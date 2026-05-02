/**
 * OKX MCP tool registration.
 *
 * Phase 1: public market data (no API key).
 * Phase 2: DEX aggregator + Wallet API with lazy credential prompts —
 * no upfront setup needed; the first private-tool invocation throws a
 * clear OkxCredentialsMissingError telling the user which credentials_set
 * calls to make.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOkxMarketTools } from "./market.tools.js";
import { registerOkxDexTools } from "./dex.tools.js";
import { registerOkxWalletTools } from "./wallet.tools.js";

export function registerOkxTools(server: McpServer): void {
  registerOkxMarketTools(server);
  registerOkxDexTools(server);
  registerOkxWalletTools(server);
}
