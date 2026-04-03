/**
 * Relay Diagnostic Tools
 *
 * Tools for checking sponsor relay health and diagnosing nonce issues
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { checkRelayHealth, formatRelayHealthStatus, attemptRbf, attemptFillGaps } from "../utils/relay-health.js";
import { NETWORK } from "../services/x402.service.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { forceResyncNonce } from "../transactions/builder.js";

export function registerRelayDiagnosticTools(server: McpServer): void {
  server.registerTool(
    "check_relay_health",
    {
      description: `Check the sponsor relay health and nonce status.

Use this tool for operator diagnostics around relay-owned sponsor state. It will:
- Check relay availability
- Inspect sponsor address nonce state
- Detect nonce gaps that block transactions
- Detect mempool desync (confirmed nonce far behind mempool nonce)
- List stuck transactions with txid, nonce, and how long they have been pending
- Report mempool congestion

This tool does not redefine caller-facing x402 payment states. Use paymentId
polling for payment lifecycle truth; use this output only as backup diagnostics.`,
      inputSchema: {},
    },
    async () => {
      try {
        const status = await checkRelayHealth(NETWORK);

        return createJsonResponse({
          ...status,
          formatted: formatRelayHealthStatus(status),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "recover_sponsor_nonce",
    {
      description: `Attempt automated recovery of stuck sponsor transactions via the relay API, or resync the local nonce counter.

Run check_relay_health first to identify stuck txids and missing nonces, then use
this tool to trigger recovery without needing to contact the AIBTC team manually.

Recovery modes:
- rbf: Replace-by-fee — rebroadcasts stuck transactions with a higher fee so miners
  prioritize them. Provide specific txids or omit to bump all stuck transactions.
- fill-gaps: Nonce gap-fill — submits placeholder transactions to fill any missing
  nonces that are blocking the queue. Provide specific nonces or omit to fill all gaps.
- both: Attempt both RBF and gap-fill in sequence (default).
- resync-local-nonce: Force-reset the MCP server's in-memory nonce counter for the
  active wallet. Use this when the local counter is out of sync with the chain (e.g.
  after a server restart, manual transaction sent outside the MCP server, or a
  confirmed-but-locally-stuck counter). The counter will be re-seeded from the chain
  on the next transaction. Requires the wallet to be unlocked.

If the relay does not yet support relay endpoints it returns a 404 or 501 and this
tool will respond with a clear message rather than throwing an error. In that case,
share the txids and nonces from check_relay_health with the AIBTC team.`,
      inputSchema: {
        action: z
          .enum(["rbf", "fill-gaps", "both", "resync-local-nonce"])
          .default("both")
          .describe("Which recovery operation to attempt"),
        txids: z
          .array(z.string())
          .optional()
          .describe("Specific stuck transaction IDs for RBF (omit to bump all stuck txs)"),
        nonces: z
          .array(z.number().int().nonnegative())
          .optional()
          .describe("Specific missing nonces for gap-fill (omit to fill all detected gaps)"),
      },
    },
    async ({ action = "both", txids, nonces }) => {
      try {
        // Resolve API key from wallet (if unlocked) to align with sponsor-builder auth flow
        const walletAccount = getWalletManager().getAccount();
        const walletApiKey = walletAccount?.sponsorApiKey;

        // Local nonce resync — no relay call needed.
        if (action === "resync-local-nonce") {
          if (!walletAccount) {
            return createJsonResponse({
              action,
              success: false,
              message: "Wallet must be unlocked to resync the local nonce counter. Use wallet_unlock first.",
            });
          }
          forceResyncNonce(walletAccount.address);
          return createJsonResponse({
            action,
            success: true,
            address: walletAccount.address,
            message: `Local nonce counter cleared for ${walletAccount.address}. The next transaction will re-seed from the chain.`,
          });
        }

        const results: Record<string, unknown> = { action };

        if (action === "rbf" || action === "both") {
          const rbfResult = await attemptRbf(NETWORK, txids, walletApiKey);
          results.rbf = rbfResult;
        }

        if (action === "fill-gaps" || action === "both") {
          const fillResult = await attemptFillGaps(NETWORK, nonces, walletApiKey);
          results.fillGaps = fillResult;
        }

        // Summarize outcome
        const anyUnsupported = Object.values(results).some(
          (r) => r && typeof r === "object" && "supported" in r && !(r as { supported: boolean }).supported
        );
        const anySupported = Object.values(results).some(
          (r) => r && typeof r === "object" && "supported" in r && (r as { supported: boolean }).supported
        );

        results.summary = anySupported
          ? "Recovery request sent to relay operator endpoints. Run check_relay_health to verify nonce state improved."
          : anyUnsupported
          ? "Relay does not yet support automated recovery. Run check_relay_health for txids and nonces to share with the AIBTC team."
          : "Recovery attempted.";

        return createJsonResponse(results);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
