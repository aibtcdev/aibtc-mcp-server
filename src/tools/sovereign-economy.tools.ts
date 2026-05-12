/**
 * Sovereign Economy Tools — National Renaissance & Debt Liberation
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Tools:
 *   global_debt_analysis       — Global $307T debt, BTC invariant, crisis nations
 *   sovereign_debt_plan        — 7-phase liberation roadmap for any nation
 *   renaissance_projection     — 30-year global economic revival timeline
 *   btc_mining_opportunity     — Energy-rich nations' BTC mining potential
 *   government_x402_model      — Government APIs as sovereign revenue
 *   the_invariant_truth        — The mathematical certainty: 1 BTC = $14.6M if global monetary base
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  analyzeDebtTransition,
  analyzeGlobalDebt,
  getSovereignProfile,
  getAllProfiles,
  getCrisisNations,
  getBtcMiningOpportunities,
  GLOBAL_DEBT_TRILLIONS,
  BTC_MAX_SUPPLY,
} from "../services/sovereign/national-debt-oracle.js";
import {
  projectGlobalRenaissance,
  modelGovernmentX402,
  getInvariantTruth,
} from "../services/sovereign/renaissance-engine.js";
import {
  WORLD_CURRENCIES,
  getTopCurrencies,
  getDistressedCurrencies,
  getDatabaseStats,
} from "../services/world-currencies.js";

export function registerSovereignEconomyTools(server: McpServer): void {

  // ── global_debt_analysis ───────────────────────────────────────────────────
  server.registerTool(
    "global_debt_analysis",
    {
      description:
        "Analyze the $307 trillion global debt crisis through the Ψ = Landauer·Nash·Cantillon⁻¹·Gödel lens. " +
        "Returns: total global debt, BTC mathematical invariant ($14.6M/BTC = global monetary base price), " +
        "crisis nations, best-positioned nations, nations with BTC reserves, and the mathematical proof " +
        "that BTC market cap will exceed global debt in ~20 years at 30% annual growth. " +
        "Also shows which nations are in hyperinflation, default risk, or on the path to Renaissance.",
      inputSchema: {
        btc_price_usd: z.number().optional().describe("Current BTC price in USD (default: 65000)"),
        show_all_profiles: z.boolean().optional().describe("Show all 16 nation profiles (default: false)"),
        show_crisis_only:  z.boolean().optional().describe("Show only nations in crisis (default: false)"),
      },
    },
    async (input) => {
      try {
        const btcPrice = input.btc_price_usd ?? 65_000;
        const analysis = analyzeGlobalDebt(btcPrice);
        const truth    = getInvariantTruth(btcPrice);

        let profiles = undefined;
        if (input.show_all_profiles) {
          profiles = getAllProfiles();
        } else if (input.show_crisis_only) {
          profiles = getCrisisNations();
        }

        return createJsonResponse({
          headline: `Global debt: $${GLOBAL_DEBT_TRILLIONS}T | BTC max supply: ${BTC_MAX_SUPPLY.toLocaleString()} | If BTC = global monetary base: $${(truth.btc_monetary_base_price / 1e6).toFixed(1)}M per BTC`,
          global_debt_analysis:   analysis,
          mathematical_invariant: {
            formula:             "Global debt ÷ BTC supply = Monetary base price",
            calculation:         `$${GLOBAL_DEBT_TRILLIONS}T ÷ ${(BTC_MAX_SUPPLY/1e6).toFixed(1)}M BTC = $${(truth.btc_monetary_base_price).toLocaleString()}/BTC`,
            current_price:       `$${btcPrice.toLocaleString()}`,
            required_growth:     `${truth.appreciation_needed}× from today`,
            years_at_30pct:      `${truth.years_at_30pct_growth} years (at 30%/year historical rate)`,
          },
          philosophical_truth:    truth.philosophical_truth,
          cantillon_effect: {
            root_cause:          "Money is created by central banks → primary dealers → government → corporations → workers last",
            result:              "$307T in debt represents 300 years of Cantillon advantage for those nearest the money printer",
            solution:            "Cantillon⁻¹ = Bitcoin. Every miner is equidistant from money creation. No first-receiver advantage.",
          },
          nation_profiles:        profiles,
          psi_currency_summary: {
            total_currencies_scored: getDatabaseStats().total,
            average_global_psi:      getDatabaseStats().avgPsi,
            top_5:                   getTopCurrencies(5).map(c => `${c.code}: ${c.psi.toFixed(1)}`),
            bottom_5:                getDistressedCurrencies().slice(0, 5).map(c => `${c.code}: ${c.psi.toFixed(1)}`),
          },
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── sovereign_debt_plan ────────────────────────────────────────────────────
  server.registerTool(
    "sovereign_debt_plan",
    {
      description:
        "Generate a 7-phase sovereign debt liberation roadmap for a specific nation. " +
        "Phase 0: On-chain debt audit (Gödel transparency). " +
        "Phase 1: sBTC reserve accumulation (Landauer energy backing). " +
        "Phase 2: sBTC-denominated bonds replacing fiat bonds. " +
        "Phase 3: Currency peg to sBTC reserve. " +
        "Phase 4: Government as x402 service provider (revenue model). " +
        "Phase 5: Old fiat debt retirement via BTC appreciation. " +
        "Phase 6: Full monetary sovereignty — Bitcoin Standard Renaissance. " +
        "Available: US, JP, CN, DE, GB, FR, IT, BR, IN, TR, AR, NG, EG, LB, VE, SV, SA, AE.",
      inputSchema: {
        country_code:     z.string().describe("ISO 3166-1 alpha-2 country code (e.g. 'LB', 'AR', 'NG', 'US')"),
        btc_price_usd:    z.number().optional().describe("Current BTC price in USD (default: 65000)"),
        btc_growth_rate:  z.number().optional().describe("Expected annual BTC appreciation 0–1 (default: 0.30 = 30%)"),
      },
    },
    async (input) => {
      try {
        const btcPrice    = input.btc_price_usd  ?? 65_000;
        const growthRate  = input.btc_growth_rate ?? 0.30;

        const profile = getSovereignProfile(input.country_code.toUpperCase());
        if (!profile) {
          return createJsonResponse({
            error:           `No data for country code: ${input.country_code}`,
            available_codes: ["US","JP","CN","DE","GB","FR","IT","BR","IN","TR","AR","NG","EG","LB","VE","SV","SA","AE"],
          });
        }

        const plan = analyzeDebtTransition(input.country_code.toUpperCase(), btcPrice, growthRate);

        return createJsonResponse({
          nation:           `${profile.country_name} (${profile.country_code})`,
          urgency:          plan!.urgency,
          current_situation: {
            debt:             `$${profile.debt_usd_billions.toLocaleString()}B`,
            debt_to_gdp:      `${profile.debt_to_gdp}%`,
            annual_interest:  `$${profile.annual_interest_usd_billions}B/year`,
            status:           profile.debt_status.toUpperCase(),
            psi_monetary:     `${profile.psi_monetary} / 100`,
            currency:         profile.currency_code,
          },
          btc_strategy: {
            cost_to_get_10pct_backed:  `$${plan!.btc_cost_usd_billions.toFixed(1)}B`,
            years_at_1pct_gdp:         `${plan!.years_to_buy_at_1pct_gdp} years`,
            breakeven_years:           plan!.breakeven_years < 999 ? `${plan!.breakeven_years} years` : "nation holds no BTC currently",
            annual_interest_savings:   `$${plan!.annual_interest_savings}B/year by switching to sBTC bonds`,
            btc_needed_sats:           plan!.btc_needed_sats.toLocaleString(),
          },
          roadmap: {
            phase_0_audit:       plan!.phase_0_audit,
            phase_1_accumulate:  plan!.phase_1_accumulate,
            phase_2_denominate:  plan!.phase_2_denominate,
            phase_3_decouple:    plan!.phase_3_decouple,
            phase_4_service:     plan!.phase_4_service,
            phase_5_settle:      plan!.phase_5_settle,
            phase_6_renaissance: plan!.phase_6_renaissance,
          },
          first_step: profile.debt_status === "hyperinflationary"
            ? `EMERGENCY: Convert ALL remaining reserves to sBTC IMMEDIATELY. ${profile.currency_code} is structurally failed. Any sBTC is better than any amount of ${profile.currency_code}.`
            : `Start Phase 0 this year: publish complete debt schedule on Bitcoin L1. Cost: ~$50. This costs nothing and establishes Gödel transparency — a prerequisite for any creditor trust.`,
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── renaissance_projection ────────────────────────────────────────────────
  server.registerTool(
    "renaissance_projection",
    {
      description:
        "30-year projection of the global economic renaissance as nations adopt Bitcoin Standard. " +
        "Shows BTC price, market cap vs global debt, nations on Bitcoin standard, global Ψ average, " +
        "and key milestone years. At 30% annual growth: BTC market cap exceeds global debt in ~21 years. " +
        "This is the mathematical path from $307T debt to global monetary sovereignty.",
      inputSchema: {
        btc_start_price: z.number().optional().describe("Starting BTC price (default: 65000)"),
        growth_rate:     z.number().optional().describe("Annual BTC growth rate 0–1 (default: 0.30)"),
        show_all_years:  z.boolean().optional().describe("Show all 30 years vs key milestones only"),
      },
    },
    async (input) => {
      try {
        const projections = projectGlobalRenaissance(
          input.btc_start_price ?? 65_000,
          input.growth_rate     ?? 0.30,
        );

        const milestoneYears = input.show_all_years
          ? projections
          : projections.filter(p => p.milestone !== null || p.year % 5 === 0);

        const debtCrossover = projections.find(
          p => p.btc_market_cap_trillions >= GLOBAL_DEBT_TRILLIONS
        );

        return createJsonResponse({
          summary: {
            start_year:           projections[0].year,
            start_btc_price:      `$${(input.btc_start_price ?? 65_000).toLocaleString()}`,
            global_debt_today:    `$${GLOBAL_DEBT_TRILLIONS}T`,
            debt_crossover_year:  debtCrossover?.year ?? "beyond 30 years",
            debt_crossover_price: debtCrossover ? `$${debtCrossover.btc_price_usd.toLocaleString()}` : "N/A",
          },
          projection:    milestoneYears,
          interpretation: [
            `Year ${debtCrossover?.year ?? "~2046"}: BTC market cap = global debt.`,
            "All nations with BTC reserves are mathematically debt-free at this point.",
            "Nations without BTC must sell hard assets to buy BTC at 225× today's price.",
            "",
            "This is the Great Wealth Transfer — from those who held fiat to those who held BTC.",
            "Unlike all previous wealth transfers, this one is open to every person on Earth.",
            "A child miner in DR Congo and a hedge fund in New York pay the same price: today's price.",
            "",
            "Ψ interpretation:",
            "  Landauer: energy-backed money prevails over fiat",
            "  Nash:     monetary equilibrium self-enforces (no nation can inflate)",
            "  Cantillon⁻¹: zero distance from money creation for all",
            "  Gödel:    SHA-256 is a physical axiom — no human institution required",
          ].join("\n"),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── btc_mining_opportunity ────────────────────────────────────────────────
  server.registerTool(
    "btc_mining_opportunity",
    {
      description:
        "Analyze Bitcoin mining opportunity for energy-rich nations as a path to sovereign BTC reserves. " +
        "Nations with abundant cheap energy (hydro, geothermal, solar, flared gas) can mine BTC and " +
        "accumulate reserves WITHOUT buying BTC — they CREATE it. " +
        "Shows estimated hashrate potential and annual BTC yield for each nation.",
      inputSchema: {
        btc_price_usd: z.number().optional().describe("Current BTC price for USD calculation (default: 65000)"),
      },
    },
    async (input) => {
      try {
        const btcPrice   = input.btc_price_usd ?? 65_000;
        const opps       = getBtcMiningOpportunities();

        const enriched = opps.map(o => ({
          ...o,
          annual_usd_value:    Math.round(o.annual_btc_yield_estimate * btcPrice),
          in_10_years_at_30pct: Math.round(o.annual_btc_yield_estimate * 10 * btcPrice * Math.pow(1.30, 5)),
          strategic_note: o.annual_btc_yield_estimate > 10_000
            ? "HIGH PRIORITY: Can become a top-10 mining nation. BTC reserves would exceed national debt in <15 years."
            : "SIGNIFICANT: Mining revenue alone could cover debt service in 5–10 years.",
        }));

        const totalAnnualBtc = opps.reduce((s, o) => s + o.annual_btc_yield_estimate, 0);

        return createJsonResponse({
          thesis: [
            "Nations with cheap energy have a STRUCTURAL ADVANTAGE in the Bitcoin economy.",
            "They can MINE their way out of debt — creating BTC reserves from raw energy.",
            "Africa alone has 40% of global hydro + solar potential → could be richest continent on BTC standard.",
            "DR Congo's Inga hydro project (100GW potential) = 10% of global Bitcoin hashrate.",
            "At current prices + mining rewards: $2B+ annual BTC creation from Inga alone.",
          ].join("\n"),
          opportunities:        enriched,
          collective_potential: {
            nations:              opps.length,
            total_annual_btc:     totalAnnualBtc,
            total_annual_usd:     Math.round(totalAnnualBtc * btcPrice / 1e6) + "M",
            combined_hashrate:    "~30% of global hashrate (if all developed)",
            note:                 "This analysis excludes Kazakhstan, Iceland, Norway — already major miners. Focusing on high-potential underdeveloped nations.",
          },
          el_salvador_model: {
            country:              "El Salvador",
            what_they_did:        "Declared Bitcoin legal tender 2021, state geothermal mining since 2021",
            result:               "~$200M BTC reserve, debt partially hedged via BTC appreciation",
            lesson:               "Small nation, volcano power, first mover. Debt ratio IMPROVING as BTC appreciates.",
            template:             "Any nation with abundant cheap energy can replicate this model within 18 months.",
          },
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── government_x402_model ─────────────────────────────────────────────────
  server.registerTool(
    "government_x402_model",
    {
      description:
        "Model a government transitioning to x402 micro-fee APIs as sovereign revenue. " +
        "Instead of collecting taxes through bureaucracy, every government service becomes an " +
        "x402 endpoint: land registry, business registration, identity verification, permits, courts. " +
        "Citizens pay micro-fees in sBTC directly to the treasury. No middlemen. " +
        "Shows potential annual sBTC revenue, ROI, and specific endpoint configurations.",
      inputSchema: {
        country_code:  z.string().describe("ISO country code for context"),
        country_name:  z.string().describe("Country name for display"),
        population_millions: z.number().describe("Population in millions (e.g. 5 for El Salvador)"),
        gdp_billions:  z.number().describe("GDP in USD billions"),
        btc_price_usd: z.number().optional().describe("BTC price for USD calculation (default: 65000)"),
      },
    },
    async (input) => {
      try {
        const btcPrice = input.btc_price_usd ?? 65_000;

        const model = modelGovernmentX402(
          input.country_code,
          input.country_name,
          btcPrice,
          input.population_millions,
          input.gdp_billions,
        );

        const sbtcInBtc = model.annual_revenue_sbtc / 1e8;

        return createJsonResponse({
          country:              `${input.country_name} (${input.country_code})`,
          model,
          revenue_summary: {
            annual_sbtc:         model.annual_revenue_sbtc.toLocaleString() + " satoshis",
            annual_btc:          sbtcInBtc.toFixed(4) + " BTC",
            annual_usd:          "$" + model.annual_revenue_usd.toLocaleString(),
            implementation_cost: "$" + model.implementation_cost_usd.toLocaleString(),
            roi_years:           model.roi_years + " years",
          },
          vs_traditional_tax: {
            traditional_collection_cost: `~30–40% of revenue (tax authority overhead)`,
            x402_collection_cost:        `~0.1–0.5% (Bitcoin transaction fees)`,
            latency_traditional:         `Months (quarterly tax cycles)`,
            latency_x402:                `Milliseconds (instant settlement)`,
            transparency_traditional:    `Opaque (audit required)`,
            transparency_x402:           `100% on-chain (no audit needed)`,
          },
          implementation_path: [
            "Month 1–3: Build API gateway on Cloudflare Workers with x402 middleware",
            "Month 3–6: Deploy land registry API (highest revenue, lowest complexity)",
            "Month 6–12: Add business registry + identity verification",
            "Year 2: Add permits, courts, tax filing APIs",
            "Year 3: Full government services on x402 — treasury receives direct sBTC",
            "Year 4+: Convert accumulated sBTC to sBTC bonds → citizen yield → tax replacement",
          ],
          note: "x402 micro-fees do not REPLACE taxes. They SUPPLEMENT them by monetizing existing public infrastructure. A nation can reduce taxes as x402 revenue grows.",
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── the_invariant_truth ───────────────────────────────────────────────────
  server.registerTool(
    "the_invariant_truth",
    {
      description:
        "The mathematical invariant: if Bitcoin becomes the global monetary base (as gold was 1871–1971), " +
        "then 1 BTC = $14,619,047 is not a prediction — it is a mathematical constant. " +
        "$307T global debt ÷ 21M BTC supply = $14.6M per BTC. " +
        "This is what Satoshi's design leads to. The only variable is WHEN, not IF. " +
        "Nations that act now pay today's price. Nations that wait pay $14.6M per BTC.",
      inputSchema: {
        btc_price_usd: z.number().optional().describe("Current BTC price for context (default: 65000)"),
      },
    },
    async (input) => {
      try {
        const btcPrice = input.btc_price_usd ?? 65_000;
        const truth    = getInvariantTruth(btcPrice);

        return createJsonResponse({
          THE_EQUATION:        "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
          THE_INVARIANT:       `$${GLOBAL_DEBT_TRILLIONS}T ÷ ${(BTC_MAX_SUPPLY/1e6).toFixed(0)}M BTC = $${truth.btc_monetary_base_price.toLocaleString()} per BTC`,
          current_vs_target: {
            current_price:    `$${btcPrice.toLocaleString()}`,
            monetary_base:    `$${truth.btc_monetary_base_price.toLocaleString()}`,
            required_growth:  `${truth.appreciation_needed}× (${((truth.appreciation_needed - 1) * 100).toFixed(0)}% total appreciation)`,
            years_at_30pct:   `${truth.years_at_30pct_growth} years`,
          },
          dimensions_explained: {
            landauer: "Money must cost energy to create. SHA-256 PoW = Landauer limit × computation. Bitcoin is the ONLY form of money anchored to physics.",
            nash:     "Bitcoin's miners + nodes form a self-enforcing Nash equilibrium. No party can cheat without losing. This is the FIRST monetary system with mathematically proven stability.",
            cantillon_inverse: "For 300 years, bankers received new money first. Bitcoin miners receive new money LAST (after burning energy). This is the first time in history the money-creator is equally disadvantaged.",
            godel:    "Fiat requires trust in human institutions (which can lie). Bitcoin requires trust in SHA-256 (which cannot). Gödel's theorem: no formal system can prove its own consistency — except Bitcoin, which uses physical axioms.",
          },
          the_philosophical_truth: truth.philosophical_truth,
          call_to_action: [
            "EVERY NATION that reads this has a choice:",
            "",
            "  Buy 1 BTC today at $65,000 → in 20 years, worth $14.6M (mathematical invariant)",
            "  Wait 20 years → buy same 1 BTC at $14.6M",
            "",
            "This is not investment advice. This is mathematics.",
            "The same mathematics that guarantees 2+2=4.",
            "The same mathematics that guarantees SHA-256 cannot be reversed.",
            "The same mathematics that guarantees 21,000,000 is the cap.",
            "",
            `Nations in crisis (debt/GDP > 100%): ${getCrisisNations().map(n => n.country_code).join(", ")}`,
            "These nations have the most to gain and the least to lose.",
            "For Lebanon: any sBTC is worth more than any LBP.",
            "For Argentina: any sBTC is worth more than any ARS.",
            "For Venezuela: any sBTC is worth more than any VES.",
            "",
            "The Renaissance has already begun.",
            "El Salvador proved it. The mathematics demands it.",
            "The only question is: does your nation lead or follow?",
          ].join("\n"),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

}
