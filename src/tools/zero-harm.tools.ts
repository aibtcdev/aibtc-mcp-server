/**
 * Zero Harm Tools — صفر أضرار على المدنيين والحكومات
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Tools:
 *   zero_harm_overview        — Full system summary: rights, guarantees, circuit breakers
 *   civilian_rights           — Complete civilian bill of rights (10 rights)
 *   government_rights         — Government sovereignty charter (10 rights)
 *   sector_guarantee          — Deep analysis of one sector (technical/monetary/security/legal)
 *   harm_assessment           — Assess a specific action's harm profile across all 4 sectors
 *   circuit_breakers          — All 10 circuit breakers — what triggers them, what they stop
 *   full_harm_matrix          — Complete harm matrix for all system actions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getCivilianRights,
  getGovernmentRights,
  getSectorGuarantees,
  getSectorGuarantee,
  getCircuitBreakers,
  getHarmAssessments,
  assessAction,
  getSafeActions,
  getConditionalActions,
  getBlockedActions,
  getZeroHarmSummary,
  HarmSector,
} from "../services/sovereign/zero-harm-protocol.js";

export function registerZeroHarmTools(server: McpServer): void {

  // ── 1. System overview ─────────────────────────────────────────────────────
  server.registerTool(
    "zero_harm_overview",
    {
      title: "Zero Harm System Overview",
      description:
        "صفر أضرار — Complete overview of the zero-harm guarantee system. " +
        "Shows civilian rights count, government rights, circuit breakers, sector guarantees, " +
        "harm assessments across all 8 actions, and the net benefit scores. " +
        "Every number here is a commitment, not an aspiration.",
      inputSchema: {},
    },
    async () => {
      const summary = getZeroHarmSummary();
      const cbList  = getCircuitBreakers();
      const safe    = getSafeActions();
      const cond    = getConditionalActions();
      const blocked = getBlockedActions();

      const lines = [
        `╔══════════════════════════════════════════════════════════════════╗`,
        `║      ZERO HARM PROTOCOL — صفر أضرار على المدنيين والحكومات       ║`,
        `╚══════════════════════════════════════════════════════════════════╝`,
        ``,
        `ABSOLUTE GUARANTEE:`,
        `  ∀ action ∈ SYSTEM:  civilian_harm = 0  |  government_harm = 0`,
        `  Net harm to any sector ≤ 0  (zero or positive for civilians)`,
        ``,
        `─── PROTECTION FRAMEWORK ───`,
        `  Civilian Rights:      ${summary.civilian_rights_count} guaranteed rights (CR-01 to CR-10)`,
        `  Government Rights:    ${summary.government_rights_count} sovereignty protections (GR-01 to GR-10)`,
        `  Sector Guarantees:    4 sectors × positive + negative commitments`,
        `  Circuit Breakers:     ${summary.circuit_breakers_count} automatic safety stops`,
        ``,
        `─── HARM ASSESSMENT RESULTS ───`,
        `  Total actions assessed: ${summary.total_actions}`,
        `  ✓ SAFE:        ${safe.length} actions — zero conditions required`,
        `  ⚠ CONDITIONAL: ${cond.length} actions — specific safeguards required`,
        `  ✗ BLOCKED:     ${blocked.length} actions — redesign required`,
        `  Worst residual risk:  ${summary.worst_residual_risk.toUpperCase()}`,
        ``,
        `─── NET BENEFIT SCORES ───`,
        `  Average civilian benefit: +${summary.avg_civilian_benefit} per action`,
        `  Average government benefit: +${summary.avg_government_benefit} per action`,
        `  (Positive = benefit. Zero = neutral. Negative = harm — BLOCKED)`,
        ``,
        `─── CIRCUIT BREAKERS ACTIVE ───`,
        ...cbList.slice(0, 5).map(cb => `  [${cb.id}] ${cb.name}: ${cb.trigger.substring(0, 60)}...`),
        `  ... and ${cbList.length - 5} more (see circuit_breakers tool for full list)`,
        ``,
        `─── 4 SECTORS COVERED ───`,
        `  TECHNICAL  (تقنية):  Open source · No backdoors · Graceful degradation`,
        `  MONETARY   (نقدية):  Cantillon⁻¹ · Savings protection · No forced conversion`,
        `  SECURITY   (أمنية):  ZK-KYC · No surveillance · Self-custody`,
        `  LEGAL      (قانونية): Constitutional primacy · Opt-in · Sovereignty respected`,
        ``,
        `─── KEY PRINCIPLES ───`,
        `  1. No civilian's savings are destroyed by any transition`,
        `  2. No government is forced to adopt any monetary standard`,
        `  3. No surveillance system is built under the guise of compliance`,
        `  4. No legal framework is overridden by protocol rules`,
        `  5. Every automated decision has a human appeal pathway`,
        `  6. Every action is reversible within its window`,
        `  7. No single entity can control >5% of any currency supply`,
        `  8. All fees are capped at 2% maximum`,
        `  9. Remittance remains affordable (<1%) for all diaspora`,
        `  10. The right to exit is absolute — no lock-in, no penalties`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 2. Civilian rights charter ────────────────────────────────────────────
  server.registerTool(
    "civilian_rights",
    {
      title: "Civilian Bill of Rights",
      description:
        "ميثاق حقوق المدنيين — Complete civilian bill of rights. " +
        "10 guaranteed rights covering savings, currency freedom, privacy, Cantillon equity, " +
        "inflation protection, employment, transparency, cross-border access, and right to exit. " +
        "Each right has technical, monetary, security, AND legal guarantees.",
      inputSchema: {
        right_id: z.string().optional().describe("Specific right to detail (e.g. CR-01). Omit for all 10 rights."),
      },
    },
    async (input) => {
      const rights = getCivilianRights();
      const list   = input.right_id
        ? rights.filter(r => r.id === (input.right_id ?? "").toUpperCase())
        : rights;

      if (list.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `Right "${input.right_id ?? ""}" not found. Available: ${rights.map(r => r.id).join(", ")}`,
          }],
        };
      }

      const lines = [
        `╔══════════════════════════════════════════════════╗`,
        `║  CIVILIAN BILL OF RIGHTS — ميثاق حقوق المدنيين  ║`,
        `╚══════════════════════════════════════════════════╝`,
        ``,
      ];

      for (const r of list) {
        lines.push(
          `[${r.id}] ${r.title}`,
          `     ${r.arabic}`,
          ``,
          `  ${r.description}`,
          ``,
          `  Enforcement: ${r.enforcement}`,
          ``,
          `  Technical guarantee:  ${r.technical_guarantee}`,
          `  Monetary guarantee:   ${r.monetary_guarantee}`,
          `  Security guarantee:   ${r.security_guarantee}`,
          `  Legal guarantee:      ${r.legal_guarantee}`,
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      lines.push(
        `PRINCIPLE: These are not aspirations. They are hard constraints.`,
        `Any system action that violates any right is BLOCKED until redesigned.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 3. Government sovereignty charter ─────────────────────────────────────
  server.registerTool(
    "government_rights",
    {
      title: "Government Sovereignty Charter",
      description:
        "ميثاق سيادة الحكومات — Complete government sovereignty protection. " +
        "10 rights: monetary sovereignty, regulatory jurisdiction, revenue continuity, " +
        "audit rights, opt-out, constitutional primacy, gradual transition, national security, " +
        "social welfare protection, international law compliance.",
      inputSchema: {
        right_id: z.string().optional().describe("Specific right (e.g. GR-01). Omit for all 10."),
        scope:    z.enum(["national", "regional", "local", "supranational"]).optional().describe("Filter by scope"),
      },
    },
    async (input) => {
      let rights = getGovernmentRights();

      if (input.right_id) {
        rights = rights.filter(r => r.id === (input.right_id ?? "").toUpperCase());
      }
      if (input.scope) {
        rights = rights.filter(r => r.scope === input.scope);
      }

      if (rights.length === 0) {
        const all = getGovernmentRights();
        return {
          content: [{
            type: "text" as const,
            text: `No rights found for filter. Available: ${all.map(r => r.id).join(", ")}`,
          }],
        };
      }

      const lines = [
        `╔══════════════════════════════════════════════════════╗`,
        `║  GOVERNMENT SOVEREIGNTY CHARTER — ميثاق سيادة الحكومات  ║`,
        `╚══════════════════════════════════════════════════════╝`,
        ``,
        `CORE PRINCIPLE: No protocol rule can override sovereign authority.`,
        `Every reform is a recommendation. Every adoption is voluntary.`,
        ``,
      ];

      for (const r of rights) {
        lines.push(
          `[${r.id}] [${r.scope.toUpperCase()}] ${r.title}`,
          `     ${r.arabic}`,
          ``,
          `  ${r.description}`,
          ``,
          `  Enforcement: ${r.enforcement}`,
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      lines.push(
        `BOTTOM LINE:`,
        `Governments are the legitimate institutions of their peoples.`,
        `The Ψ system serves governments — it does not command them.`,
        `Any government may reject any recommendation at any time, for any reason.`,
        `The system's value is that the recommendations are mathematically sound — not that they are mandatory.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 4. Sector guarantee deep dive ─────────────────────────────────────────
  server.registerTool(
    "sector_guarantee",
    {
      title: "Sector Zero-Harm Guarantee",
      description:
        "Deep analysis of zero-harm guarantees for one specific sector: " +
        "technical (تقنية), monetary (نقدية), security (أمنية), or legal (قانونية). " +
        "Shows exact positive commitments (what we WILL do) and negative commitments (what we will NEVER do).",
      inputSchema: {
        sector: z.enum(["technical", "monetary", "security", "legal"])
          .describe("Which sector to analyze: technical, monetary, security, or legal"),
      },
    },
    async (input) => {
      const g = getSectorGuarantee(input.sector as HarmSector);
      if (!g) {
        return {
          content: [{ type: "text" as const, text: `Sector "${input.sector}" not found.` }],
        };
      }

      const sectorEmoji: Record<string, string> = {
        technical: "تقنية", monetary: "نقدية", security: "أمنية", legal: "قانونية",
      };

      const lines = [
        `╔════════════════════════════════════════════════════════════╗`,
        `║  SECTOR GUARANTEE: ${g.sector.toUpperCase().padEnd(10)} (${sectorEmoji[g.sector]})  ║`,
        `╚════════════════════════════════════════════════════════════╝`,
        ``,
        `CORE PROMISE:`,
        g.core_promise,
        ``,
        `─── POSITIVE COMMITMENTS (ما نلتزم بفعله) ───`,
        ...g.positive_commitments.map((c, i) => `  ${String(i + 1).padStart(2)}. ${c}`),
        ``,
        `─── NEGATIVE COMMITMENTS (ما لن نفعله أبداً) ───`,
        ...g.negative_commitments.map((c, i) => `  ${String(i + 1).padStart(2)}. ${c}`),
        ``,
        `─── VERIFICATION ───`,
        g.verification,
        ``,
        `GUARANTEE STATUS: ACTIVE`,
        `These commitments are encoded in the protocol, not just stated in text.`,
        `Any code that violates a negative commitment is a critical security bug.`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 5. Harm assessment for a specific action ──────────────────────────────
  server.registerTool(
    "harm_assessment",
    {
      title: "Action Harm Assessment",
      description:
        "Assess a specific system action across all 4 sectors (technical, monetary, security, legal). " +
        "Returns: inherent risk, mitigations, residual risk, net benefit scores for civilians and governments, " +
        "and the verdict: SAFE / CONDITIONAL / BLOCKED.",
      inputSchema: {
        action_id: z.string().optional().describe("Action ID (e.g. HA-01). Omit to list all available actions."),
      },
    },
    async (input) => {
      if (!input.action_id) {
        const all = getHarmAssessments();
        const lines = [
          `Available harm assessments:`,
          ``,
          ...all.map(a =>
            `  [${a.action_id}] [${a.verdict}] ${a.action_name}` +
            (a.verdict === "CONDITIONAL" ? `\n    Condition: ${a.condition}` : "")
          ),
          ``,
          `Call with action_id to see full 4-sector analysis.`,
        ];
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      const a = assessAction(input.action_id.toUpperCase());
      if (!a) {
        return {
          content: [{
            type: "text" as const,
            text: `Action "${input.action_id}" not found. Valid IDs: ${getHarmAssessments().map(h => h.action_id).join(", ")}`,
          }],
        };
      }

      const verdictIcon = { SAFE: "✓", CONDITIONAL: "⚠", BLOCKED: "✗" }[a.verdict];

      const renderSector = (s: typeof a.technical_risk) =>
        `  ${s.sector.toUpperCase().padEnd(10)} Inherent: ${s.inherent_risk.padEnd(8)} Residual: ${s.residual_risk}\n` +
        `    Risk: ${s.description}\n` +
        `    Mitigation: ${s.mitigation}` +
        (s.circuit_breaker ? `\n    Circuit breaker: ${s.circuit_breaker}` : "");

      const lines = [
        `╔════════════════════════════════════════════════════╗`,
        `║  HARM ASSESSMENT: ${a.action_id}  ${verdictIcon} ${a.verdict.padEnd(12)}      ║`,
        `╚════════════════════════════════════════════════════╝`,
        ``,
        `Action: ${a.action_name}`,
        `Category: ${a.category}`,
        `Affected: ${a.affected_parties.join(", ")}`,
        ``,
        `─── 4-SECTOR RISK ANALYSIS ───`,
        renderSector(a.technical_risk),
        ``,
        renderSector(a.monetary_risk),
        ``,
        renderSector(a.security_risk),
        ``,
        renderSector(a.legal_risk),
        ``,
        `─── NET BENEFIT SCORES ───`,
        `  Civilian:    +${a.net_civilian_score}  (positive = benefit to civilians)`,
        `  Government:  +${a.net_government_score}  (positive = benefit to governments)`,
        ``,
        `─── VERDICT: ${verdictIcon} ${a.verdict} ───`,
        a.verdict === "CONDITIONAL" && a.condition ? `Condition: ${a.condition}` : "",
        a.verdict === "BLOCKED" && a.blocking_reason ? `Blocked: ${a.blocking_reason}` : "",
        a.verdict === "SAFE" ? "No conditions. Action is approved as designed." : "",
      ].filter(l => l !== "");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 6. Circuit breakers ───────────────────────────────────────────────────
  server.registerTool(
    "circuit_breakers",
    {
      title: "Zero-Harm Circuit Breakers",
      description:
        "قواطع الأمان — All 10 automatic safety stops. Each circuit breaker monitors a specific harm signal " +
        "and automatically halts or modifies system behavior when the trigger condition is met. " +
        "These are NOT manual switches — they fire automatically.",
      inputSchema: {
        protects: z.enum(["civilians", "governments", "economy", "society"]).optional()
          .describe("Filter by who is protected"),
        cb_id:    z.string().optional().describe("Specific circuit breaker ID (e.g. CB-01)"),
      },
    },
    async (input) => {
      let cbs = getCircuitBreakers();

      if (input.protects) {
        cbs = cbs.filter(cb => cb.protects.includes(input.protects as never));
      }
      if (input.cb_id) {
        cbs = cbs.filter(cb => cb.id === (input.cb_id ?? "").toUpperCase());
      }

      const lines = [
        `╔═══════════════════════════════════════╗`,
        `║  ZERO-HARM CIRCUIT BREAKERS — قواطع الأمان  ║`,
        `╚═══════════════════════════════════════╝`,
        ``,
        `${cbs.length} circuit breaker(s) — automatic, not manual.`,
        input.protects ? `Filter: protects ${input.protects}` : "",
        ``,
      ].filter(l => l !== "");

      for (const cb of cbs) {
        lines.push(
          `[${cb.id}] ${cb.name}`,
          `  Protects:   ${cb.protects.join(", ")}`,
          `  Trigger:    ${cb.trigger}`,
          `  Action:     ${cb.action}`,
          `  Reset when: ${cb.reset_condition}`,
          ``,
        );
      }

      lines.push(
        `HOW CIRCUIT BREAKERS WORK:`,
        `  1. A monitoring process continuously evaluates each trigger condition`,
        `  2. If trigger is met, the circuit breaker fires immediately — no human needed`,
        `  3. The action is automatic and cannot be overridden without meeting the reset condition`,
        `  4. All firings are logged on-chain for transparency`,
        `  5. Reset conditions require independent verification — not self-attestation`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 7. Full harm matrix ───────────────────────────────────────────────────
  server.registerTool(
    "full_harm_matrix",
    {
      title: "Complete Harm Matrix",
      description:
        "مصفوفة الأضرار الكاملة — All assessed system actions in a single table. " +
        "Shows each action's worst residual risk across all 4 sectors, net civilian benefit, " +
        "net government benefit, and verdict. Sortable by verdict, civilian benefit, or risk.",
      inputSchema: {
        verdict_filter: z.enum(["SAFE", "CONDITIONAL", "BLOCKED", "all"]).optional()
          .describe("Filter by verdict (default: all)"),
        min_civilian_benefit: z.number().optional()
          .describe("Only show actions with civilian benefit >= this number"),
      },
    },
    async (input) => {
      let actions = getHarmAssessments();

      if (input.verdict_filter && input.verdict_filter !== "all") {
        actions = actions.filter(a => a.verdict === input.verdict_filter);
      }
      if (input.min_civilian_benefit !== undefined) {
        actions = actions.filter(a => a.net_civilian_score >= input.min_civilian_benefit!);
      }

      // Sort by civilian benefit descending
      actions = actions.sort((a, b) => b.net_civilian_score - a.net_civilian_score);

      const header =
        `${"ID".padEnd(6)} ${"Verdict".padEnd(12)} ${"Civ+".padEnd(5)} ${"Gov+".padEnd(5)} ${"T".padEnd(5)} ${"M".padEnd(5)} ${"S".padEnd(5)} ${"L".padEnd(5)} Action`;
      const divider = "─".repeat(header.length + 20);

      const riskChar: Record<string, string> = { zero: "●", low: "○", medium: "△", high: "▲", critical: "✗" };

      const rows = actions.map(a =>
        `${a.action_id.padEnd(6)} ${a.verdict.padEnd(12)} ` +
        `+${String(a.net_civilian_score).padEnd(4)} ` +
        `+${String(a.net_government_score).padEnd(4)} ` +
        `${riskChar[a.technical_risk.residual_risk].padEnd(5)}` +
        `${riskChar[a.monetary_risk.residual_risk].padEnd(5)}` +
        `${riskChar[a.security_risk.residual_risk].padEnd(5)}` +
        `${riskChar[a.legal_risk.residual_risk].padEnd(5)}` +
        `${a.action_name}`
      );

      const lines = [
        `╔══════════════════════════════════════════════════════╗`,
        `║  COMPLETE HARM MATRIX — مصفوفة الأضرار الكاملة         ║`,
        `╚══════════════════════════════════════════════════════╝`,
        ``,
        `Legend: ● zero risk  ○ low  △ medium  ▲ high  ✗ critical`,
        `Sectors: T=Technical  M=Monetary  S=Security  L=Legal`,
        `Civ+ = net civilian benefit (>0 = benefit, 0 = neutral)`,
        `Gov+ = net government benefit`,
        ``,
        header,
        divider,
        ...rows,
        ``,
        `SUMMARY:`,
        `  ✓ SAFE actions:        ${getSafeActions().length} — proceed as designed`,
        `  ⚠ CONDITIONAL actions: ${getConditionalActions().length} — specific safeguards required`,
        `  ✗ BLOCKED actions:     ${getBlockedActions().length} — redesign required before deployment`,
        ``,
        `GUARANTEE: No action with civilian_benefit < 0 is in this system.`,
        `Any negative impact is either mitigated to zero or the action is BLOCKED.`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
