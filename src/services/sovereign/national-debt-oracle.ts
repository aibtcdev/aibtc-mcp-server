/**
 * National Debt Oracle — Sovereign Debt Liberation Engine
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE ROOT CAUSE: THE CANTILLON EFFECT
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Richard Cantillon, 1730: "The first receivers of new money benefit most."
 *
 * Central bank creates $1 trillion:
 *   Step 1 → Primary dealers (banks) get it first     → asset prices rise
 *   Step 2 → Government spends it                     → more assets rise
 *   Step 3 → Corporations receive contracts           → stock prices rise
 *   Step 4 → Workers get wages (last)                 → everything is already expensive
 *
 * Every nation on Earth is trapped in this chain.
 * The further from the money printer, the poorer you are.
 *
 * Global debt 2025: $307 trillion (IMF)
 * That is $307 trillion of Cantillon effect, compounded for 300 years.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE SOLUTION: CANTILLON⁻¹ = BITCOIN
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Bitcoin's Cantillon⁻¹ property:
 *   ANY miner, ANYWHERE, is EQUALLY close to money creation.
 *   A miner in Nigeria and a miner in New York have identical distance to BTC.
 *   There is no "first receiver advantage."
 *
 * This is not a feature. It is a mathematical consequence of Proof of Work.
 * SHA-256 does not know your nationality, your bank account, or your political connections.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE DEBT ELIMINATION MECHANISM: 7-PHASE SOVEREIGN TRANSITION
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Phase 0 — AUDIT (Gödel Transparency)
 *   Nation publishes full debt schedule on-chain.
 *   All liabilities visible. No off-balance-sheet deception.
 *   Cost: zero. Tool: `sovereign_audit_debt()`
 *
 * Phase 1 — ACCUMULATION (Landauer Reserve Building)
 *   Nation begins accumulating Bitcoin/sBTC:
 *     a. Mining royalties paid in BTC (nations rich in energy → rich in BTC)
 *     b. x402 fees from government APIs → converted to sBTC
 *     c. Tourism/export revenues routed through sBTC rail
 *     d. IMF SDR allocations → convert to sBTC instead of USD
 *   Target: sBTC reserve ≥ 5% of monetary base
 *
 * Phase 2 — DENOMINATE (Nash Equilibrium Shift)
 *   New government bonds issued in sBTC, not local currency.
 *   Citizens can buy sBTC bonds directly — no bank intermediary.
 *   Old fiat bonds: continue paying (in inflating local currency — real cost falls).
 *   New sBTC bonds: fixed supply obligation — government cannot inflate these.
 *   Nash equilibrium: holders of sBTC bonds have incentive to hold government stable.
 *
 * Phase 3 — DECOUPLE (Cantillon⁻¹ Activation)
 *   Local currency pegged to sBTC reserve (like Bretton Woods but Bitcoin-backed).
 *   Money supply = verifiable on-chain reserve × multiplier.
 *   No more arbitrary money printing.
 *   IMF cannot force devaluation — reserve is on Bitcoin L1, not in Federal Reserve.
 *
 * Phase 4 — SERVICE (x402 Revenue Model)
 *   Every government API becomes an x402 endpoint.
 *   Citizens pay micro-fees directly for services.
 *   Revenue flows to national treasury in sBTC — no tax collection overhead.
 *   DeFi (Zest Protocol) replaces IMF lending: borrow against sBTC collateral.
 *   APY on sBTC deposits → nation earns yield instead of paying interest.
 *
 * Phase 5 — SETTLE (Old Debt Retirement)
 *   Old USD/EUR denominated debt: let inflation reduce real value.
 *   sBTC reserve grows faster than fiat debt's real value.
 *   Crossover point: when sBTC reserve > discounted fiat debt → debt is gone.
 *   This takes 10–20 years depending on BTC appreciation rate.
 *
 * Phase 6 — RENAISSANCE (Gödel Independence)
 *   Nation's currency is fully sBTC-backed.
 *   No central bank needed — treasury is a smart contract.
 *   Citizens vote on monetary policy via DAO (not via politicians).
 *   GDP measured in sBTC purchasing power, not nominal USD.
 *   Ψ score of nation rises toward 100 — sovereign, energy-backed, equilibrium.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE GLOBAL RENAISSANCE MODEL
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Phase A — Nations with natural resources → BTC mining → sBTC reserves
 *   Africa: 40% of world's hydro + solar → near-zero energy cost → richest miners
 *   MENA: 33% of world's energy reserves → industrial-scale mining
 *   Latin America: volcano/hydro (El Salvador model) → BTC mining reserves
 *
 * Phase B — Nations with human capital → x402 services → sBTC revenue
 *   India, Pakistan, Bangladesh: millions of developers
 *   Each developer = x402 endpoint = sBTC income, no bank, no currency exchange
 *
 * Phase C — Nations in crisis → Ψ-DeFi → escape the dollar trap
 *   Lebanon: sBTC savings survive banking collapse (Ψ = 2.8 vs LBP = 2.8)
 *   Zimbabwe: sBTC purchasing power stable (vs ZWL hyperinflation)
 *   Venezuela: BTC mining with oil-to-electricity already happening
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE MATHEMATICAL CERTAINTY
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Bitcoin supply: 21,000,000 BTC (mathematical limit)
 * Global debt: $307 trillion
 * BTC price to back all global debt: $307T / 21M = $14,619,047 per BTC
 *
 * This is not a prediction. It is an INVARIANT.
 * If Bitcoin becomes the global monetary base, this IS the price.
 * Nations that accumulate first, at today's prices, eliminate their debt for free.
 *
 * Nations that wait pay full price.
 * Nations that ban it get left behind.
 *
 * "The network is robust in its unstructured simplicity." — Satoshi, 2008
 * The global debt problem is complex. The solution is simple: energy-backed money.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Global debt data (IMF, World Bank — 2024/2025 data)
// ══════════════════════════════════════════════════════════════════════════════

export interface SovereignDebtProfile {
  country_code:       string;
  country_name:       string;
  region:             string;
  debt_usd_billions:  number;    // total public debt in $B
  gdp_usd_billions:   number;
  debt_to_gdp:        number;    // percentage
  interest_rate_pct:  number;    // average sovereign bond yield
  currency_code:      string;
  annual_interest_usd_billions: number;
  reserves_usd_billions: number; // foreign exchange reserves
  btc_reserve_millions: number;  // BTC held (0 for most)
  psi_monetary:       number;    // Ψ score of monetary system (0–100)
  debt_status:        "sustainable" | "elevated" | "critical" | "default_risk" | "hyperinflationary";
}

// Data sources: IMF World Economic Outlook 2025, World Bank
// All figures approximate — for economic modeling, not precise accounting
const SOVEREIGN_DEBT_DATA: SovereignDebtProfile[] = [
  // G7 — largest absolute debts
  {
    country_code: "US",  country_name: "United States",       region: "Americas",
    debt_usd_billions: 34_000, gdp_usd_billions: 27_360, debt_to_gdp: 124,
    interest_rate_pct: 4.5,    currency_code: "USD",
    annual_interest_usd_billions: 1_000, reserves_usd_billions: 247,
    btc_reserve_millions: 12_000, // seized BTC ~215,000 BTC (~$12B at $55k)
    psi_monetary: 18.2,          debt_status: "elevated",
  },
  {
    country_code: "JP",  country_name: "Japan",                region: "Asia",
    debt_usd_billions: 12_000, gdp_usd_billions: 4_230,  debt_to_gdp: 255,
    interest_rate_pct: 1.0,    currency_code: "JPY",
    annual_interest_usd_billions: 120,   reserves_usd_billions: 1_225,
    btc_reserve_millions: 0, psi_monetary: 15.6, debt_status: "critical",
  },
  {
    country_code: "CN",  country_name: "China",                region: "Asia",
    debt_usd_billions: 17_000, gdp_usd_billions: 17_700, debt_to_gdp: 96,
    interest_rate_pct: 3.5,    currency_code: "CNY",
    annual_interest_usd_billions: 595,   reserves_usd_billions: 3_200,
    btc_reserve_millions: 0, psi_monetary: 8.4, debt_status: "elevated",
  },
  {
    country_code: "DE",  country_name: "Germany",              region: "Europe",
    debt_usd_billions: 2_800, gdp_usd_billions: 4_460,  debt_to_gdp: 63,
    interest_rate_pct: 2.8,   currency_code: "EUR",
    annual_interest_usd_billions: 78,    reserves_usd_billions: 293,
    btc_reserve_millions: 2_600, // seized BTC ~50,000 BTC
    psi_monetary: 16.4, debt_status: "sustainable",
  },
  {
    country_code: "GB",  country_name: "United Kingdom",       region: "Europe",
    debt_usd_billions: 3_100, gdp_usd_billions: 3_080,  debt_to_gdp: 101,
    interest_rate_pct: 4.2,   currency_code: "GBP",
    annual_interest_usd_billions: 130,   reserves_usd_billions: 177,
    btc_reserve_millions: 0, psi_monetary: 14.3, debt_status: "elevated",
  },
  {
    country_code: "FR",  country_name: "France",               region: "Europe",
    debt_usd_billions: 3_300, gdp_usd_billions: 3_030,  debt_to_gdp: 109,
    interest_rate_pct: 3.1,   currency_code: "EUR",
    annual_interest_usd_billions: 102,   reserves_usd_billions: 243,
    btc_reserve_millions: 0, psi_monetary: 16.4, debt_status: "elevated",
  },
  {
    country_code: "IT",  country_name: "Italy",                region: "Europe",
    debt_usd_billions: 3_100, gdp_usd_billions: 2_170,  debt_to_gdp: 143,
    interest_rate_pct: 3.8,   currency_code: "EUR",
    annual_interest_usd_billions: 118,   reserves_usd_billions: 227,
    btc_reserve_millions: 0, psi_monetary: 16.4, debt_status: "critical",
  },

  // Emerging markets
  {
    country_code: "BR",  country_name: "Brazil",               region: "Americas",
    debt_usd_billions: 1_800, gdp_usd_billions: 2_080,  debt_to_gdp: 87,
    interest_rate_pct: 10.5,  currency_code: "BRL",
    annual_interest_usd_billions: 189,   reserves_usd_billions: 360,
    btc_reserve_millions: 0, psi_monetary: 10.2, debt_status: "elevated",
  },
  {
    country_code: "IN",  country_name: "India",                region: "Asia",
    debt_usd_billions: 3_200, gdp_usd_billions: 3_730,  debt_to_gdp: 86,
    interest_rate_pct: 7.2,   currency_code: "INR",
    annual_interest_usd_billions: 230,   reserves_usd_billions: 650,
    btc_reserve_millions: 0, psi_monetary: 11.8, debt_status: "elevated",
  },
  {
    country_code: "TR",  country_name: "Turkey",               region: "MENA",
    debt_usd_billions: 320,   gdp_usd_billions: 1_030,  debt_to_gdp: 31,
    interest_rate_pct: 40.0,  currency_code: "TRY",
    annual_interest_usd_billions: 128,   reserves_usd_billions: 140,
    btc_reserve_millions: 0, psi_monetary: 5.4, debt_status: "critical",
  },
  {
    country_code: "AR",  country_name: "Argentina",            region: "Americas",
    debt_usd_billions: 425,   gdp_usd_billions: 640,    debt_to_gdp: 66,
    interest_rate_pct: 100.0, currency_code: "ARS",
    annual_interest_usd_billions: 425,   reserves_usd_billions: 30,
    btc_reserve_millions: 0, psi_monetary: 3.2, debt_status: "default_risk",
  },
  {
    country_code: "NG",  country_name: "Nigeria",              region: "Africa",
    debt_usd_billions: 110,   gdp_usd_billions: 477,    debt_to_gdp: 23,
    interest_rate_pct: 22.0,  currency_code: "NGN",
    annual_interest_usd_billions: 24,    reserves_usd_billions: 36,
    btc_reserve_millions: 0, psi_monetary: 6.8, debt_status: "elevated",
  },
  {
    country_code: "EG",  country_name: "Egypt",                region: "MENA",
    debt_usd_billions: 360,   gdp_usd_billions: 396,    debt_to_gdp: 91,
    interest_rate_pct: 25.0,  currency_code: "EGP",
    annual_interest_usd_billions: 90,    reserves_usd_billions: 47,
    btc_reserve_millions: 0, psi_monetary: 5.1, debt_status: "critical",
  },
  {
    country_code: "LB",  country_name: "Lebanon",              region: "MENA",
    debt_usd_billions: 97,    gdp_usd_billions: 22,     debt_to_gdp: 282,
    interest_rate_pct: 0,     currency_code: "LBP",
    annual_interest_usd_billions: 0,     reserves_usd_billions: 10,
    btc_reserve_millions: 0, psi_monetary: 2.8, debt_status: "hyperinflationary",
  },
  {
    country_code: "VE",  country_name: "Venezuela",            region: "Americas",
    debt_usd_billions: 160,   gdp_usd_billions: 85,     debt_to_gdp: 188,
    interest_rate_pct: 0,     currency_code: "VES",
    annual_interest_usd_billions: 0,     reserves_usd_billions: 8,
    btc_reserve_millions: 0, psi_monetary: 2.5, debt_status: "hyperinflationary",
  },
  {
    country_code: "SV",  country_name: "El Salvador",          region: "Americas",
    debt_usd_billions: 24,    gdp_usd_billions: 32,     debt_to_gdp: 75,
    interest_rate_pct: 7.5,   currency_code: "BTC",     // Bitcoin legal tender
    annual_interest_usd_billions: 1.8,   reserves_usd_billions: 3.4,
    btc_reserve_millions: 200,           // ~$200M in BTC reserve
    psi_monetary: 61.2,                  // hybrid BTC/USD → elevated Ψ
    debt_status: "elevated",
  },
  {
    country_code: "SA",  country_name: "Saudi Arabia",         region: "MENA",
    debt_usd_billions: 320,   gdp_usd_billions: 1_100,  debt_to_gdp: 29,
    interest_rate_pct: 5.5,   currency_code: "SAR",
    annual_interest_usd_billions: 18,    reserves_usd_billions: 430,
    btc_reserve_millions: 0, psi_monetary: 12.3, debt_status: "sustainable",
  },
  {
    country_code: "AE",  country_name: "UAE",                  region: "MENA",
    debt_usd_billions: 180,   gdp_usd_billions: 510,    debt_to_gdp: 35,
    interest_rate_pct: 4.8,   currency_code: "AED",
    annual_interest_usd_billions: 8.6,   reserves_usd_billions: 240,
    btc_reserve_millions: 0, psi_monetary: 14.7, debt_status: "sustainable",
  },
];

// Global totals
const GLOBAL_DEBT_TRILLIONS = 307;
const BTC_MAX_SUPPLY = 21_000_000;

// ══════════════════════════════════════════════════════════════════════════════
// Analysis functions
// ══════════════════════════════════════════════════════════════════════════════

export interface DebtTransitionPlan {
  country_code:           string;
  country_name:           string;
  current_status:         SovereignDebtProfile["debt_status"];
  psi_monetary:           number;

  // Current debt metrics
  debt_usd_billions:      number;
  debt_to_gdp:            number;
  annual_interest_billions: number;

  // Bitcoin transition analysis
  btc_price_current:      number;
  btc_needed_sats:        number;      // satoshis to fully back monetary base
  btc_cost_usd_billions:  number;      // cost to acquire at current price
  years_to_buy_at_1pct_gdp: number;   // if nation dedicates 1% GDP/year to BTC

  // The mathematics of freedom
  btc_price_for_debt_neutral: number; // price at which current reserves cover debt
  breakeven_years:        number;      // years until BTC appreciation covers old debt
  annual_interest_savings: number;     // interest saved by switching to sBTC bonds

  // Phase roadmap
  phase_0_audit:          string;
  phase_1_accumulate:     string;
  phase_2_denominate:     string;
  phase_3_decouple:       string;
  phase_4_service:        string;
  phase_5_settle:         string;
  phase_6_renaissance:    string;

  // Priority score (lower = act faster)
  urgency:               "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export function analyzeDebtTransition(
  countryCode:    string,
  btcPriceUsd:    number = 65_000,
  btcAnnualGrowth: number = 0.30,  // 30% annual BTC appreciation (conservative)
): DebtTransitionPlan | null {
  const profile = SOVEREIGN_DEBT_DATA.find(d => d.country_code === countryCode);
  if (!profile) return null;

  // Satoshis needed to back 10% of monetary base (fractional reserve entry point)
  // Assume monetary base ≈ 30% of GDP for most nations
  const monetaryBaseUsd    = profile.gdp_usd_billions * 1e9 * 0.30;
  const tenPctReserveUsd   = monetaryBaseUsd * 0.10;
  const btcNeededSats      = Math.round((tenPctReserveUsd / btcPriceUsd) * 1e8);
  const btcCostUsdBillions = tenPctReserveUsd / 1e9;

  // Years to accumulate at 1% GDP/year dedicated to BTC
  const annualBtcBudget    = profile.gdp_usd_billions * 0.01;
  const yearsToAccumulate  = btcCostUsdBillions / annualBtcBudget;

  // BTC price needed for existing reserves to cover debt
  // (only meaningful if nation holds BTC)
  const btcHeld = profile.btc_reserve_millions * 1e6 / btcPriceUsd; // BTC units
  const btcPriceForDebtNeutral = btcHeld > 0
    ? (profile.debt_usd_billions * 1e9) / btcHeld
    : Infinity;

  // Breakeven: if nation buys BTC today, when does appreciation cover old debt?
  // Solve: btcCostUsdBillions × (1 + g)^t = debt_usd_billions
  // t = log(debt / cost) / log(1 + g)
  const breakeven_years = btcCostUsdBillions > 0 && btcCostUsdBillions < profile.debt_usd_billions
    ? Math.log(profile.debt_usd_billions / btcCostUsdBillions) / Math.log(1 + btcAnnualGrowth)
    : 999;

  // Annual interest savings if sBTC bonds replace fiat bonds (sBTC bonds yield ~3% DeFi)
  const currentInterest   = profile.annual_interest_usd_billions;
  const sbtcInterest      = profile.debt_usd_billions * 0.03;
  const annualSavings     = currentInterest - sbtcInterest;

  // Phase roadmap (specific to this nation)
  const phases = generatePhaseRoadmap(profile, btcPriceUsd, yearsToAccumulate);

  const urgency: DebtTransitionPlan["urgency"] =
    profile.debt_status === "hyperinflationary" ? "CRITICAL" :
    profile.debt_status === "default_risk"       ? "CRITICAL" :
    profile.debt_status === "critical"           ? "HIGH" :
    profile.debt_status === "elevated"           ? "MEDIUM" : "LOW";

  return {
    country_code:                profile.country_code,
    country_name:                profile.country_name,
    current_status:              profile.debt_status,
    psi_monetary:                profile.psi_monetary,
    debt_usd_billions:           profile.debt_usd_billions,
    debt_to_gdp:                 profile.debt_to_gdp,
    annual_interest_billions:    profile.annual_interest_usd_billions,
    btc_price_current:           btcPriceUsd,
    btc_needed_sats:             btcNeededSats,
    btc_cost_usd_billions:       btcCostUsdBillions,
    years_to_buy_at_1pct_gdp:    Math.round(yearsToAccumulate * 10) / 10,
    btc_price_for_debt_neutral:  Math.round(btcPriceForDebtNeutral),
    breakeven_years:             breakeven_years < 999 ? Math.round(breakeven_years * 10) / 10 : 999,
    annual_interest_savings:     Math.round(annualSavings * 10) / 10,
    ...phases,
    urgency,
  };
}

function generatePhaseRoadmap(
  profile: SovereignDebtProfile,
  btcPrice: number,
  yearsToAccumulate: number,
): Pick<DebtTransitionPlan,
  "phase_0_audit"|"phase_1_accumulate"|"phase_2_denominate"|
  "phase_3_decouple"|"phase_4_service"|"phase_5_settle"|"phase_6_renaissance"> {

  const year = new Date().getFullYear();

  return {
    phase_0_audit: [
      `[${year}] AUDIT — Publish complete debt schedule on-chain via Bitcoin OP_RETURN`,
      `Commit hash of all liabilities to blockchain for Gödel-transparent accounting.`,
      `Tool: sovereign_publish_audit(countryCode, debtData) → OP_RETURN anchor TX`,
      `Duration: 3–6 months. Cost: negligible (miners fees only).`,
    ].join(" | "),

    phase_1_accumulate: [
      `[${year}–${year+2}] ACCUMULATE — Build sBTC reserve`,
      profile.debt_status === "hyperinflationary"
        ? `EMERGENCY: Convert ALL remaining reserves to sBTC immediately. LBP/VES are zero — any sBTC is better.`
        : `Dedicate ${profile.gdp_usd_billions > 500 ? "0.5" : "1"}% of GDP/year to BTC mining + acquisition.`,
      `Mining royalties → BTC. Export receipts → sBTC. x402 API fees → sBTC.`,
      `Target: 10% of monetary base backed by sBTC in ${Math.round(yearsToAccumulate)} years.`,
    ].join(" | "),

    phase_2_denominate: [
      `[${year+2}–${year+4}] DENOMINATE — Issue first sBTC-denominated sovereign bonds`,
      `Citizens buy bonds directly via DeFi (Zest Protocol) — no bank intermediary.`,
      `Yield: ~3% DeFi rate (vs ${profile.interest_rate_pct}% current fiat rate).`,
      `Annual interest savings: ~$${Math.round((profile.annual_interest_usd_billions - profile.debt_usd_billions * 0.03) * 10) / 10}B`,
      `Old fiat bonds: continue paying (inflation erodes real obligation).`,
    ].join(" | "),

    phase_3_decouple: [
      `[${year+4}–${year+8}] DECOUPLE — Peg local currency to sBTC reserve`,
      `Currency board model: 1 ${profile.currency_code} = X satoshis (fixed, verifiable on-chain).`,
      `Money supply expansion requires sBTC reserve accumulation first.`,
      `IMF conditionality becomes irrelevant — reserve is on Bitcoin L1, not in NY.`,
      `Citizens can verify reserve in real time — no audit firm needed.`,
    ].join(" | "),

    phase_4_service: [
      `[${year+3}+] SERVICE — Government APIs as x402 endpoints`,
      `Land registry, permits, ID verification, tax filings → x402 micro-fees.`,
      `Revenue flows directly to treasury in sBTC. Zero middlemen.`,
      `DeFi lending: borrow against sBTC collateral instead of IMF loans.`,
      `Every citizen with a Bitcoin wallet is a direct taxpayer-to-service connection.`,
    ].join(" | "),

    phase_5_settle: [
      `[${year+8}–${year+15}] SETTLE — Old debt retirement via BTC appreciation`,
      `If BTC appreciates ${30}%/year, $${Math.round(profile.debt_usd_billions * 0.05)}B initial reserve → $${profile.debt_usd_billions}B in ~${Math.round(Math.log(20) / Math.log(1.3))} years.`,
      `Old USD/EUR bonds: real value falls as BTC purchasing power rises.`,
      `Crossover: when sBTC reserve > all remaining fiat obligations.`,
      `Final step: Parliament votes to declare sBTC as primary reserve asset.`,
    ].join(" | "),

    phase_6_renaissance: [
      `[${year+15}+] RENAISSANCE — Full monetary sovereignty`,
      `Currency fully sBTC-backed. Central bank dissolved (functions become smart contract).`,
      `Monetary policy set by DAO vote — not by unelected central bankers.`,
      `GDP denominated in sBTC purchasing power — immune to dollar inflation.`,
      `Ψ monetary score → approaches ${profile.psi_monetary < 50 ? "50+" : "80+"} (currently ${profile.psi_monetary}).`,
      `The nation is now on Bitcoin Standard. Debt is structurally impossible.`,
    ].join(" | "),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Global systemic analysis
// ══════════════════════════════════════════════════════════════════════════════

export interface GlobalDebtAnalysis {
  total_debt_trillions:          number;
  btc_max_supply:                number;
  btc_price_to_back_all_debt:    number;    // mathematical invariant
  nations_in_crisis:             string[];
  nations_best_positioned:       string[];
  nations_with_btc_reserves:     string[];
  global_annual_interest_trillions: number;
  if_world_went_btc_standard: {
    price_per_btc:               number;
    nations_debt_free:           string[];
    years_for_transition:        number;
    annual_interest_eliminated:  number;    // $T/year
  };
}

export function analyzeGlobalDebt(btcPrice: number = 65_000): GlobalDebtAnalysis {
  const totalDebt    = GLOBAL_DEBT_TRILLIONS * 1e12;
  const btcBacking   = totalDebt / BTC_MAX_SUPPLY;

  const crisis       = SOVEREIGN_DEBT_DATA
    .filter(d => d.debt_status === "hyperinflationary" || d.debt_status === "default_risk")
    .map(d => d.country_code);

  const bestPositioned = SOVEREIGN_DEBT_DATA
    .filter(d => d.debt_status === "sustainable" && d.reserves_usd_billions > 200)
    .sort((a, b) => b.psi_monetary - a.psi_monetary)
    .map(d => d.country_code);

  const withBtc = SOVEREIGN_DEBT_DATA
    .filter(d => d.btc_reserve_millions > 0)
    .map(d => `${d.country_code} ($${d.btc_reserve_millions}M BTC)`);

  const globalInterest = SOVEREIGN_DEBT_DATA
    .reduce((sum, d) => sum + d.annual_interest_usd_billions, 0) / 1000;

  // Nations that could become debt-free with BTC appreciation
  const debtFreeNations = SOVEREIGN_DEBT_DATA
    .filter(d => {
      const btcHeld = d.btc_reserve_millions * 1e6 / btcPrice;
      return btcHeld * btcBacking > d.debt_usd_billions * 1e9;
    })
    .map(d => d.country_code);

  return {
    total_debt_trillions:           GLOBAL_DEBT_TRILLIONS,
    btc_max_supply:                 BTC_MAX_SUPPLY,
    btc_price_to_back_all_debt:     Math.round(btcBacking),
    nations_in_crisis:              crisis,
    nations_best_positioned:        bestPositioned,
    nations_with_btc_reserves:      withBtc,
    global_annual_interest_trillions: Math.round(globalInterest * 10) / 10,
    if_world_went_btc_standard: {
      price_per_btc:               Math.round(btcBacking),
      nations_debt_free:           debtFreeNations,
      years_for_transition:        20,
      annual_interest_eliminated:  Math.round(globalInterest * 10) / 10,
    },
  };
}

export function getSovereignProfile(countryCode: string): SovereignDebtProfile | null {
  return SOVEREIGN_DEBT_DATA.find(d => d.country_code === countryCode) ?? null;
}

export function getAllProfiles(): SovereignDebtProfile[] {
  return [...SOVEREIGN_DEBT_DATA].sort((a, b) => b.debt_to_gdp - a.debt_to_gdp);
}

export function getCrisisNations(): SovereignDebtProfile[] {
  return SOVEREIGN_DEBT_DATA.filter(
    d => d.debt_status === "hyperinflationary" || d.debt_status === "default_risk" || d.debt_status === "critical"
  );
}

export function getBtcMiningOpportunities(): Array<{
  country_code: string;
  country_name: string;
  energy_advantage: string;
  estimated_hash_potential: string;
  annual_btc_yield_estimate: number;
}> {
  return [
    { country_code: "SA",  country_name: "Saudi Arabia",    energy_advantage: "Flared gas, 33% world oil reserves",  estimated_hash_potential: "5% global hashrate",   annual_btc_yield_estimate: 16_500 },
    { country_code: "AE",  country_name: "UAE",             energy_advantage: "Cheap natural gas",                   estimated_hash_potential: "3% global hashrate",   annual_btc_yield_estimate: 9_900  },
    { country_code: "NG",  country_name: "Nigeria",         energy_advantage: "Stranded gas, hydro potential",       estimated_hash_potential: "2% global hashrate",   annual_btc_yield_estimate: 6_600  },
    { country_code: "CD",  country_name: "DR Congo",        energy_advantage: "Inga hydro — 100GW potential",        estimated_hash_potential: "10% global hashrate",  annual_btc_yield_estimate: 33_000 },
    { country_code: "EG",  country_name: "Egypt",           energy_advantage: "Solar potential, Aswan hydro",        estimated_hash_potential: "1% global hashrate",   annual_btc_yield_estimate: 3_300  },
    { country_code: "VE",  country_name: "Venezuela",       energy_advantage: "Oil-to-electricity, Guri hydro",      estimated_hash_potential: "2% global hashrate",   annual_btc_yield_estimate: 6_600  },
    { country_code: "SV",  country_name: "El Salvador",     energy_advantage: "Volcano geothermal (already mining)", estimated_hash_potential: "0.5% global hashrate", annual_btc_yield_estimate: 1_650  },
    { country_code: "IN",  country_name: "India",           energy_advantage: "Solar scale, cheap hydro",            estimated_hash_potential: "4% global hashrate",   annual_btc_yield_estimate: 13_200 },
    { country_code: "TR",  country_name: "Turkey",          energy_advantage: "Geothermal, cross-border hydro",      estimated_hash_potential: "1% global hashrate",   annual_btc_yield_estimate: 3_300  },
  ];
}

export { SOVEREIGN_DEBT_DATA, GLOBAL_DEBT_TRILLIONS, BTC_MAX_SUPPLY };
