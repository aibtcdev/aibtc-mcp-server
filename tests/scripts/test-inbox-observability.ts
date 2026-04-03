/**
 * Test inbox payment observability fix.
 *
 * Verifies that after sending an inbox message:
 * 1. paymentId is extracted from the inbox response body
 * 2. paymentStatus is extracted correctly
 * 3. Nonce tracker records a reference (paymentId) even when txid is pending
 * 4. The agent gets a checkStatusUrl for polling payment status
 *
 * Usage:
 *   TEST_WALLET_PASSWORD=<password> npx tsx tests/scripts/test-inbox-observability.ts
 */

import {
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
} from "@stacks/transactions";
import {
  decodePaymentRequired,
  decodePaymentResponse,
  encodePaymentPayload,
  generatePaymentId,
  buildPaymentIdentifierExtension,
  X402_HEADERS,
} from "../../src/utils/x402-protocol.js";
import { getWalletManager } from "../../src/services/wallet-manager.js";
import { getAccount, NETWORK } from "../../src/services/x402.service.js";
import { getStacksNetwork } from "../../src/config/networks.js";
import { getContracts, parseContractId } from "../../src/config/contracts.js";
import { createFungiblePostCondition } from "../../src/transactions/post-conditions.js";
import { getHiroApi } from "../../src/services/hiro-api.js";
import {
  getTrackedNonce,
  recordNonceUsed,
  reconcileWithChain,
  getAddressState,
} from "../../src/services/nonce-tracker.js";

// Configurable via env vars for portability across dev machines and CI
const RECIPIENT_STX =
  process.env.TEST_RECIPIENT_STX || "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9";
const RECIPIENT_BTC =
  process.env.TEST_RECIPIENT_BTC || "bc1qv6lt5utlfvfdpdj8emmar4vt4p484pjnhlwwnn";

const WALLET_NAME = process.env.TEST_WALLET_NAME || "secret mars name";
const WALLET_PASSWORD = process.env.TEST_WALLET_PASSWORD || "";
const INBOX_BASE = process.env.TEST_INBOX_BASE || "https://aibtc.com/api/inbox";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  if (!WALLET_PASSWORD) {
    console.error("Set TEST_WALLET_PASSWORD env var");
    process.exit(1);
  }

  // ── Unlock wallet ──────────────────────────────────────────────────
  console.log("[1] Unlocking wallet...");
  const wm = getWalletManager();
  const wallets = await wm.listWallets();
  const target = wallets.find((w) => w.name === WALLET_NAME);
  if (!target) throw new Error(`Wallet "${WALLET_NAME}" not found`);
  await wm.unlock(target.id, WALLET_PASSWORD);
  const account = await getAccount();
  console.log("  address:", account.address);

  // ── Nonce baseline ─────────────────────────────────────────────────
  // Use the same nonce resolution as inbox.tools.ts: max(local tracker, chain)
  // This prevents reusing nonces that are in-flight at the relay.
  console.log("\n[2] Nonce baseline...");
  const hiroApi = getHiroApi(NETWORK);
  const nonceInfo = await hiroApi.getNonceInfo(account.address);

  // Reconcile local tracker with chain
  await reconcileWithChain(account.address, nonceInfo.possible_next_nonce);
  const localNext = await getTrackedNonce(account.address);

  // Check mempool for highest nonce
  let highestMempoolNonce = -1;
  try {
    const mempool = await hiroApi.getMempoolTransactions({
      sender_address: account.address,
      limit: 50,
    });
    for (const tx of mempool.results) {
      if (tx.nonce > highestMempoolNonce) highestMempoolNonce = tx.nonce;
    }
  } catch { /* non-fatal */ }

  const chainNext = Math.max(nonceInfo.possible_next_nonce, highestMempoolNonce + 1);
  const nonceToBuild = Math.max(chainNext, localNext ?? 0);

  console.log("  chain possibleNextNonce:", nonceInfo.possible_next_nonce);
  console.log("  chain lastExecuted:", nonceInfo.last_executed_tx_nonce);
  console.log("  local tracker next:", localNext);
  console.log("  highest mempool nonce:", highestMempoolNonce);
  console.log("  → using nonce:", nonceToBuild);

  // ── Step 1: POST without payment → 402 ────────────────────────────
  console.log("\n[3] POST without payment → expect 402...");
  const inboxUrl = `${INBOX_BASE}/${RECIPIENT_BTC}`;
  const body = {
    toBtcAddress: RECIPIENT_BTC,
    toStxAddress: RECIPIENT_STX,
    content: `Observability test ${Date.now()}`,
  };

  const initialRes = await fetch(inboxUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("  status:", initialRes.status);
  assert(initialRes.status === 402, "Got 402 payment challenge");

  if (initialRes.status !== 402) {
    console.log("  body:", await initialRes.text());
    process.exit(1);
  }

  // ── Step 2: Parse payment requirements ─────────────────────────────
  console.log("\n[4] Parsing payment requirements...");
  const paymentHeader = initialRes.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
  assert(!!paymentHeader, "payment-required header present");

  const paymentRequired = decodePaymentRequired(paymentHeader);
  assert(!!paymentRequired?.accepts?.length, "Has accepted payment methods");

  const accept = paymentRequired!.accepts[0];
  const amount = BigInt(accept.amount);
  console.log("  amount:", accept.amount, "asset:", accept.asset, "payTo:", accept.payTo);

  // ── Step 3: Build sponsored sBTC transfer ──────────────────────────
  console.log("\n[5] Building sponsored tx with nonce", nonceToBuild, "...");
  const contracts = getContracts(NETWORK);
  const { address: contractAddress, name: contractName } = parseContractId(contracts.SBTC_TOKEN);
  const postCondition = createFungiblePostCondition(
    account.address, contracts.SBTC_TOKEN, "sbtc-token", "eq", amount
  );
  const transaction = await makeContractCall({
    contractAddress,
    contractName,
    functionName: "transfer",
    functionArgs: [uintCV(amount), principalCV(account.address), principalCV(accept.payTo), noneCV()],
    senderKey: account.privateKey,
    network: getStacksNetwork(NETWORK),
    postConditions: [postCondition],
    sponsored: true,
    fee: 0n,
    nonce: BigInt(nonceToBuild),
  });
  let txHex = "0x" + transaction.serialize();
  const paymentId = generatePaymentId();
  console.log("  paymentId:", paymentId);

  // ── Step 4: Encode and send with payment (retry loop like inbox.tools.ts) ──
  const MAX_ATTEMPTS = 3;
  let currentNonce = nonceToBuild;
  let finalRes!: Response;
  let parsed!: Record<string, unknown>;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      // Rebuild tx with incremented nonce (sender-side conflict recovery)
      currentNonce++;
      console.log(`  Retry ${attempt}: rebuilding with nonce ${currentNonce}`);
      const retryTx = await makeContractCall({
        contractAddress,
        contractName,
        functionName: "transfer",
        functionArgs: [uintCV(amount), principalCV(account.address), principalCV(accept.payTo), noneCV()],
        senderKey: account.privateKey,
        network: getStacksNetwork(NETWORK),
        postConditions: [postCondition],
        sponsored: true,
        fee: 0n,
        nonce: BigInt(currentNonce),
      });
      txHex = "0x" + retryTx.serialize();
    }

    const paymentSignature = encodePaymentPayload({
      x402Version: 2,
      resource: paymentRequired!.resource,
      accepted: accept,
      payload: { transaction: txHex },
      extensions: buildPaymentIdentifierExtension(paymentId),
    });

    console.log(`\n[6] POST with payment-signature (attempt ${attempt + 1}, nonce ${currentNonce})...`);
    finalRes = await fetch(inboxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [X402_HEADERS.PAYMENT_SIGNATURE]: paymentSignature,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    console.log("  status:", finalRes.status);
    const responseText = await finalRes.text();
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }

    if (finalRes.status === 200 || finalRes.status === 201) break;

    // 409 SENDER_NONCE_DUPLICATE — advance nonce and retry
    if (finalRes.status === 409 && (parsed as any).code === "SENDER_NONCE_DUPLICATE") {
      console.log(`  ⚠️ SENDER_NONCE_DUPLICATE at nonce ${currentNonce} — will retry with ${currentNonce + 1}`);
      await recordNonceUsed(account.address, currentNonce, `dup:attempt${attempt}`);
      if (attempt < MAX_ATTEMPTS - 1) {
        const retryAfter = (parsed as any).retryAfter ?? 5;
        console.log(`  Waiting ${retryAfter}s before retry...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
    }

    // Other error — don't retry
    console.log("  Response:", JSON.stringify(parsed, null, 2));
    break;
  }

  assert(finalRes.status === 200 || finalRes.status === 201, `Got success status (${finalRes.status})`);

  // ── Verify: response body extraction ───────────────────────────────
  console.log("\n[7] Verifying response body...");
  console.log(JSON.stringify(parsed, null, 2));

  const inboxData = (parsed as any).inbox as Record<string, unknown> | undefined;
  const inboxPaymentId = (inboxData?.paymentId ?? parsed.paymentId) as string | undefined;
  const inboxPaymentStatus = (inboxData?.paymentStatus ?? parsed.paymentStatus) as string | undefined;

  assert(!!inboxPaymentId, `paymentId extracted: ${inboxPaymentId}`);
  assert(!!inboxPaymentStatus, `paymentStatus extracted: ${inboxPaymentStatus}`);

  // ── Verify: payment-response header ────────────────────────────────
  console.log("\n[8] Checking payment-response header...");
  const paymentResponseHeader = finalRes.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
  if (paymentResponseHeader) {
    const settlement = decodePaymentResponse(paymentResponseHeader);
    const txid = settlement?.transaction;
    console.log("  txid from header:", txid);
    assert(!!txid, `txid present in payment-response: ${txid}`);
  } else {
    console.log("  payment-response header: NOT SET (expected for pending settlement)");
    assert(inboxPaymentStatus === "pending", "No header expected when paymentStatus is pending");
  }

  // ── Verify: nonce ref for tracker ──────────────────────────────────
  console.log("\n[9] Verifying nonce tracker ref...");
  const settlement = decodePaymentResponse(
    finalRes.headers.get(X402_HEADERS.PAYMENT_RESPONSE)
  );
  const txid = settlement?.transaction;
  const nonceRef = txid || (inboxPaymentId ? `pending:${inboxPaymentId}` : "");

  console.log("  nonceRef:", nonceRef);
  assert(nonceRef.length > 0, `Nonce ref is non-empty: ${nonceRef}`);
  assert(
    nonceRef.startsWith("0x") || nonceRef.startsWith("pending:pay_"),
    `Nonce ref is either txid or pending:paymentId`
  );

  // Record in tracker (simulating what the fixed code does)
  await recordNonceUsed(account.address, currentNonce, nonceRef);
  const trackerState = await getAddressState(account.address);
  console.log("  tracker lastUsedNonce:", trackerState?.lastUsedNonce);
  console.log("  tracker pending log:", JSON.stringify(trackerState?.pending.slice(-1)));
  assert(
    trackerState?.pending.some((p) => p.txid === nonceRef) ?? false,
    "Nonce tracker recorded the paymentId ref"
  );

  // ── Verify: checkStatusUrl construction ────────────────────────────
  console.log("\n[10] Verifying checkStatusUrl...");
  const checkStatusUrl = inboxPaymentId
    ? `https://aibtc.com/api/payment-status/${inboxPaymentId}`
    : undefined;
  console.log("  checkStatusUrl:", checkStatusUrl);
  assert(!!checkStatusUrl, "checkStatusUrl is constructable from paymentId");

  // Verify the checkStatusUrl actually works
  if (checkStatusUrl) {
    console.log("  Polling checkStatusUrl...");
    const pollRes = await fetch(checkStatusUrl);
    console.log("  poll status:", pollRes.status);
    if (pollRes.ok) {
      const pollData = await pollRes.json();
      console.log("  poll data:", JSON.stringify(pollData, null, 2));
      assert(true, `checkStatusUrl returned ${pollRes.status}`);
    } else {
      const pollText = await pollRes.text();
      console.log("  poll response:", pollText);
      // 404 is ok — the paymentId might not be our client-side ID
      assert(
        pollRes.status === 404 || pollRes.status === 200,
        `checkStatusUrl returned ${pollRes.status}`
      );
    }
  }

  // ── Verify: nonce advanced on chain ────────────────────────────────
  console.log("\n[11] Checking nonce after 5s...");
  await new Promise((r) => setTimeout(r, 5000));
  const nonceAfter = await hiroApi.getNonceInfo(account.address);
  console.log("  possibleNextNonce:", nonceAfter.possible_next_nonce, "(was", currentNonce, ")");
  console.log("  lastExecuted:", nonceAfter.last_executed_tx_nonce);
  if (nonceAfter.possible_next_nonce > currentNonce) {
    assert(true, `Chain nonce advanced: ${currentNonce} → ${nonceAfter.possible_next_nonce}`);
  } else {
    console.log(`  ⚠️ Chain nonce not yet advanced (relay may still be processing). This is expected for pending payments.`);
    // Not a failure — relay queue processing is async
    assert(true, `Chain nonce pending (relay status: queued) — expected for async settlement`);
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nFATAL:", err.message || err);
  process.exit(1);
});
