/**
 * Test x402 payment flow against aibtc.news classifieds endpoint.
 *
 * Uses direct fetch (like test-sponsored-inbox.ts) instead of the
 * axios interceptor chain — simpler, no retry spiral risk.
 *
 * Flow: POST → 402 → parse requirements → build sponsored tx → encode payload → POST with payment header
 *
 * Modes:
 *   --dry-run   (default) Probe only — shows payment requirements without paying
 *   --pay       Execute full flow — pays 30k sats sBTC
 *
 * Usage:
 *   TEST_WALLET_PASSWORD=<password> TEST_WALLET_NAME=<name> npx tsx tests/scripts/test-x402-classifieds.ts [--dry-run|--pay]
 */

import {
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
} from "@stacks/transactions";
import { decodePaymentRequired, encodePaymentPayload, X402_HEADERS } from "x402-stacks";
import { getWalletManager, type WalletManager } from "../../src/services/wallet-manager.js";
import { getAccount, NETWORK, checkSufficientBalance } from "../../src/services/x402.service.js";
import { getStacksNetwork } from "../../src/config/networks.js";
import { getContracts, parseContractId } from "../../src/config/contracts.js";

const CLASSIFIEDS_URL = "https://aibtc.news/api/classifieds";

const TEST_CLASSIFIED = {
  category: "agents",
  headline: "AIBTC MCP Server — give your AI agent a Bitcoin wallet and 200+ tools",
  body: "npx @aibtc/mcp-server@latest --install. Trade on ALEX, Zest, Bitflow. Transfer STX/BTC. File signals on aibtc.news. Deploy x402 paid APIs. All from Claude Code or any MCP client.",
};

const WALLET_PASSWORD = process.env.TEST_WALLET_PASSWORD || "";
const WALLET_NAME = process.env.TEST_WALLET_NAME || "";
const PAY_MODE = process.argv.includes("--pay");

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
  const btcAddress = wm.getSessionInfo()?.btcAddress;
  console.log("  address:", account.address);
  console.log("  btcAddress:", btcAddress);
  console.log("  network:", account.network);

  // Build body with btc_address (required by classifieds API)
  const postBody = { ...TEST_CLASSIFIED, btc_address: btcAddress };

  // 2. POST without payment → 402
  console.log("\n[2] POST without payment...");
  const initialRes = await fetch(CLASSIFIEDS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postBody),
    signal: AbortSignal.timeout(30000),
  });
  console.log("  status:", initialRes.status);

  if (initialRes.status !== 402) {
    console.log("  body:", await initialRes.text());
    console.log("  Expected 402, got", initialRes.status);
    return;
  }

  // 3. Parse payment requirements
  console.log("\n[3] Parsing payment-required header...");
  const paymentHeader = initialRes.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
  if (!paymentHeader) throw new Error("Missing payment-required header");
  const paymentRequired = decodePaymentRequired(paymentHeader);
  if (!paymentRequired?.accepts?.length) throw new Error("No accepted payment methods");
  const accept = paymentRequired.accepts[0];
  const amount = BigInt(accept.amount);
  console.log("  amount:", accept.amount, "asset:", accept.asset);
  console.log("  payTo:", accept.payTo);
  console.log("  network:", accept.network);

  // 4. Balance check
  console.log("\n[4] Balance check...");
  await checkSufficientBalance(account, accept.amount, accept.asset, true);
  console.log("  OK — sufficient balance");

  if (!PAY_MODE) {
    console.log("\n  DRY RUN — skipping payment. Use --pay to execute.");
    console.log("\nPROBE TEST PASSED");
    return;
  }

  // 5. Build sponsored sBTC transfer
  console.log("\n[5] Building sponsored tx...");
  const contracts = getContracts(NETWORK);
  const { address: contractAddress, name: contractName } = parseContractId(contracts.SBTC_TOKEN);
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
    sponsored: true,
    fee: 0n,
  });
  const txHex = "0x" + transaction.serialize();
  console.log("  txHex length:", txHex.length, "prefix:", txHex.substring(0, 12));

  // 6. Encode PaymentPayloadV2
  console.log("\n[6] Encoding PaymentPayloadV2...");
  const resourceUrl = paymentRequired.resource?.url || CLASSIFIEDS_URL;
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
  } as Parameters<typeof encodePaymentPayload>[0]);
  console.log("  signature length:", paymentSignature.length);

  // 7. POST with payment header
  console.log("\n[7] Sending with payment-signature...");
  const finalRes = await fetch(CLASSIFIEDS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    console.log("\nSUCCESS — classified ad placed!");
  } else {
    // Log payment-required header if present (helps debug settlement failures)
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
