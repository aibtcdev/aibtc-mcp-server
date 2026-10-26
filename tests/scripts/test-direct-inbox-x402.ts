/**
 * Test the x402 inbox path used by the `send_inbox_message_direct` tool.
 *
 * x402-stacks signs a SPONSORED sBTC transfer (fee 0, facilitator pays gas)
 * when the inbox 402 advertises `extra.feePayer`, and a STANDARD-auth one
 * (sender pays gas) otherwise. This script drives the real interceptor and
 * asserts the signed tx matches what the inbox advertised.
 *
 * Modes:
 *   DRY (default) — Probe the inbox 402, let x402-stacks sign the payment,
 *                   then INTERCEPT and abort before broadcast. Deserializes the
 *                   signed tx and asserts its auth type (and fee 0 when
 *                   sponsored). Spends nothing.
 *
 *   SEND=1        — Actually deliver the message. Costs real sBTC (+ STX gas
 *                   when not sponsored) on mainnet. Afterwards fetches the tx
 *                   from Hiro and asserts `sponsored` matches and the sender paid.
 *
 * Usage:
 *   # dry run with env mnemonic
 *   CLIENT_MNEMONIC="..." npx tsx tests/scripts/test-direct-inbox-x402.ts
 *
 *   # dry run with a managed wallet
 *   TEST_WALLET_NAME="my wallet" TEST_WALLET_PASSWORD=pw npx tsx tests/scripts/test-direct-inbox-x402.ts
 *
 *   # live send
 *   SEND=1 CLIENT_MNEMONIC="..." npx tsx tests/scripts/test-direct-inbox-x402.ts
 */

import axios from "axios";
import {
  wrapAxiosWithPayment,
  decodePaymentRequired,
  decodePaymentResponse,
  X402_HEADERS,
  type StacksAccount,
} from "x402-stacks";
import {
  deserializeTransaction,
  AuthType,
  type StacksTransactionWire,
} from "@stacks/transactions";
import { getWalletManager } from "../../src/services/wallet-manager.js";
import { getAccount, NETWORK } from "../../src/services/x402.service.js";
import { checkDirectInboxBalance } from "../../src/tools/inbox-x402.tools.js";
import { getHiroApi } from "../../src/services/hiro-api.js";

// Default recipient (overridable via env). bc1q + SP address of a known agent.
const RECIPIENT_BTC =
  process.env.RECIPIENT_BTC || "bc1qyu22hyqr406pus0g9jmfytk4ss5z8qsje74l76";
const RECIPIENT_STX =
  process.env.RECIPIENT_STX || "SPKH9AWG0ENZ87J1X0PBD4HETP22G8W22AFNVF8K";
const CONTENT =
  process.env.CONTENT ||
  "x402 inbox test message.";

const INBOX_BASE = "https://aibtc.com/api/inbox";
const SEND = process.env.SEND === "1";

// Sentinel thrown by the dry-run request interceptor to abort before broadcast.
const ABORT_SENTINEL = "__DRY_RUN_ABORT__";

interface CapturedSignedTx {
  txHex: string;
}

function decodePaymentSignatureHeader(value: unknown): { transaction?: string } | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const json = Buffer.from(value, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
}

async function unlockWallet(): Promise<void> {
  const name = process.env.TEST_WALLET_NAME;
  const password = process.env.TEST_WALLET_PASSWORD;
  if (name && password) {
    const wm = getWalletManager();
    const wallets = await wm.listWallets();
    const target = wallets.find((w) => w.name === name);
    if (!target) throw new Error(`Managed wallet not found: ${name}`);
    await wm.unlock(target.id, password);
    console.log(`  unlocked managed wallet: ${name}`);
  } else if (!process.env.CLIENT_MNEMONIC) {
    throw new Error(
      "No wallet. Set CLIENT_MNEMONIC, or TEST_WALLET_NAME + TEST_WALLET_PASSWORD."
    );
  }
}

async function main() {
  console.log(`\n=== x402 inbox test — mode: ${SEND ? "SEND" : "DRY"} ===\n`);

  if (NETWORK !== "mainnet") {
    throw new Error(`Inbox is mainnet-only; NETWORK=${NETWORK}`);
  }

  console.log("[1] Unlocking wallet...");
  await unlockWallet();
  const account = await getAccount();
  console.log("  sender:", account.address);

  const inboxUrl = `${INBOX_BASE}/${RECIPIENT_BTC}`;
  const body = {
    toBtcAddress: RECIPIENT_BTC,
    toStxAddress: RECIPIENT_STX,
    content: CONTENT,
  };

  // [2] Probe the 402 (no payment) — mirrors the tool's pre-flight.
  console.log("\n[2] Probing inbox for 402...");
  const probe = await fetch(inboxUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  console.log("  status:", probe.status);
  if (probe.status !== 402) {
    console.log("  body:", await probe.text());
    throw new Error(`Expected 402, got ${probe.status}`);
  }
  const paymentRequired = decodePaymentRequired(
    probe.headers.get(X402_HEADERS.PAYMENT_REQUIRED)
  );
  if (!paymentRequired?.accepts?.length) throw new Error("No payment requirements");
  const accept = paymentRequired.accepts[0];
  console.log("  amount:", accept.amount, "asset:", accept.asset, "payTo:", accept.payTo);
  const expectSponsored = typeof accept.extra?.feePayer === "string";
  console.log("  feePayer:", accept.extra?.feePayer ?? "(none — sender pays gas)");

  // [3] Balance check — exercise the tool's own checkDirectInboxBalance
  // (sBTC for the message + a realistic STX gas budget), not a separate helper.
  // In DRY mode we never broadcast, so a shortfall is informational only —
  // we still want to reach the signing-inspection step. In SEND mode it's fatal.
  console.log(`\n[3] Balance check (sBTC${expectSponsored ? "" : " + STX gas"})...`);
  try {
    await checkDirectInboxBalance(account.address, accept.amount, expectSponsored);
    console.log("  OK — sufficient balance");
  } catch (err) {
    if (SEND) throw err;
    console.log("  ⚠️  (dry mode, non-fatal):", err instanceof Error ? err.message : err);
    console.log("  Note: SEND=1 would require this to pass.");
  }

  // [4] Build the x402-stacks payment client.
  const stacksAccount: StacksAccount = {
    address: account.address,
    privateKey: account.privateKey,
    network: NETWORK,
  };
  const api = wrapAxiosWithPayment(axios.create({ timeout: 120_000 }), stacksAccount);

  if (!SEND) {
    // DRY: capture the signed tx from the retried request and abort before it
    // hits the network. The retry carries the payment-signature header.
    const captured: Partial<CapturedSignedTx> = {};
    api.interceptors.request.use((config) => {
      const sigHeader = config.headers?.[X402_HEADERS.PAYMENT_SIGNATURE];
      if (sigHeader) {
        const payload = decodePaymentSignatureHeader(sigHeader);
        if (payload?.transaction) {
          captured.txHex = payload.transaction;
          throw new Error(ABORT_SENTINEL);
        }
      }
      return config;
    });

    console.log("\n[4] Signing payment via x402-stacks (dry — will abort before broadcast)...");
    try {
      await api.post(inboxUrl, body, {
        headers: { "Content-Type": "application/json" },
      });
      throw new Error("Expected dry-run abort, but request completed");
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes(ABORT_SENTINEL)) {
        throw err;
      }
    }

    if (!captured.txHex) {
      throw new Error("x402-stacks did not produce a signed payment transaction");
    }

    // [5] Deserialize and assert the auth type matches the advertised rail.
    console.log("\n[5] Inspecting the signed transaction...");
    const txHex = captured.txHex.startsWith("0x")
      ? captured.txHex.slice(2)
      : captured.txHex;
    const tx: StacksTransactionWire = deserializeTransaction(txHex);
    const authType = tx.auth.authType;
    const authName = authType === AuthType.Sponsored ? "Sponsored" : "Standard";
    console.log("  authType:", authName);
    const feeUStx = (tx.auth.spendingCondition as { fee?: bigint })?.fee;
    if (feeUStx !== undefined) {
      console.log("  fee:", feeUStx.toString(), "µSTX =", (Number(feeUStx) / 1e6).toFixed(6), "STX");
    }

    if ((authType === AuthType.Sponsored) !== expectSponsored) {
      throw new Error(
        `FAIL: transaction is ${authName} — expected ${expectSponsored ? "Sponsored" : "Standard"}`
      );
    }
    if (expectSponsored && feeUStx !== 0n) {
      throw new Error(`FAIL: sponsored tx has origin fee ${feeUStx} — expected 0`);
    }

    console.log(`\n✅ PASS — x402-stacks signed a ${authName.toUpperCase()} sBTC transfer.`);
    console.log(expectSponsored ? "   The facilitator pays the gas." : "   The sender pays its own gas.");
    console.log("   Run with SEND=1 to actually deliver the message.\n");
    return;
  }

  // [4] LIVE: deliver the message. The interceptor signs + retries.
  console.log("\n[4] Sending (LIVE) via x402-stacks interceptor...");
  const response = await api.post(inboxUrl, body, {
    headers: { "Content-Type": "application/json" },
  });
  console.log("  status:", response.status);

  const settlement = decodePaymentResponse(
    response.headers[X402_HEADERS.PAYMENT_RESPONSE]
  );
  const txid = settlement?.transaction;
  console.log("  payer:", settlement?.payer);
  console.log("  txid:", txid);
  console.log("  inbox response:", JSON.stringify(response.data));

  if (!txid) {
    console.log("\n⚠️  Delivered, but no txid in payment-response — cannot verify on-chain.");
    return;
  }

  // [5] Verify on-chain that the sponsorship matches the advertised rail.
  console.log(`\n[5] Verifying on-chain (sponsored should be ${expectSponsored})...`);
  const hiro = getHiroApi(NETWORK);
  // Poll briefly — the facilitator may have just broadcast it.
  let txData: { sponsored?: boolean; sender_address?: string; tx_status?: string } | undefined;
  for (let i = 0; i < 10; i++) {
    try {
      txData = (await hiro.getTransaction(txid)) as typeof txData;
      if (txData) break;
    } catch {
      /* not indexed yet */
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }

  if (!txData) {
    console.log("  tx not indexed yet — check the explorer:", txid);
    return;
  }
  console.log("  sponsored:", txData.sponsored);
  console.log("  sender_address:", txData.sender_address);
  console.log("  tx_status:", txData.tx_status);

  if (Boolean(txData.sponsored) !== expectSponsored) {
    throw new Error(`FAIL: on-chain sponsored=${txData.sponsored} — expected ${expectSponsored}`);
  }
  if (txData.sender_address !== account.address) {
    throw new Error(
      `FAIL: sender_address ${txData.sender_address} !== wallet ${account.address}`
    );
  }
  console.log(`\n✅ PASS — message delivered with a ${expectSponsored ? "SPONSORED" : "NON-SPONSORED"} tx.\n`);
}

main().catch((err) => {
  console.error("\n❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
