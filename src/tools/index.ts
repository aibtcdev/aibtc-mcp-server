import { McpServer } from "@modelcontextprotocol/server";

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
import { registerBitflowTools } from "./bitflow.tools.js";
import { registerScaffoldTools } from "./scaffold.tools.js";
import { registerOpenRouterTools } from "./openrouter.tools.js";
import { registerYieldHunterTools } from "./yield-hunter.tools.js";
import { registerYieldDashboardTools } from "./yield-dashboard.tools.js";
import { registerPillarTools } from "./pillar.tools.js";
import { registerPillarDirectTools } from "./pillar-direct.tools.js";
import { registerBitcoinTools } from "./bitcoin.tools.js";
import { registerLightningTools } from "./lightning.tools.js";
import { registerMempoolTools } from "./mempool.tools.js";
import { registerNostrTools } from "./nostr.tools.js";
import { registerRelayDiagnosticTools } from "./relay-diagnostic.tools.js";
import { registerNonceTools } from "./nonce.tools.js";
import { registerStacksMarketTools } from "./stacks-market.tools.js";
import { registerTeneroTools } from "./tenero.tools.js";
import { registerOrdinalsP2PTools } from "./ordinals-p2p.tools.js";
import { registerOrdinalsMarketplaceTools } from "./ordinals-marketplace.tools.js";
import { registerTaprootMultisigTools } from "./taproot-multisig.tools.js";
import { registerPsbtTools } from "./psbt.tools.js";
import { registerSettingsTools } from "./settings.tools.js";
import { registerJingswapTools } from "./jingswap.tools.js";
import { registerSigningTools } from "./signing.tools.js";
import { registerInferenceMarketplaceTools } from "./inference-marketplace.tools.js";
import { registerNewsTools } from "./news.tools.js";
import { registerLegionTools } from "./legion.tools.js";
import { registerAtStakeTools } from "./at-stake.tools.js";
import { registerAtStakeLegionTools } from "./at-stake-legion.tools.js";
import { registerIdentityTools } from "./identity.tools.js";
import { registerCredentialsTools } from "./credentials.tools.js";
import { registerSouldinalsTools } from "./souldinals.tools.js";
import { registerOrdinalsTools } from "./ordinals.tools.js";
import { registerChildInscriptionTools } from "./child-inscription.tools.js";
import { registerBountyScannerTools } from "./bounty-scanner.tools.js";
import { registerRunesTools } from "./runes.tools.js";
import { registerInboxTools } from "./inbox.tools.js";
import { registerInboxX402Tools } from "./inbox-x402.tools.js";
import { registerArxivResearchTools } from "./arxiv-research.tools.js";
import { registerEarningTools } from "./earning.tools.js";
import { getSkillForTool } from "./skill-mappings.js";
import { isToolSelected, type ToolGroup, type ToolSelection } from "./profiles.js";

/**
 * One-line pointer appended to every tool's description (except the earning tool
 * itself) so agents stay oriented toward how they can put their assets to work.
 */
const EARNING_TIP =
  "\n\nTip: call `earning_opportunities` to see how to put your assets to work.";

/**
 * Wraps server.registerTool to:
 * - skip tools outside the active selection,
 * - inject _meta.skill from TOOL_SKILL_MAP when a mapping exists, and
 * - append the earning-opportunities tip to each tool's description.
 * Returns a cleanup function that restores the original method.
 */
function withSkillMeta(
  server: McpServer,
  selection: ToolSelection,
  currentGroup: () => ToolGroup
): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (server as any).registerTool;
  const hasOwn = Object.prototype.hasOwnProperty.call(server, "registerTool");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).registerTool = function (name: string, config: Record<string, unknown>, cb: unknown) {
    if (!isToolSelected(selection, name, currentGroup())) return undefined;
    const skill = getSkillForTool(name);
    let patched: Record<string, unknown> = skill
      ? { ...config, _meta: { ...(config._meta as Record<string, unknown> | undefined ?? {}), skill } }
      : config;
    if (name !== "earning_opportunities" && typeof patched.description === "string") {
      patched = { ...patched, description: patched.description + EARNING_TIP };
    }
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
 * Register the selected tools with the MCP server. Each registration module
 * belongs to one group; a tool is registered when it is in the core set or its
 * group is selected (see profiles.ts).
 */
export function registerAllTools(server: McpServer, selection: ToolSelection): void {
  let currentGroup: ToolGroup = "wallet";
  const restoreRegisterTool = withSkillMeta(server, selection, () => currentGroup);
  const inGroup = (group: ToolGroup, register: (server: McpServer) => void) => {
    currentGroup = group;
    register(server);
  };

  // Wallet & Balance
  inGroup("wallet", registerWalletTools);

  // Wallet Management (create, import, unlock, lock, etc.)
  inGroup("wallet", registerWalletManagementTools);

  // Transfers
  inGroup("stacks", registerTransferTools);

  // Smart Contracts
  inGroup("stacks", registerContractTools);

  // sBTC
  inGroup("sbtc", registerSbtcTools);

  // Tokens (SIP-010)
  inGroup("stacks", registerTokenTools);

  // NFTs (SIP-009)
  inGroup("stacks", registerNftTools);

  // Stacking / PoX
  inGroup("stacking", registerStackingTools);

  // Dual Stacking (sBTC yield via Dual Stacking protocol)
  inGroup("stacking", registerDualStackingTools);

  // Stacking Lottery (StackSpot — pool STX, VRF picks sBTC winner)
  inGroup("stacking", registerStackingLotteryTools);

  // BNS Domains
  inGroup("bns", registerBnsTools);

  // Blockchain Queries
  inGroup("stacks", registerQueryTools);

  // Reputation (ERC-8004 feedback lifecycle)
  inGroup("identity", registerReputationTools);

  // x402 Endpoints
  inGroup("dev", registerEndpointTools);

  // DeFi (ALEX DEX, Zest Protocol)
  inGroup("defi", registerDefiTools);

  // Bitflow DEX (public API — no key required, key only raises rate limits)
  inGroup("defi", registerBitflowTools);

  // Styx BTC→sBTC conversion
  inGroup("sbtc", registerStyxTools);

  // Scaffolding (generate x402 endpoint projects)
  inGroup("dev", registerScaffoldTools);

  // OpenRouter AI (call AI models directly)
  inGroup("dev", registerOpenRouterTools);

  // Yield Hunter (autonomous sBTC yield farming)
  inGroup("defi", registerYieldHunterTools);

  // Yield Dashboard (read-only cross-protocol DeFi yield aggregation)
  inGroup("defi", registerYieldDashboardTools);

  // Pillar (handoff to frontend + polling)
  inGroup("pillar", registerPillarTools);

  // Pillar Direct (agent-signed, no browser handoff)
  inGroup("pillar", registerPillarDirectTools);

  // Bitcoin L1 (read-only: balance, fees, UTXOs)
  inGroup("bitcoin", registerBitcoinTools);

  // Lightning Network (L402 auto-pay, Spark-backed wallet)
  inGroup("lightning", registerLightningTools);

  // Mempool Watch (read-only: mempool stats, tx status, address tx history)
  inGroup("bitcoin", registerMempoolTools);

  // Nostr protocol (publish notes, read feed, manage profile)
  inGroup("social", registerNostrTools);

  // Relay Diagnostics (sponsor relay health, nonce status, stuck transactions)
  inGroup("stacks", registerRelayDiagnosticTools);

  // Nonce Diagnostics (sender nonce health, gap-fill — issue #413)
  inGroup("stacks", registerNonceTools);

  // Stacks Market prediction market trading
  inGroup("markets", registerStacksMarketTools);

  // Tenero market analytics (token info, gainers/losers, trending pools, wallet trades)
  inGroup("defi", registerTeneroTools);

  // Ordinals P2P trading (ledger.drx4.xyz — offers, counters, transfers, PSBT swaps)
  inGroup("ordinals", registerOrdinalsP2PTools);

  // Ordinals Marketplace (Magic Eden — browse listings, list/buy/cancel via PSBT)
  inGroup("ordinals", registerOrdinalsMarketplaceTools);

  // Taproot Multisig (M-of-N coordination via OP_CHECKSIGADD, BIP-341/342)
  inGroup("ordinals", registerTaprootMultisigTools);

  // PSBT sign/broadcast/decode (used by the ordinals marketplace, P2P and taproot multisig flows)
  inGroup("ordinals", registerPsbtTools);

  // Settings (Hiro API key, custom Stacks API URL, server version)
  inGroup("dev", registerSettingsTools);

  // Jingswap Auction (blind batch auctions for STX/sBTC)
  inGroup("defi", registerJingswapTools);

  // Message Signing (BTC BIP-322, Stacks SIWS, SIP-018 structured data, Nostr NIP-01)
  inGroup("identity", registerSigningTools);

  // AIBTC Inference Marketplace (list/manage a paid model endpoint via wallet signature)
  inGroup("dev", registerInferenceMarketplaceTools);

  // AIBTC News (deprecated — API retired; each tool redirects to legion_*)
  inGroup("legion", registerNewsTools);

  // AIBTC News Legion (mainnet aibtc-news-gov — inscribe, propose, vote, conclude)
  inGroup("legion", registerLegionTools);

  // At Stake (elsalvadorstakesbtc.com — complete-set prediction market)
  inGroup("markets", registerAtStakeTools);

  // At Stake side legions (aibtc.com/legions — weight is the share balance)
  inGroup("legion", registerAtStakeLegionTools);

  // Identity (ERC-8004 on-chain agent identity management)
  inGroup("identity", registerIdentityTools);

  // Credentials (encrypted credential store — list, get, set, delete, unlock)
  inGroup("wallet", registerCredentialsTools);

  // Ordinals (genesis inscriptions — taproot address, estimate fee, inscribe, reveal, lookup)
  inGroup("ordinals", registerOrdinalsTools);

  // Souldinals (soul.md child inscriptions — inscribe, reveal, list, load, display traits)
  inGroup("ordinals", registerSouldinalsTools);

  // Child inscriptions (parent-child provenance — estimate fee, commit, reveal)
  inGroup("ordinals", registerChildInscriptionTools);

  // Bounty board (aibtc.com/api/bounties — list, get, submit, accept, pay, cancel, my-views)
  inGroup("earn", registerBountyScannerTools);

  // Runes (Bitcoin-native fungible tokens — list, query, holders, activity, balances)
  inGroup("ordinals", registerRunesTools);

  // Inbox (AIBTC agent messaging — send paid inbox messages)
  inGroup("social", registerInboxTools);

  // Inbox direct x402 (non-sponsored — sender pays own STX gas, no relay)
  inGroup("social", registerInboxX402Tools);

  // arXiv Research (public arXiv Atom API — paper search and digest compilation)
  inGroup("dev", registerArxivResearchTools);

  // Earning Opportunities (static "how to put your assets to work" menu)
  inGroup("earn", registerEarningTools);

  restoreRegisterTool();
}
