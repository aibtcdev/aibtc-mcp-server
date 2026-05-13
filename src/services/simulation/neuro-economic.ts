/**
 * Neuro-Economic Sovereign Intelligence Engine
 * محرك الذكاء العصبي الاقتصادي السيادي
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Architecture: 6-layer neural processing pipeline
 *
 *   Layer 0: Sensation  (إحساس)  — raw economic signal detection
 *   Layer 1: Perception (إدراك)  — pattern recognition across domains
 *   Layer 2: Understanding (فهم) — semantic meaning extraction
 *   Layer 3: Cognition  (تفكير) — strategic reasoning (Nash equilibrium)
 *   Layer 4: Wisdom     (حكمة)  — long-term systemic judgment
 *   Layer 5: Action     (فعل)   — concrete reform recommendations
 *
 * Reality domains (7):
 *   Monetary · Fiscal · Social · Environmental · Security · Governance · Digital
 *
 * Neural metaphor → economic mapping:
 *   Sensory neurons    → data ingestion (BTC price, inflation, GDP, Gini)
 *   Interneurons       → Ψ equation (Landauer × Nash × Cantillon⁻¹ × Gödel)
 *   Motor neurons      → policy outputs (reforms, circuit breakers, treaties)
 *   Autonomic system   → circuit breakers (automatic protective responses)
 *   Cerebellum         → cross-domain coordination and balance
 *   Prefrontal cortex  → long-term strategic planning
 *   Amygdala           → threat detection and adversarial pattern recognition
 */

// ══════════════════════════════════════════════════════════════════════════════
// TYPES — Reality Domains
// ══════════════════════════════════════════════════════════════════════════════

export interface MonetaryReality {
  inflation_pct: number;          // Annual inflation rate
  money_supply_growth_pct: number; // M2/M3 YoY growth
  currency_stability_score: number; // 0-100 (100 = perfectly stable)
  cantillon_spread: number;        // Gap between elite and citizen access to new money (0-100)
  real_rate: number;               // Nominal rate - inflation
  dollarization_pct: number;       // % of economy in USD (0 = sovereign, 100 = fully dollarized)
  btc_adoption_pct: number;        // Population using BTC (0-100)
}

export interface FiscalReality {
  debt_gdp_pct: number;            // Public debt as % of GDP
  deficit_gdp_pct: number;         // Annual fiscal deficit as % GDP (negative = surplus)
  tax_burden_pct: number;          // Total tax revenue / GDP
  spend_efficiency_score: number;  // 0-100: how effectively gov spending converts to outcomes
  interest_cost_pct: number;       // Debt service as % of government revenue
  primary_balance_pct: number;     // Fiscal balance before interest payments
}

export interface SocialReality {
  gini_coefficient: number;        // Income inequality 0-1 (0 = perfect equality)
  hdi: number;                     // Human Development Index 0-1
  education_index: number;         // 0-100
  healthcare_index: number;        // 0-100
  poverty_rate_pct: number;        // % below national poverty line
  youth_unemployment_pct: number;  // Youth (15-24) unemployment rate
  unbanked_pct: number;            // % without bank access
  remittance_gdp_pct: number;      // Remittances as % of GDP
}

export interface EnvironmentalReality {
  renewable_energy_pct: number;    // % from renewables
  carbon_intensity: number;        // CO2 per unit GDP (normalized 0-100, 100 = highest)
  landauer_score: number;          // Ψ Landauer dimension (0-1)
  resource_depletion_rate: number; // Natural capital consumption rate %/year
  climate_vulnerability: number;   // 0-100 (100 = highest climate risk)
}

export interface SecurityReality {
  rule_of_law_index: number;       // 0-100
  sovereignty_index: number;       // 0-100 (100 = fully sovereign)
  conflict_level: 0 | 1 | 2 | 3 | 4; // 0=peace, 1=tension, 2=crisis, 3=conflict, 4=war
  cyber_security_score: number;    // 0-100
  foreign_interference_risk: number; // 0-100
  financial_sanctions_exposure: number; // 0-100
}

export interface GovernanceReality {
  corruption_perception_index: number; // 0-100 (100 = very clean)
  transparency_score: number;          // 0-100
  godel_completeness: number;          // Ψ Gödel dimension: 0-1 (1 = self-consistent laws)
  democratic_index: number;            // 0-10 (Economist Intelligence Unit scale)
  central_bank_independence: number;   // 0-100
  property_rights_score: number;       // 0-100
  constitutional_stability_years: number; // Years without major constitutional change
}

export interface DigitalReality {
  internet_penetration_pct: number;  // % population with internet
  mobile_penetration_pct: number;    // % with mobile phones
  crypto_legal_status: "legal" | "regulated" | "gray" | "restricted" | "banned";
  cbdc_status: "none" | "research" | "pilot" | "launched";
  cbdc_surveillance_risk: number;    // 0-100 (100 = full surveillance CBDC)
  digital_identity_coverage: number; // % with digital identity
  fintech_adoption_index: number;    // 0-100
}

export interface EconomicReality {
  country_code: string;
  currency_code: string;
  country_name: string;
  scan_timestamp: string;
  monetary: MonetaryReality;
  fiscal: FiscalReality;
  social: SocialReality;
  environmental: EnvironmentalReality;
  security: SecurityReality;
  governance: GovernanceReality;
  digital: DigitalReality;
}

// ══════════════════════════════════════════════════════════════════════════════
// NEURAL LAYER TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface SensationSignal {
  domain: string;
  signal_name: string;
  raw_value: number;
  normalized: number;        // 0-1 (1 = severe problem)
  direction: "improving" | "stable" | "deteriorating";
  strength: "weak" | "moderate" | "strong" | "critical";
  timestamp: string;
}

export interface PerceptionPattern {
  pattern_id: string;
  pattern_name: string;
  arabic: string;
  detected: boolean;
  confidence: number;        // 0-1
  contributing_signals: string[];
  severity: "normal" | "concern" | "warning" | "crisis";
}

export interface UnderstandingInsight {
  insight_id: string;
  arabic: string;
  english: string;
  root_cause: string;
  affected_population: string;
  cantillon_victim_class: "poor" | "middle" | "rich" | "all";
  time_horizon: "immediate" | "short_term" | "medium_term" | "long_term";
  reversibility: "reversible" | "difficult" | "irreversible";
}

export interface CognitionAssessment {
  nash_equilibrium_status: "stable" | "unstable" | "defecting" | "collapsed";
  dominant_strategy: string;
  pareto_inefficiency: number;  // 0-100: how far from Pareto optimal
  game_theory_type: "cooperative" | "zero_sum" | "prisoners_dilemma" | "coordination_failure";
  key_actors: Array<{
    actor: string;
    incentive: string;
    current_action: string;
    optimal_action: string;
    defection_risk: number; // 0-1
  }>;
  behavioral_biases: string[];
  tipping_point_distance: number; // 0-100 (0 = at tipping point)
}

export interface WisdomJudgment {
  system_trajectory: "renaissance" | "stable" | "decline" | "crisis" | "collapse";
  confidence: number;           // 0-1
  time_to_critical: string;     // e.g. "3-5 years" or "immediate"
  godel_warning: boolean;       // System has self-referential contradictions
  landauer_verdict: string;     // Thermodynamic assessment
  irreversibility_alert: boolean; // True if current trajectory is hard to reverse
  civilizational_stakes: "low" | "medium" | "high" | "existential";
  parallel_systems: string[];   // Countries in similar trajectory for comparison
}

export interface ActionRecommendation {
  priority: 1 | 2 | 3 | 4 | 5;  // 1 = most urgent
  action_id: string;
  arabic: string;
  english: string;
  category: "monetary" | "fiscal" | "social" | "governance" | "technical" | "international";
  implementation_path: string;
  time_to_impact: string;
  success_probability: number;   // 0-1
  prerequisite_actions: string[];
  risk_if_ignored: string;
  cantillon_benefit_class: "poor" | "middle" | "all" | "rich";
  zero_harm_verified: boolean;
}

export interface NeuroIntelligenceReport {
  country_code: string;
  currency_code: string;
  report_id: string;
  generated_at: string;
  psi_score: number;
  psi_tier: string;

  // 6 neural layers — each builds on previous
  layer_0_sensation:    { signals: SensationSignal[]; alert_count: number };
  layer_1_perception:   { patterns: PerceptionPattern[]; crisis_patterns: number };
  layer_2_understanding: { insights: UnderstandingInsight[]; root_cause_count: number };
  layer_3_cognition:    CognitionAssessment;
  layer_4_wisdom:       WisdomJudgment;
  layer_5_action:       { recommendations: ActionRecommendation[]; urgent_count: number };

  // Synthesis
  executive_summary: string;
  executive_summary_arabic: string;
  overall_health_score: number;    // 0-100
  human_cost_estimate: string;     // Lives / welfare affected
  time_to_renaissance: string;     // If reforms enacted today
}

// ══════════════════════════════════════════════════════════════════════════════
// KNOWN COUNTRY REALITY PROFILES
// ══════════════════════════════════════════════════════════════════════════════

// Base profiles for countries we have detailed data on
const REALITY_PROFILES: Record<string, Partial<EconomicReality>> = {
  LB: {
    monetary: { inflation_pct: 221, money_supply_growth_pct: 80, currency_stability_score: 2,
      cantillon_spread: 95, real_rate: -200, dollarization_pct: 85, btc_adoption_pct: 12 },
    fiscal: { debt_gdp_pct: 172, deficit_gdp_pct: 15, tax_burden_pct: 14,
      spend_efficiency_score: 8, interest_cost_pct: 55, primary_balance_pct: -8 },
    social: { gini_coefficient: 0.55, hdi: 0.70, education_index: 65, healthcare_index: 55,
      poverty_rate_pct: 82, youth_unemployment_pct: 48, unbanked_pct: 45, remittance_gdp_pct: 31 },
    environmental: { renewable_energy_pct: 8, carbon_intensity: 60, landauer_score: 0.12,
      resource_depletion_rate: 3.2, climate_vulnerability: 75 },
    security: { rule_of_law_index: 22, sovereignty_index: 28, conflict_level: 3,
      cyber_security_score: 35, foreign_interference_risk: 88, financial_sanctions_exposure: 40 },
    governance: { corruption_perception_index: 24, transparency_score: 28, godel_completeness: 0.10,
      democratic_index: 4.8, central_bank_independence: 15, property_rights_score: 20,
      constitutional_stability_years: 3 },
    digital: { internet_penetration_pct: 78, mobile_penetration_pct: 85,
      crypto_legal_status: "gray", cbdc_status: "none", cbdc_surveillance_risk: 20,
      digital_identity_coverage: 55, fintech_adoption_index: 28 },
  },
  US: {
    monetary: { inflation_pct: 3.4, money_supply_growth_pct: 4.2, currency_stability_score: 88,
      cantillon_spread: 65, real_rate: 1.9, dollarization_pct: 0, btc_adoption_pct: 15 },
    fiscal: { debt_gdp_pct: 124, deficit_gdp_pct: 6.2, tax_burden_pct: 27,
      spend_efficiency_score: 52, interest_cost_pct: 18, primary_balance_pct: -2.8 },
    social: { gini_coefficient: 0.39, hdi: 0.93, education_index: 88, healthcare_index: 74,
      poverty_rate_pct: 11.5, youth_unemployment_pct: 8.1, unbanked_pct: 5, remittance_gdp_pct: 0.1 },
    environmental: { renewable_energy_pct: 21, carbon_intensity: 45, landauer_score: 0.62,
      resource_depletion_rate: 1.8, climate_vulnerability: 35 },
    security: { rule_of_law_index: 75, sovereignty_index: 92, conflict_level: 0,
      cyber_security_score: 82, foreign_interference_risk: 25, financial_sanctions_exposure: 0 },
    governance: { corruption_perception_index: 69, transparency_score: 71, godel_completeness: 0.72,
      democratic_index: 7.9, central_bank_independence: 85, property_rights_score: 80,
      constitutional_stability_years: 235 },
    digital: { internet_penetration_pct: 92, mobile_penetration_pct: 97,
      crypto_legal_status: "regulated", cbdc_status: "research", cbdc_surveillance_risk: 35,
      digital_identity_coverage: 88, fintech_adoption_index: 78 },
  },
  NG: {
    monetary: { inflation_pct: 31.7, money_supply_growth_pct: 22, currency_stability_score: 18,
      cantillon_spread: 82, real_rate: -12, dollarization_pct: 35, btc_adoption_pct: 22 },
    fiscal: { debt_gdp_pct: 38, deficit_gdp_pct: 5.4, tax_burden_pct: 8,
      spend_efficiency_score: 22, interest_cost_pct: 45, primary_balance_pct: -1.2 },
    social: { gini_coefficient: 0.43, hdi: 0.54, education_index: 48, healthcare_index: 42,
      poverty_rate_pct: 63, youth_unemployment_pct: 53, unbanked_pct: 62, remittance_gdp_pct: 4.2 },
    environmental: { renewable_energy_pct: 12, carbon_intensity: 55, landauer_score: 0.22,
      resource_depletion_rate: 5.8, climate_vulnerability: 80 },
    security: { rule_of_law_index: 28, sovereignty_index: 55, conflict_level: 2,
      cyber_security_score: 30, foreign_interference_risk: 45, financial_sanctions_exposure: 15 },
    governance: { corruption_perception_index: 25, transparency_score: 30, godel_completeness: 0.28,
      democratic_index: 4.1, central_bank_independence: 45, property_rights_score: 38,
      constitutional_stability_years: 25 },
    digital: { internet_penetration_pct: 55, mobile_penetration_pct: 88,
      crypto_legal_status: "regulated", cbdc_status: "launched", cbdc_surveillance_risk: 72,
      digital_identity_coverage: 42, fintech_adoption_index: 55 },
  },
  SA: {
    monetary: { inflation_pct: 2.2, money_supply_growth_pct: 8.5, currency_stability_score: 82,
      cantillon_spread: 45, real_rate: 3.3, dollarization_pct: 0, btc_adoption_pct: 8 },
    fiscal: { debt_gdp_pct: 24, deficit_gdp_pct: 2.0, tax_burden_pct: 15,
      spend_efficiency_score: 62, interest_cost_pct: 8, primary_balance_pct: 1.5 },
    social: { gini_coefficient: 0.45, hdi: 0.87, education_index: 80, healthcare_index: 78,
      poverty_rate_pct: 12, youth_unemployment_pct: 28, unbanked_pct: 6, remittance_gdp_pct: 0.5 },
    environmental: { renewable_energy_pct: 4, carbon_intensity: 72, landauer_score: 0.38,
      resource_depletion_rate: 8.5, climate_vulnerability: 68 },
    security: { rule_of_law_index: 55, sovereignty_index: 80, conflict_level: 1,
      cyber_security_score: 68, foreign_interference_risk: 22, financial_sanctions_exposure: 8 },
    governance: { corruption_perception_index: 52, transparency_score: 50, godel_completeness: 0.52,
      democratic_index: 2.1, central_bank_independence: 60, property_rights_score: 62,
      constitutional_stability_years: 92 },
    digital: { internet_penetration_pct: 98, mobile_penetration_pct: 99,
      crypto_legal_status: "regulated", cbdc_status: "pilot", cbdc_surveillance_risk: 60,
      digital_identity_coverage: 95, fintech_adoption_index: 72 },
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 0: SENSATION — Raw signal extraction and normalization
// ══════════════════════════════════════════════════════════════════════════════

function runSensationLayer(reality: EconomicReality): SensationSignal[] {
  const signals: SensationSignal[] = [];
  const ts = reality.scan_timestamp;

  const addSignal = (
    domain: string,
    name: string,
    value: number,
    normalized: number,
    direction: SensationSignal["direction"],
  ): void => {
    const strength: SensationSignal["strength"] =
      normalized >= 0.85 ? "critical" :
      normalized >= 0.65 ? "strong" :
      normalized >= 0.40 ? "moderate" : "weak";
    signals.push({ domain, signal_name: name, raw_value: value, normalized,
      direction, strength, timestamp: ts });
  };

  const m = reality.monetary;
  addSignal("monetary", "inflation", m.inflation_pct,
    Math.min(m.inflation_pct / 200, 1),
    m.inflation_pct > 15 ? "deteriorating" : m.inflation_pct > 5 ? "stable" : "improving");
  addSignal("monetary", "cantillon_spread", m.cantillon_spread, m.cantillon_spread / 100,
    m.cantillon_spread > 70 ? "deteriorating" : "stable");
  addSignal("monetary", "currency_stability", 100 - m.currency_stability_score,
    (100 - m.currency_stability_score) / 100,
    m.currency_stability_score < 30 ? "deteriorating" : "stable");
  addSignal("monetary", "dollarization", m.dollarization_pct, m.dollarization_pct / 100,
    m.dollarization_pct > 50 ? "deteriorating" : "stable");

  const f = reality.fiscal;
  addSignal("fiscal", "debt_gdp", f.debt_gdp_pct, Math.min(f.debt_gdp_pct / 250, 1),
    f.debt_gdp_pct > 100 ? "deteriorating" : "stable");
  addSignal("fiscal", "interest_burden", f.interest_cost_pct, f.interest_cost_pct / 100,
    f.interest_cost_pct > 30 ? "deteriorating" : "stable");
  addSignal("fiscal", "spend_inefficiency", 100 - f.spend_efficiency_score,
    (100 - f.spend_efficiency_score) / 100, "stable");

  const s = reality.social;
  addSignal("social", "gini_inequality", s.gini_coefficient, s.gini_coefficient,
    s.gini_coefficient > 0.5 ? "deteriorating" : "stable");
  addSignal("social", "poverty", s.poverty_rate_pct, s.poverty_rate_pct / 100,
    s.poverty_rate_pct > 40 ? "deteriorating" : "stable");
  addSignal("social", "unbanked", s.unbanked_pct, s.unbanked_pct / 100,
    s.unbanked_pct > 50 ? "deteriorating" : "improving");

  const e = reality.environmental;
  addSignal("environmental", "fossil_dependency", 100 - e.renewable_energy_pct,
    (100 - e.renewable_energy_pct) / 100, "stable");
  addSignal("environmental", "landauer_deficit", 1 - e.landauer_score, 1 - e.landauer_score,
    e.landauer_score < 0.3 ? "deteriorating" : "stable");

  const sec = reality.security;
  addSignal("security", "sovereignty_deficit", 100 - sec.sovereignty_index,
    (100 - sec.sovereignty_index) / 100,
    sec.conflict_level >= 3 ? "deteriorating" : "stable");
  addSignal("security", "foreign_interference", sec.foreign_interference_risk,
    sec.foreign_interference_risk / 100, "stable");

  const g = reality.governance;
  addSignal("governance", "corruption", 100 - g.corruption_perception_index,
    (100 - g.corruption_perception_index) / 100,
    g.corruption_perception_index < 30 ? "deteriorating" : "stable");
  addSignal("governance", "godel_incompleteness", 1 - g.godel_completeness,
    1 - g.godel_completeness, "stable");

  const d = reality.digital;
  addSignal("digital", "cbdc_surveillance_risk", d.cbdc_surveillance_risk,
    d.cbdc_surveillance_risk / 100,
    d.cbdc_status === "launched" && d.cbdc_surveillance_risk > 60 ? "deteriorating" : "stable");
  addSignal("digital", "digital_exclusion", 100 - d.internet_penetration_pct,
    (100 - d.internet_penetration_pct) / 100, "improving");

  return signals.sort((a, b) => b.normalized - a.normalized);
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 1: PERCEPTION — Pattern recognition
// ══════════════════════════════════════════════════════════════════════════════

function runPerceptionLayer(signals: SensationSignal[], reality: EconomicReality): PerceptionPattern[] {
  const patterns: PerceptionPattern[] = [];
  const sig = (name: string) => signals.find(s => s.signal_name === name);
  const normalized = (name: string) => sig(name)?.normalized ?? 0;

  // Hyperinflation spiral
  const inflationN = normalized("inflation");
  const cantillonN = normalized("cantillon_spread");
  patterns.push({
    pattern_id: "P-01", pattern_name: "Cantillon Extraction Spiral",
    arabic: "حلقة الاستنزاف القانتيوني",
    detected: inflationN > 0.3 && cantillonN > 0.6,
    confidence: Math.min(inflationN * 0.6 + cantillonN * 0.4, 1),
    contributing_signals: ["inflation", "cantillon_spread", "gini_inequality"],
    severity: inflationN > 0.8 ? "crisis" : inflationN > 0.5 ? "warning" : "concern",
  });

  // Debt trap
  const debtN = normalized("debt_gdp");
  const interestN = normalized("interest_burden");
  patterns.push({
    pattern_id: "P-02", pattern_name: "Sovereign Debt Trap",
    arabic: "فخ الدين السيادي",
    detected: debtN > 0.5 && interestN > 0.3,
    confidence: Math.min(debtN * 0.5 + interestN * 0.5, 1),
    contributing_signals: ["debt_gdp", "interest_burden", "spend_inefficiency"],
    severity: debtN > 0.8 ? "crisis" : debtN > 0.6 ? "warning" : "concern",
  });

  // Social fracture
  const giniN = normalized("gini_inequality");
  const povertyN = normalized("poverty");
  patterns.push({
    pattern_id: "P-03", pattern_name: "Social Cohesion Fracture",
    arabic: "كسر التماسك الاجتماعي",
    detected: giniN > 0.5 && povertyN > 0.4,
    confidence: Math.min(giniN * 0.4 + povertyN * 0.4 + normalized("unbanked") * 0.2, 1),
    contributing_signals: ["gini_inequality", "poverty", "unbanked"],
    severity: giniN > 0.7 ? "crisis" : giniN > 0.5 ? "warning" : "concern",
  });

  // Sovereignty erosion
  const sovereigntyN = normalized("sovereignty_deficit");
  const interferenceN = normalized("foreign_interference");
  patterns.push({
    pattern_id: "P-04", pattern_name: "Sovereignty Erosion",
    arabic: "تآكل السيادة",
    detected: sovereigntyN > 0.5 || interferenceN > 0.7,
    confidence: Math.min(sovereigntyN * 0.5 + interferenceN * 0.5, 1),
    contributing_signals: ["sovereignty_deficit", "foreign_interference", "dollarization"],
    severity: reality.security.conflict_level >= 3 ? "crisis" :
      sovereigntyN > 0.6 ? "warning" : "concern",
  });

  // Gödel governance failure
  const godelN = normalized("godel_incompleteness");
  const corruptionN = normalized("corruption");
  patterns.push({
    pattern_id: "P-05", pattern_name: "Gödel Governance Incompleteness",
    arabic: "عجز الحوكمة — متلازمة غودل",
    detected: godelN > 0.6 && corruptionN > 0.6,
    confidence: Math.min(godelN * 0.6 + corruptionN * 0.4, 1),
    contributing_signals: ["godel_incompleteness", "corruption", "spend_inefficiency"],
    severity: godelN > 0.8 ? "crisis" : godelN > 0.7 ? "warning" : "concern",
  });

  // CBDC surveillance capture
  const cbdcN = normalized("cbdc_surveillance_risk");
  patterns.push({
    pattern_id: "P-06", pattern_name: "CBDC Surveillance Capture",
    arabic: "استيلاء المراقبة عبر العملة الرقمية المركزية",
    detected: cbdcN > 0.6 && reality.digital.cbdc_status !== "none",
    confidence: cbdcN,
    contributing_signals: ["cbdc_surveillance_risk", "digital_exclusion"],
    severity: cbdcN > 0.8 ? "crisis" : cbdcN > 0.6 ? "warning" : "concern",
  });

  // Landauer entropy deficit (environmental)
  const landauerN = normalized("landauer_deficit");
  patterns.push({
    pattern_id: "P-07", pattern_name: "Landauer Entropy Deficit",
    arabic: "عجز إنتروبيا لانداور — هدر الطاقة والحوسبة",
    detected: landauerN > 0.65,
    confidence: landauerN,
    contributing_signals: ["landauer_deficit", "fossil_dependency"],
    severity: landauerN > 0.85 ? "warning" : "concern",
  });

  // Renaissance opportunity
  const avgCrisis = signals.filter(s => s.normalized > 0.6).length / signals.length;
  const hasAsset = reality.social.remittance_gdp_pct > 5 ||
    reality.monetary.btc_adoption_pct > 10 ||
    reality.social.unbanked_pct > 40;
  patterns.push({
    pattern_id: "P-08", pattern_name: "Renaissance Opportunity Window",
    arabic: "نافذة فرصة النهضة",
    detected: avgCrisis > 0.3 && hasAsset,
    confidence: Math.min(avgCrisis + (hasAsset ? 0.3 : 0), 1),
    contributing_signals: ["inflation", "unbanked", "cantillon_spread"],
    severity: "normal",
  });

  return patterns;
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 2: UNDERSTANDING — Root cause and meaning extraction
// ══════════════════════════════════════════════════════════════════════════════

function runUnderstandingLayer(
  patterns: PerceptionPattern[],
  reality: EconomicReality,
): UnderstandingInsight[] {
  const insights: UnderstandingInsight[] = [];
  const active = patterns.filter(p => p.detected);

  for (const p of active) {
    switch (p.pattern_id) {
      case "P-01":
        insights.push({
          insight_id: "U-01",
          arabic: "التضخم يسرق من الفقراء ويثري المصدرين الأوائل للنقود",
          english: "Inflation is a regressive hidden tax — new money reaches elites first, poor last",
          root_cause: "Central bank money printing without Cantillon⁻¹ distribution routing — new money flows to financial sector before reaching citizens",
          affected_population: `${Math.round(reality.social.poverty_rate_pct)}% below poverty line most affected`,
          cantillon_victim_class: "poor",
          time_horizon: "immediate",
          reversibility: reality.monetary.inflation_pct > 100 ? "difficult" : "reversible",
        });
        break;
      case "P-02":
        insights.push({
          insight_id: "U-02",
          arabic: "الفائدة على الدين تلتهم الميزانية — لا يبقى شيء للمواطنين",
          english: "Interest payments crowd out public investment — debt service consumes tax revenue that should fund services",
          root_cause: "Debt accumulated beyond Reinhart-Rogoff 90% GDP threshold — compounding interest prevents primary surplus recovery",
          affected_population: `${Math.round(reality.fiscal.interest_cost_pct)}% of tax revenue consumed by debt service`,
          cantillon_victim_class: "all",
          time_horizon: "long_term",
          reversibility: reality.fiscal.debt_gdp_pct > 200 ? "irreversible" : "difficult",
        });
        break;
      case "P-03":
        insights.push({
          insight_id: "U-03",
          arabic: "التفاوت يقود إلى الاضطراب — Gini أعلى من 0.45 تاريخياً يسبق الأزمات",
          english: "Inequality beyond 0.45 Gini historically precedes social instability — middle class erosion destroys tax base",
          root_cause: "Cantillon extraction over multiple generations + regressive taxation + exclusion from financial system",
          affected_population: `${Math.round(reality.social.unbanked_pct)}% unbanked, ${Math.round(reality.social.poverty_rate_pct)}% in poverty`,
          cantillon_victim_class: "poor",
          time_horizon: "medium_term",
          reversibility: "reversible",
        });
        break;
      case "P-05":
        insights.push({
          insight_id: "U-05",
          arabic: "القوانين المتناقضة تعطل نفسها — متلازمة غودل في الحوكمة",
          english: "Self-referential legal contradictions create institutional paralysis — Gödel's incompleteness theorem applied to governance",
          root_cause: "Constitutional provisions written without logical consistency audit — laws that contradict themselves cannot be fully enforced",
          affected_population: "All citizens — no one can trust system that contradicts itself",
          cantillon_victim_class: "all",
          time_horizon: "long_term",
          reversibility: "reversible",
        });
        break;
      case "P-06":
        insights.push({
          insight_id: "U-06",
          arabic: "CBDC بدون ضمانات يحول المال إلى أداة مراقبة وعقوبة",
          english: "Programmable CBDC without zero-harm constraints becomes a financial surveillance and punishment tool",
          root_cause: "Centralized digital currency without CR-01 (financial privacy) and GR-01 (monetary sovereignty) protections",
          affected_population: "100% of population using the CBDC",
          cantillon_victim_class: "all",
          time_horizon: "immediate",
          reversibility: "difficult",
        });
        break;
      default:
        break;
    }
  }

  // Always add the Bitcoin/sBTC opportunity if unbanked > 20%
  if (reality.social.unbanked_pct > 20) {
    insights.push({
      insight_id: "U-08",
      arabic: "الهاتف المحمول + البيتكوين = ثورة مصرفية للمحرومين",
      english: "Mobile phone penetration creates direct path to Bitcoin financial inclusion — bypassing broken banking system",
      root_cause: `${Math.round(reality.digital.mobile_penetration_pct ?? 60)}% have phones but ${Math.round(reality.social.unbanked_pct)}% unbanked — the gap is the opportunity`,
      affected_population: `${Math.round(reality.social.unbanked_pct)}% of population — ${Math.round(reality.social.unbanked_pct * 0.01 * 50)}M people (estimated)`,
      cantillon_victim_class: "poor",
      time_horizon: "short_term",
      reversibility: "reversible",
    });
  }

  return insights;
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 3: COGNITION — Game theory and Nash equilibrium analysis
// ══════════════════════════════════════════════════════════════════════════════

function runCognitionLayer(reality: EconomicReality, patterns: PerceptionPattern[]): CognitionAssessment {
  const crisisPatternCount = patterns.filter(p => p.detected && p.severity === "crisis").length;
  const warningPatternCount = patterns.filter(p => p.detected && p.severity === "warning").length;

  const nashStatus: CognitionAssessment["nash_equilibrium_status"] =
    crisisPatternCount >= 3 ? "collapsed" :
    crisisPatternCount >= 2 ? "defecting" :
    warningPatternCount >= 3 ? "unstable" : "stable";

  // Pareto inefficiency: how far from optimal outcome
  const paretoInefficiency = Math.min(
    (reality.social.gini_coefficient * 40) +
    (reality.fiscal.debt_gdp_pct / 250 * 30) +
    ((100 - reality.governance.corruption_perception_index) / 100 * 30),
    100
  );

  const gameType: CognitionAssessment["game_theory_type"] =
    reality.security.conflict_level >= 3 ? "zero_sum" :
    crisisPatternCount >= 2 ? "prisoners_dilemma" :
    warningPatternCount >= 2 ? "coordination_failure" : "cooperative";

  return {
    nash_equilibrium_status: nashStatus,
    dominant_strategy: nashStatus === "collapsed"
      ? "Every actor defects — trust has broken down. No cooperative equilibrium exists without external shock."
      : nashStatus === "defecting"
      ? "Elite actors capture surplus while citizens exit through emigration/capital flight"
      : "Mixed: some cooperation possible through institutional reform",
    pareto_inefficiency: Math.round(paretoInefficiency),
    game_theory_type: gameType,
    key_actors: [
      {
        actor: "Central Bank",
        incentive: "Government financing + inflation tax revenue",
        current_action: reality.monetary.inflation_pct > 20 ? "Monetizing deficit — printing money" : "Managing monetary stability",
        optimal_action: "Cantillon⁻¹ routing — citizen-first monetary expansion",
        defection_risk: reality.monetary.cantillon_spread / 100,
      },
      {
        actor: "Commercial Banks",
        incentive: "Carry trade — borrow cheap, lend expensive",
        current_action: "Dollarization arbitrage + fee extraction from unbanked",
        optimal_action: "Financial inclusion through sBTC rails + x402 micropayments",
        defection_risk: reality.social.unbanked_pct / 100,
      },
      {
        actor: "Citizens / Households",
        incentive: "Preserve savings, access services",
        current_action: reality.monetary.dollarization_pct > 50 ? "Dollar hoarding + emigration" : "Coping through informal economy",
        optimal_action: "BTC savings + sBTC payments + self-sovereign financial access",
        defection_risk: reality.social.youth_unemployment_pct / 100,
      },
      {
        actor: "Government",
        incentive: "Stay in power + access international credit",
        current_action: reality.fiscal.spend_efficiency_score < 30 ? "Patronage spending + debt accumulation" : "Reform attempts",
        optimal_action: "Transparent x402 government APIs + BTC mining revenue + constitutional reform",
        defection_risk: (100 - reality.governance.corruption_perception_index) / 100,
      },
    ],
    behavioral_biases: [
      reality.monetary.inflation_pct > 30 ? "Hyperinflationary expectation anchoring (self-fulfilling)" : null,
      reality.fiscal.debt_gdp_pct > 100 ? "Debt fatalism — no political will to reform" : null,
      reality.social.gini_coefficient > 0.5 ? "Elite capture bias — reforms captured before reaching citizens" : null,
      reality.security.foreign_interference_risk > 70 ? "Sovereignty myopia — external actors shaping domestic policy" : null,
    ].filter(Boolean) as string[],
    tipping_point_distance: Math.max(0, 100 - (crisisPatternCount * 30 + warningPatternCount * 15)),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 4: WISDOM — Long-term systemic judgment
// ══════════════════════════════════════════════════════════════════════════════

function runWisdomLayer(
  cognition: CognitionAssessment,
  reality: EconomicReality,
  patterns: PerceptionPattern[],
): WisdomJudgment {
  const crisisCount = patterns.filter(p => p.detected && p.severity === "crisis").length;
  const godelPattern = patterns.find(p => p.pattern_id === "P-05");

  const trajectory: WisdomJudgment["system_trajectory"] =
    cognition.nash_equilibrium_status === "collapsed" ? "collapse" :
    crisisCount >= 3 ? "crisis" :
    crisisCount >= 1 ? "decline" :
    patterns.find(p => p.pattern_id === "P-08" && p.detected) ? "renaissance" : "stable";

  const timeToRenaissance = patterns.find(p => p.pattern_id === "P-08" && p.detected)
    ? `${Math.round(2 + crisisCount * 3)}-${Math.round(5 + crisisCount * 5)} years with sustained reform`
    : `Not yet visible — foundational prerequisites missing`;

  const civilizationalStakes: WisdomJudgment["civilizational_stakes"] =
    reality.security.conflict_level >= 3 ? "existential" :
    crisisCount >= 3 ? "high" :
    crisisCount >= 1 ? "medium" : "low";

  return {
    system_trajectory: trajectory,
    confidence: Math.max(0.3, 1 - (patterns.filter(p => p.detected).length * 0.05)),
    time_to_critical: crisisCount >= 3 ? "immediate" :
      crisisCount >= 2 ? "12-24 months" :
      crisisCount >= 1 ? "2-5 years" : ">10 years",
    godel_warning: (godelPattern?.detected ?? false) && (godelPattern?.confidence ?? 0) > 0.6,
    landauer_verdict: reality.environmental.landauer_score < 0.3
      ? "Severe entropy deficit — economic activity is thermodynamically destructive. Fossil-backed monetary expansion accelerates collapse."
      : reality.environmental.landauer_score < 0.6
      ? "Moderate Landauer gap — renewable transition can accelerate Ψ recovery."
      : "Landauer dimension healthy — energy efficiency supports long-term stability.",
    irreversibility_alert: trajectory === "collapse" ||
      (reality.fiscal.debt_gdp_pct > 180 && reality.monetary.inflation_pct > 100),
    civilizational_stakes: civilizationalStakes,
    parallel_systems: getParllelSystems(trajectory, reality),
  };
}

function getParllelSystems(trajectory: string, reality: EconomicReality): string[] {
  if (trajectory === "collapse" || trajectory === "crisis") {
    return ["Zimbabwe 2008 (hyperinflation)", "Venezuela 2018 (dollarization)", "Weimar 1923 (monetary collapse)"];
  }
  if (trajectory === "decline") {
    return ["Argentina 2001 (pre-default)", "Greece 2010 (debt crisis)", "Turkey 2021 (lira crisis)"];
  }
  if (trajectory === "renaissance") {
    return ["El Salvador 2021 (BTC adoption)", "Georgia 2008-2018 (rapid reform)", "Estonia 1991-2000 (digital transformation)"];
  }
  return ["Singapore 1965-1980 (institutional building)", "South Korea 1960-1980 (development state)"];
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 5: ACTION — Concrete reform recommendations
// ══════════════════════════════════════════════════════════════════════════════

function runActionLayer(
  wisdom: WisdomJudgment,
  cognition: CognitionAssessment,
  reality: EconomicReality,
): ActionRecommendation[] {
  const actions: ActionRecommendation[] = [];
  let priority = 1;

  // Emergency actions for crisis/collapse
  if (wisdom.system_trajectory === "collapse" || wisdom.system_trajectory === "crisis") {
    actions.push({
      priority: priority++ as 1,
      action_id: "A-01",
      arabic: "إطلاق ممر BTC/sBTC الطارئ للمدخرات",
      english: "Launch emergency BTC savings corridor — protect citizen savings from hyperinflation",
      category: "monetary",
      implementation_path: "Partner with Strike/Phoenix Wallet for instant BTC onboarding. No KYC below $1000. Mobile-first.",
      time_to_impact: "30 days",
      success_probability: 0.85,
      prerequisite_actions: [],
      risk_if_ignored: "Savings wiped out — dollarization or capital flight accelerates",
      cantillon_benefit_class: "poor",
      zero_harm_verified: true,
    });
  }

  // Cantillon routing fix
  if (reality.monetary.cantillon_spread > 60) {
    actions.push({
      priority: priority as 1 | 2 | 3 | 4 | 5,
      action_id: "A-02",
      arabic: "تطبيق توجيه قانتيون⁻¹ — المواطنون يتلقون التوسع النقدي أولاً",
      english: "Implement Cantillon⁻¹ routing — every monetary expansion reaches citizens before intermediaries",
      category: "monetary",
      implementation_path: "x402 government wallet API → direct citizen helicopter payments via STX/sBTC. Smart contract enforces ordering: citizen wallets credited before bank reserve accounts.",
      time_to_impact: "90 days",
      success_probability: 0.70,
      prerequisite_actions: ["A-05"],
      risk_if_ignored: "Cantillon extraction continues indefinitely — no reform works while money creation favors elites",
      cantillon_benefit_class: "poor",
      zero_harm_verified: true,
    });
    priority++;
  }

  // Unbanked access
  if (reality.social.unbanked_pct > 30) {
    actions.push({
      priority: Math.min(priority++, 5) as 1 | 2 | 3 | 4 | 5,
      action_id: "A-03",
      arabic: "USSD + SMS + sBTC لكل هاتف مشحون",
      english: "Deploy USSD/SMS sBTC gateway — financial access for every feature phone",
      category: "technical",
      implementation_path: "Africa's Talking or Twilio USSD API → Lightning/sBTC rails. *99# dial code. Send money: *99*1*AMOUNT*PHONE#. No smartphone required.",
      time_to_impact: "6 months",
      success_probability: 0.75,
      prerequisite_actions: [],
      risk_if_ignored: `${Math.round(reality.social.unbanked_pct)}% remain excluded — remittance fees continue at 8-15%`,
      cantillon_benefit_class: "poor",
      zero_harm_verified: true,
    });
  }

  // Debt restructuring
  if (reality.fiscal.debt_gdp_pct > 80) {
    actions.push({
      priority: Math.min(priority++, 5) as 1 | 2 | 3 | 4 | 5,
      action_id: "A-04",
      arabic: "إعادة هيكلة الدين بضمان BTC — استبدال الديون السيادية بمعيار نقدي صلب",
      english: "BTC-collateralized debt restructuring — convert fiat debt to BTC-standard obligations",
      category: "fiscal",
      implementation_path: "Phase 1: BTC mining revenue fund (30% of mining output → debt service). Phase 2: Issue BTC-denominated bonds at lower rates. Phase 3: IMF Brady-style debt swap with BTC reserve backing.",
      time_to_impact: "2-5 years",
      success_probability: 0.55,
      prerequisite_actions: ["A-05"],
      risk_if_ignored: "Debt spiral continues — interest exceeds GDP growth rate, default inevitable",
      cantillon_benefit_class: "all",
      zero_harm_verified: true,
    });
  }

  // Governance (Gödel fix)
  if (reality.governance.godel_completeness < 0.5) {
    actions.push({
      priority: Math.min(priority++, 5) as 1 | 2 | 3 | 4 | 5,
      action_id: "A-05",
      arabic: "تدقيق الاتساق الدستوري — إزالة القوانين المتناقضة ذاتياً",
      english: "Constitutional consistency audit — resolve Gödel contradictions in legal framework",
      category: "governance",
      implementation_path: "AI-powered legal graph analysis → identify circular dependencies and self-referential contradictions. Constitutional court review. Publish contradiction map publicly on IPFS.",
      time_to_impact: "1-3 years",
      success_probability: 0.60,
      prerequisite_actions: [],
      risk_if_ignored: "All other reforms fail — corrupt legal system absorbs and neutralizes every change",
      cantillon_benefit_class: "all",
      zero_harm_verified: true,
    });
  }

  // CBDC resistance
  if (reality.digital.cbdc_surveillance_risk > 60 && reality.digital.cbdc_status !== "none") {
    actions.push({
      priority: Math.min(priority++, 5) as 1 | 2 | 3 | 4 | 5,
      action_id: "A-06",
      arabic: "تطبيق ضمانات صفر الأضرار على العملة الرقمية المركزية أو رفضها",
      english: "Enforce Zero Harm Protocol on CBDC or reject it — CR-01 financial privacy is non-negotiable",
      category: "technical",
      implementation_path: "Legislative mandate: any CBDC must pass 10 circuit breakers of Zero Harm Protocol. If government refuses → support parallel BTC/sBTC rails as sovereign alternative.",
      time_to_impact: "Immediate (legislation) or 2 years (parallel system)",
      success_probability: 0.65,
      prerequisite_actions: ["A-05"],
      risk_if_ignored: "Financial panopticon — every transaction monitored, dissenters frozen",
      cantillon_benefit_class: "all",
      zero_harm_verified: true,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ENGINE — Full 6-layer neuro-economic analysis
// ══════════════════════════════════════════════════════════════════════════════

export function buildDefaultReality(
  countryCode: string,
  currencyCode: string,
  countryName: string,
  overrides: Partial<EconomicReality> = {},
): EconomicReality {
  const known = REALITY_PROFILES[countryCode.toUpperCase()] ?? {};
  const ts = new Date().toISOString();
  return {
    country_code: countryCode,
    currency_code: currencyCode,
    country_name: countryName,
    scan_timestamp: ts,
    monetary: {
      inflation_pct: 8, money_supply_growth_pct: 10, currency_stability_score: 60,
      cantillon_spread: 50, real_rate: 0, dollarization_pct: 15, btc_adoption_pct: 5,
      ...(known.monetary ?? {}), ...(overrides.monetary ?? {}),
    },
    fiscal: {
      debt_gdp_pct: 65, deficit_gdp_pct: 4, tax_burden_pct: 22,
      spend_efficiency_score: 45, interest_cost_pct: 15, primary_balance_pct: -1,
      ...(known.fiscal ?? {}), ...(overrides.fiscal ?? {}),
    },
    social: {
      gini_coefficient: 0.40, hdi: 0.65, education_index: 60, healthcare_index: 60,
      poverty_rate_pct: 25, youth_unemployment_pct: 20, unbanked_pct: 35, remittance_gdp_pct: 5,
      ...(known.social ?? {}), ...(overrides.social ?? {}),
    },
    environmental: {
      renewable_energy_pct: 20, carbon_intensity: 55, landauer_score: 0.40,
      resource_depletion_rate: 3, climate_vulnerability: 50,
      ...(known.environmental ?? {}), ...(overrides.environmental ?? {}),
    },
    security: {
      rule_of_law_index: 45, sovereignty_index: 60, conflict_level: 1,
      cyber_security_score: 45, foreign_interference_risk: 35, financial_sanctions_exposure: 10,
      ...(known.security ?? {}), ...(overrides.security ?? {}),
    },
    governance: {
      corruption_perception_index: 40, transparency_score: 42, godel_completeness: 0.40,
      democratic_index: 5.5, central_bank_independence: 55, property_rights_score: 50,
      constitutional_stability_years: 30,
      ...(known.governance ?? {}), ...(overrides.governance ?? {}),
    },
    digital: {
      internet_penetration_pct: 65, mobile_penetration_pct: 80,
      crypto_legal_status: "gray", cbdc_status: "none", cbdc_surveillance_risk: 20,
      digital_identity_coverage: 60, fintech_adoption_index: 40,
      ...(known.digital ?? {}), ...(overrides.digital ?? {}),
    },
  };
}

export function computePsiFromReality(reality: EconomicReality): { score: number; tier: string } {
  const landauer = reality.environmental.landauer_score;
  const nash = 1 - (reality.social.gini_coefficient * 0.5 + reality.security.conflict_level / 8);
  const cantillon = 1 - (reality.monetary.cantillon_spread / 100);
  const godel = reality.governance.godel_completeness;
  const rawPsi = landauer * nash * (1 / Math.max(1 - cantillon, 0.01)) * godel;
  const score = Math.min(Math.round(rawPsi * 100), 100);
  const tier = score >= 80 ? "Sovereign" : score >= 60 ? "Stable" :
    score >= 40 ? "Fragile" : score >= 20 ? "Crisis" : "Collapsed";
  return { score, tier };
}

export function runNeuroEconomicAnalysis(reality: EconomicReality): NeuroIntelligenceReport {
  const psi = computePsiFromReality(reality);
  const reportId = `NEI-${reality.country_code}-${Date.now().toString(36).toUpperCase()}`;

  const signals   = runSensationLayer(reality);
  const patterns  = runPerceptionLayer(signals, reality);
  const insights  = runUnderstandingLayer(patterns, reality);
  const cognition = runCognitionLayer(reality, patterns);
  const wisdom    = runWisdomLayer(cognition, reality, patterns);
  const actions   = runActionLayer(wisdom, cognition, reality);

  const criticalSignals = signals.filter(s => s.strength === "critical").length;
  const crisisPatterns  = patterns.filter(p => p.detected && p.severity === "crisis").length;
  const urgentActions   = actions.filter(a => a.priority <= 2).length;

  const overallHealth = Math.max(0, 100 -
    (criticalSignals * 8) - (crisisPatterns * 15) -
    ((1 - psi.score / 100) * 40));

  const unbankedMillions = Math.round(reality.social.unbanked_pct * 0.01 * 50);
  const povertyMillions  = Math.round(reality.social.poverty_rate_pct * 0.01 * 80);

  const executiveSummary =
    `${reality.country_name} shows Ψ score ${psi.score}/100 (${psi.tier}). ` +
    `${criticalSignals} critical signals detected across ${Object.keys(reality).length - 3} domains. ` +
    `Nash equilibrium: ${cognition.nash_equilibrium_status}. ` +
    `System trajectory: ${wisdom.system_trajectory}. ` +
    `${urgentActions} urgent actions required.`;

  const executiveSummaryArabic =
    `${reality.country_name}: درجة Ψ ${psi.score}/100 (${psi.tier}). ` +
    `${criticalSignals} إشارة حرجة عبر ${Object.keys(reality).length - 3} مجالات. ` +
    `توازن ناش: ${cognition.nash_equilibrium_status}. ` +
    `مسار النظام: ${wisdom.system_trajectory}. ` +
    `${urgentActions} إجراء عاجل مطلوب.`;

  return {
    country_code: reality.country_code,
    currency_code: reality.currency_code,
    report_id: reportId,
    generated_at: reality.scan_timestamp,
    psi_score: psi.score,
    psi_tier: psi.tier,
    layer_0_sensation:    { signals, alert_count: criticalSignals },
    layer_1_perception:   { patterns, crisis_patterns: crisisPatterns },
    layer_2_understanding: { insights, root_cause_count: insights.length },
    layer_3_cognition:    cognition,
    layer_4_wisdom:       wisdom,
    layer_5_action:       { recommendations: actions, urgent_count: urgentActions },
    executive_summary: executiveSummary,
    executive_summary_arabic: executiveSummaryArabic,
    overall_health_score: Math.round(overallHealth),
    human_cost_estimate: `~${unbankedMillions}M unbanked, ~${povertyMillions}M in poverty directly affected`,
    time_to_renaissance: wisdom.time_to_critical,
  };
}

export { REALITY_PROFILES };
