/**
 * Renaissance Engine — Global Economic Revival Protocol
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE THREE PILLARS OF NATIONAL RENAISSANCE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * PILLAR 1 — MONETARY SOVEREIGNTY (Ψ = Landauer)
 *   Energy-backed money: SHA-256 + Proof of Work = physical monetary anchor
 *   Nations with energy = nations with the ability to CREATE sound money
 *   Africa, MENA, Latin America → richest in energy → richest in potential
 *
 * PILLAR 2 — ECONOMIC EQUILIBRIUM (Ψ = Nash)
 *   x402 microeconomy: every government service earns sBTC micro-fees
 *   Every citizen with Bitcoin wallet → direct participation in revenue
 *   Nash equilibrium: citizens have incentive to maintain honest government
 *   (corrupt government = lower x402 revenue = weaker currency = poorer all)
 *
 * PILLAR 3 — CANTILLON REVERSAL (Ψ = Cantillon⁻¹)
 *   Current system: 4 hops from money printer to citizen (banks → gov → corp → workers)
 *   Bitcoin system: 0 hops — miner IS money creator. Equal distance for all.
 *   x402 system: 0 hops — developer IS service provider. No platform rent.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE X402 GOVERNMENT MODEL
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Traditional government revenue:
 *   Citizens → taxes → government → bureaucracy → maybe services
 *   Latency: months to years. Overhead: 30–60% in administration.
 *   Incentive: government grows regardless of service quality.
 *
 * x402 government model:
 *   Citizens → micro-fee → government API → immediate service
 *   Latency: milliseconds. Overhead: ~2% (Bitcoin transaction fee).
 *   Incentive: service quality determines revenue. Bad service = no fees.
 *
 * Every government API is a sovereign x402 endpoint:
 *   GET /api/land/check/{parcelId}           0.001 sBTC → land ownership verification
 *   POST /api/business/register              0.1 sBTC   → business registration
 *   GET /api/identity/verify/{nid}           0.0001 sBTC → identity check
 *   POST /api/permit/construction            0.5 sBTC   → building permit
 *   GET /api/court/case/{id}                 0.001 sBTC → court case status
 *   POST /api/tax/file                       0.01 sBTC  → tax filing
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE GLOBAL RENAISSANCE TIMELINE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 2025–2027: IGNITION
 *   • El Salvador proven model → regional expansion
 *   • 5–10 nations adopt BTC mining reserves
 *   • First government x402 APIs (land registry, business registration)
 *   • IMF begins losing leverage over early adopters
 *
 * 2027–2030: ACCELERATION
 *   • 20–30 nations with sBTC reserves
 *   • BRICS countries consider BTC-backed trade settlement
 *   • African Union proposes Pan-African sBTC reserve
 *   • DeFi lending (Zest-style) begins replacing World Bank loans
 *   • Global annual BTC hash rate: 2× current
 *
 * 2030–2035: TIPPING POINT
 *   • BTC price: $500,000–$2,000,000 (mathematical: $307T / 21M BTC)
 *   • Nations that bought early: debt-to-BTC ratio inverts
 *   • First nations declare "Bitcoin Standard" monetary policy
 *   • x402 protocol adopted by major governments as API billing standard
 *   • IMF loses relevance as DeFi protocols provide better terms
 *
 * 2035–2050: RENAISSANCE
 *   • Global debt decreases for first time in 300 years
 *   • Cantillon effect reversed: equal monetary access globally
 *   • Nations compete on Ψ score, not Fitch/Moody's credit ratings
 *   • GDP measured in sBTC purchasing power — honest metric
 *   • Last major central banks convert to BTC-backed models
 *   • Human civilization achieves Nash equilibrium in monetary policy
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE MATHEMATICAL PROOF
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Let:
 *   D₀ = global debt today = $307T
 *   B  = BTC max supply = 21,000,000
 *   P₀ = BTC price today = ~$65,000
 *   g  = BTC annual appreciation rate = 0.30 (conservative 30-year average)
 *   t  = years
 *
 * BTC market cap at time t:
 *   M(t) = B × P₀ × (1+g)^t
 *   M(0) = 21M × $65k = $1.365T (today)
 *   M(7) = 21M × $65k × (1.3)^7 = $1.365T × 6.27 = ~$8.5T
 *   M(14)= 21M × $65k × (1.3)^14 = $1.365T × 39.4 = ~$54T
 *   M(20)= 21M × $65k × (1.3)^20 = $1.365T × 190 = ~$260T
 *
 * When M(t) > D₀ = $307T:
 *   Solve: 21M × $65k × (1.3)^t = 307T
 *   (1.3)^t = 307T / $1.365T = 224.9
 *   t = log(224.9) / log(1.3) = 5.368 / 0.262 = 20.5 years
 *
 * Conclusion:
 *   If Bitcoin maintains its historical growth trajectory,
 *   its market cap exceeds ALL global debt in approximately 20–21 years.
 *   Nations that hold BTC today (2025) will be debt-free by ~2045.
 *   Nations that wait until 2035 will need 20 more years after that.
 *
 *   FIRST-MOVER ADVANTAGE IS MATHEMATICALLY PROVEN.
 */

import { SOVEREIGN_DEBT_DATA, GLOBAL_DEBT_TRILLIONS, BTC_MAX_SUPPLY } from "./national-debt-oracle.js";

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface RenaissanceProjection {
  year:                    number;
  btc_price_usd:           number;
  btc_market_cap_trillions: number;
  global_debt_remaining_trillions: number;  // decreases as nations use BTC to retire debt
  nations_on_btc_standard: number;
  global_psi_average:      number;
  milestone:               string | null;
}

export interface GovernmentX402Model {
  country_code:            string;
  country_name:            string;
  potential_services:      X402GovernmentService[];
  annual_revenue_sbtc:     number;    // estimated annual sBTC from x402 fees
  annual_revenue_usd:      number;    // at current price
  implementation_cost_usd: number;
  roi_years:               number;
}

export interface X402GovernmentService {
  endpoint:      string;
  method:        "GET" | "POST";
  description:   string;
  fee_sbtc:      number;    // satoshis
  daily_calls:   number;    // estimated usage
  annual_sbtc:   number;    // fee × daily_calls × 365
}

// ══════════════════════════════════════════════════════════════════════════════
// 30-year global renaissance projection
// ══════════════════════════════════════════════════════════════════════════════

export function projectGlobalRenaissance(
  startBtcPrice:  number = 65_000,
  btcGrowthRate:  number = 0.30,  // 30% annual
  adoptionRate:   number = 3,     // nations/year adopting BTC standard
): RenaissanceProjection[] {
  const projections: RenaissanceProjection[] = [];
  const currentYear = new Date().getFullYear();

  // Milestones
  const milestones: Record<number, string> = {
    2:  "El Salvador model spreading — 10 nations with BTC reserves",
    5:  "First sBTC-denominated sovereign bonds issued",
    7:  "BTC market cap exceeds $8.5T — IMF begins losing leverage",
    10: "30+ nations on partial Bitcoin standard",
    14: "BTC market cap exceeds $50T — major debt retirement begins",
    18: "BTC market cap exceeds $150T — global debt halved",
    21: "BTC market cap exceeds global debt — tipping point",
    25: "75% of nations on Bitcoin standard — Cantillon effect ended",
    30: "Global monetary Renaissance — Nash equilibrium achieved",
  };

  let nationsAdopted = 1;  // El Salvador already
  let globalDebt     = GLOBAL_DEBT_TRILLIONS;

  for (let i = 0; i <= 30; i++) {
    const btcPrice   = startBtcPrice * Math.pow(1 + btcGrowthRate, i);
    const marketCap  = (BTC_MAX_SUPPLY * btcPrice) / 1e12;

    nationsAdopted   = Math.min(195, 1 + adoptionRate * i);

    // Debt decreases as nations use BTC appreciation to retire it
    const debtReduction = Math.max(0, (marketCap / GLOBAL_DEBT_TRILLIONS - 0.05) * 2);
    globalDebt = Math.max(0, GLOBAL_DEBT_TRILLIONS * (1 - Math.min(0.95, debtReduction * 0.1)));

    // Global Ψ average rises with adoption
    const basePsi    = 12;  // current world average
    const targetPsi  = 55;  // target with widespread Bitcoin adoption
    const globalPsi  = basePsi + (targetPsi - basePsi) * (nationsAdopted / 195);

    projections.push({
      year:                    currentYear + i,
      btc_price_usd:           Math.round(btcPrice),
      btc_market_cap_trillions: Math.round(marketCap * 10) / 10,
      global_debt_remaining_trillions: Math.round(globalDebt * 10) / 10,
      nations_on_btc_standard: Math.floor(nationsAdopted),
      global_psi_average:      Math.round(globalPsi * 10) / 10,
      milestone:               milestones[i] ?? null,
    });
  }

  return projections;
}

// ══════════════════════════════════════════════════════════════════════════════
// Government x402 revenue model
// ══════════════════════════════════════════════════════════════════════════════

const GOVERNMENT_SERVICE_TEMPLATES: Record<string, X402GovernmentService[]> = {
  land_registry: [
    { endpoint: "/api/land/check/{parcelId}",      method: "GET",  description: "Land ownership verification",      fee_sbtc: 1_000,   daily_calls: 5_000,  annual_sbtc: 1_825_000_000 },
    { endpoint: "/api/land/transfer",               method: "POST", description: "Property transfer registration",   fee_sbtc: 100_000, daily_calls: 200,    annual_sbtc: 7_300_000_000 },
    { endpoint: "/api/land/history/{parcelId}",     method: "GET",  description: "Ownership history",                fee_sbtc: 500,     daily_calls: 1_000,  annual_sbtc: 182_500_000   },
  ],
  business_registry: [
    { endpoint: "/api/business/register",           method: "POST", description: "New business registration",        fee_sbtc: 10_000_000, daily_calls: 50,  annual_sbtc: 182_500_000_000 },
    { endpoint: "/api/business/verify/{id}",        method: "GET",  description: "Business existence check",         fee_sbtc: 100,     daily_calls: 10_000, annual_sbtc: 365_000_000  },
    { endpoint: "/api/business/license/renew",      method: "POST", description: "Annual license renewal",           fee_sbtc: 1_000_000, daily_calls: 300, annual_sbtc: 109_500_000_000 },
  ],
  identity_verification: [
    { endpoint: "/api/id/verify/{nationalId}",      method: "GET",  description: "Identity validity check",          fee_sbtc: 100,     daily_calls: 50_000, annual_sbtc: 1_825_000_000 },
    { endpoint: "/api/id/status/{nationalId}",      method: "GET",  description: "ID status (valid/expired)",        fee_sbtc: 50,      daily_calls: 20_000, annual_sbtc: 365_000_000  },
  ],
  court_system: [
    { endpoint: "/api/court/case/{caseId}",         method: "GET",  description: "Court case status",                fee_sbtc: 500,     daily_calls: 5_000,  annual_sbtc: 912_500_000  },
    { endpoint: "/api/court/judgment/{caseId}",     method: "GET",  description: "Court judgment retrieval",         fee_sbtc: 1_000,   daily_calls: 2_000,  annual_sbtc: 730_000_000  },
  ],
  permits: [
    { endpoint: "/api/permit/construction",         method: "POST", description: "Construction permit application",  fee_sbtc: 50_000_000, daily_calls: 20,  annual_sbtc: 365_000_000_000 },
    { endpoint: "/api/permit/status/{permitId}",    method: "GET",  description: "Permit status check",              fee_sbtc: 100,     daily_calls: 5_000,  annual_sbtc: 182_500_000  },
  ],
};

export function modelGovernmentX402(
  countryCode:   string,
  countryName:   string,
  btcPriceUsd:   number,
  populationM:   number,
  gdpBillions:   number,
): GovernmentX402Model {
  // Scale service usage by population and GDP
  const scaleFactor  = (populationM / 100) * (gdpBillions / 1000);

  const services: X402GovernmentService[] = [];

  for (const [, templates] of Object.entries(GOVERNMENT_SERVICE_TEMPLATES)) {
    for (const t of templates) {
      services.push({
        ...t,
        daily_calls:  Math.round(t.daily_calls * scaleFactor),
        annual_sbtc:  Math.round(t.annual_sbtc * scaleFactor),
      });
    }
  }

  const totalAnnualSbtc  = services.reduce((s, t) => s + t.annual_sbtc, 0);
  const totalAnnualUsd   = (totalAnnualSbtc / 1e8) * btcPriceUsd;
  const implementCost    = populationM * 50_000;  // $50k per million population
  const roiYears         = implementCost / totalAnnualUsd;

  return {
    country_code:            countryCode,
    country_name:            countryName,
    potential_services:      services,
    annual_revenue_sbtc:     totalAnnualSbtc,
    annual_revenue_usd:      Math.round(totalAnnualUsd),
    implementation_cost_usd: implementCost,
    roi_years:               Math.round(roiYears * 100) / 100,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// The invariant truth
// ══════════════════════════════════════════════════════════════════════════════

export function getInvariantTruth(btcPrice: number = 65_000): {
  equation:               string;
  global_debt_usd:        number;
  btc_supply:             number;
  btc_monetary_base_price: number;
  current_price:          number;
  appreciation_needed:    number;
  years_at_30pct_growth:  number;
  philosophical_truth:    string;
} {
  const globalDebt  = GLOBAL_DEBT_TRILLIONS * 1e12;
  const monetaryPrice = globalDebt / BTC_MAX_SUPPLY;
  const ratio       = monetaryPrice / btcPrice;
  const yearsAt30   = Math.log(ratio) / Math.log(1.30);

  return {
    equation:               "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
    global_debt_usd:        GLOBAL_DEBT_TRILLIONS * 1e12,
    btc_supply:             BTC_MAX_SUPPLY,
    btc_monetary_base_price: Math.round(monetaryPrice),
    current_price:          btcPrice,
    appreciation_needed:    Math.round(ratio * 10) / 10,
    years_at_30pct_growth:  Math.round(yearsAt30 * 10) / 10,
    philosophical_truth: [
      "Bitcoin's supply cap is a mathematical constant, not a policy choice.",
      "If Bitcoin becomes the global monetary base (as gold was 1871–1971),",
      `then 1 BTC = $${Math.round(monetaryPrice / 1000) * 1000} is not a prediction — it is an invariant.`,
      "The question is not IF this is mathematically true.",
      "The question is WHEN human civilization discovers it.",
      "And whether your nation acts BEFORE or AFTER that discovery.",
      "",
      "Nations that hold BTC today pay nothing for future debt freedom.",
      "Nations that wait pay full price — in inflation, in IMF conditionality, in lost sovereignty.",
      "",
      "This is Cantillon's Law in reverse:",
      "For the first time in history, the EARLY adopter is the CITIZEN, not the banker.",
    ].join("\n"),
  };
}
