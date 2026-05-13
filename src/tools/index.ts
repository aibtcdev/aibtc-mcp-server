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
import { registerBitflowTools } from "./bitflow.tools.js";
import { registerScaffoldTools } from "./scaffold.tools.js";
import { registerOpenRouterTools } from "./openrouter.tools.js";
import { registerYieldHunterTools } from "./yield-hunter.tools.js";
import { registerYieldDashboardTools } from "./yield-dashboard.tools.js";
import { registerPillarTools } from "./pillar.tools.js";
import { registerPillarDirectTools } from "./pillar-direct.tools.js";
import { registerBitcoinTools } from "./bitcoin.tools.js";
import { registerMempoolTools } from "./mempool.tools.js";
import { registerNostrTools } from "./nostr.tools.js";
import { registerRelayDiagnosticTools } from "./relay-diagnostic.tools.js";
import { registerNonceTools } from "./nonce.tools.js";
import { registerStacksMarketTools } from "./stacks-market.tools.js";
import { registerTeneroTools } from "./tenero.tools.js";
import { registerOrdinalsP2PTools } from "./ordinals-p2p.tools.js";
import { registerOrdinalsMarketplaceTools } from "./ordinals-marketplace.tools.js";
import { registerTaprootMultisigTools } from "./taproot-multisig.tools.js";
import { registerJingswapTools } from "./jingswap.tools.js";
import { registerJingswapV2Tools } from "./jingswap-v2.tools.js";
import { registerSigningTools } from "./signing.tools.js";
import { registerNewsTools } from "./news.tools.js";
import { registerIdentityTools } from "./identity.tools.js";
import { registerCredentialsTools } from "./credentials.tools.js";
import { registerSouldinalsTools } from "./souldinals.tools.js";
import { registerBountyScannerTools } from "./bounty-scanner.tools.js";
import { registerRunesTools } from "./runes.tools.js";
import { registerInboxTools } from "./inbox.tools.js";
import { registerArxivResearchTools } from "./arxiv-research.tools.js";
import { registerFlyingWhaleTools } from "./flying-whale.tools.js";
import { registerPsiTools } from "./psi.tools.js";
import { registerBtcChainTools } from "./btc-chain.tools.js";
import { registerComplianceTools } from "./compliance.tools.js";
import { registerSovereignEconomyTools } from "./sovereign-economy.tools.js";
import { registerPsiOracleTools } from "./psi-oracle.tools.js";
import { registerGrandUnifiedTools } from "./grand-unified.tools.js";
import { registerChildInscriptionTools } from "./child-inscription.tools.js";
import { registerErc8004Tools } from "./erc8004.tools.js";
import { registerOrdinalsTools } from "./ordinals.tools.js";
import { registerPsbtTools } from "./psbt.tools.js";
import { registerSettingsTools } from "./settings.tools.js";
import { registerCurrencyRenaissanceTools } from "./currency-renaissance.tools.js";
import { registerZeroHarmTools } from "./zero-harm.tools.js";
import { registerMasterEvaluationTools } from "./master-evaluation.tools.js";
import { registerGapResolverTools } from "./gap-resolver.tools.js";
import { registerNeuroSovereignTools } from "./neuro-sovereign.tools.js";
import { registerSecurityCoreTools } from "./security-core.tools.js";
import { registerNashGossipTools } from "./nash-gossip.tools.js";
import { registerUnifiedEngineTools } from "./unified-engine.tools.js";
import { getSkillForTool } from "./skill-mappings.js";
import { withSessionGuard } from "./session-guard.js";

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
  // Layer 1: Session guard (MCPTox / Denial-of-Wallet protection) — must wrap first
  const restoreSessionGuard = withSessionGuard(server);
  // Layer 2: Skill metadata injection
  const restoreRegisterTool = withSkillMeta(server);

  void restoreSessionGuard; // cleanup available if needed

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

  // Bitflow DEX (public read-only + authenticated swap when BITFLOW_API_KEY is set)
  registerBitflowTools(server);

  // Styx BTC→sBTC conversion
  registerStyxTools(server);

  // Scaffolding (generate x402 endpoint projects)
  registerScaffoldTools(server);

  // OpenRouter AI (call AI models directly)
  registerOpenRouterTools(server);

  // Yield Hunter (autonomous sBTC yield farming)
  registerYieldHunterTools(server);

  // Yield Dashboard (read-only cross-protocol DeFi yield aggregation)
  registerYieldDashboardTools(server);

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

  // Nonce Diagnostics (sender nonce health, gap-fill — issue #413)
  registerNonceTools(server);

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

  // Jingswap Auction V1 (blind batch auctions for STX/sBTC — 3-phase)
  registerJingswapTools(server);

  // Jingswap Auction V2 (limit-price auctions — 2-phase atomic settlement, 20s cycles)
  // COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54
  registerJingswapV2Tools(server);

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

  // arXiv Research (public arXiv Atom API — paper search and digest compilation)
  registerArxivResearchTools(server);

  // Flying Whale Marketplace (skill discovery, bounties, order book, intelligence)
  registerFlyingWhaleTools(server);

  // Child Inscriptions (parent-child provenance via OP_RETURN)
  registerChildInscriptionTools(server);

  // ERC-8004 (on-chain agent identity, reputation, validation)
  registerErc8004Tools(server);

  // Ordinals (inscribe, reveal, estimate fee, get inscription, taproot address)
  registerOrdinalsTools(server);

  // PSBTs (decode, sign, finalize, broadcast)
  registerPsbtTools(server);

  // Settings (Hiro API key, Stacks API URL, server version)
  registerSettingsTools(server);

  // Ψ Consensus Layer (Landauer · Nash · Cantillon⁻¹ · Gödel)
  // The same mathematical foundations as Bitcoin — made explicit and measured
  registerPsiTools(server);

  // Bitcoin-Complete Chain (SHA256d, Merkle, nBits, PoP, halving, UTXO, FW Script)
  registerBtcChainTools(server);

  // Universal Ψ Compliance Protocol — SHA-256 anchored, chain-agnostic
  // No brand, no name. Identified only by SHA-256("Ψ=Landauer·Nash·Cantillon⁻¹·Gödel")
  // Works on Bitcoin, Stacks, Ethereum, Solana, Lightning, and all chains.
  registerComplianceTools(server);

  // Ψ Grand Unified System — complete architecture: constitution, adversarial matrix,
  // risk registry, reform catalog, monetary bridge, stability mechanisms, reactions balance
  registerGrandUnifiedTools(server);

  // Ψ Universal Oracle — single unified call across all 8 layers
  // psi_oracle: address+chain+jurisdiction → full intelligence in one response
  // psi_nation: country code → debt + currency + law + roadmap + invariant
  // psi_system_state: live health of all 8 layers + global stats
  registerPsiOracleTools(server);

  // Sovereign Economy — National Debt Liberation & Global Renaissance
  // $307T global debt → 7-phase Bitcoin Standard transition → 30-year Renaissance projection
  // x402 government APIs, BTC mining reserves, mathematical invariant: $14.6M/BTC if global base
  registerSovereignEconomyTools(server);

  // Currency Renaissance — Every Currency Strengthens Itself
  // Ψ diagnosis per currency → specific Landauer/Nash/Cantillon/Gödel reforms
  // Multi-currency x402: no forced sBTC — LBP pays LBP, JPY pays JPY
  registerCurrencyRenaissanceTools(server);

  // Zero Harm Protocol — صفر أضرار على المدنيين والحكومات
  // 10 civilian rights × 10 government rights × 4 sector guarantees × 10 circuit breakers
  // Technical | Monetary | Security | Legal — complete zero-harm coverage
  registerZeroHarmTools(server);

  // Master Evaluation — التقييم الشامل الكامل (20 dimensions)
  // Inventory · Goals · Gaps · Risks · Intentions · Assets · Data ·
  // Cooperation · Public Interest · Master Synthesis — complete picture
  registerMasterEvaluationTools(server);

  // Neuro-Sovereign Intelligence — 6-layer neural analysis + Monte Carlo risks
  // + live OFAC/EU/UK sanctions screening (SEC-12 + SEC-13 fixed)
  // + discrimination audit (Cantillon disparate impact) + after-effects timeline
  registerNeuroSovereignTools(server);

  // Gap Resolver + Security Hardening — حل الفجوات وأعلى مستوى أمان
  // 80+ currencies · 13-risk cascade system · 25-check security audit ·
  // CR-11 whistleblower · quantum migration · environmental Landauer · governance
  registerGapResolverTools(server);

  // Security Core — Bitcoin-identical hash chain + real ZK + SMS/USSD gateway
  // SEC-14 (tool hash chain) + SEC-15 (ZK commitment real) + SEC-21 (unbanked access)
  registerSecurityCoreTools(server);

  // Nash-Gossip Protocol — conflict-free parallel propagation
  // Non-geometric E-R topology · dominant strategy = propagate · O(log n) rounds
  registerNashGossipTools(server);

  // Unified Engine — الدمج الكامل لكل الأنظمة في حلقة واحدة مغلقة
  // WHALE→Ψ→Access | x402→Treasury→Buyback | Chain→Gossip | Risk→ZeroHarm | USSD→DeFi
  registerUnifiedEngineTools(server);

  restoreRegisterTool();
}
