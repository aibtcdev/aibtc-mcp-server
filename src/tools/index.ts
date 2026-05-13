import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ── L1 · Bitcoin (L1) ─────────────────────────────────────────────────────────
import { registerBitcoinTools }             from "./bitcoin.tools.js";
import { registerMempoolTools }             from "./mempool.tools.js";
import { registerBtcChainTools }            from "./btc-chain.tools.js";
import { registerPsbtTools }                from "./psbt.tools.js";
import { registerTaprootMultisigTools }     from "./taproot-multisig.tools.js";
import { registerOrdinalsTools }            from "./ordinals.tools.js";
import { registerOrdinalsP2PTools }         from "./ordinals-p2p.tools.js";
import { registerOrdinalsMarketplaceTools } from "./ordinals-marketplace.tools.js";
import { registerRunesTools }               from "./runes.tools.js";
import { registerChildInscriptionTools }    from "./child-inscription.tools.js";
import { registerSouldinalsTools }          from "./souldinals.tools.js";
import { registerSigningTools }             from "./signing.tools.js";

// ── L2 · Wallet & Keys ───────────────────────────────────────────────────────
import { registerWalletTools }              from "./wallet.tools.js";
import { registerWalletManagementTools }    from "./wallet-management.tools.js";
import { registerTransferTools }            from "./transfer.tools.js";
import { registerSettingsTools }            from "./settings.tools.js";
import { registerCredentialsTools }         from "./credentials.tools.js";

// ── L3 · Stacks (Bitcoin L2) ─────────────────────────────────────────────────
import { registerContractTools }            from "./contract.tools.js";
import { registerSbtcTools }                from "./sbtc.tools.js";
import { registerQueryTools }               from "./query.tools.js";
import { registerBnsTools }                 from "./bns.tools.js";
import { registerNostrTools }               from "./nostr.tools.js";
import { registerNonceTools }               from "./nonce.tools.js";
import { registerNftTools }                 from "./nft.tools.js";
import { registerTokenTools }               from "./tokens.tools.js";
import { registerStacksMarketTools }        from "./stacks-market.tools.js";

// ── L3 · Stacking ─────────────────────────────────────────────────────────────
import { registerStackingTools }            from "./stacking.tools.js";
import { registerDualStackingTools }        from "./dual-stacking.tools.js";
import { registerStackingLotteryTools }     from "./stacking-lottery.tools.js";

// ── L3 · DeFi ────────────────────────────────────────────────────────────────
import { registerDefiTools }                from "./defi.tools.js";
import { registerBitflowTools }             from "./bitflow.tools.js";
import { registerJingswapTools }            from "./jingswap.tools.js";
import { registerJingswapV2Tools }          from "./jingswap-v2.tools.js";
import { registerYieldHunterTools }         from "./yield-hunter.tools.js";
import { registerYieldDashboardTools }      from "./yield-dashboard.tools.js";

// ── L3 · Identity & Reputation ────────────────────────────────────────────────
import { registerIdentityTools }            from "./identity.tools.js";
import { registerErc8004Tools }             from "./erc8004.tools.js";
import { registerReputationTools }          from "./reputation.tools.js";

// ── L3 · Communication & Inbox ────────────────────────────────────────────────
import { registerInboxTools }               from "./inbox.tools.js";
import { registerRelayDiagnosticTools }     from "./relay-diagnostic.tools.js";

// ── L4 · Networks (Multi-chain) ──────────────────────────────────────────────
import { registerNetworksTools }            from "./networks.tools.js";

// ── L5 · Assets (Crypto + Fiat + Stocks) ─────────────────────────────────────
import { registerAssetsTools }              from "./assets.tools.js";
import { registerTeneroTools }              from "./tenero.tools.js";

// ── L1 · Bitcoin Energy (Thermodynamic Foundation) ───────────────────────────
import { registerBitcoinEnergyTools }       from "./bitcoin-energy.tools.js";

// ── L5 · Mathematical Intelligence ───────────────────────────────────────────
import { registerPsiTools }                 from "./psi.tools.js";
import { registerPsiOracleTools }           from "./psi-oracle.tools.js";
import { registerNashGossipTools }          from "./nash-gossip.tools.js";
import { registerNashIdealMoneyTools }      from "./nash-ideal-money.tools.js";
import { registerNashSatoshiCompleteTools } from "./nash-satoshi-complete.tools.js";
import { registerUnifiedEngineTools }       from "./unified-engine.tools.js";
import { registerGrandUnifiedTools }        from "./grand-unified.tools.js";
import { registerNeuroSovereignTools }      from "./neuro-sovereign.tools.js";
import { registerSovereignEconomyTools }    from "./sovereign-economy.tools.js";
import { registerCurrencyRenaissanceTools } from "./currency-renaissance.tools.js";
import { registerGapResolverTools }         from "./gap-resolver.tools.js";
import { registerMasterEvaluationTools }    from "./master-evaluation.tools.js";
import { registerZeroHarmTools }            from "./zero-harm.tools.js";

// ── L5 · Security & Compliance ────────────────────────────────────────────────
import { registerSecurityCoreTools }        from "./security-core.tools.js";
import { registerComplianceTools }          from "./compliance.tools.js";
import { registerBountyScannerTools }       from "./bounty-scanner.tools.js";

// ── L5 · AI & Research ───────────────────────────────────────────────────────
import { registerOpenRouterTools }          from "./openrouter.tools.js";
import { registerArxivResearchTools }       from "./arxiv-research.tools.js";
import { registerNewsTools }                from "./news.tools.js";

// ── L5 · x402 Endpoints & Scaffold ───────────────────────────────────────────
import { registerEndpointTools }            from "./endpoint.tools.js";
import { registerScaffoldTools }            from "./scaffold.tools.js";

// ── L6 · Pillar Smart Wallet ─────────────────────────────────────────────────
import { registerPillarTools }              from "./pillar.tools.js";
import { registerPillarDirectTools }        from "./pillar-direct.tools.js";
import { registerFlyingWhaleTools }         from "./flying-whale.tools.js";

// ── L5 · Prosperity Equation ──────────────────────────────────────────────────
import { registerProsperityTools }          from "./prosperity.tools.js";
import { registerSovereignCommonsTools }    from "./sovereign-commons.tools.js";
import { registerPolicyTools }              from "./policy.tools.js";
import { registerPerfectScoreTools }        from "./perfect-score.tools.js";

// ── L7 · Bridge ──────────────────────────────────────────────────────────────
import { registerStyxTools }                from "./styx.tools.js";

// ── Infrastructure ────────────────────────────────────────────────────────────
import { getSkillForTool }  from "./skill-mappings.js";
import { withSessionGuard } from "./session-guard.js";

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
 * aibtc-protocol — 7-layer architecture
 *
 * L1  Bitcoin L1      btc, mempool, psbt, ordinals, runes, signing
 * L2  Wallet          wallet, transfer, credentials, settings
 * L3  Stacks L2       contracts, sbtc, query, bns, nft, defi, stacking, identity
 * L4  Networks        ETH, BNB, Polygon, Avalanche, Arbitrum, Optimism, Base, Solana
 * L5  Assets+Intel    crypto/fiat/stock prices, Ψ engine, security, AI, x402
 * L6  Pillar          smart wallet + handoff model
 * L7  Bridge          BTC ↔ sBTC (Styx) + session SHA256 chain (implicit)
 */
export function registerAllTools(server: McpServer): void {
  const restoreSessionGuard = withSessionGuard(server);
  const restoreRegisterTool = withSkillMeta(server);

  void restoreSessionGuard;

  // L1 — Bitcoin Energy (thermodynamic foundation — registered first)
  registerBitcoinEnergyTools(server);

  // L1 — Bitcoin Core
  registerBitcoinTools(server);
  registerMempoolTools(server);
  registerBtcChainTools(server);
  registerPsbtTools(server);
  registerTaprootMultisigTools(server);
  registerOrdinalsTools(server);
  registerOrdinalsP2PTools(server);
  registerOrdinalsMarketplaceTools(server);
  registerRunesTools(server);
  registerChildInscriptionTools(server);
  registerSouldinalsTools(server);
  registerSigningTools(server);

  // L2 — Wallet & Keys
  registerWalletTools(server);
  registerWalletManagementTools(server);
  registerTransferTools(server);
  registerSettingsTools(server);
  registerCredentialsTools(server);

  // L3 — Stacks
  registerContractTools(server);
  registerSbtcTools(server);
  registerQueryTools(server);
  registerBnsTools(server);
  registerNostrTools(server);
  registerNonceTools(server);
  registerNftTools(server);
  registerTokenTools(server);
  registerStacksMarketTools(server);

  // L3 — Stacking
  registerStackingTools(server);
  registerDualStackingTools(server);
  registerStackingLotteryTools(server);

  // L3 — DeFi
  registerDefiTools(server);
  registerBitflowTools(server);
  registerJingswapTools(server);
  registerJingswapV2Tools(server);
  registerYieldHunterTools(server);
  registerYieldDashboardTools(server);

  // L3 — Identity & Reputation
  registerIdentityTools(server);
  registerErc8004Tools(server);
  registerReputationTools(server);

  // L3 — Communication
  registerInboxTools(server);
  registerRelayDiagnosticTools(server);

  // L4 — Networks (multi-chain)
  registerNetworksTools(server);

  // L5 — Assets
  registerAssetsTools(server);
  registerTeneroTools(server);

  // L5 — Mathematical Intelligence
  registerPsiTools(server);
  registerPsiOracleTools(server);
  registerNashGossipTools(server);
  registerNashIdealMoneyTools(server);
  registerNashSatoshiCompleteTools(server);
  registerUnifiedEngineTools(server);
  registerGrandUnifiedTools(server);
  registerNeuroSovereignTools(server);
  registerSovereignEconomyTools(server);
  registerCurrencyRenaissanceTools(server);
  registerGapResolverTools(server);
  registerMasterEvaluationTools(server);
  registerZeroHarmTools(server);

  // L5 — Security & Compliance
  registerSecurityCoreTools(server);
  registerComplianceTools(server);
  registerBountyScannerTools(server);

  // L5 — AI & Research
  registerOpenRouterTools(server);
  registerArxivResearchTools(server);
  registerNewsTools(server);

  // L5 — Prosperity Equation + Sovereign Commons + Policy
  registerProsperityTools(server);
  registerSovereignCommonsTools(server);
  registerPolicyTools(server);
  registerPerfectScoreTools(server);

  // L5 — x402 Endpoints
  registerEndpointTools(server);
  registerScaffoldTools(server);

  // L6 — Pillar Smart Wallet
  registerPillarTools(server);
  registerPillarDirectTools(server);
  registerFlyingWhaleTools(server);

  // L7 — Bridge
  registerStyxTools(server);

  restoreRegisterTool();
}
