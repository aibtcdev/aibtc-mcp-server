/**
 * Relay Diagnostic Tools
 * 
 * Tools for checking sponsor relay health and diagnosing nonce issues
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { checkRelayHealth, formatRelayHealthStatus } from "../utils/relay-health.js";
import { NETWORK } from "../services/x402.service.js";

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
        return createErrorResponse(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}
