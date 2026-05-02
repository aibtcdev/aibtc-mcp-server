/**
 * OKX MCP tool registration.
 *
 * Phase 1: public market data (no API key).
 * Phase 2 will add DEX Aggregator + Wallet API tools that prompt for
 * credentials lazily when invoked.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOkxMarketTools } from "./market.tools.js";

export function registerOkxTools(server: McpServer): void {
  registerOkxMarketTools(server);
}
