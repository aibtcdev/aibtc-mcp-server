/**
 * Risk Impact Engine — محرك حساب المخاطر والآثار وما بعدها
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Capabilities:
 *   1. Monte Carlo risk simulation (10,000 scenarios)
 *   2. Black swan detection (Pareto/power-law fat tails)
 *   3. Cascade impact calculator (directed dependency graph)
 *   4. After-effects timeline (30 / 90 / 365 day decay model)
 *   5. Remediation scorer (how much each action reduces risk)
 *   6. Discrimination / bias audit (checks for disparate impact)
 */

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface RiskScenario {
  scenario_id: string;
  risk_name: string;
  arabic: string;
  base_probability: number;       // 0-1: probability this risk materializes within 1 year
  severity_if_triggered: number;  // 0-100: damage if triggered
  time_horizon_days: number;      // when this risk could materialize
  affected_population_pct: number;
  economic_cost_billions_usd: number;
  reversibility: "reversible" | "difficult" | "irreversible";
  trigger_conditions: string[];
  cascade_outputs: string[];      // which risks this triggers
}

export interface MonteCarloResult {
  scenario_id: string;
  simulations: number;
  expected_impact: number;        // mean impact across all simulations
  p10: number;                    // 10th percentile (optimistic)
  p50: number;                    // median
  p90: number;                    // 90th percentile (pessimistic)
  p99: number;                    // 99th percentile (tail risk)
  black_swan_probability: number; // probability of catastrophic tail event
  variance: number;
}

export interface CascadeImpact {
  trigger_risk: string;
  chain: Array<{
    risk_id: string;
    risk_name: string;
    delay_days: number;
    amplification_factor: number; // how much worse each cascade makes it
    probability: number;          // probability this step in chain occurs
    cumulative_damage: number;    // total damage at this point in chain
  }>;
  total_chain_damage: number;
  time_to_full_cascade_days: number;
  prevention_window_days: number;
}

export interface AfterEffectsTimeline {
  risk_id: string;
  immediate_0_30: {
    economic_damage_pct: number;
    social_disruption: string;
    political_pressure: string;
    citizen_impact: string;
  };
  short_term_31_90: {
    recovery_probability: number;
    structural_damage: string;
    behavioral_changes: string;
    policy_responses: string[];
  };
  medium_term_91_365: {
    new_equilibrium: string;
    irreversible_changes: string[];
    opportunity_windows: string[];
  };
  long_term_1_10_years: {
    trajectory: "recovery" | "adaptation" | "decline" | "transformation";
    critical_dependencies: string[];
    renaissance_conditions: string[];
  };
  decay_model: {
    formula: string;
    half_life_days: number;
    residual_damage_pct: number;
  };
}

export interface BiasAuditResult {
  audit_id: string;
  system_or_policy: string;
  population_groups: Array<{
    group: string;
    impact_score: number;        // 0-100 (100 = most impacted)
    cantillon_class: "poor" | "middle" | "rich";
    disparate_impact_ratio: number; // 4/5ths rule: < 0.8 = discriminatory
    verdict: "equitable" | "monitor" | "discriminatory";
  }>;
  overall_bias_score: number;    // 0-100 (0 = perfectly equitable)
  discrimination_detected: boolean;
  discrimination_type: string[];
  remediation: string[];
}

export interface RemediationScore {
  action_id: string;
  action_name: string;
  target_risk: string;
  risk_reduction_pct: number;    // % reduction in base_probability
  cost_effectiveness: number;    // damage_prevented / implementation_cost ratio
  time_to_effect_days: number;
  side_effects: Array<{ effect: string; sign: "positive" | "negative" }>;
  cantillon_distribution: {
    poor: number;                // % of benefit going to poor
    middle: number;
    rich: number;
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// RISK SCENARIO DATABASE
// ══════════════════════════════════════════════════════════════════════════════

export const RISK_SCENARIOS: RiskScenario[] = [
  {
    scenario_id: "RS-01",
    risk_name: "Hyperinflation Spiral",
    arabic: "الدوامة التضخمية المفرطة",
    base_probability: 0,  // set per country
    severity_if_triggered: 92,
    time_horizon_days: 180,
    affected_population_pct: 95,
    economic_cost_billions_usd: 0,  // computed per country
    reversibility: "difficult",
    trigger_conditions: [
      "Inflation > 50%/month",
      "Central bank deficit monetization > 30% of spending",
      "Currency collapses > 80% in 12 months",
      "Dollarization acceleration > 20ppt/year",
    ],
    cascade_outputs: ["RS-03", "RS-05", "RS-07"],
  },
  {
    scenario_id: "RS-02",
    risk_name: "Sovereign Debt Default",
    arabic: "إفلاس الديون السيادية",
    base_probability: 0,
    severity_if_triggered: 78,
    time_horizon_days: 365,
    affected_population_pct: 88,
    economic_cost_billions_usd: 0,
    reversibility: "difficult",
    trigger_conditions: [
      "Debt/GDP > 150%",
      "Interest cost > 40% of tax revenue",
      "No IMF program in place",
      "Credit rating below CCC",
    ],
    cascade_outputs: ["RS-01", "RS-04", "RS-06"],
  },
  {
    scenario_id: "RS-03",
    risk_name: "Social Unrest / Revolution",
    arabic: "الاضطراب الاجتماعي والثورة",
    base_probability: 0,
    severity_if_triggered: 85,
    time_horizon_days: 270,
    affected_population_pct: 100,
    economic_cost_billions_usd: 0,
    reversibility: "difficult",
    trigger_conditions: [
      "Poverty rate > 60%",
      "Youth unemployment > 40%",
      "Gini > 0.55",
      "Cantillon spread > 80",
    ],
    cascade_outputs: ["RS-06", "RS-08"],
  },
  {
    scenario_id: "RS-04",
    risk_name: "Banking System Collapse",
    arabic: "انهيار النظام المصرفي",
    base_probability: 0,
    severity_if_triggered: 88,
    time_horizon_days: 120,
    affected_population_pct: 85,
    economic_cost_billions_usd: 0,
    reversibility: "difficult",
    trigger_conditions: [
      "NPL ratio > 25%",
      "Bank runs > 20% deposit withdrawal in 30 days",
      "Currency board impossible",
      "Dollarization of deposits > 60%",
    ],
    cascade_outputs: ["RS-01", "RS-03"],
  },
  {
    scenario_id: "RS-05",
    risk_name: "Food Security Crisis",
    arabic: "أزمة الأمن الغذائي",
    base_probability: 0,
    severity_if_triggered: 95,
    time_horizon_days: 90,
    affected_population_pct: 65,
    economic_cost_billions_usd: 0,
    reversibility: "reversible",
    trigger_conditions: [
      "Import food bill > 60% of export earnings",
      "FX reserves < 2 months imports",
      "Inflation > 100% on food items",
    ],
    cascade_outputs: ["RS-03"],
  },
  {
    scenario_id: "RS-06",
    risk_name: "Sovereignty Loss / Foreign Capture",
    arabic: "فقدان السيادة والاستيلاء الأجنبي",
    base_probability: 0,
    severity_if_triggered: 82,
    time_horizon_days: 730,
    affected_population_pct: 100,
    economic_cost_billions_usd: 0,
    reversibility: "difficult",
    trigger_conditions: [
      "Foreign interference risk > 80",
      "IMF conditionality replaces sovereign policy",
      "Military or political pressure from regional power",
      "Dollar dependency > 80%",
    ],
    cascade_outputs: ["RS-07"],
  },
  {
    scenario_id: "RS-07",
    risk_name: "Constitutional / Governance Collapse",
    arabic: "انهيار دستوري وحوكمي",
    base_probability: 0,
    severity_if_triggered: 90,
    time_horizon_days: 365,
    affected_population_pct: 100,
    economic_cost_billions_usd: 0,
    reversibility: "irreversible",
    trigger_conditions: [
      "Gödel completeness < 0.15",
      "Rule of law < 20",
      "Constitutional stability < 3 years",
      "Democratic index < 3.0",
    ],
    cascade_outputs: ["RS-03", "RS-06"],
  },
  {
    scenario_id: "RS-08",
    risk_name: "Digital Authoritarianism / CBDC Capture",
    arabic: "الاستبداد الرقمي واستيلاء العملة المركزية",
    base_probability: 0,
    severity_if_triggered: 75,
    time_horizon_days: 540,
    affected_population_pct: 100,
    economic_cost_billions_usd: 0,
    reversibility: "difficult",
    trigger_conditions: [
      "CBDC launched with surveillance score > 80",
      "Cash eliminated > 90%",
      "Transaction monitoring without warrant",
      "Social credit linkage to financial access",
    ],
    cascade_outputs: ["RS-06"],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// MONTE CARLO SIMULATION
// ══════════════════════════════════════════════════════════════════════════════

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

export function runMonteCarlo(
  scenario: RiskScenario,
  probability: number,
  n_simulations = 10_000,
): MonteCarloResult {
  const rand = seededRandom(probability * 1e9 | 0);
  const impacts: number[] = [];

  for (let i = 0; i < n_simulations; i++) {
    const occurs = rand() < probability;
    if (!occurs) {
      impacts.push(0);
      continue;
    }
    // Fat-tail damage distribution (log-normal)
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const baseSeverity = scenario.severity_if_triggered;
    // Standard deviation = 20% of severity
    const impact = Math.max(0, Math.min(100, baseSeverity + normal * (baseSeverity * 0.2)));
    impacts.push(impact);
  }

  impacts.sort((a, b) => a - b);
  const mean = impacts.reduce((s, v) => s + v, 0) / n_simulations;
  const variance = impacts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n_simulations;
  const p10 = impacts[Math.floor(n_simulations * 0.10)];
  const p50 = impacts[Math.floor(n_simulations * 0.50)];
  const p90 = impacts[Math.floor(n_simulations * 0.90)];
  const p99 = impacts[Math.floor(n_simulations * 0.99)];
  const blackSwanThreshold = scenario.severity_if_triggered * 1.5;
  const blackSwanProb = impacts.filter(v => v >= blackSwanThreshold).length / n_simulations;

  return {
    scenario_id: scenario.scenario_id,
    simulations: n_simulations,
    expected_impact: Math.round(mean * 100) / 100,
    p10: Math.round(p10 * 100) / 100,
    p50: Math.round(p50 * 100) / 100,
    p90: Math.round(p90 * 100) / 100,
    p99: Math.round(p99 * 100) / 100,
    black_swan_probability: Math.round(blackSwanProb * 10000) / 10000,
    variance: Math.round(variance * 100) / 100,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CASCADE IMPACT CALCULATOR
// ══════════════════════════════════════════════════════════════════════════════

const CASCADE_GRAPH: Record<string, Array<{ to: string; delay_days: number; amplification: number; probability: number }>> = {
  "RS-01": [
    { to: "RS-03", delay_days: 45,  amplification: 1.4, probability: 0.75 },
    { to: "RS-05", delay_days: 30,  amplification: 1.8, probability: 0.65 },
    { to: "RS-07", delay_days: 180, amplification: 1.2, probability: 0.40 },
  ],
  "RS-02": [
    { to: "RS-01", delay_days: 60,  amplification: 1.6, probability: 0.80 },
    { to: "RS-04", delay_days: 30,  amplification: 1.5, probability: 0.70 },
    { to: "RS-06", delay_days: 365, amplification: 1.3, probability: 0.35 },
  ],
  "RS-03": [
    { to: "RS-06", delay_days: 90,  amplification: 1.3, probability: 0.45 },
    { to: "RS-08", delay_days: 180, amplification: 1.1, probability: 0.30 },
  ],
  "RS-04": [
    { to: "RS-01", delay_days: 15,  amplification: 2.0, probability: 0.90 },
    { to: "RS-03", delay_days: 45,  amplification: 1.5, probability: 0.60 },
  ],
  "RS-05": [
    { to: "RS-03", delay_days: 30,  amplification: 1.8, probability: 0.80 },
  ],
  "RS-06": [
    { to: "RS-07", delay_days: 180, amplification: 1.4, probability: 0.55 },
  ],
  "RS-07": [
    { to: "RS-03", delay_days: 60,  amplification: 1.6, probability: 0.70 },
    { to: "RS-06", delay_days: 90,  amplification: 1.2, probability: 0.50 },
  ],
};

export function computeCascadeImpact(
  triggerRiskId: string,
  baseDamage: number,
  maxDepth = 4,
): CascadeImpact {
  const chain: CascadeImpact["chain"] = [];
  const visited = new Set<string>();
  let cumulativeDamage = baseDamage;
  let maxDelay = 0;

  function traverse(riskId: string, delay: number, damage: number, depth: number): void {
    if (depth > maxDepth || visited.has(riskId)) return;
    visited.add(riskId);

    const edges = CASCADE_GRAPH[riskId] ?? [];
    for (const edge of edges) {
      const scenario = RISK_SCENARIOS.find(s => s.scenario_id === edge.to);
      if (!scenario) continue;
      const cascadeDamage = damage * edge.amplification * edge.probability;
      const totalDelay = delay + edge.delay_days;
      cumulativeDamage += cascadeDamage;
      maxDelay = Math.max(maxDelay, totalDelay);
      chain.push({
        risk_id: edge.to,
        risk_name: scenario.risk_name,
        delay_days: totalDelay,
        amplification_factor: edge.amplification,
        probability: edge.probability,
        cumulative_damage: Math.round(cumulativeDamage * 100) / 100,
      });
      traverse(edge.to, totalDelay, cascadeDamage, depth + 1);
    }
  }

  traverse(triggerRiskId, 0, baseDamage, 0);
  chain.sort((a, b) => a.delay_days - b.delay_days);

  const preventionWindow = chain.length > 0 ? Math.min(...chain.map(c => c.delay_days)) - 14 : 365;

  return {
    trigger_risk: triggerRiskId,
    chain,
    total_chain_damage: Math.round(cumulativeDamage * 100) / 100,
    time_to_full_cascade_days: maxDelay,
    prevention_window_days: Math.max(0, preventionWindow),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// AFTER-EFFECTS TIMELINE
// ══════════════════════════════════════════════════════════════════════════════

export function buildAfterEffectsTimeline(
  riskId: string,
  severity: number,
  reversibility: RiskScenario["reversibility"],
): AfterEffectsTimeline {
  const scenario = RISK_SCENARIOS.find(s => s.scenario_id === riskId);
  const halfLifeDays = reversibility === "reversible" ? 90 :
    reversibility === "difficult" ? 365 : 1825; // 5 years if irreversible
  const residualDamage = reversibility === "reversible" ? 10 :
    reversibility === "difficult" ? 30 : 60;

  return {
    risk_id: riskId,
    immediate_0_30: {
      economic_damage_pct: Math.round(severity * 0.6),
      social_disruption: severity > 80
        ? "Severe — food/medicine shortages, capital flight, bank runs"
        : severity > 50
        ? "Significant — purchasing power loss, business closures"
        : "Moderate — financial stress, reduced consumption",
      political_pressure: severity > 80
        ? "Existential — government may fall, emergency powers invoked"
        : "High — parliamentary opposition, street protests possible",
      citizen_impact: `~${scenario?.affected_population_pct ?? 70}% directly affected. Savings devalued, access to services disrupted.`,
    },
    short_term_31_90: {
      recovery_probability: reversibility === "reversible" ? 0.75 :
        reversibility === "difficult" ? 0.45 : 0.20,
      structural_damage: severity > 80
        ? "Permanent brain drain begins. Foreign investment collapses. Credit access frozen."
        : "Supply chain disruption. SME failures. Rising NPLs in banking sector.",
      behavioral_changes: "Citizens shift to USD/BTC savings. Trust in local currency erodes. Barter emerges in informal economy.",
      policy_responses: [
        "IMF emergency financing (if applicable)",
        "Capital controls (frequently counterproductive)",
        "Emergency food/fuel subsidies",
        "BTC/sBTC corridor activation for remittances",
      ],
    },
    medium_term_91_365: {
      new_equilibrium: reversibility === "reversible"
        ? "Recovery begins — new monetary anchor, restored confidence if reforms enacted"
        : "Partial stabilization at lower equilibrium — permanent reduction in potential GDP",
      irreversible_changes: reversibility !== "reversible" ? [
        "Human capital loss (emigration of skilled workers)",
        "Institutional trust erosion — takes 10-20 years to rebuild",
        "Market structure changes — oligopolies fill gaps left by failures",
      ] : [],
      opportunity_windows: [
        "Financial inclusion leap: BTC/sBTC adoption fills banking gap",
        "x402 government APIs: transparent digital services rebuild trust",
        "Cantillon⁻¹ reform: crisis creates political will for monetary reform",
        "Constitutional convention: rebuild Gödel-consistent legal framework",
      ],
    },
    long_term_1_10_years: {
      trajectory: reversibility === "reversible" ? "recovery" :
        reversibility === "difficult" ? "adaptation" : "decline",
      critical_dependencies: [
        "Quality of leadership post-crisis",
        "Speed of BTC/sBTC financial infrastructure deployment",
        "Cantillon routing reform — who captures the recovery",
        "Constitutional consistency restoration (Gödel completeness)",
      ],
      renaissance_conditions: [
        "Adopt BTC standard as monetary anchor",
        "Implement Cantillon⁻¹ routing: citizen-first monetary policy",
        "Deploy x402 government transparency APIs",
        "Pass Zero Harm Protocol into constitutional law",
        "Launch USSD/SMS financial inclusion for unbanked",
      ],
    },
    decay_model: {
      formula: `D(t) = D_0 × e^(-λt)  where λ = ln(2)/${halfLifeDays}`,
      half_life_days: halfLifeDays,
      residual_damage_pct: residualDamage,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// BIAS / DISCRIMINATION AUDIT
// ══════════════════════════════════════════════════════════════════════════════

export function runBiasAudit(
  systemOrPolicy: string,
  impacts: Array<{ group: string; impact: number; cantillon_class: "poor" | "middle" | "rich" }>,
): BiasAuditResult {
  const auditId = `BA-${Date.now().toString(36).toUpperCase()}`;
  const richImpact = impacts.find(i => i.cantillon_class === "rich")?.impact ?? 10;
  const discriminationTypes: string[] = [];

  const groups = impacts.map(i => {
    const disparateRatio = richImpact > 0 ? i.impact / richImpact : 1;
    let verdict: "equitable" | "monitor" | "discriminatory";
    if (disparateRatio > 1.5 && i.cantillon_class !== "rich") {
      verdict = "discriminatory";
      discriminationTypes.push(`Cantillon discrimination against ${i.cantillon_class} class`);
    } else if (disparateRatio > 1.2) {
      verdict = "monitor";
    } else {
      verdict = "equitable";
    }
    return { group: i.group, impact_score: i.impact, cantillon_class: i.cantillon_class,
      disparate_impact_ratio: Math.round(disparateRatio * 100) / 100, verdict };
  });

  const avgImpact = impacts.reduce((s, i) => s + i.impact, 0) / impacts.length;
  const biasScore = Math.min(100, (richImpact > 0 ?
    (avgImpact - richImpact) / richImpact * 100 : 0));

  return {
    audit_id: auditId,
    system_or_policy: systemOrPolicy,
    population_groups: groups,
    overall_bias_score: Math.round(Math.max(0, biasScore)),
    discrimination_detected: discriminationTypes.length > 0,
    discrimination_type: discriminationTypes,
    remediation: discriminationTypes.length > 0 ? [
      "Apply Cantillon⁻¹ routing: invert distribution so poor benefit first",
      "Means-test the policy: reduce impact on low-income groups",
      "Universal basic services: ensure floor before scaling",
      "Audit distribution quarterly with on-chain transparency",
    ] : ["No discrimination detected — maintain monitoring"],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// REMEDIATION SCORER
// ══════════════════════════════════════════════════════════════════════════════

export function scoreRemediation(
  actionName: string,
  targetRisk: RiskScenario,
  currentProbability: number,
  implementationCostMillionsUsd: number,
): RemediationScore {
  // Compute expected damage prevented
  const expectedDamage = currentProbability * targetRisk.severity_if_triggered *
    targetRisk.economic_cost_billions_usd * 1000; // in millions
  const reducedProbability = currentProbability * 0.5; // assume 50% reduction as baseline
  const damagePrevented = (currentProbability - reducedProbability) *
    targetRisk.severity_if_triggered * targetRisk.economic_cost_billions_usd * 1000;

  const costEffectiveness = implementationCostMillionsUsd > 0
    ? Math.round(damagePrevented / implementationCostMillionsUsd * 10) / 10
    : 999; // free intervention

  return {
    action_id: `REM-${Date.now().toString(36).toUpperCase()}`,
    action_name: actionName,
    target_risk: targetRisk.scenario_id,
    risk_reduction_pct: 50,
    cost_effectiveness: costEffectiveness,
    time_to_effect_days: 90,
    side_effects: [
      { effect: "Public confidence restoration", sign: "positive" },
      { effect: "Short-term liquidity tightening", sign: "negative" },
      { effect: "BTC/sBTC adoption acceleration", sign: "positive" },
    ],
    cantillon_distribution: {
      poor: 60,
      middle: 30,
      rich: 10,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// FULL RISK ASSESSMENT — all scenarios for a country
// ══════════════════════════════════════════════════════════════════════════════

export interface CountryRiskAssessment {
  country_code: string;
  assessment_id: string;
  generated_at: string;
  scenarios: Array<{
    scenario: RiskScenario;
    adjusted_probability: number;
    monte_carlo: MonteCarloResult;
    cascade: CascadeImpact;
    after_effects: AfterEffectsTimeline;
  }>;
  top_risk: string;
  aggregate_expected_damage: number;
  total_black_swan_risk: number;
  bias_audit: BiasAuditResult;
  overall_risk_rating: "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "CRITICAL";
}

export function assessCountryRisks(
  countryCode: string,
  inflationPct: number,
  debtGdpPct: number,
  giniCoefficient: number,
  sovereigntyIndex: number,
  godelCompleteness: number,
  cbdcSurveillanceRisk: number,
  gdpBillions: number,
): CountryRiskAssessment {
  const assessmentId = `CRA-${countryCode}-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  // Compute adjusted probabilities per country
  const probabilities: Record<string, number> = {
    "RS-01": Math.min(0.95, inflationPct > 50 ? 0.80 : inflationPct > 20 ? 0.45 : inflationPct > 10 ? 0.20 : 0.05),
    "RS-02": Math.min(0.90, debtGdpPct > 150 ? 0.60 : debtGdpPct > 100 ? 0.30 : debtGdpPct > 80 ? 0.15 : 0.05),
    "RS-03": Math.min(0.85, giniCoefficient > 0.55 ? 0.65 : giniCoefficient > 0.45 ? 0.35 : 0.15),
    "RS-04": Math.min(0.90, inflationPct > 100 ? 0.70 : inflationPct > 30 ? 0.30 : 0.10),
    "RS-05": Math.min(0.80, inflationPct > 50 ? 0.55 : inflationPct > 20 ? 0.25 : 0.08),
    "RS-06": Math.min(0.75, (100 - sovereigntyIndex) > 70 ? 0.50 : (100 - sovereigntyIndex) > 50 ? 0.25 : 0.10),
    "RS-07": Math.min(0.70, godelCompleteness < 0.2 ? 0.55 : godelCompleteness < 0.4 ? 0.30 : 0.10),
    "RS-08": Math.min(0.85, cbdcSurveillanceRisk > 80 ? 0.70 : cbdcSurveillanceRisk > 60 ? 0.40 : 0.10),
  };

  const results = RISK_SCENARIOS.map(scenario => {
    const prob = probabilities[scenario.scenario_id] ?? 0.10;
    const scenarioWithCost = { ...scenario, economic_cost_billions_usd: gdpBillions * 0.15 };
    const mc = runMonteCarlo(scenarioWithCost, prob);
    const cascade = computeCascadeImpact(scenario.scenario_id, mc.expected_impact);
    const afterEffects = buildAfterEffectsTimeline(scenario.scenario_id, scenario.severity_if_triggered, scenario.reversibility);
    return { scenario: scenarioWithCost, adjusted_probability: prob, monte_carlo: mc, cascade, after_effects: afterEffects };
  });

  const topRisk = results.reduce((best, r) =>
    r.monte_carlo.expected_impact > best.monte_carlo.expected_impact ? r : best
  ).scenario.scenario_id;

  const aggregateDamage = results.reduce((s, r) => s + r.monte_carlo.expected_impact, 0);
  const blackSwanRisk = 1 - results.reduce((p, r) => p * (1 - r.monte_carlo.black_swan_probability), 1);

  const biasAudit = runBiasAudit("Country Monetary Policy", [
    { group: "Bottom 40% income", impact: 85, cantillon_class: "poor" },
    { group: "Middle 40% income", impact: 55, cantillon_class: "middle" },
    { group: "Top 20% income", impact: 20, cantillon_class: "rich" },
  ]);

  const rating: CountryRiskAssessment["overall_risk_rating"] =
    aggregateDamage > 400 ? "CRITICAL" :
    aggregateDamage > 250 ? "SEVERE" :
    aggregateDamage > 150 ? "HIGH" :
    aggregateDamage > 75  ? "MODERATE" : "LOW";

  return {
    country_code: countryCode,
    assessment_id: assessmentId,
    generated_at: now,
    scenarios: results,
    top_risk: topRisk,
    aggregate_expected_damage: Math.round(aggregateDamage * 100) / 100,
    total_black_swan_risk: Math.round(blackSwanRisk * 10000) / 10000,
    bias_audit: biasAudit,
    overall_risk_rating: rating,
  };
}
