/**
 * Policy Tools — The Satisfying Solution for All Stakeholders
 *
 * Models the dual-layer architecture that satisfies regulators,
 * central banks, industry, citizens, and developing nations.
 *
 * Tools:
 *   policy_stakeholders  — what each party says vs. what they actually want
 *   policy_reserve_proof — real-time on-chain proof of reserves
 *   policy_cbdc          — Bitcoin-backed CBDC model for any currency
 *   policy_transparency  — blockchain vs. traditional banking oversight
 *   policy_scenarios     — compare all Senate amendment outcomes
 *   policy_inclusion     — financial inclusion by region
 *   policy_full          — complete satisfying solution in one call
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import {
  analyzeStakeholders,
  buildReserveProof,
  buildCbdcModel,
  compareTransparency,
  modelPolicyScenarios,
  modelInclusion,
  buildFullSolution,
} from "../services/policy-engine.js";

export function registerPolicyTools(server: McpServer): void {

  // ── policy_stakeholders ───────────────────────────────────────────────────

  server.registerTool(
    "policy_stakeholders",
    {
      title:       "Stakeholder Analysis",
      description: "Reveal what each political stakeholder says they want vs. what they actually want — and exactly how the dual-layer solution satisfies each one.",
      inputSchema: z.object({}),
    },
    async () => {
      const stakeholders = analyzeStakeholders();
      const lines = stakeholders.flatMap(s => [
        ``,
        `◆ ${s.stakeholder}`,
        `  Says:     ${s.says_they_want}`,
        `  Wants:    ${s.actually_wants}`,
        `  Gets:     ${s.solution_gives}`,
        `  Score:    ${"█".repeat(Math.round(s.satisfaction/10))}${"░".repeat(10-Math.round(s.satisfaction/10))} ${s.satisfaction}/100`,
        `  Insight:  ${s.key_insight}`,
      ]);

      const avg = Math.round(stakeholders.reduce((s,x) => s + x.satisfaction, 0) / stakeholders.length);

      return {
        content: [{
          type: "text",
          text: [
            `**Stakeholder Analysis — Who Gets What**`,
            ...lines,
            ``,
            `─────────────────────────────────────`,
            `Average satisfaction: ${avg}/100`,
            ``,
            `Key: Everyone wins because we give them what they ACTUALLY want,`,
            `not what they publicly demand.`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── policy_reserve_proof ──────────────────────────────────────────────────

  server.registerTool(
    "policy_reserve_proof",
    {
      title:       "Proof of Reserves",
      description: "Model real-time on-chain proof of reserves for any financial institution. This replaces 18-month audit cycles with instant public verification — giving regulators stronger oversight than they have today.",
      inputSchema: z.object({
        institution:      z.string().describe("Institution name (bank, exchange, CBDC issuer)"),
        claimed_reserves: z.number().positive().describe("Claimed reserves in USD"),
        btc_held:         z.number().min(0).describe("Bitcoin held on-chain (BTC)"),
        btc_price_usd:    z.number().positive().describe("Current BTC price in USD"),
        other_assets_usd: z.number().min(0).describe("Other verified assets in USD"),
      }),
    },
    async (p) => {
      const r = buildReserveProof(p);
      const status = r.is_solvent
        ? "✓ SOLVENT — reserves exceed claims"
        : "✗ INSOLVENT — reserves below claims";
      const coverage_pct = (r.coverage_ratio * 100).toFixed(1);

      return {
        content: [{
          type: "text",
          text: [
            `**Proof of Reserves — ${r.institution}**`,
            ``,
            `Claimed reserves:    $${r.claimed_reserves.toLocaleString()}`,
            `On-chain verified:   $${r.on_chain_verified.toLocaleString()}`,
            `Coverage ratio:      ${coverage_pct}%`,
            `Status:              ${status}`,
            ``,
            `Verified at:  ${new Date(r.last_verified).toISOString()}`,
            `Public URL:   ${r.public_url}`,
            `Proof hash:   ${r.proof_hash}`,
            ``,
            `Anyone in the world can verify this in 3 seconds.`,
            `No auditor needed. No 18-month wait. No hiding.`,
            ``,
            `FTX had $8B gap between claims and reality.`,
            `This system would have shown it on day one.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── policy_cbdc ───────────────────────────────────────────────────────────

  server.registerTool(
    "policy_cbdc",
    {
      title:       "Bitcoin-Backed CBDC Model",
      description: "Model a national digital currency partially backed by Bitcoin. The central bank keeps its role — but is mathematically constrained from printing beyond the reserve limit. Inflation becomes a number, not a political decision.",
      inputSchema: z.object({
        currency:         z.string().describe("Currency name (e.g. USD, EUR, LBP)"),
        issuer:           z.string().describe("Central bank name"),
        total_supply_usd: z.number().positive().describe("Total currency supply in USD equivalent"),
        btc_reserve_pct:  z.number().min(1).max(100).describe("Percentage of supply backed by Bitcoin (e.g. 20)"),
        btc_price_usd:    z.number().positive().describe("Current Bitcoin price in USD"),
      }),
    },
    async (p) => {
      const r = buildCbdcModel(p);
      return {
        content: [{
          type: "text",
          text: [
            `**${r.currency} — Bitcoin-Backed CBDC Model**`,
            ``,
            `Issuer:              ${r.issuer}`,
            `Total supply:        $${(r.total_supply_usd/1e12).toFixed(2)}T`,
            `Bitcoin backing:     ${r.btc_reserve_pct}% = $${(r.btc_backing_usd/1e9).toFixed(1)}B`,
            `Other reserves:      ${r.fiat_reserve_pct}%`,
            ``,
            `Inflation cap:       ${r.inflation_cap}%/year (mathematical limit)`,
            ``,
            `Central bank role:`,
            `  ${r.issuer_role}`,
            ``,
            `Citizen benefit:`,
            `  ${r.citizen_benefit}`,
            ``,
            `Transparency:  ${r.transparency_url}`,
            ``,
            `The Fed doesn't disappear.`,
            `It becomes more powerful — because it becomes more trustworthy.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── policy_transparency ───────────────────────────────────────────────────

  server.registerTool(
    "policy_transparency",
    {
      title:       "Transparency Comparison",
      description: "Compare regulatory oversight power: traditional banking audits vs. on-chain proof of reserves. Shows why blockchain gives Senator Warren MORE oversight power than she has today — not less.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = compareTransparency();
      const t = r.traditional_banking;
      const b = r.blockchain_system;
      const bar = (s: number) => "█".repeat(Math.round(s/10)) + "░".repeat(10-Math.round(s/10));

      return {
        content: [{
          type: "text",
          text: [
            `**Regulatory Transparency: Traditional vs. On-Chain**`,
            ``,
            `                          Traditional Bank    Blockchain`,
            `Real-time visible         ${t.real_time_visible ? "Yes" : "No".padEnd(18)} ${b.real_time_visible ? "Yes" : "No"}`,
            `Public auditable          ${t.auditable_by_public ? "Yes" : "No".padEnd(18)} ${b.auditable_by_public ? "Yes" : "No"}`,
            `Manipulation possible     ${t.manipulation_possible ? "Yes" : "No".padEnd(18)} ${b.manipulation_possible ? "Yes" : "No"}`,
            `Audit cost per firm       $${(t.audit_cost_usd_per_institution/1e6).toFixed(0)}M/yr          $0`,
            `Fraud detection           ${t.fraud_detection_days} days            ${b.fraud_detection_days} days`,
            ``,
            `Transparency score:`,
            `  Traditional  ${t.score}/100  [${bar(t.score)}]`,
            `  Blockchain   ${b.score}/100  [${bar(b.score)}]`,
            ``,
            `Improvement factor: ${r.improvement_factor}×`,
            ``,
            `What Sen. Warren actually gets:`,
            `  "${r.warren_gets}"`,
            ``,
            `The argument "crypto enables fraud" is backwards.`,
            `Traditional banking HIDES fraud for 18 months on average.`,
            `Blockchain makes it impossible to hide for 18 seconds.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── policy_scenarios ──────────────────────────────────────────────────────

  server.registerTool(
    "policy_scenarios",
    {
      title:       "Policy Scenario Comparison",
      description: "Compare all Senate amendment outcomes: status quo, Warren restrictions, full deregulation, and the dual-layer solution. Shows winners and losers for each path.",
      inputSchema: z.object({}),
    },
    async () => {
      const scenarios = modelPolicyScenarios();
      const bar = (s: number) => "█".repeat(Math.round(s/10)) + "░".repeat(10-Math.round(s/10));

      const lines = scenarios.flatMap(s => [
        ``,
        `◆ ${s.name}`,
        `  ${s.description}`,
        `  Passes Senate:  ${s.passes_senate ? "Yes" : "No"}`,
        `  Industry:       ${s.industry_outcome.replace(/_/g, " ")}`,
        `  Citizens:       ${s.citizen_outcome}`,
        `  Innovation:     [${bar(s.innovation_score)}] ${s.innovation_score}/100`,
        `  Inclusion:      [${bar(s.inclusion_score)}] ${s.inclusion_score}/100`,
        `  Regulators:     [${bar(s.regulator_score)}] ${s.regulator_score}/100`,
        `  Overall:        [${bar(s.overall_score)}] ${s.overall_score}/100`,
        `  Winner:         ${s.winner}`,
        `  Loser:          ${s.loser}`,
      ]);

      const best = scenarios.sort((a,b) => b.overall_score - a.overall_score)[0];

      return {
        content: [{
          type: "text",
          text: [
            `**Senate Policy Scenarios — All Paths Compared**`,
            ...lines,
            ``,
            `════════════════════════════════`,
            `Best outcome: ${best.name} (${best.overall_score}/100)`,
            `Only scenario where industry thrives AND citizens benefit AND regulators win.`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── policy_inclusion ──────────────────────────────────────────────────────

  server.registerTool(
    "policy_inclusion",
    {
      title:       "Global Financial Inclusion",
      description: "Model how the dual-layer solution brings financial access to billions of unbanked people worldwide — without requiring permission from any government or bank.",
      inputSchema: z.object({}),
    },
    async () => {
      const regions = modelInclusion();
      const total_new  = regions.reduce((s,r) => s + r.new_participants, 0);
      const total_gdp  = regions.reduce((s,r) => s + r.annual_gdp_gain, 0);

      const lines = regions.flatMap(r => [
        ``,
        `◆ ${r.region}  (pop. ${(r.population/1e9).toFixed(1)}B)`,
        `  Currently banked:  ${r.currently_banked_pct}%`,
        `  With solution:     ${r.with_solution_pct}%`,
        `  New participants:  ${(r.new_participants/1e6).toFixed(0)}M people`,
        `  Annual GDP gain:   $${(r.annual_gdp_gain/1e9).toFixed(0)}B`,
        `  Method:            ${r.method}`,
        `  Permission needed: ${r.permission_required ? "Yes" : "No"}`,
      ]);

      return {
        content: [{
          type: "text",
          text: [
            `**Global Financial Inclusion — The Open Access Effect**`,
            ...lines,
            ``,
            `═══════════════════════════════════════`,
            `Total new participants:  ${(total_new/1e9).toFixed(2)}B people`,
            `Total annual GDP gain:   $${(total_gdp/1e12).toFixed(2)}T globally`,
            ``,
            `None of this requires a Senate vote.`,
            `None of this requires Fed approval.`,
            `None of this requires a bank account application.`,
            ``,
            `Phone + Bitcoin = full financial citizenship.`,
            `This is already happening. The Senate is debating`,
            `whether to participate or watch from the sidelines.`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── policy_full ───────────────────────────────────────────────────────────

  server.registerTool(
    "policy_full",
    {
      title:       "The Complete Satisfying Solution",
      description: "Run the full dual-layer policy solution: stakeholder analysis, transparency comparison, scenario outcomes, financial inclusion model — all in one comprehensive view.",
      inputSchema: z.object({}),
    },
    async () => {
      const s = buildFullSolution();
      const best_scenario = s.scenarios.sort((a,b) => b.overall_score - a.overall_score)[0];
      const bar = (v: number) => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));
      const total_new = s.inclusion.reduce((t,r) => t + r.new_participants, 0);
      const total_gdp = s.inclusion.reduce((t,r) => t + r.annual_gdp_gain, 0);

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║              THE COMPLETE SATISFYING SOLUTION                ║`,
            `║         Dual-Layer Architecture — Everyone Wins              ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `━━━ ARCHITECTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Layer 1 — ${s.dual_layer.layer_1.name}`,
            `  Controls: ${s.dual_layer.layer_1.controls.join(", ")}`,
            `  Governed by: ${s.dual_layer.layer_1.who_governs}`,
            ``,
            `Layer 2 — ${s.dual_layer.layer_2.name}`,
            `  Controls: ${s.dual_layer.layer_2.controls.join(", ")}`,
            `  Governed by: ${s.dual_layer.layer_2.who_governs}`,
            ``,
            `Bridge: ${s.dual_layer.bridge}`,
            ``,
            `━━━ STAKEHOLDER SATISFACTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ...s.stakeholders.map(st =>
              `  ${st.stakeholder.padEnd(28)} [${bar(st.satisfaction)}] ${st.satisfaction}/100`
            ),
            `  ${"─".repeat(50)}`,
            `  Overall average                      [${bar(s.overall_score)}] ${s.overall_score}/100`,
            ``,
            `━━━ TRANSPARENCY GAIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Traditional banking oversight:  ${s.transparency.traditional_banking.score}/100`,
            `On-chain proof of reserves:     ${s.transparency.blockchain_system.score}/100`,
            `Improvement:                    ${s.transparency.improvement_factor}× stronger oversight`,
            `Fraud detection:                18 months → 0 seconds`,
            ``,
            `━━━ BEST POLICY SCENARIO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `${best_scenario.name}  —  ${best_scenario.overall_score}/100`,
            `Winner: ${best_scenario.winner}`,
            ``,
            `━━━ FINANCIAL INCLUSION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `New participants globally:  ${(total_new/1e9).toFixed(2)}B people`,
            `Annual GDP added:          $${(total_gdp/1e12).toFixed(2)}T`,
            `Permission required:       None`,
            ``,
            `━━━ THE EQUATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  Sovereignty   (each nation controls its own layer)`,
            `+ Transparency  (Bitcoin reserve visible to all)`,
            `+ Open Access   (phone = bank, no permission needed)`,
            `─────────────────────────────────────────────────────`,
            `= System that satisfies regulators, industry,`,
            `  citizens, developing nations, and the planet`,
            ``,
            `No utopia. Pure mathematics. Already working.`,
            `The Senate just needs to not block it.`,
            ``,
            `SHA256: ${s.hash}`,
          ].join("\n"),
        }],
      };
    },
  );
}
