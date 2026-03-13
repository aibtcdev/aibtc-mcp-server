import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerWalletTools } from "./wallet.tools.js";
import { registerWalletManagementTools } from "./wallet-management.tools.js";
import { registerTransferTools } from "./transfer.tools.js";
import { registerContractTools } from "./contract.tools.js";
import { registerSbtcTools } from "./sbtc.tools.js";
import { registerTokenTools } from "./tokens.tools.js";
import { registerNftTools } from "./nft.tools.js";
import { registerStackingTools } from "./stacking.tools.js";
import { registerBnsTools } from "./bns.tools.js";
import { registerStyxTools } from "./styx.tools.js";
import { registerQueryTools } from "./query.tools.js";
import { registerEndpointTools } from "./endpoint.tools.js";
import { registerDefiTools } from "./defi.tools.js";
// TODO: Re-enable when Bitflow API key integration is complete
// import { registerBitflowTools } from "./bitflow.tools.js";
import { registerScaffoldTools } from "./scaffold.tools.js";
import { registerOpenRouterTools } from "./openrouter.tools.js";
import { registerYieldHunterTools } from "./yield-hunter.tools.js";
import { registerPillarTools } from "./pillar.tools.js";
import { registerPillarDirectTools } from "./pillar-direct.tools.js";
import { registerBitcoinTools } from "./bitcoin.tools.js";
import { registerRelayDiagnosticTools } from "./relay-diagnostic.tools.js";
import { getSkillForTool } from "./skill-mappings.js";

/**
 * Wraps server.registerTool to inject _meta.skill from TOOL_SKILL_MAP when a mapping exists.
 * Returns a cleanup function that restores the original method.
 */
function withSkillMeta(server: McpServer): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (server as any).registerTool;
  const hasOwn = Object.prototype.hasOwnProperty.call(server, "registerTool");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).registerTool = function (name: string, config: Record<string, unknown>, cb: unknown) {
    const skill = getSkillForTool(name);
    const patched = skill
      ? { ...config, _meta: { ...(config._meta as Record<string, unknown> | undefined ?? {}), skill } }
      : config;
    return original.call(server, name, patched, cb);
  };
  return () => {
    if (hasOwn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).registerTool = original;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (server as any).registerTool;
    }
  };
}

/**
 * Register all tools with the MCP server
 */
export function registerAllTools(server: McpServer): void {
  const restoreRegisterTool = withSkillMeta(server);

  // Wallet & Balance
  registerWalletTools(server);

  // Wallet Management (create, import, unlock, lock, etc.)
  registerWalletManagementTools(server);

  // Transfers
  registerTransferTools(server);

  // Smart Contracts
  registerContractTools(server);

  // sBTC
  registerSbtcTools(server);

  // Tokens (SIP-010)
  registerTokenTools(server);

  // NFTs (SIP-009)
  registerNftTools(server);

  // Stacking / PoX
  registerStackingTools(server);

  // BNS Domains
  registerBnsTools(server);

  // Blockchain Queries
  registerQueryTools(server);

  // x402 Endpoints
  registerEndpointTools(server);

  // DeFi (ALEX DEX, Zest Protocol)
  registerDefiTools(server);

  // Bitflow DEX (disabled until API key integration is complete)
  // registerBitflowTools(server);

  // Styx BTC→sBTC conversion
  registerStyxTools(server);

  // Scaffolding (generate x402 endpoint projects)
  registerScaffoldTools(server);

  // OpenRouter AI (call AI models directly)
  registerOpenRouterTools(server);

  // Yield Hunter (autonomous sBTC yield farming)
  registerYieldHunterTools(server);

  // Pillar (handoff to frontend + polling)
  registerPillarTools(server);

  // Pillar Direct (agent-signed, no browser handoff)
  registerPillarDirectTools(server);

  // Bitcoin L1 (read-only: balance, fees, UTXOs)
  registerBitcoinTools(server);

  // Relay Diagnostics (sponsor relay health, nonce status, stuck transactions)
  registerRelayDiagnosticTools(server);

  restoreRegisterTool();
}
