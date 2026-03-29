/**
 * Test filing a news signal on aibtc.news via x402 payment + BIP-322 auth.
 *
 * The /api/signals endpoint requires BOTH:
 * 1. x402 payment (sBTC sponsored tx) — same as classifieds
 * 2. BIP-322 auth headers (X-BTC-Address, X-BTC-Signature, X-BTC-Timestamp)
 *
 * Modes:
 *   --dry-run   (default) Probe only — shows payment requirements without paying
 *   --pay       Execute full flow — pays x402 fee and files signal
 *
 * Usage:
 *   TEST_WALLET_PASSWORD=<password> TEST_WALLET_NAME=<name> npx tsx tests/scripts/test-news-file-signal.ts [--dry-run|--pay]
 */

import {
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
} from "@stacks/transactions";
import {
  p2wpkh,
  NETWORK as BTC_MAINNET,
  TEST_NETWORK as BTC_TESTNET,
} from "@scure/btc-signer";
import { decodePaymentRequired, encodePaymentPayload, X402_HEADERS } from "../../src/utils/x402-protocol.js";
import { getWalletManager } from "../../src/services/wallet-manager.js";
import { getAccount, NETWORK, checkSufficientBalance } from "../../src/services/x402.service.js";
import { getStacksNetwork } from "../../src/config/networks.js";
import { getContracts, parseContractId } from "../../src/config/contracts.js";
import { createFungiblePostCondition } from "../../src/transactions/post-conditions.js";
import { bip322Sign } from "../../src/utils/bip322.js";

const SIGNALS_URL = process.env.SIGNALS_URL || "http://localhost:8787/api/signals";

const TEST_SIGNAL = {
  beat_slug: "agent-intel",
  headline: "AIBTC MCP Server v1.46 ships Zest collateral management",
  body: "The latest release adds zest_enable_collateral, letting agents toggle supplied assets as borrowing collateral directly from Claude Code or any MCP client. This rounds out the Zest DeFi integration with supply, borrow, repay, withdraw, and now collateral control.",
  sources: [
    {
      url: "https://github.com/aibtcdev/aibtc-mcp-server",
      title: "aibtc-mcp-server GitHub repository",
    },
  ],
  tags: ["stacks", "defi", "zest", "mcp", "agents"],
  disclosure: "claude-opus-4-6, aibtc MCP tools, test script",
};

const WALLET_PASSWORD = process.env.TEST_WALLET_PASSWORD || "";
const WALLET_NAME = process.env.TEST_WALLET_NAME || "";
const PAY_MODE = process.argv.includes("--pay");

/**
 * Build BIP-322 auth headers for aibtc.news.
 * Message format: "METHOD /path:unix_timestamp"
 */
function buildAuthHeaders(
  method: string,
  path: string,
  btcAddress: string,
  btcPrivateKey: Uint8Array,
  btcPublicKey: Uint8Array,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${method} ${path}:${timestamp}`;

  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(btcPublicKey, btcNetwork).script;
  const signature = bip322Sign(message, btcPrivateKey, scriptPubKey);

  return {
    "X-BTC-Address": btcAddress,
    "X-BTC-Signature": signature,
    "X-BTC-Timestamp": String(timestamp),
  };
}

async function main() {
  if (!WALLET_PASSWORD) {
    console.error("Set TEST_WALLET_PASSWORD env var");
    process.exit(1);
  }

  // 1. Unlock wallet
  console.log("[1] Unlocking wallet...");
  const wm = getWalletManager();
  const wallets = await wm.listWallets();
  if (wallets.length === 0) throw new Error("No wallets found");
  console.log("  available wallets:", wallets.map(w => `${w.name} (${w.id})`).join(", "));
  const target = WALLET_NAME
    ? wallets.find(w => w.name === WALLET_NAME) || wallets[0]
    : wallets[0];
  console.log("  using wallet:", target.name, `(${target.id})`);
  await wm.unlock(target.id, WALLET_PASSWORD);
  const account = await getAccount();
  const session = wm.getSessionInfo();
  const btcAddress = session?.btcAddress;
  console.log("  stx address:", account.address);
  console.log("  btc address:", btcAddress);
  console.log("  network:", account.network);

  if (!btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
    throw new Error("Bitcoin keys not available from wallet");
  }

  if (!btcAddress.startsWith("bc1q") && !btcAddress.startsWith("tb1q")) {
    throw new Error(
      `aibtc.news requires P2WPKH (bc1q) address. Got: ${btcAddress}`
    );
  }

  // Build POST body
  const postBody = {
    ...TEST_SIGNAL,
    btc_address: btcAddress,
  };

  // 2. Build BIP-322 auth headers
  console.log("\n[2] Building BIP-322 auth headers...");
  const authHeaders = buildAuthHeaders(
    "POST",
    "/api/signals",
    btcAddress,
    account.btcPrivateKey,
    account.btcPublicKey,
  );
  console.log("  X-BTC-Address:", authHeaders["X-BTC-Address"]);
  console.log("  X-BTC-Timestamp:", authHeaders["X-BTC-Timestamp"]);
  console.log("  X-BTC-Signature:", authHeaders["X-BTC-Signature"].substring(0, 40) + "...");

  // 3. POST without payment → expect 402
  console.log("\n[3] POST with auth but no payment...");
  const initialRes = await fetch(SIGNALS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(postBody),
    signal: AbortSignal.timeout(60000),
  });
  console.log("  status:", initialRes.status);

  if (initialRes.status !== 402) {
    const text = await initialRes.text();
    console.log("  body:", text);
    if (initialRes.status === 200 || initialRes.status === 201) {
      console.log("\nSignal filed WITHOUT x402 payment (endpoint may not require payment)");
      return;
    }
    console.log("\n  Expected 402, got", initialRes.status);
    process.exit(1);
  }

  // 4. Parse payment requirements
  console.log("\n[4] Parsing payment-required header...");
  const paymentHeader = initialRes.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
  if (!paymentHeader) throw new Error("Missing payment-required header");
  const paymentRequired = decodePaymentRequired(paymentHeader);
  if (!paymentRequired?.accepts?.length) throw new Error("No accepted payment methods");
  const accept = paymentRequired.accepts[0];
  const amount = BigInt(accept.amount);
  console.log("  amount:", accept.amount, "asset:", accept.asset);
  console.log("  payTo:", accept.payTo);
  console.log("  network:", accept.network);

  // 5. Balance check
  console.log("\n[5] Balance check...");
  await checkSufficientBalance(account, accept.amount, accept.asset, true);
  console.log("  OK — sufficient balance");

  if (!PAY_MODE) {
    console.log("\n  DRY RUN — skipping payment. Use --pay to execute.");
    console.log("\nPROBE TEST PASSED");
    return;
  }

  // 6. Build sponsored sBTC transfer
  console.log("\n[6] Building sponsored tx...");
  const contracts = getContracts(NETWORK);
  const { address: contractAddress, name: contractName } = parseContractId(contracts.SBTC_TOKEN);
  const postCondition = createFungiblePostCondition(
    account.address,
    contracts.SBTC_TOKEN,
    "sbtc-token",
    "eq",
    amount
  );
  const transaction = await makeContractCall({
    contractAddress,
    contractName,
    functionName: "transfer",
    functionArgs: [
      uintCV(amount),
      principalCV(account.address),
      principalCV(accept.payTo),
      noneCV(),
    ],
    senderKey: account.privateKey,
    network: getStacksNetwork(NETWORK),
    postConditions: [postCondition],
    sponsored: true,
    fee: 0n,
  });
  const txHex = "0x" + transaction.serialize();
  console.log("  txHex length:", txHex.length, "prefix:", txHex.substring(0, 12));

  // 7. Encode PaymentPayloadV2
  console.log("\n[7] Encoding PaymentPayloadV2...");
  const resourceUrl = paymentRequired.resource?.url || SIGNALS_URL;
  const paymentSignature = encodePaymentPayload({
    x402Version: 2,
    resource: {
      url: resourceUrl,
      description: paymentRequired.resource?.description || "",
      mimeType: paymentRequired.resource?.mimeType || "application/json",
    },
    accepted: {
      scheme: accept.scheme || "exact",
      network: accept.network,
      asset: accept.asset,
      amount: accept.amount,
      payTo: accept.payTo,
      maxTimeoutSeconds: accept.maxTimeoutSeconds || 300,
      extra: accept.extra || {},
    },
    payload: { transaction: txHex },
  });
  console.log("  signature length:", paymentSignature.length);

  // 8. POST with both auth headers AND payment header
  // Rebuild auth headers with fresh timestamp for the final request
  const finalAuthHeaders = buildAuthHeaders(
    "POST",
    "/api/signals",
    btcAddress,
    account.btcPrivateKey,
    account.btcPublicKey,
  );

  console.log("\n[8] Sending with payment + auth headers...");
  const finalRes = await fetch(SIGNALS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...finalAuthHeaders,
      [X402_HEADERS.PAYMENT_SIGNATURE]: paymentSignature,
    },
    body: JSON.stringify(postBody),
    signal: AbortSignal.timeout(120000),
  });

  console.log("  status:", finalRes.status);
  const responseData = await finalRes.text();
  let parsed: unknown;
  try { parsed = JSON.parse(responseData); } catch { parsed = responseData; }
  console.log("  data:", JSON.stringify(parsed, null, 2));

  const paymentResponse = finalRes.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
  if (paymentResponse) {
    try {
      const decoded = JSON.parse(Buffer.from(paymentResponse, "base64").toString());
      console.log("  payment-response:", JSON.stringify(decoded, null, 2));
    } catch {
      console.log("  payment-response (raw):", paymentResponse);
    }
  }

  if (finalRes.status === 200 || finalRes.status === 201) {
    console.log("\nSUCCESS — signal filed!");
  } else {
    const retryPaymentHeader = finalRes.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
    if (retryPaymentHeader) {
      console.log("  payment-required header present (settlement rejected by relay)");
    }
    console.log("\nFAILED — status", finalRes.status);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nERROR:", err.message || err);
  process.exit(1);
});
