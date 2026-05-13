/**
 * Prosperity Engine — The Complete Equation
 *
 * Sound Money + Transparent Resources + Open Access = Real Prosperity
 *
 * Mathematical models:
 *   Cantillon Effect   — who gains from money printing
 *   Monetary Health    — soundness score of any currency
 *   Resource Equity    — fair resource taxation model
 *   Transition Path    — fiat → sound money without losers
 *   Prosperity Index   — composite score for any economy
 */

import { createHash } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonetaryHealthResult {
  currency:          string;
  score:             number;          // 0-100 (100 = perfectly sound)
  inflation_rate:    number;          // annual %
  supply_growth:     number;          // annual %
  debt_to_gdp:       number;          // %
  purchasing_power_loss_10y: number;  // % lost over 10 years
  cantillon_gap:     number;          // wealth gap amplification factor
  verdict:           string;
  hash:              string;
}

export interface CantillonResult {
  printed_amount:    number;          // new money printed
  currency:          string;
  reaches_banks:     number;          // % reaching financial sector first
  reaches_corps:     number;          // % reaching corporations second
  reaches_middle:    number;          // % reaching middle class third
  reaches_poor:      number;          // % reaching poor (last, devalued)
  real_value_poor:   number;          // real purchasing power when it arrives
  wealth_gap_factor: number;          // how much gap widens
  hash:              string;
}

export interface ResourceTaxModel {
  resource:          string;
  current_user:      string;          // who uses it now
  annual_value:      number;          // USD
  proposed_fee:      number;          // USD/year (fair share)
  production_tax_saved: number;       // what workers/companies save
  public_revenue:    number;          // goes to public treasury
  net_benefit_worker: number;         // worker net gain
  hash:              string;
}

export interface TransitionPath {
  country:           string;
  population:        number;
  gdp_usd:           number;
  current_debt_usd:  number;
  phase_1:           TransitionPhase;
  phase_2:           TransitionPhase;
  phase_3:           TransitionPhase;
  total_years:       number;
  citizen_benefit:   string;
  hash:              string;
}

export interface TransitionPhase {
  name:              string;
  duration_years:    number;
  actions:           string[];
  who_loses:         string;
  who_gains:         string;
}

export interface ProsperityIndex {
  economy:           string;
  score:             number;          // 0-100
  monetary_score:    number;          // sound money component
  access_score:      number;          // financial inclusion
  resource_score:    number;          // fair resource distribution
  production_score:  number;          // ease of production / low tax
  trust_score:       number;          // institutional transparency
  tier:              "critical" | "poor" | "fair" | "good" | "excellent";
  bottleneck:        string;          // biggest problem
  recommendation:    string;
  hash:              string;
}

// ── Cantillon Effect ──────────────────────────────────────────────────────────

export function computeCantillon(
  printed_amount: number,
  currency = "USD",
): CantillonResult {
  // Historical distribution based on Fed/ECB studies
  const banks_pct  = 0.45;
  const corps_pct  = 0.30;
  const middle_pct = 0.18;
  const poor_pct   = 0.07;

  // By the time money reaches the poor, inflation has already eroded 15-30%
  const devaluation_by_arrival = 0.22;
  const real_value_poor = printed_amount * poor_pct * (1 - devaluation_by_arrival);

  // Wealth gap: banks get full value, poor get devalued fraction
  const wealth_gap_factor = (banks_pct) / (poor_pct * (1 - devaluation_by_arrival));

  const hash = createHash("sha256")
    .update(`cantillon:${printed_amount}:${currency}:${Date.now()}`)
    .digest("hex");

  return {
    printed_amount,
    currency,
    reaches_banks:    banks_pct  * 100,
    reaches_corps:    corps_pct  * 100,
    reaches_middle:   middle_pct * 100,
    reaches_poor:     poor_pct   * 100,
    real_value_poor,
    wealth_gap_factor: parseFloat(wealth_gap_factor.toFixed(2)),
    hash,
  };
}

// ── Monetary Health ───────────────────────────────────────────────────────────

export function computeMonetaryHealth(params: {
  currency:       string;
  inflation_rate: number;   // annual %
  supply_growth:  number;   // annual % (M2 or equivalent)
  debt_to_gdp:    number;   // %
  is_fixed_supply?: boolean;
}): MonetaryHealthResult {
  const { currency, inflation_rate, supply_growth, debt_to_gdp, is_fixed_supply } = params;

  // Scoring (each 0-20)
  const inflation_score  = is_fixed_supply ? 20 : Math.max(0, 20 - inflation_rate * 2);
  const supply_score     = is_fixed_supply ? 20 : Math.max(0, 20 - supply_growth  * 1.5);
  const debt_score       = Math.max(0, 20 - (debt_to_gdp / 100) * 20);
  const sovereignty_score = is_fixed_supply ? 20 : 8;  // central bank discretion penalty
  const trust_score      = is_fixed_supply ? 20 : Math.max(0, 20 - inflation_rate * 1.5);

  const score = Math.min(100, Math.round(
    inflation_score + supply_score + debt_score + sovereignty_score + trust_score
  ));

  // Compound purchasing power loss over 10 years
  const ppl = (1 - Math.pow(1 - inflation_rate / 100, 10)) * 100;

  // Cantillon gap grows with supply growth rate
  const cantillon_gap = 1 + (supply_growth / 100) * 6.4;

  let verdict = "";
  if (score >= 80) verdict = "Sound — preserves wealth reliably";
  else if (score >= 60) verdict = "Acceptable — moderate erosion";
  else if (score >= 40) verdict = "Weak — significant wealth destruction";
  else if (score >= 20) verdict = "Failing — rapid erosion, Cantillon severe";
  else verdict = "Broken — hyperinflationary risk";

  const hash = createHash("sha256")
    .update(`monetary:${currency}:${score}:${Date.now()}`)
    .digest("hex");

  return {
    currency,
    score,
    inflation_rate,
    supply_growth,
    debt_to_gdp,
    purchasing_power_loss_10y: parseFloat(ppl.toFixed(1)),
    cantillon_gap: parseFloat(cantillon_gap.toFixed(2)),
    verdict,
    hash,
  };
}

// ── Resource Tax Model ────────────────────────────────────────────────────────

export function computeResourceTax(params: {
  resource:         string;
  current_user:     string;
  annual_value_usd: number;
  workers_in_region: number;
}): ResourceTaxModel {
  const { resource, current_user, annual_value_usd, workers_in_region } = params;

  // Fair fee = full rental value of the commons (Henry George principle)
  const proposed_fee = annual_value_usd * 0.85; // 85% of resource rent

  // Currently workers pay income/production taxes instead
  // Average production tax burden per worker ≈ 28% of wages
  const avg_wage          = 35_000;
  const production_tax_saved = workers_in_region * avg_wage * 0.28;

  // Net to public treasury after collection costs (3%)
  const public_revenue    = proposed_fee * 0.97;

  // Worker net gain = production taxes saved - share of resource fee (through services)
  const net_benefit_worker = (production_tax_saved - proposed_fee) / workers_in_region;

  const hash = createHash("sha256")
    .update(`resource:${resource}:${annual_value_usd}:${Date.now()}`)
    .digest("hex");

  return {
    resource,
    current_user,
    annual_value: annual_value_usd,
    proposed_fee: parseFloat(proposed_fee.toFixed(0)),
    production_tax_saved: parseFloat(production_tax_saved.toFixed(0)),
    public_revenue: parseFloat(public_revenue.toFixed(0)),
    net_benefit_worker: parseFloat(net_benefit_worker.toFixed(0)),
    hash,
  };
}

// ── Transition Path ───────────────────────────────────────────────────────────

export function computeTransitionPath(params: {
  country:       string;
  population:    number;
  gdp_usd:       number;
  debt_usd:      number;
}): TransitionPath {
  const { country, population, gdp_usd, debt_usd } = params;
  const debt_to_gdp = (debt_usd / gdp_usd) * 100;

  const phase_1: TransitionPhase = {
    name: "Foundation",
    duration_years: 2,
    actions: [
      "Government buys Bitcoin as reserve asset (1-5% of reserves)",
      "Stop NEW money printing — freeze supply growth",
      "Launch transparent on-chain treasury (public audit)",
      "Pilot resource tax in one sector (land/spectrum)",
    ],
    who_loses: "None — additive changes only",
    who_gains: "Citizens: inflation slows. Government: trust rises.",
  };

  const phase_2: TransitionPhase = {
    name: "Transition",
    duration_years: debt_to_gdp > 100 ? 5 : 3,
    actions: [
      "Shift income/production taxes → resource taxes gradually",
      "Bitcoin reserve grows — backs new currency issuance",
      "Open financial access — any citizen with phone gets wallet",
      "Central bank role shifts: printer → transparency guardian",
    ],
    who_loses: "Land speculators, spectrum hoarders (pay fair share now)",
    who_gains: "Workers: lower income tax. Companies: lower production cost. Poor: access to sound money.",
  };

  const phase_3: TransitionPhase = {
    name: "Prosperity",
    duration_years: 3,
    actions: [
      "Full resource-based revenue model operational",
      "Bitcoin-backed reserve — currency 100% redeemable",
      "Zero income tax on labor and production",
      "Micro-transaction public revenue from network fees",
    ],
    who_loses: "Practically no one — structural poverty eliminated",
    who_gains: "Everyone: sound money, fair taxes, open access.",
  };

  const total_years = phase_1.duration_years + phase_2.duration_years + phase_3.duration_years;

  const hash = createHash("sha256")
    .update(`transition:${country}:${gdp_usd}:${Date.now()}`)
    .digest("hex");

  return {
    country,
    population,
    gdp_usd,
    current_debt_usd: debt_usd,
    phase_1,
    phase_2,
    phase_3,
    total_years,
    citizen_benefit: `In ${total_years} years: zero production tax, sound savings, open financial access for all ${(population / 1e6).toFixed(1)}M citizens.`,
    hash,
  };
}

// ── Prosperity Index ──────────────────────────────────────────────────────────

export function computeProsperityIndex(params: {
  economy:              string;
  inflation_rate:       number;
  supply_growth:        number;
  debt_to_gdp:          number;
  banked_population_pct: number;    // % with bank access
  gini_coefficient:     number;     // 0-1 (0=perfect equality)
  production_tax_rate:  number;     // % on labor/production
  transparency_score:   number;     // 0-100 (govt transparency)
  is_bitcoin_legal:     boolean;
}): ProsperityIndex {
  const {
    economy, inflation_rate, supply_growth, debt_to_gdp,
    banked_population_pct, gini_coefficient, production_tax_rate,
    transparency_score, is_bitcoin_legal,
  } = params;

  // Monetary score (0-20)
  const monetary_score = Math.min(20, Math.max(0,
    20 - inflation_rate * 1.5 - supply_growth * 0.5 - (debt_to_gdp / 100) * 5
    + (is_bitcoin_legal ? 3 : 0)
  ));

  // Access score (0-20)
  const access_score = Math.min(20, Math.max(0,
    (banked_population_pct / 100) * 15
    + (is_bitcoin_legal ? 5 : 0)
  ));

  // Resource/equity score (0-20) — lower Gini = better
  const resource_score = Math.min(20, Math.max(0,
    (1 - gini_coefficient) * 20
  ));

  // Production score (0-20) — lower production tax = better
  const production_score = Math.min(20, Math.max(0,
    20 - production_tax_rate * 0.5
  ));

  // Trust/transparency score (0-20)
  const trust_score = Math.min(20, (transparency_score / 100) * 20);

  const score = Math.round(
    monetary_score + access_score + resource_score + production_score + trust_score
  );

  let tier: ProsperityIndex["tier"];
  if      (score >= 80) tier = "excellent";
  else if (score >= 60) tier = "good";
  else if (score >= 40) tier = "fair";
  else if (score >= 20) tier = "poor";
  else                  tier = "critical";

  // Find bottleneck
  const components = [
    { name: "monetary system",    v: monetary_score  },
    { name: "financial access",   v: access_score    },
    { name: "resource equity",    v: resource_score  },
    { name: "production freedom", v: production_score },
    { name: "transparency",       v: trust_score     },
  ];
  const bottleneck = components.sort((a,b) => a.v - b.v)[0].name;

  const recommendation = `Fix ${bottleneck} first — highest leverage point for ${economy}.`;

  const hash = createHash("sha256")
    .update(`prosperity:${economy}:${score}:${Date.now()}`)
    .digest("hex");

  return {
    economy,
    score,
    monetary_score:  parseFloat(monetary_score.toFixed(1)),
    access_score:    parseFloat(access_score.toFixed(1)),
    resource_score:  parseFloat(resource_score.toFixed(1)),
    production_score: parseFloat(production_score.toFixed(1)),
    trust_score:     parseFloat(trust_score.toFixed(1)),
    tier,
    bottleneck,
    recommendation,
    hash,
  };
}
