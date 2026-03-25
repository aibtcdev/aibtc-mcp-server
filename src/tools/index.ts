import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerWalletTools } from "./wallet.tools.js";
import { registerWalletManagementTools } from "./wallet-management.tools.js";
import { registerTransferTools } from "./transfer.tools.js";
import { registerContractTools } from "./contract.tools.js";
import { registerSbtcTools } from "./sbtc.tools.js";
import { registerTokenTools } from "./tokens.tools.js";
import { registerNftTools } from "./nft.tools.js";
import { registerStackingTools } from "./stacking.tools.js";
import { registerDualStackingTools } from "./dual-stacking.tools.js";
import { registerStackingLotteryTools } from "./stacking-lottery.tools.js";
import { registerBnsTools } from "./bns.tools.js";
import { registerStyxTools } from "./styx.tools.js";
import { registerQueryTools } from "./query.tools.js";
import { registerReputationTools } from "./reputation.tools.js";
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
import { registerMempoolTools } from "./mempool.tools.js";
import { registerNostrTools } from "./nostr.tools.js";
import { registerRelayDiagnosticTools } from "./relay-diagnostic.tools.js";
import { registerStacksMarketTools } from "./stacks-market.tools.js";
import { registerTeneroTools } from "./tenero.tools.js";
import { registerOrdinalsP2PTools } from "./ordinals-p2p.tools.js";
import { registerOrdinalsMarketplaceTools } from "./ordinals-marketplace.tools.js";
import { registerTaprootMultisigTools } from "./taproot-multisig.tools.js";
import { registerJingswapTools } from "./jingswap.tools.js";
import { registerSigningTools } from "./signing.tools.js";
import { registerNewsTools } from "./news.tools.js";
import { registerIdentityTools } from "./identity.tools.js";
import { registerCredentialsTools } from "./credentials.tools.js";
import { registerSouldinalsTools } from "./souldinals.tools.js";
import { registerBountyScannerTools } from "./bounty-scanner.tools.js";
import { registerRunesTools } from "./runes.tools.js";
import { registerInboxTools } from "./inbox.tools.js";
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

  // Dual Stacking (sBTC yield via Dual Stacking protocol)
  registerDualStackingTools(server);

  // Stacking Lottery (StackSpot — pool STX, VRF picks sBTC winner)
  registerStackingLotteryTools(server);

  // BNS Domains
  registerBnsTools(server);

  // Blockchain Queries
  registerQueryTools(server);

  // Reputation (ERC-8004 feedback lifecycle)
  registerReputationTools(server);

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

  // Mempool Watch (read-only: mempool stats, tx status, address tx history)
  registerMempoolTools(server);

  // Nostr protocol (publish notes, read feed, manage profile)
  registerNostrTools(server);

  // Relay Diagnostics (sponsor relay health, nonce status, stuck transactions)
  registerRelayDiagnosticTools(server);

  // Stacks Market prediction market trading
  registerStacksMarketTools(server);

  // Tenero market analytics (token info, gainers/losers, trending pools, wallet trades)
  registerTeneroTools(server);

  // Ordinals P2P trading (ledger.drx4.xyz — offers, counters, transfers, PSBT swaps)
  registerOrdinalsP2PTools(server);

  // Ordinals Marketplace (Magic Eden — browse listings, list/buy/cancel via PSBT)
  registerOrdinalsMarketplaceTools(server);

  // Taproot Multisig (M-of-N coordination via OP_CHECKSIGADD, BIP-341/342)
  registerTaprootMultisigTools(server);

  // Jingswap Auction (blind batch auctions for STX/sBTC)
  registerJingswapTools(server);

  // Message Signing (BTC BIP-322, Stacks SIWS, SIP-018 structured data, Nostr NIP-01)
  registerSigningTools(server);

  // AIBTC News (signal feed, leaderboard, file signals)
  registerNewsTools(server);

  // Identity (ERC-8004 on-chain agent identity management)
  registerIdentityTools(server);

  // Credentials (encrypted credential store — list, get, set, delete, unlock)
  registerCredentialsTools(server);

  // Souldinals (soul.md child inscriptions — inscribe, reveal, list, load, display traits)
  registerSouldinalsTools(server);

  // Bounty Scanner (bounty.drx4.xyz — list, match, claim, status, my-claims)
  registerBountyScannerTools(server);

  // Runes (Bitcoin-native fungible tokens — list, query, holders, activity, balances)
  registerRunesTools(server);

  // Inbox (AIBTC agent messaging — send paid inbox messages)
  registerInboxTools(server);

  restoreRegisterTool();
}
