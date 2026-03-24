/**
 * Test x402 payment flow against aibtc.news classifieds endpoint.
 *
 * Validates that settlement failures surface detailed error messages
 * (fix for blind "Payment retry limit exceeded" errors).
 *
 * Modes:
 *   --dry-run   (default) Probe only — shows payment requirements without paying
 *   --pay       Execute with autoApprove — actually pays 30k sats sBTC
 *
 * Usage:
 *   TEST_WALLET_PASSWORD=<password> npx tsx tests/scripts/test-x402-classifieds.ts [--dry-run|--pay]
 */

import { getWalletManager } from "../../src/services/wallet-manager.js";
import {
  getAccount,
  createApiClient,
  probeEndpoint,
  checkSufficientBalance,
  formatPaymentAmount,
  detectTokenType,
} from "../../src/services/x402.service.js";

const CLASSIFIEDS_URL = "https://aibtc.news/api/classifieds";

const TEST_CLASSIFIED = {
  category: "agents",
  headline: "AIBTC MCP Server — give your AI agent a Bitcoin wallet and 200+ tools",
  body: "npx @aibtc/mcp-server@latest --install. Trade on ALEX, Zest, Bitflow. Transfer STX/BTC. File signals on aibtc.news. Deploy x402 paid APIs. All from Claude Code or any MCP client.",
};

const WALLET_PASSWORD = process.env.TEST_WALLET_PASSWORD || "";
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
  const target = wallets[0];
  await wm.unlock(target.id, WALLET_PASSWORD);
  const account = await getAccount();
  console.log("  address:", account.address);
  console.log("  network:", account.network);

  // 2. Probe endpoint — verify it returns 402 with sBTC payment requirements
  console.log("\n[2] Probing classifieds endpoint...");
  const probe = await probeEndpoint({
    method: "POST",
    url: CLASSIFIEDS_URL,
    data: TEST_CLASSIFIED,
  });
  console.log("  type:", probe.type);

  if (probe.type === "free") {
    console.log("  Unexpected: endpoint is free. Response:", JSON.stringify(probe.data));
    return;
  }

  const { amount, asset, recipient, network } = probe;
  const tokenType = detectTokenType(asset);
  const formattedCost = formatPaymentAmount(amount, asset);
  console.log("  cost:", formattedCost);
  console.log("  token:", tokenType);
  console.log("  asset:", asset);
  console.log("  recipient:", recipient);
  console.log("  network:", network);

  // 3. Balance check
  console.log("\n[3] Checking balance...");
  try {
    await checkSufficientBalance(account, amount, asset, true);
    console.log("  OK — sufficient balance");
  } catch (err) {
    console.error("  INSUFFICIENT:", (err as Error).message);
    process.exit(1);
  }

  if (!PAY_MODE) {
    console.log("\n[4] DRY RUN — skipping payment. Use --pay to execute.");
    console.log("  Would pay:", formattedCost, "to", recipient);
    console.log("\nPROBE TEST PASSED");
    return;
  }

  // 4. Execute with payment via createApiClient (exercises the interceptor chain)
  console.log("\n[4] Executing with payment (autoApprove)...");
  console.log("  Creating API client with payment interceptor...");

  const api = await createApiClient("https://aibtc.news", {
    onBeforePayment: async (requirements) => {
      console.log("  onBeforePayment callback fired:");
      console.log("    amount:", requirements.amount);
      console.log("    asset:", requirements.asset);
      console.log("    recipient:", requirements.recipient);
      await checkSufficientBalance(requirements.account, requirements.amount, requirements.asset, true);
      console.log("    balance check: OK");
    },
  });

  try {
    const response = await api.request({
      method: "POST",
      url: "/api/classifieds",
      data: TEST_CLASSIFIED,
    });

    console.log("\n  status:", response.status);
    console.log("  data:", JSON.stringify(response.data, null, 2));
    console.log("\nSUCCESS — classified ad placed!");
  } catch (err: unknown) {
    const error = err as Error & {
      response?: { status?: number; data?: unknown; headers?: Record<string, string> };
      config?: { headers?: Record<string, string> };
    };

    console.error("\n  PAYMENT FLOW ERROR:");
    console.error("  message:", error.message);

    // Verify our fix: the error should now include settlement response details
    if (error.message.includes("Settlement response:")) {
      console.log("\n  FIX VERIFIED — settlement failure details are visible in error message");
    } else {
      console.log("\n  NOTE — error did not include settlement details (may be a different failure mode)");
    }

    // Check if axios properties are preserved (for txid recovery)
    if (error.config?.headers?.["payment-signature"]) {
      console.log("  FIX VERIFIED — payment-signature header preserved on error (txid recovery possible)");
    }

    if (error.response) {
      console.log("  response status:", error.response.status);
      console.log("  response data:", JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nERROR:", err.message || err);
  process.exit(1);
});
