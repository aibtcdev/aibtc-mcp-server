/**
 * Neuro-Sovereign Intelligence Tools
 * أدوات الذكاء العصبي السيادي
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Tools:
 *   neuro_reality_scan      — 7-domain economic reality scan for any country
 *   neuro_full_intelligence — Complete 6-layer neural analysis (sensation→action)
 *   neuro_risk_calculate    — Monte Carlo risk simulation (10,000 scenarios)
 *   neuro_cascade_impact    — Cascade chain: how one risk triggers others
 *   neuro_after_effects     — 30/90/365-day after-effects timeline
 *   neuro_bias_audit        — Discrimination/disparate impact audit
 *   sanctions_screen        — Live OFAC + EU + UK OFSI screening (SEC-12/13 fix)
 *   sanctions_status        — Sanctions feed freshness and entry counts
 *   sanctions_refresh       — Force-refresh all sanctions feeds
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buildDefaultReality,
  runNeuroEconomicAnalysis,
  computePsiFromReality,
  type EconomicReality,
} from "../services/simulation/neuro-economic.js";

import {
  assessCountryRisks,
  computeCascadeImpact,
  buildAfterEffectsTimeline,
  runBiasAudit,
  RISK_SCENARIOS,
  runMonteCarlo,
} from "../services/simulation/risk-impact-engine.js";

import {
  screenEntity,
  getFeedStatuses,
  forceRefreshAllFeeds,
} from "../services/security/sanctions-engine.js";

export function registerNeuroSovereignTools(server: McpServer): void {

  // ─── 1. NEURO REALITY SCAN ───────────────────────────────────────────────
  server.registerTool(
    "neuro_reality_scan",
    {
      title: "Neuro Reality Scan — 7-Domain Economic Reality",
      description:
        "Scan any country across 7 reality domains: Monetary · Fiscal · Social · " +
        "Environmental · Security · Governance · Digital. Returns raw Ψ score, " +
        "domain-by-domain analysis, and which domains are in crisis. " +
        "Pre-loaded profiles: LB (Lebanon), US, NG (Nigeria), SA (Saudi Arabia). " +
        "Any other country uses global averages with optional overrides.",
      inputSchema: {
        country_code: z.string().length(2).describe("ISO 3166-1 alpha-2 country code (e.g. LB, US, NG, EG, PK)"),
        currency_code: z.string().length(3).describe("ISO 4217 currency code (e.g. LBP, USD, NGN, EGP)"),
        country_name: z.string().describe("Full country name"),
        overrides: z.object({
          inflation_pct: z.number().optional(),
          debt_gdp_pct: z.number().optional(),
          gini_coefficient: z.number().min(0).max(1).optional(),
          unbanked_pct: z.number().min(0).max(100).optional(),
          sovereignty_index: z.number().min(0).max(100).optional(),
          godel_completeness: z.number().min(0).max(1).optional(),
          renewable_energy_pct: z.number().min(0).max(100).optional(),
          cbdc_surveillance_risk: z.number().min(0).max(100).optional(),
          cantillon_spread: z.number().min(0).max(100).optional(),
        }).optional().describe("Override specific metrics (leave empty to use profile/defaults)"),
      },
    },
    async (input) => {
      const monetaryOverrides = input.overrides ? {
        inflation_pct: input.overrides.inflation_pct,
        cantillon_spread: input.overrides.cantillon_spread,
      } : {};
      const fiscalOverrides = input.overrides?.debt_gdp_pct
        ? { debt_gdp_pct: input.overrides.debt_gdp_pct } : {};
      const socialOverrides = input.overrides ? {
        gini_coefficient: input.overrides.gini_coefficient,
        unbanked_pct: input.overrides.unbanked_pct,
      } : {};
      const securityOverrides = input.overrides?.sovereignty_index
        ? { sovereignty_index: input.overrides.sovereignty_index } : {};
      const governanceOverrides = input.overrides?.godel_completeness
        ? { godel_completeness: input.overrides.godel_completeness } : {};
      const environmentalOverrides = input.overrides?.renewable_energy_pct
        ? { renewable_energy_pct: input.overrides.renewable_energy_pct } : {};
      const digitalOverrides = input.overrides?.cbdc_surveillance_risk
        ? { cbdc_surveillance_risk: input.overrides.cbdc_surveillance_risk } : {};

      const overrideObj: Partial<EconomicReality> = {
        ...(Object.keys(monetaryOverrides).some(k => monetaryOverrides[k as keyof typeof monetaryOverrides] !== undefined)
          ? { monetary: monetaryOverrides as EconomicReality["monetary"] } : {}),
        ...(Object.keys(fiscalOverrides).length ? { fiscal: fiscalOverrides as EconomicReality["fiscal"] } : {}),
        ...(Object.keys(socialOverrides).some(k => socialOverrides[k as keyof typeof socialOverrides] !== undefined)
          ? { social: socialOverrides as EconomicReality["social"] } : {}),
        ...(Object.keys(securityOverrides).length ? { security: securityOverrides as EconomicReality["security"] } : {}),
        ...(Object.keys(governanceOverrides).length ? { governance: governanceOverrides as EconomicReality["governance"] } : {}),
        ...(Object.keys(environmentalOverrides).length ? { environmental: environmentalOverrides as EconomicReality["environmental"] } : {}),
        ...(Object.keys(digitalOverrides).length ? { digital: digitalOverrides as EconomicReality["digital"] } : {}),
      };

      const reality = buildDefaultReality(
        input.country_code.toUpperCase(),
        input.currency_code.toUpperCase(),
        input.country_name,
        overrideObj,
      );

      const psi = computePsiFromReality(reality);
      const criticalDomains: string[] = [];

      if (reality.monetary.inflation_pct > 50) criticalDomains.push("Monetary — hyperinflation");
      if (reality.fiscal.debt_gdp_pct > 130) criticalDomains.push("Fiscal — debt trap");
      if (reality.social.poverty_rate_pct > 60) criticalDomains.push("Social — mass poverty");
      if (reality.environmental.landauer_score < 0.2) criticalDomains.push("Environmental — entropy deficit");
      if (reality.security.conflict_level >= 3) criticalDomains.push("Security — active conflict");
      if (reality.governance.godel_completeness < 0.2) criticalDomains.push("Governance — Gödel failure");
      if (reality.digital.cbdc_surveillance_risk > 80 && reality.digital.cbdc_status !== "none")
        criticalDomains.push("Digital — CBDC surveillance capture");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            country: input.country_name,
            currency: input.currency_code.toUpperCase(),
            psi_score: psi.score,
            psi_tier: psi.tier,
            critical_domains: criticalDomains,
            domain_count_in_crisis: criticalDomains.length,
            reality,
          }, null, 2),
        }],
      };
    },
  );

  // ─── 2. NEURO FULL INTELLIGENCE ───────────────────────────────────────────
  server.registerTool(
    "neuro_full_intelligence",
    {
      title: "Full Neuro-Economic Intelligence Report (6 Neural Layers)",
      description:
        "Complete sovereign intelligence analysis through all 6 neural layers: " +
        "Layer 0 (Sensation) → Layer 1 (Perception) → Layer 2 (Understanding) → " +
        "Layer 3 (Cognition/Nash) → Layer 4 (Wisdom) → Layer 5 (Action). " +
        "Returns a full NeuroIntelligenceReport with game-theoretic assessment, " +
        "root causes, Nash equilibrium status, and prioritized reform recommendations.",
      inputSchema: {
        country_code: z.string().length(2).describe("ISO country code (e.g. LB, US, NG)"),
        currency_code: z.string().length(3).describe("Currency code (e.g. LBP, USD, NGN)"),
        country_name: z.string().describe("Country name"),
        inflation_pct: z.number().optional().describe("Current annual inflation rate"),
        debt_gdp_pct: z.number().optional().describe("Public debt as % of GDP"),
        gini_coefficient: z.number().min(0).max(1).optional().describe("Income inequality (0-1)"),
        unbanked_pct: z.number().min(0).max(100).optional().describe("% population without bank access"),
        sovereignty_index: z.number().min(0).max(100).optional().describe("Sovereignty score (0-100)"),
        layer_filter: z.enum(["all", "summary", "actions_only"]).optional()
          .describe("Which layers to include in response (default: all)"),
      },
    },
    async (input) => {
      const monetaryOverrides = input.inflation_pct !== undefined
        ? { inflation_pct: input.inflation_pct } as EconomicReality["monetary"] : undefined;
      const fiscalOverrides = input.debt_gdp_pct !== undefined
        ? { debt_gdp_pct: input.debt_gdp_pct } as EconomicReality["fiscal"] : undefined;
      const socialOverrides = (input.gini_coefficient !== undefined || input.unbanked_pct !== undefined)
        ? { gini_coefficient: input.gini_coefficient, unbanked_pct: input.unbanked_pct } as EconomicReality["social"]
        : undefined;
      const securityOverrides = input.sovereignty_index !== undefined
        ? { sovereignty_index: input.sovereignty_index } as EconomicReality["security"] : undefined;

      const overrideObj: Partial<EconomicReality> = {
        ...(monetaryOverrides ? { monetary: monetaryOverrides } : {}),
        ...(fiscalOverrides ? { fiscal: fiscalOverrides } : {}),
        ...(socialOverrides ? { social: socialOverrides } : {}),
        ...(securityOverrides ? { security: securityOverrides } : {}),
      };

      const reality = buildDefaultReality(
        input.country_code.toUpperCase(),
        input.currency_code.toUpperCase(),
        input.country_name,
        overrideObj,
      );

      const report = runNeuroEconomicAnalysis(reality);

      const filter = input.layer_filter ?? "all";
      const output = filter === "summary"
        ? {
          report_id: report.report_id,
          country: input.country_name,
          psi_score: report.psi_score,
          psi_tier: report.psi_tier,
          overall_health_score: report.overall_health_score,
          system_trajectory: report.layer_4_wisdom.system_trajectory,
          nash_equilibrium: report.layer_3_cognition.nash_equilibrium_status,
          executive_summary_arabic: report.executive_summary_arabic,
          executive_summary: report.executive_summary,
          human_cost: report.human_cost_estimate,
          urgent_actions: report.layer_5_action.recommendations.filter(a => a.priority <= 2),
        }
        : filter === "actions_only"
        ? {
          report_id: report.report_id,
          psi_score: report.psi_score,
          recommendations: report.layer_5_action.recommendations,
          urgent_count: report.layer_5_action.urgent_count,
        }
        : report;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        }],
      };
    },
  );

  // ─── 3. NEURO RISK CALCULATE ─────────────────────────────────────────────
  server.registerTool(
    "neuro_risk_calculate",
    {
      title: "Monte Carlo Risk Calculation (10,000 scenarios)",
      description:
        "Full risk assessment for a country using Monte Carlo simulation across " +
        "8 risk scenarios: hyperinflation, debt default, social unrest, banking collapse, " +
        "food crisis, sovereignty loss, governance collapse, CBDC capture. " +
        "Returns P10/P50/P90/P99 percentiles, black swan probability, " +
        "and overall risk rating: LOW/MODERATE/HIGH/SEVERE/CRITICAL.",
      inputSchema: {
        country_code: z.string().length(2).describe("ISO country code"),
        inflation_pct: z.number().describe("Current annual inflation rate (%)"),
        debt_gdp_pct: z.number().describe("Public debt as % of GDP"),
        gini_coefficient: z.number().min(0).max(1).describe("Income inequality (0-1)"),
        sovereignty_index: z.number().min(0).max(100).describe("Sovereignty score (0-100)"),
        godel_completeness: z.number().min(0).max(1).describe("Governance consistency (0-1)"),
        cbdc_surveillance_risk: z.number().min(0).max(100).describe("CBDC surveillance risk (0-100)"),
        gdp_billions_usd: z.number().describe("GDP in billions USD"),
      },
    },
    async (input) => {
      const assessment = assessCountryRisks(
        input.country_code.toUpperCase(),
        input.inflation_pct,
        input.debt_gdp_pct,
        input.gini_coefficient,
        input.sovereignty_index,
        input.godel_completeness,
        input.cbdc_surveillance_risk,
        input.gdp_billions_usd,
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            assessment_id: assessment.assessment_id,
            country: input.country_code.toUpperCase(),
            overall_risk_rating: assessment.overall_risk_rating,
            aggregate_expected_damage_score: assessment.aggregate_expected_damage,
            total_black_swan_probability: assessment.total_black_swan_risk,
            top_risk: assessment.top_risk,
            bias_audit: assessment.bias_audit,
            scenarios: assessment.scenarios.map(s => ({
              scenario_id: s.scenario.scenario_id,
              name: s.scenario.risk_name,
              arabic: s.scenario.arabic,
              probability: s.adjusted_probability,
              monte_carlo: s.monte_carlo,
              cascade_chain_length: s.cascade.chain.length,
              total_cascade_damage: s.cascade.total_chain_damage,
              prevention_window_days: s.cascade.prevention_window_days,
            })),
          }, null, 2),
        }],
      };
    },
  );

  // ─── 4. NEURO CASCADE IMPACT ─────────────────────────────────────────────
  server.registerTool(
    "neuro_cascade_impact",
    {
      title: "Cascade Impact Analysis",
      description:
        "Compute how a triggered risk cascades through the system. " +
        "Shows the full cascade chain: RS-01 (hyperinflation) → RS-05 (food crisis) → " +
        "RS-03 (social unrest) → RS-06 (sovereignty loss), with delay, amplification, " +
        "cumulative damage at each step, and the prevention window (days before chain locks in).",
      inputSchema: {
        risk_id: z.enum(["RS-01","RS-02","RS-03","RS-04","RS-05","RS-06","RS-07","RS-08"])
          .describe("Risk to trigger: RS-01=hyperinflation, RS-02=debt default, RS-03=social unrest, RS-04=banking, RS-05=food, RS-06=sovereignty, RS-07=governance, RS-08=CBDC"),
        base_damage: z.number().min(0).max(100).describe("Initial damage score (0-100)"),
      },
    },
    async (input) => {
      const cascade = computeCascadeImpact(input.risk_id, input.base_damage);
      const scenario = RISK_SCENARIOS.find(s => s.scenario_id === input.risk_id);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            trigger: {
              risk_id: input.risk_id,
              name: scenario?.risk_name ?? input.risk_id,
              arabic: scenario?.arabic ?? "",
              base_damage: input.base_damage,
            },
            cascade,
            interpretation: cascade.chain.length === 0
              ? "No cascade dependencies for this risk — it is a terminal node."
              : `This risk cascades into ${cascade.chain.length} downstream risks. ` +
                `Prevention window: ${cascade.prevention_window_days} days. ` +
                `Total amplified damage: ${cascade.total_chain_damage.toFixed(1)}. ` +
                `Act within ${cascade.prevention_window_days} days to break the chain.`,
          }, null, 2),
        }],
      };
    },
  );

  // ─── 5. NEURO AFTER EFFECTS ──────────────────────────────────────────────
  server.registerTool(
    "neuro_after_effects",
    {
      title: "After-Effects Timeline (30/90/365 days + long-term)",
      description:
        "After a risk materializes: what happens in the first 30 days, 31-90 days, " +
        "91-365 days, and 1-10 years? Includes economic decay model with half-life, " +
        "behavioral changes, policy responses, irreversible changes, " +
        "and renaissance opportunity windows.",
      inputSchema: {
        risk_id: z.enum(["RS-01","RS-02","RS-03","RS-04","RS-05","RS-06","RS-07","RS-08"])
          .describe("Which risk materialized"),
        severity: z.number().min(0).max(100).describe("How severe the event was (0-100)"),
        reversibility: z.enum(["reversible", "difficult", "irreversible"])
          .describe("How reversible the damage is"),
      },
    },
    async (input) => {
      const timeline = buildAfterEffectsTimeline(input.risk_id, input.severity, input.reversibility);
      const scenario = RISK_SCENARIOS.find(s => s.scenario_id === input.risk_id);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            risk: { id: input.risk_id, name: scenario?.risk_name, arabic: scenario?.arabic },
            severity: input.severity,
            reversibility: input.reversibility,
            timeline,
          }, null, 2),
        }],
      };
    },
  );

  // ─── 6. NEURO BIAS AUDIT ─────────────────────────────────────────────────
  server.registerTool(
    "neuro_bias_audit",
    {
      title: "Discrimination / Bias Audit (Cantillon Disparate Impact)",
      description:
        "Audit any policy, monetary reform, or system for discriminatory disparate impact " +
        "using the 4/5ths rule (disparate impact ratio < 0.8 = discriminatory). " +
        "Maps impact to Cantillon classes (poor/middle/rich) and detects Cantillon extraction bias. " +
        "Returns remediation steps to achieve equitable distribution.",
      inputSchema: {
        system_or_policy: z.string().describe("What is being audited (e.g. 'Central Bank QE policy', 'CBDC rollout', 'VAT increase')"),
        impact_groups: z.array(z.object({
          group: z.string().describe("Group name (e.g. 'Bottom 40% income', 'Smallholder farmers')"),
          impact_score: z.number().min(0).max(100).describe("Impact score 0-100 (100 = most harmed)"),
          cantillon_class: z.enum(["poor", "middle", "rich"]).describe("Cantillon class"),
        })).min(2).describe("Groups and their impact scores"),
      },
    },
    async (input) => {
      const result = runBiasAudit(
        input.system_or_policy,
        input.impact_groups.map(g => ({
          group: g.group,
          impact: g.impact_score,
          cantillon_class: g.cantillon_class,
        })),
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...result,
            verdict_summary: result.discrimination_detected
              ? `DISCRIMINATION DETECTED — ${result.discrimination_type.join("; ")}. Bias score: ${result.overall_bias_score}/100.`
              : `No significant discrimination. Bias score: ${result.overall_bias_score}/100.`,
            zero_harm_compliance: result.discrimination_detected ? "FAILED — violates CR-04 (no discrimination)" : "PASSED",
          }, null, 2),
        }],
      };
    },
  );

  // ─── 7. SANCTIONS SCREEN ─────────────────────────────────────────────────
  server.registerTool(
    "sanctions_screen",
    {
      title: "Live Sanctions Screening (OFAC + EU + UK OFSI)",
      description:
        "Screen a name, address, or entity against live sanctions lists. " +
        "Checks US OFAC SDN, EU Consolidated Sanctions, and UK OFSI lists simultaneously. " +
        "Uses fuzzy name matching (Levenshtein ≤ 20%) and exact address matching. " +
        "Returns match score, jurisdiction, sanctions program, and date listed. " +
        "FIXES SEC-12 (OFAC static) + SEC-13 (EU/UK missing). " +
        "Zero Harm Protocol: individual screening only — no country-based mass blocking.",
      inputSchema: {
        value: z.string().describe("Name, address, or entity to screen"),
        type: z.enum(["name", "address", "entity"]).describe("Type of value being screened"),
        jurisdictions: z.array(z.enum(["US_OFAC", "EU", "UK_OFSI"])).optional()
          .describe("Jurisdictions to check (default: all three)"),
      },
    },
    async (input) => {
      const result = await screenEntity(
        input.value,
        input.type,
        (input.jurisdictions as ("US_OFAC" | "EU" | "UK_OFSI")[] | undefined) ?? ["US_OFAC", "EU", "UK_OFSI"],
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...result,
            compliance_action: result.is_sanctioned
              ? "BLOCKED — Entity appears on sanctions list. Transaction not permitted without legal authorization."
              : result.matches.length > 0
              ? "REVIEW — Partial matches found. Manual compliance review recommended before proceeding."
              : "CLEAR — No sanctions matches found. Proceed with normal due diligence.",
            zero_harm_note: "Screening is individual-based. No country-level blocking (CR-04 compliance).",
          }, null, 2),
        }],
      };
    },
  );

  // ─── 8. SANCTIONS STATUS ─────────────────────────────────────────────────
  server.registerTool(
    "sanctions_status",
    {
      title: "Sanctions Feeds Status",
      description:
        "Check the freshness and entry count of all three sanctions feeds: " +
        "US OFAC, EU Consolidated Sanctions, UK OFSI. " +
        "Shows last updated time, entry count, and any errors. " +
        "Feeds auto-refresh every 24 hours. Use sanctions_refresh to force update.",
      inputSchema: {},
    },
    async (_input) => {
      const statuses = await getFeedStatuses();
      const allFresh = statuses.every(s => s.is_fresh);
      const totalEntries = statuses.reduce((s, f) => s + f.entry_count, 0);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            overall_status: allFresh ? "CURRENT" : "STALE — run sanctions_refresh",
            total_entries_loaded: totalEntries,
            feeds: statuses,
            sec_12_status: statuses.find(s => s.jurisdiction === "US_OFAC")?.is_fresh ? "FIXED — OFAC live" : "STALE",
            sec_13_status: statuses.filter(s => ["EU","UK_OFSI"].includes(s.jurisdiction))
              .every(s => s.is_fresh) ? "FIXED — EU + UK live" : "STALE",
          }, null, 2),
        }],
      };
    },
  );

  // ─── 9. SANCTIONS REFRESH ────────────────────────────────────────────────
  server.registerTool(
    "sanctions_refresh",
    {
      title: "Force-Refresh All Sanctions Feeds",
      description:
        "Force re-download of all sanctions feeds from official sources: " +
        "OFAC (treasury.gov), EU (ec.europa.eu), UK OFSI. " +
        "Clears cache and fetches latest data. Use when you need guaranteed fresh data.",
      inputSchema: {},
    },
    async (_input) => {
      const statuses = await forceRefreshAllFeeds();
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            refresh_result: "COMPLETE",
            feeds: statuses,
            timestamp: new Date().toISOString(),
          }, null, 2),
        }],
      };
    },
  );
}
