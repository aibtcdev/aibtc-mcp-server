import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Layer 1: Bitcoin L1 (Primary)
import { registerBitcoinTools } from "./bitcoin.tools.js";
import { registerOrdinalsTools } from "./ordinals.tools.js";
import { registerWalletTools } from "./wallet.tools.js";
import { registerWalletManagementTools } from "./wallet-management.tools.js";
import { registerSigningTools } from "./signing.tools.js";

// Layer 2: Stacks L2 (On-Demand)
import { registerTransferTools } from "./transfer.tools.js";
import { registerContractTools } from "./contract.tools.js";
import { registerSbtcTools } from "./sbtc.tools.js";
import { registerTokenTools } from "./tokens.tools.js";
import { registerNftTools } from "./nft.tools.js";
import { registerBnsTools } from "./bns.tools.js";

// Layer 2b: DeFi (Advanced)
import { registerDefiTools } from "./defi.tools.js";
import { registerStackingTools } from "./stacking.tools.js";
// TODO: Re-enable when Bitflow API key integration is complete
// import { registerBitflowTools } from "./bitflow.tools.js";

// Layer 3: Pillar Smart Wallet
import { registerPillarTools } from "./pillar.tools.js";
import { registerPillarDirectTools } from "./pillar-direct.tools.js";

// Layer 4: APIs & Utilities
import { registerQueryTools } from "./query.tools.js";
import { registerEndpointTools } from "./endpoint.tools.js";
import { registerScaffoldTools } from "./scaffold.tools.js";
import { registerOpenRouterTools } from "./openrouter.tools.js";
import { registerYieldHunterTools } from "./yield-hunter.tools.js";

/**
 * Register all tools with the MCP server.
 *
 * Tools are organized in layers reflecting the Bitcoin-first hierarchy:
 * - Layer 1: Bitcoin L1 - Core Bitcoin operations (balance, fees, UTXOs, transfer)
 * - Layer 2: Stacks L2 - Smart contracts, tokens, NFTs, BNS on Stacks
 * - Layer 2b: DeFi - ALEX DEX, Zest Protocol, Stacking
 * - Layer 3: Pillar - Smart wallet with passkey signing
 * - Layer 4: APIs - x402 endpoints, scaffolding, AI integrations
 */
export function registerAllTools(server: McpServer): void {
  // =========================================================================
  // Layer 1: Bitcoin L1 (Primary)
  // Core Bitcoin operations - shown first as the foundation
  // =========================================================================
  registerBitcoinTools(server);
  registerOrdinalsTools(server);
  registerWalletTools(server);
  registerWalletManagementTools(server);
  registerSigningTools(server);

  // =========================================================================
  // Layer 2: Stacks L2 (On-Demand)
  // Smart contract platform built on Bitcoin
  // =========================================================================
  registerTransferTools(server);
  registerContractTools(server);
  registerSbtcTools(server);
  registerTokenTools(server);
  registerNftTools(server);
  registerBnsTools(server);

  // =========================================================================
  // Layer 2b: DeFi (Advanced)
  // Decentralized finance protocols on Stacks
  // =========================================================================
  registerDefiTools(server);
  registerStackingTools(server);
  // registerBitflowTools(server); // Disabled until API key integration

  // =========================================================================
  // Layer 3: Pillar Smart Wallet
  // Passkey-based smart wallet for sBTC yield
  // =========================================================================
  registerPillarTools(server);
  registerPillarDirectTools(server);

  // =========================================================================
  // Layer 4: APIs & Utilities
  // x402 endpoints, blockchain queries, scaffolding, AI
  // =========================================================================
  registerQueryTools(server);
  registerEndpointTools(server);
  registerScaffoldTools(server);
  registerOpenRouterTools(server);
  registerYieldHunterTools(server);
}
