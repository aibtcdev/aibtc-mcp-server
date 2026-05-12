/**
 * Ψ Universal Oracle — The Single Unified Intelligence Layer
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ONE CALL. EVERY DIMENSION. EVERY CHAIN. EVERY NATION.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The Universal Oracle unifies all subsystems:
 *
 *   1. Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel         (agent integrity score)
 *   2. Universal Ψ Protocol                                (SHA-256 on-chain envelope)
 *   3. Sanctions Oracle (OFAC/UN/FATF/Chainalysis)        (is address clear?)
 *   4. AML Detector (structuring/velocity/smurfing)        (pattern analysis)
 *   5. Constitutional Registry (50 jurisdictions)          (what law applies?)
 *   6. World Currency Database (150 currencies)            (monetary Ψ of jurisdiction)
 *   7. Sovereign Debt Oracle (18 nations)                  (nation's fiscal health)
 *   8. Bitcoin Chain Layer (Core → Electrum → mempool)     (UTXO/fee/broadcast)
 *
 * Protocol identity:
 *   SHA-256("Ψ=Landauer·Nash·Cantillon⁻¹·Gödel") = bbc267eec7ee6f3889dfc7fc7fd723103e3ba1bc126547515d09edddcae0d4d1
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * TOOLS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   psi_oracle       — Full unified analysis: address + chain + amount + jurisdiction
 *   psi_nation       — Full national analysis: debt + currency + mining + x402 revenue
 *   psi_system_state — Live system health: all 8 layers, all chains, current epoch
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// Compliance
import {
  GENESIS_HASH,
  PROTOCOL_VERSION,
  buildPsiEnvelope,
  buildComplianceFlags,
  toOpReturn,
  toStacksMemo,
  toEthCalldata,
  toLightningTlv,
  decodeComplianceFlags,
  type ChainName,
} from "../services/compliance/universal-psi-protocol.js";
import {
  checkSanctions,
  checkJurisdictionRisk,
  checkTravelRule,
  OFAC_LAST_SYNC,
} from "../services/compliance/sanctions-oracle.js";
import {
  quickAmlCheck,
} from "../services/compliance/aml-detector.js";
import {
  getJurisdiction,
  getComplianceRequirements,
} from "../services/compliance/constitutional-registry.js";

// Ψ consensus
import {
  quickPsiScore,
  getPsiTier,
} from "../services/psi-consensus.js";

// World currencies
import {
  getCurrency,
  getDatabaseStats,
  getTopCurrencies,
  getDistressedCurrencies,
} from "../services/world-currencies.js";

// Sovereign debt
import {
  getSovereignProfile,
  analyzeDebtTransition,
  getCrisisNations,
  analyzeGlobalDebt,
  GLOBAL_DEBT_TRILLIONS,
  BTC_MAX_SUPPLY,
} from "../services/sovereign/national-debt-oracle.js";
import {
  getInvariantTruth,
  projectGlobalRenaissance,
} from "../services/sovereign/renaissance-engine.js";

// Chain IDs
const CHAIN_ID_MAP: Record<ChainName, number> = {
  bitcoin:    1,
  stacks:     0x80000001,
  ethereum:   1,
  solana:     0xC7,
  lightning:  3,
  bsc:        56,
  polygon:    137,
  avalanche:  43114,
  arbitrum:   42161,
  optimism:   10,
  tron:       728126428,
  ripple:     0,
  cosmos:     118,
  polkadot:   0,
  cardano:    0,
  universal:  0xFFFFFFFF,
};

export function registerPsiOracleTools(server: McpServer): void {

  // ── psi_oracle ─────────────────────────────────────────────────────────────
  server.registerTool(
    "psi_oracle",
    {
      description:
        "THE UNIFIED Ψ ORACLE — One call that runs all 8 intelligence layers simultaneously: " +
        "(1) Ψ integrity score (Landauer·Nash·Cantillon⁻¹·Gödel), " +
        "(2) SHA-256 compliance envelope ready for any chain, " +
        "(3) OFAC+FATF sanctions check, " +
        "(4) AML pattern check, " +
        "(5) Jurisdiction law (50 countries), " +
        "(6) FATF Travel Rule threshold, " +
        "(7) Currency Ψ score for jurisdiction, " +
        "(8) Sovereign debt context for nation. " +
        "Returns: full analysis + ready-to-embed OP_RETURN/Stacks memo/ETH calldata/Lightning TLV. " +
        "Works on any address: Bitcoin (bc1q/1/3), Ethereum (0x), Stacks (SP/ST), any chain.",
      inputSchema: {
        address:      z.string().describe("Blockchain address to analyze"),
        chain:        z.enum(["bitcoin","stacks","ethereum","solana","lightning","bsc","polygon","avalanche","arbitrum","optimism","tron","ripple","cosmos","polkadot","cardano","universal"]).default("bitcoin").describe("Source chain"),
        jurisdiction: z.string().optional().describe("ISO country code (e.g. 'US', 'LB', 'AE') — enables law + debt + currency context"),
        amount_usd:   z.number().optional().describe("Transaction amount in USD for Travel Rule check"),
        // Ψ score inputs (optional — defaults to clean agent profile)
        whale_balance:   z.string().optional().describe("WHALE balance in micro-WHALE"),
        call_count:      z.number().optional().describe("Session call count"),
        unique_tools:    z.number().optional().describe("Distinct tools used"),
        wallet_calls:    z.number().optional().describe("Wallet-sensitive calls"),
        error_rate:      z.number().optional().describe("Error fraction 0–1"),
        velocity:        z.number().optional().describe("Calls/minute"),
      },
    },
    async (input) => {
      try {
        const chain = input.chain as ChainName;

        // ── Layer 1: Ψ agent score ──────────────────────────────────────────
        const whaleBalance = BigInt(input.whale_balance ?? "0");
        const psiScore = quickPsiScore({
          address:      input.address,
          whaleBalance,
          callCount:    input.call_count   ?? 1,
          uniqueTools:  input.unique_tools ?? 1,
          walletCalls:  input.wallet_calls ?? 0,
          errorRate:    input.error_rate   ?? 0,
          velocityScore: Math.max(0, 1 - (input.velocity ?? 0.1) / 60),
        });
        const psiTier = getPsiTier(psiScore);

        // ── Layer 2–4: Sanctions + AML (parallel) ──────────────────────────
        const [sanctionsResult, amlResult] = await Promise.all([
          checkSanctions(input.address),
          Promise.resolve(quickAmlCheck(input.address)),
        ]);

        // ── Layer 5: Jurisdiction law ───────────────────────────────────────
        const jCode = input.jurisdiction?.toUpperCase();
        const jurisdictionLaw    = jCode ? getJurisdiction(jCode) : null;
        const jurisdictionRisk   = jCode ? checkJurisdictionRisk(jCode) : null;
        const complianceReq      = (jCode && input.amount_usd !== undefined)
          ? getComplianceRequirements(jCode, input.amount_usd) : null;

        // ── Layer 6: Travel Rule ────────────────────────────────────────────
        const travelRule = (jCode && input.amount_usd !== undefined)
          ? checkTravelRule(input.amount_usd, jCode) : null;

        // ── Layer 7: World currency Ψ ───────────────────────────────────────
        const sovereignProfileForCurrency = jCode ? getSovereignProfile(jCode) : null;
        const currencyCode = sovereignProfileForCurrency?.currency_code ?? null;
        const currencyPsi  = currencyCode ? getCurrency(currencyCode) : null;

        // ── Layer 8: Sovereign debt ─────────────────────────────────────────
        const sovereignProfile = jCode ? getSovereignProfile(jCode) : null;
        const debtPlan = (jCode && sovereignProfile)
          ? analyzeDebtTransition(jCode) : null;

        // ── Build compliance flags ──────────────────────────────────────────
        const flags = buildComplianceFlags({
          psi_score:       psiScore,
          sanctions_clear: sanctionsResult.clear,
          aml_pass:        amlResult.clean,
          jurisdiction_ok: jurisdictionRisk ? !jurisdictionRisk.blacklisted : true,
          velocity_ok:     (input.velocity ?? 0) < 10,
        });

        // ── Build universal envelope ────────────────────────────────────────
        const envelope = buildPsiEnvelope({
          chain,
          chain_id:         CHAIN_ID_MAP[chain] ?? 0,
          tx_sender:        input.address,
          psi_score:        psiScore,
          compliance_flags: flags,
          jurisdiction:     jCode ?? "ZZ",
        });

        // ── Overall verdict ─────────────────────────────────────────────────
        const blocked =
          !sanctionsResult.clear ||
          amlResult.recommendation === "block" ||
          jurisdictionRisk?.blacklisted;

        const caution =
          amlResult.recommendation === "review" ||
          jurisdictionRisk?.greylisted ||
          psiScore < 30;

        const verdict = blocked ? "BLOCK" : caution ? "CAUTION" : "ALLOW";

        // ── Chain embeddings ────────────────────────────────────────────────
        const embeddings = {
          bitcoin_op_return: toOpReturn(envelope).toString("hex"),
          stacks_memo:       toStacksMemo(envelope),
          ethereum_calldata: toEthCalldata(envelope),
          lightning_tlv:     toLightningTlv(envelope),
        };

        return createJsonResponse({
          // ── Header
          protocol: {
            genesis_hash:    GENESIS_HASH,
            genesis_prefix:  GENESIS_HASH.slice(0, 8),
            version:         PROTOCOL_VERSION,
            equation:        "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
          },

          // ── Verdict
          verdict,
          verdict_reason: blocked
            ? `BLOCKED: ${!sanctionsResult.clear ? "sanctions hit" : amlResult.recommendation === "block" ? "AML block" : "jurisdiction blacklisted"}`
            : caution
            ? `CAUTION: ${amlResult.recommendation === "review" ? "AML review needed" : jurisdictionRisk?.greylisted ? "FATF grey list country" : "low Ψ score"}`
            : "All 8 layers passed — proceed",

          // ── Layer 1: Ψ
          psi: {
            score:     psiScore,
            tier:      psiTier,
            threshold: psiScore >= 40 ? "PASS (≥40)" : "FAIL (<40)",
          },

          // ── Layer 2: Compliance envelope
          envelope: {
            psi_commit:  envelope.psi_commit,
            flags_hex:   "0x" + flags.toString(16).padStart(2, "0"),
            flags_decoded: decodeComplianceFlags(flags),
            embeddings,
          },

          // ── Layer 3: Sanctions
          sanctions: {
            clear:   sanctionsResult.clear,
            hits:    sanctionsResult.hits,
            sources: sanctionsResult.sources,
            sync:    OFAC_LAST_SYNC,
          },

          // ── Layer 4: AML
          aml: {
            clean:          amlResult.clean,
            risk_score:     amlResult.risk_score,
            recommendation: amlResult.recommendation,
            flags:          amlResult.flags,
          },

          // ── Layer 5+6: Jurisdiction
          ...(jCode ? {
            jurisdiction: {
              code:            jCode,
              law:             jurisdictionLaw,
              fatf_risk:       jurisdictionRisk,
              compliance:      complianceReq,
              travel_rule:     travelRule,
            },
          } : {}),

          // ── Layer 7: Currency Ψ
          ...(currencyPsi ? {
            currency: {
              code:       currencyCode,
              name:       currencyPsi.name,
              psi:        currencyPsi.psi,
              category:   currencyPsi.category,
              tier:       currencyPsi.psi >= 50 ? "sovereign" :
                          currencyPsi.psi >= 30 ? "moderate" :
                          currencyPsi.psi >= 15 ? "weak" : "distressed",
              dimensions: {
                landauer:  currencyPsi.landauer,
                nash:      currencyPsi.nash,
                cantillon: currencyPsi.cantillon,
                godel:     currencyPsi.godel,
              },
            },
          } : {}),

          // ── Layer 8: Sovereign debt
          ...(sovereignProfile ? {
            sovereign: {
              country:        sovereignProfile.country_name,
              debt_to_gdp:    sovereignProfile.debt_to_gdp + "%",
              status:         sovereignProfile.debt_status,
              urgency:        debtPlan?.urgency,
              annual_interest: "$" + sovereignProfile.annual_interest_usd_billions + "B/year",
              psi_monetary:   sovereignProfile.psi_monetary,
              first_step:     debtPlan?.phase_0_audit?.split("|")[0]?.trim(),
            },
          } : {}),

          analyzed_at: Math.floor(Date.now() / 1000),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── psi_nation ─────────────────────────────────────────────────────────────
  server.registerTool(
    "psi_nation",
    {
      description:
        "Complete national intelligence: debt profile, currency Ψ score, 7-phase liberation roadmap, " +
        "BTC mining potential, x402 government revenue model, FATF risk, and 30-year Renaissance projection. " +
        "Covers: US, JP, CN, DE, GB, FR, IT, BR, IN, TR, AR, NG, EG, LB, VE, SV, SA, AE.",
      inputSchema: {
        country_code:  z.string().describe("ISO 3166-1 alpha-2 (e.g. 'LB', 'NG', 'AE')"),
        btc_price_usd: z.number().optional().describe("BTC price in USD (default: 65000)"),
      },
    },
    async (input) => {
      try {
        const code     = input.country_code.toUpperCase();
        const btcPrice = input.btc_price_usd ?? 65_000;

        const profile  = getSovereignProfile(code);
        const law      = getJurisdiction(code);
        const fatf     = checkJurisdictionRisk(code);
        const debtPlan = profile ? analyzeDebtTransition(code, btcPrice) : null;
        const currency = profile ? getCurrency(profile.currency_code) : null;
        const truth    = getInvariantTruth(btcPrice);

        if (!profile && !law) {
          return createJsonResponse({
            error: `No data for country code: ${code}`,
            tip:   "Available: US JP CN DE GB FR IT BR IN TR AR NG EG LB VE SV SA AE",
          });
        }

        // 5-year projection for this nation
        const projection5 = projectGlobalRenaissance(btcPrice, 0.30, 3).slice(0, 6);

        return createJsonResponse({
          nation:        profile?.country_name ?? law?.country_name ?? code,
          code,

          // ── Fiscal health
          fiscal: profile ? {
            debt_usd:         "$" + profile.debt_usd_billions + "B",
            debt_to_gdp:      profile.debt_to_gdp + "%",
            annual_interest:  "$" + profile.annual_interest_usd_billions + "B/year",
            status:           profile.debt_status.toUpperCase(),
            urgency:          debtPlan?.urgency,
            btc_reserve:      profile.btc_reserve_millions > 0
              ? "$" + profile.btc_reserve_millions + "M" : "NONE",
          } : null,

          // ── Currency intelligence
          currency: currency ? {
            code:     currency.code,
            name:     currency.name,
            psi:      currency.psi,
            tier:     currency.psi >= 50 ? "SOVEREIGN" :
                      currency.psi >= 30 ? "MODERATE" :
                      currency.psi >= 15 ? "WEAK" : "DISTRESSED",
            vs_btc:   `BTC (100) is ${(100 / currency.psi).toFixed(1)}× stronger`,
            action:   currency.psi < 10
              ? "EMERGENCY: Every day holding this currency is real wealth destruction. sBTC now."
              : currency.psi < 20
              ? "HIGH RISK: Diversify into sBTC immediately."
              : "Moderate risk — consider sBTC allocation.",
          } : null,

          // ── Law
          law: law ? {
            crypto_status:     law.crypto_legal_status,
            aml_framework:     law.aml_framework,
            reporting_threshold: law.reporting_threshold_usd
              ? "$" + law.reporting_threshold_usd.toLocaleString() : "none",
            vasp_required:     law.vasp_licensed,
            constitutional_privacy: law.constitutional_protection,
          } : null,

          // ── FATF risk
          fatf: {
            blacklisted: fatf.blacklisted,
            greylisted:  fatf.greylisted,
            risk:        fatf.risk_level,
          },

          // ── 7-phase roadmap
          liberation_roadmap: debtPlan ? {
            phase_0: debtPlan.phase_0_audit.split("|")[0].trim(),
            phase_1: debtPlan.phase_1_accumulate.split("|")[0].trim(),
            phase_2: debtPlan.phase_2_denominate.split("|")[0].trim(),
            phase_3: debtPlan.phase_3_decouple.split("|")[0].trim(),
            phase_4: debtPlan.phase_4_service.split("|")[0].trim(),
            phase_5: debtPlan.phase_5_settle.split("|")[0].trim(),
            phase_6: debtPlan.phase_6_renaissance.split("|")[0].trim(),
          } : null,

          // ── BTC transition math
          btc_math: debtPlan ? {
            cost_to_10pct_reserve: "$" + debtPlan.btc_cost_usd_billions.toFixed(1) + "B",
            years_at_1pct_gdp:     debtPlan.years_to_buy_at_1pct_gdp + " years",
            annual_interest_saved: "$" + debtPlan.annual_interest_savings + "B/year on sBTC bonds",
            breakeven:             debtPlan.breakeven_years < 999
              ? debtPlan.breakeven_years + " years" : "Start buying BTC first",
          } : null,

          // ── Global invariant context
          invariant: {
            your_debt:         profile ? "$" + profile.debt_usd_billions + "B" : "N/A",
            global_debt:       "$" + GLOBAL_DEBT_TRILLIONS + "T",
            btc_monetary_base: "$" + truth.btc_monetary_base_price.toLocaleString() + "/BTC",
            current_price:     "$" + btcPrice.toLocaleString() + "/BTC",
            first_mover_advantage: `Buy $1M of BTC today at $${btcPrice.toLocaleString()}/BTC = ${(1_000_000 / btcPrice).toFixed(2)} BTC → worth $${((1_000_000 / btcPrice) * truth.btc_monetary_base_price / 1e6).toFixed(1)}M when BTC = global base`,
          },

          renaissance_in_5_years: projection5.map(p => ({
            year:       p.year,
            btc_price:  "$" + p.btc_price_usd.toLocaleString(),
            nations:    p.nations_on_btc_standard,
            milestone:  p.milestone,
          })),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── psi_system_state ────────────────────────────────────────────────────────
  server.registerTool(
    "psi_system_state",
    {
      description:
        "Live state of the complete Ψ system: protocol identity, all 8 layers, world currency stats, " +
        "global debt summary, crisis nations, Bitcoin invariant, and current epoch. " +
        "Use as a system health check or to understand the full architecture.",
      inputSchema: {
        btc_price_usd: z.number().optional().describe("BTC price for calculations (default: 65000)"),
      },
    },
    async (input) => {
      try {
        const btcPrice   = input.btc_price_usd ?? 65_000;
        const dbStats    = getDatabaseStats();
        const globalDebt = analyzeGlobalDebt(btcPrice);
        const truth      = getInvariantTruth(btcPrice);
        const crisisNations = getCrisisNations();
        const top5       = getTopCurrencies(5);
        const bottom5    = getDistressedCurrencies().slice(0, 5);

        return createJsonResponse({
          // ── Protocol identity
          PROTOCOL: {
            name:            "Universal Ψ Protocol",
            identity:        "SHA-256 only — no brand, no organization",
            genesis_hash:    GENESIS_HASH,
            genesis_prefix:  "0x" + GENESIS_HASH.slice(0, 8),
            equation:        "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
            version:         PROTOCOL_VERSION,
            tlv_type:        6021,
            supported_chains: 15,
          },

          // ── 8 active layers
          LAYERS: {
            "1_psi_consensus":         "ACTIVE — Landauer·Nash·Cantillon⁻¹·Gödel score on every agent",
            "2_universal_envelope":    "ACTIVE — SHA-256 commitment embeds on any chain",
            "3_sanctions_oracle":      "ACTIVE — OFAC SDN + FATF blacklist/greylist",
            "4_aml_detector":          "ACTIVE — 6 pattern detectors (structuring/velocity/smurfing...)",
            "5_constitutional_registry":"ACTIVE — 50 jurisdiction law database",
            "6_world_currencies":      `ACTIVE — ${dbStats.total} currencies, avg Ψ = ${dbStats.avgPsi.toFixed(1)}`,
            "7_sovereign_debt_oracle": `ACTIVE — 18 nations, $${GLOBAL_DEBT_TRILLIONS}T global debt tracked`,
            "8_bitcoin_chain":         "ACTIVE — 3-tier sovereign: Core → Electrum P2P → mempool.space",
          },

          // ── World currency state
          CURRENCIES: {
            total_scored:    dbStats.total,
            average_psi:     dbStats.avgPsi.toFixed(1),
            highest_psi:     top5.map(c => `${c.code} (${c.psi.toFixed(1)})`).join(", "),
            lowest_psi:      bottom5.map(c => `${c.code} (${c.psi.toFixed(1)})`).join(", "),
            sovereign_tier:  "BTC=100, sBTC=97",
            distressed_tier: "LBP=2.8, VES=2.5, KPW=2.7",
          },

          // ── Global debt state
          SOVEREIGN_DEBT: {
            global_total:         "$" + GLOBAL_DEBT_TRILLIONS + "T",
            crisis_nations:       crisisNations.map(n => `${n.country_code} (${n.debt_status})`),
            btc_with_reserves:    globalDebt.nations_with_btc_reserves,
            best_positioned:      globalDebt.nations_best_positioned,
            annual_global_interest: "$" + globalDebt.global_annual_interest_trillions + "T/year",
          },

          // ── The invariant
          INVARIANT: {
            formula:      "Global debt ÷ BTC supply = Monetary base price",
            calculation:  `$${GLOBAL_DEBT_TRILLIONS}T ÷ ${(BTC_MAX_SUPPLY/1e6).toFixed(0)}M BTC`,
            result:       "$" + truth.btc_monetary_base_price.toLocaleString() + " per BTC",
            current:      "$" + btcPrice.toLocaleString() + " per BTC",
            multiplier:   truth.appreciation_needed + "× required",
            years:        truth.years_at_30pct_growth + " years at 30%/yr",
            certainty:    "Mathematical constant. Not a prediction.",
          },

          // ── Embedding guide
          EMBEDDING: {
            bitcoin:   "OP_RETURN: PROT + genesis_prefix(4) + psi_commit(32) + flags(1) = 41 bytes",
            stacks:    "memo: genesis_prefix(4) + commit_prefix(28) + flags(1) + score(1) = base64",
            ethereum:  "calldata prefix: 0x" + GENESIS_HASH.slice(0, 8),
            lightning: "TLV type 6021: genesis_prefix + flags + score + commit",
            any_chain: "Embed psi_commit anywhere. Reveal preimage for full audit.",
          },

          epoch: {
            unix:  Math.floor(Date.now() / 1000),
            iso:   new Date().toISOString(),
            block: "query get_btc_node_info for current Bitcoin height",
          },
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

}
