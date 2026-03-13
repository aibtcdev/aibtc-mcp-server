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

export function registerRelayDiagnosticTools(server: McpServer): void {
  server.registerTool(
    "check_relay_health",
    {
      description: `Check the sponsor relay health and nonce status.

Use this tool to diagnose sponsored transaction failures. It will:
- Check relay availability
- Inspect sponsor address nonce state
- Detect nonce gaps that block transactions
- Detect mempool desync (confirmed nonce far behind mempool nonce)
- List stuck transactions with txid, nonce, and how long they have been pending
- Report mempool congestion

If nonce gaps or stuck transactions are detected, the output includes
txids and pending durations to share with the AIBTC team for recovery.`,
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
      description: `Attempt automated recovery of stuck sponsor transactions via the relay API.

Run check_relay_health first to identify stuck txids and missing nonces, then use
this tool to trigger recovery without needing to contact the AIBTC team manually.

Two recovery modes are available:
- rbf: Replace-by-fee — rebroadcasts stuck transactions with a higher fee so miners
  prioritize them. Provide specific txids or omit to bump all stuck transactions.
- fill-gaps: Nonce gap-fill — submits placeholder transactions to fill any missing
  nonces that are blocking the queue. Provide specific nonces or omit to fill all gaps.
- both: Attempt both RBF and gap-fill in sequence (default).

If the relay does not yet support these endpoints it returns a 404 or 501 and this
tool will respond with a clear message rather than throwing an error. In that case,
share the txids and nonces from check_relay_health with the AIBTC team.`,
      inputSchema: {
        action: z
          .enum(["rbf", "fill-gaps", "both"])
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
          ? "Recovery request submitted to relay. Run check_relay_health to verify nonce state improved."
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
