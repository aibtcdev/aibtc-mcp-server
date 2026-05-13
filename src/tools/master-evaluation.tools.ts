/**
 * Master Evaluation Tools — التقييم الشامل الكامل
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Tools:
 *   system_evaluation      — Full inventory: what's built, completeness, gaps
 *   global_goals           — 10 global goals with status and blocking gaps
 *   gap_analysis           — What's missing, impact, and path to completion
 *   risk_map               — 13 global risks with probability, impact, mitigations
 *   intention_classifier   — 10 actor types from constructive to hostile
 *   assets_registry        — 8 asset classes with sovereignty and protection rules
 *   data_sovereignty       — 8 data categories with cross-border rules
 *   cooperation_models     — 6 international cooperation frameworks
 *   public_interest        — 7 public interest override doctrines
 *   master_synthesis       — Complete picture: all 20 dimensions in one response
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getBuiltComponents,
  getGlobalGoals,
  getGlobalRisks,
  getIntentionProfiles,
  getAssetClasses,
  getDataCategories,
  getCooperationModels,
  getPublicInterestRules,
  getGapAnalysis,
  getMasterEvaluationSummary,
} from "../services/sovereign/master-evaluation.js";

export function registerMasterEvaluationTools(server: McpServer): void {

  // ── 1. System evaluation — inventory ────────────────────────────────────────
  server.registerTool(
    "system_evaluation",
    {
      title: "System Evaluation — Inventory",
      description:
        "ما تم بناؤه — Complete inventory of every built component. " +
        "Shows completeness percentage, tools count, and specific gaps for each. " +
        "13 components from Ψ equation to Zero Harm Protocol.",
      inputSchema: {
        status_filter: z.enum(["complete", "partial", "planned", "missing", "all"]).optional()
          .describe("Filter by completion status"),
        show_gaps: z.boolean().optional()
          .describe("Include gap details for each component (default: true)"),
      },
    },
    async (input) => {
      let components = getBuiltComponents();
      const showGaps = input.show_gaps !== false;

      if (input.status_filter && input.status_filter !== "all") {
        components = components.filter(c => c.status === input.status_filter);
      }

      const summary = getMasterEvaluationSummary();

      const statusIcon: Record<string, string> = {
        complete: "✓", partial: "◑", planned: "○", missing: "✗",
      };

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  SYSTEM INVENTORY — ما تم بناؤه                              ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `Total components: ${summary.total_components}   Total MCP tools: ${summary.total_tools}`,
        `Average completeness: ${summary.average_completeness_pct}%`,
        `Coverage: ${summary.coverage_nations_pct}% nations | ${summary.coverage_currencies_pct}% currencies | ${summary.coverage_jurisdictions_pct}% jurisdictions`,
        ``,
        `${"ID".padEnd(7)} ${"Status".padEnd(10)} ${"Complete".padEnd(10)} ${"Tools".padEnd(6)} Component`,
        `${"─".repeat(80)}`,
        ...components.map(c =>
          `${c.id.padEnd(7)} ${(statusIcon[c.status] + " " + c.status).padEnd(10)} ` +
          `${(c.completeness + "%").padEnd(10)} ${String(c.tools_count).padEnd(6)} ${c.name}\n` +
          `        ${c.arabic}\n` +
          `        ${c.description}` +
          (showGaps && c.gaps.length > 0
            ? `\n        Gaps: ${c.gaps.map(g => `• ${g}`).join("\n               ")}`
            : "")
        ),
        ``,
        `LEGEND: ✓ complete  ◑ partial  ○ planned  ✗ missing`,
        ``,
        `CRITICAL OBSERVATION:`,
        `Nation coverage is ${summary.coverage_nations_pct}% — ${195 - 16} nations still unserved.`,
        `Currency coverage is ${summary.coverage_currencies_pct}% — ${180 - 8} currencies still unserved.`,
        `The framework is architecturally complete. Scale is the remaining challenge.`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 2. Global goals ─────────────────────────────────────────────────────────
  server.registerTool(
    "global_goals",
    {
      title: "Global Goals — الأهداف العالمية",
      description:
        "الأهداف الكاملة — 10 global goals: poverty elimination, debt liberation, financial inclusion, " +
        "privacy, digital identity, national renaissance for all 195 nations, remittance, " +
        "transparent government, resource sovereignty, Ψ as international standard. " +
        "Each with timeline, measurable target, and blocking gap.",
      inputSchema: {
        status_filter: z.enum(["complete", "partial", "planned", "all"]).optional()
          .describe("Filter by goal status"),
        show_blocking: z.boolean().optional()
          .describe("Show what's blocking each goal (default: true)"),
      },
    },
    async (input) => {
      let goals = getGlobalGoals();
      if (input.status_filter && input.status_filter !== "all") {
        goals = goals.filter(g => g.status === input.status_filter);
      }
      const showBlocking = input.show_blocking !== false;

      const statusIcon: Record<string, string> = {
        complete: "✓ DONE", partial: "◑ PARTIAL", planned: "○ PLANNED",
      };

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  GLOBAL GOALS — الأهداف العالمية                              ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `${goals.length} goals shown. Each is measurable, time-bound, and humanity-positive.`,
        ``,
      ];

      for (const g of goals) {
        lines.push(
          `[${g.id}] ${statusIcon[g.status]}`,
          `    ${g.goal}`,
          `    ${g.arabic}`,
          ``,
          `    WHY: ${g.why}`,
          `    TIMELINE: ${g.timeline}`,
          `    SUCCESS METRIC: ${g.measurable}`,
          showBlocking && g.blocking_gap
            ? `    BLOCKING GAP: ⚠ ${g.blocking_gap}`
            : showBlocking
              ? `    STATUS: On track — no current blocker`
              : "",
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      lines.push(
        `SUMMARY:`,
        `  Complete: ${goals.filter(g => g.status === "complete").length}`,
        `  Partial:  ${goals.filter(g => g.status === "partial").length}`,
        `  Planned:  ${goals.filter(g => g.status === "planned").length}`,
        ``,
        `HORIZON: All 10 goals achievable within 30 years if Ψ system is fully deployed.`,
        `Critical path: nation coverage (GA-01, GA-02) must be solved first.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 3. Gap analysis ──────────────────────────────────────────────────────────
  server.registerTool(
    "gap_analysis",
    {
      title: "Gap Analysis — النواقص",
      description:
        "النواقص الكاملة — 12 identified gaps with impact level (critical/high/medium/low), " +
        "effort estimate, and specific path to completion. " +
        "From currency coverage (4%) to ZK-proof deployment to whistleblower protection.",
      inputSchema: {
        impact_filter: z.enum(["critical", "high", "medium", "low", "all"]).optional()
          .describe("Filter by impact level (default: all, sorted critical first)"),
      },
    },
    async (input) => {
      const impact = input.impact_filter === "all" ? undefined : input.impact_filter;
      let gaps = getGapAnalysis(impact);

      // Sort: critical → high → medium → low
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      gaps = gaps.sort((a, b) => order[a.impact] - order[b.impact]);

      const impactIcon: Record<string, string> = {
        critical: "🔴 CRITICAL", high: "🟠 HIGH", medium: "🟡 MEDIUM", low: "🟢 LOW",
      };

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  GAP ANALYSIS — النواقص                                       ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `${gaps.length} gaps identified. Critical gaps block global adoption.`,
        ``,
      ];

      for (const g of gaps) {
        lines.push(
          `[${g.id}] ${impactIcon[g.impact]}  (effort: ${g.effort})`,
          `    Area: ${g.area} — ${g.arabic}`,
          `    Gap: ${g.gap}`,
          `    Path: ${g.path}`,
          ``,
        );
      }

      const critical = gaps.filter(g => g.impact === "critical");
      const high     = gaps.filter(g => g.impact === "high");

      lines.push(
        `TOP PRIORITY (solve these first):`,
        ...critical.map(g => `  [${g.id}] ${g.area}: ${g.gap.substring(0, 60)}...`),
        ``,
        `HIGH PRIORITY (solve next):`,
        ...high.map(g => `  [${g.id}] ${g.area}: ${g.gap.substring(0, 60)}...`),
        ``,
        `CRITICAL PATH: GA-01 (currency coverage) + GA-02 (nation coverage) + GA-04 (live data)`,
        `These three unlock 90% of the remaining global goals.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 4. Risk map ──────────────────────────────────────────────────────────────
  server.registerTool(
    "risk_map",
    {
      title: "Global Risk Map — خريطة المخاطر",
      description:
        "تحديد المخاطر — 13 global risks identified: BTC price collapse, protocol capture, " +
        "automation unemployment, CBDC surveillance, debt trap, quantum break, regulatory fragmentation, " +
        "mining concentration, digital divide, financial capture, energy manipulation, " +
        "sovereign default cascade, environmental cost. " +
        "Each with probability, impact, affected parties, mitigation, and residual risk.",
      inputSchema: {
        category: z.enum(["technical", "monetary", "geopolitical", "social", "legal", "environmental", "all"]).optional()
          .describe("Filter by risk category"),
        high_only: z.boolean().optional()
          .describe("Show only high probability or catastrophic impact risks"),
      },
    },
    async (input) => {
      const cat = input.category === "all" ? undefined : input.category;
      let risks = getGlobalRisks(cat);

      if (input.high_only) {
        risks = risks.filter(r => r.probability === "high" || r.impact === "catastrophic");
      }

      const probIcon: Record<string, string> = { low: "▽", medium: "△", high: "▲" };
      const impactIcon: Record<string, string> = { low: "●", medium: "◆", high: "◆◆", catastrophic: "◆◆◆" };
      const residualIcon: Record<string, string> = { acceptable: "✓", monitor: "👁", critical: "⚠" };

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  GLOBAL RISK MAP — خريطة المخاطر العالمية                     ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `${risks.length} risks assessed. None are ignored. All have mitigations.`,
        ``,
        `${"ID".padEnd(7)} ${"Prob".padEnd(8)} ${"Impact".padEnd(14)} ${"Residual".padEnd(12)} ${"Category".padEnd(14)} Risk`,
        `${"─".repeat(90)}`,
        ...risks.map(r =>
          `${r.id.padEnd(7)} ${(probIcon[r.probability] + " " + r.probability).padEnd(8)} ` +
          `${(impactIcon[r.impact] + " " + r.impact).padEnd(14)} ` +
          `${(residualIcon[r.residual] + " " + r.residual).padEnd(12)} ` +
          `${r.category.padEnd(14)} ${r.name}\n` +
          `        ${r.arabic}\n` +
          `        ${r.description}\n` +
          `        Affected: ${r.affected.join(", ")}\n` +
          `        Mitigation: ${r.mitigation}\n` +
          `        Owner: ${r.owner}`
        ),
        ``,
        `LEGEND:`,
        `  Probability: ▽ low  △ medium  ▲ high`,
        `  Impact: ● low  ◆ medium  ◆◆ high  ◆◆◆ catastrophic`,
        `  Residual: ✓ acceptable  👁 monitor  ⚠ critical`,
        ``,
        `CRITICAL RISKS REQUIRING IMMEDIATE ACTION:`,
        ...risks.filter(r => r.residual === "critical").map(r =>
          `  [${r.id}] ${r.name}: ${r.mitigation.substring(0, 80)}...`
        ),
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 5. Intention classifier ──────────────────────────────────────────────────
  server.registerTool(
    "intention_classifier",
    {
      title: "Intention Classifier — تصنيف النوايا",
      description:
        "النوايا — 10 actor profiles from constructive to hostile. " +
        "For each: detection signals, system response, and real-world examples. " +
        "The system treats actors differently based on demonstrated intent, not assumed identity. " +
        "Constructive actors get full access. Hostile actors are blocked and reported.",
      inputSchema: {
        intent_filter: z.enum(["constructive", "neutral", "opportunistic", "adversarial", "hostile", "all"]).optional()
          .describe("Filter by intent level"),
      },
    },
    async (input) => {
      const intent = input.intent_filter === "all" ? undefined : input.intent_filter;
      const profiles = getIntentionProfiles(intent);

      const intentIcon: Record<string, string> = {
        constructive: "✓ CONSTRUCTIVE",
        neutral:      "○ NEUTRAL",
        opportunistic:"△ OPPORTUNISTIC",
        adversarial:  "▲ ADVERSARIAL",
        hostile:      "✗ HOSTILE",
      };

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  INTENTION CLASSIFIER — تصنيف النوايا والجهات الفاعلة         ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `PRINCIPLE: The system judges behavior, not identity.`,
        `The same wallet can change classification based on observed actions.`,
        `No permanent stigma — rehabilitation is possible.`,
        ``,
      ];

      for (const p of profiles) {
        lines.push(
          `${intentIcon[p.intent]}`,
          `  Actor: ${p.actor_type}  —  ${p.arabic}`,
          `  ${p.description}`,
          ``,
          `  Detection: ${p.detection}`,
          `  System response: ${p.response}`,
          `  Examples: ${p.examples.join(" | ")}`,
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      const constructive  = profiles.filter(p => p.intent === "constructive").length;
      const hostile       = profiles.filter(p => p.intent === "hostile" || p.intent === "adversarial").length;

      lines.push(
        `DISTRIBUTION:`,
        `  Constructive: ${constructive} types — full access, positive Ψ score`,
        `  Hostile/Adversarial: ${hostile} types — blocked, reported, evidence preserved`,
        ``,
        `REHABILITATION:`,
        `  CAUTION → CLEAR: 90 days of clean behavior resets classification`,
        `  BLOCK → REVIEW: Human appeal with documented evidence required`,
        `  HOSTILE: Permanent record; reset requires extraordinary evidence`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 6. Assets registry ───────────────────────────────────────────────────────
  server.registerTool(
    "assets_registry",
    {
      title: "Assets Registry — سجل الأصول",
      description:
        "الأصول — 8 asset classes: natural resources, digital identity, intellectual property, " +
        "government financial assets, human capital, digital infrastructure, cultural heritage, " +
        "environmental commons. Each with sovereignty model, protection mechanism, and fair monetization path.",
      inputSchema: {
        type_filter: z.enum(["natural", "financial", "digital", "intellectual", "human", "infrastructure", "all"]).optional()
          .describe("Filter by asset type"),
        sovereignty_filter: z.enum(["national", "individual", "shared", "global_commons", "all"]).optional()
          .describe("Filter by sovereignty model"),
      },
    },
    async (input) => {
      const type       = input.type_filter === "all" ? undefined : input.type_filter;
      const sovereignty = input.sovereignty_filter === "all" ? undefined : input.sovereignty_filter;

      let assets = getAssetClasses(type);
      if (sovereignty) {
        assets = assets.filter(a => a.sovereignty === sovereignty);
      }

      const sovIcon: Record<string, string> = {
        national: "🏛 National", individual: "👤 Individual",
        shared: "🤝 Shared", global_commons: "🌍 Global Commons",
      };

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  ASSETS REGISTRY — سجل الأصول                                ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `PRINCIPLE: Every asset has a sovereign owner. The system protects ownership.`,
        `Monetization is fair — creators and sovereign owners benefit first.`,
        ``,
      ];

      for (const a of assets) {
        lines.push(
          `[${a.id}] ${a.name} — ${a.arabic}`,
          `  Type: ${a.type.toUpperCase()}  |  Sovereignty: ${sovIcon[a.sovereignty]}`,
          `  ${a.description}`,
          ``,
          `  Protection: ${a.protection}`,
          `  Monetization: ${a.monetization}`,
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      lines.push(
        `SOVEREIGNTY DISTRIBUTION:`,
        ...["national", "individual", "shared", "global_commons"].map(s => {
          const count = getAssetClasses().filter(a => a.sovereignty === s).length;
          return `  ${sovIcon[s]}: ${count} asset classes`;
        }),
        ``,
        `KEY RULE: Global commons (environment) belong to ALL — no private ownership.`,
        `Individual assets (identity, IP) cannot be taken without due process.`,
        `National assets monetized via Cantillon⁻¹ — citizens benefit first.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 7. Data sovereignty ───────────────────────────────────────────────────────
  server.registerTool(
    "data_sovereignty",
    {
      title: "Data Sovereignty — سيادة البيانات",
      description:
        "البيانات — 8 data categories with sovereignty rules, sensitivity levels, " +
        "protection mechanisms, monetization rights, and cross-border transfer rules. " +
        "From transaction history (private, individual) to government spending (public, national). " +
        "Biometric data: BLOCKED from cross-border transfer under all circumstances.",
      inputSchema: {
        sovereignty_filter: z.enum(["individual", "national", "organizational", "public", "all"]).optional()
          .describe("Filter by sovereignty type"),
        sensitivity_filter: z.enum(["public", "private", "confidential", "sovereign", "all"]).optional()
          .describe("Filter by sensitivity level"),
      },
    },
    async (input) => {
      const sov  = input.sovereignty_filter === "all" ? undefined : input.sovereignty_filter;
      const sens = input.sensitivity_filter === "all" ? undefined : input.sensitivity_filter;

      let data = getDataCategories(sov);
      if (sens) data = data.filter(d => d.sensitivity === sens);

      const sensitivityColor: Record<string, string> = {
        public: "PUBLIC", private: "PRIVATE", confidential: "CONFIDENTIAL", sovereign: "SOVEREIGN",
      };

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  DATA SOVEREIGNTY — سيادة البيانات                            ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `PRINCIPLE: Data belongs to its creator. The system is a custodian, not an owner.`,
        `We collect minimum necessary. We retain minimum required. We share only with consent.`,
        ``,
      ];

      for (const d of data) {
        lines.push(
          `[${d.id}] ${d.name} — ${d.arabic}`,
          `  Sovereignty: ${d.sovereignty.toUpperCase()}  |  Sensitivity: ${sensitivityColor[d.sensitivity]}`,
          `  ${d.description}`,
          ``,
          `  Protection: ${d.protection}`,
          d.monetization ? `  Monetization: ${d.monetization}` : `  Monetization: Not applicable — private data`,
          `  Cross-border: ${d.cross_border}`,
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      lines.push(
        `ABSOLUTE RULES:`,
        `  1. Biometric data (DC-07): BLOCKED cross-border. Always. No exceptions.`,
        `  2. Transaction history (DC-01): ZK proofs only. Court order to unmask.`,
        `  3. Government spending (DC-05): 100% public. Cannot be hidden.`,
        `  4. KYC status (DC-02): Shareable. Underlying PII stays in home jurisdiction.`,
        ``,
        `DATA MINIMIZATION: The system collects ONLY what cryptographic necessity requires.`,
        `Everything else is a privacy violation.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 8. International cooperation models ──────────────────────────────────────
  server.registerTool(
    "cooperation_models",
    {
      title: "International Cooperation Models — نماذج التعاون الدولي",
      description:
        "التشارك العالمي — 6 cooperation frameworks: Ψ Treaty, regional currency stability, " +
        "commodity sovereignty alliance, global remittance protocol, debt restructuring forum, " +
        "open digital governance standard. " +
        "Each preserves full national sovereignty while enabling massive international benefit.",
      inputSchema: {
        model_id: z.string().optional()
          .describe("Specific model ID (CM-01 to CM-06). Omit for all."),
      },
    },
    async (input) => {
      let models = getCooperationModels();
      if (input.model_id) {
        models = models.filter(m => m.id === (input.model_id ?? "").toUpperCase());
      }

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  INTERNATIONAL COOPERATION — نماذج التعاون الدولي              ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `CORE DESIGN PRINCIPLE:`,
        `All models are opt-in. All preserve full national sovereignty.`,
        `Benefits flow to participating nations — no extraction to protocol layer.`,
        `Any nation exits cleanly with no penalty.`,
        ``,
      ];

      for (const m of models) {
        lines.push(
          `[${m.id}] ${m.name}`,
          `     ${m.arabic}`,
          ``,
          `  Parties: ${m.parties}`,
          `  Mechanism: ${m.mechanism}`,
          `  Benefit sharing: ${m.benefit_sharing}`,
          `  Decision making: ${m.decision_making}`,
          `  Exit clause: ${m.exit_clause}`,
          `  Real example: ${m.example}`,
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      lines.push(
        `WHAT MAKES THESE DIFFERENT FROM CURRENT GLOBAL INSTITUTIONS:`,
        `  IMF: Lender conditions override sovereignty. Ψ: no conditions, only recommendations.`,
        `  WTO: Rich nations dominate. Ψ: equal vote regardless of GDP.`,
        `  SWIFT: US can sanction by exclusion. Ψ: no single nation controls exclusion.`,
        `  FATF: 37 nations set rules for 195. Ψ: each jurisdiction opt-in.`,
        ``,
        `The Ψ models are built to make the IMF/WTO/SWIFT path less necessary`,
        `by making the opt-in cooperative path more attractive.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 9. Public interest doctrine ───────────────────────────────────────────────
  server.registerTool(
    "public_interest_doctrine",
    {
      title: "Public Interest Doctrine — المصلحة العامة",
      description:
        "المصلحة العامة — 7 principles for when public interest overrides private rights: " +
        "environmental survival, health emergency, financial stability, resource repatriation, " +
        "essential services, anti-concentration, generational equity. " +
        "Each has strict conditions, limits, and compensation requirements. " +
        "Public interest is real — but it is not unlimited.",
      inputSchema: {
        rule_id: z.string().optional()
          .describe("Specific rule ID (PI-01 to PI-07). Omit for all."),
      },
    },
    async (input) => {
      let rules = getPublicInterestRules();
      if (input.rule_id) {
        rules = rules.filter(r => r.id === (input.rule_id ?? "").toUpperCase());
      }

      const lines = [
        `╔══════════════════════════════════════════════════════════════╗`,
        `║  PUBLIC INTEREST DOCTRINE — مبدأ المصلحة العامة               ║`,
        `╚══════════════════════════════════════════════════════════════╝`,
        ``,
        `BALANCE:`,
        `  Private rights are real and protected.`,
        `  Public interest can override them — but ONLY with strict conditions.`,
        `  No blank check for governments to invoke "public interest" arbitrarily.`,
        ``,
      ];

      for (const r of rules) {
        lines.push(
          `[${r.id}] ${r.principle}`,
          `     ${r.arabic}`,
          ``,
          `  When it applies: ${r.when_applies}`,
          `  Overrides: ${r.override}`,
          ``,
          `  CONDITIONS (all must be met):`,
          ...r.conditions.map(c => `    • ${c}`),
          ``,
          `  LIMITS (even public interest cannot do this): ${r.limits}`,
          ``,
          `  Example: ${r.example}`,
          ``,
          `${"─".repeat(70)}`,
          ``,
        );
      }

      lines.push(
        `THE BALANCE TEST (applied to every override):`,
        `  1. Is the harm to public genuinely serious? (not hypothetical)`,
        `  2. Is there no less harmful alternative? (least restrictive means)`,
        `  3. Is compensation provided for private loss? (no confiscation)`,
        `  4. Is the override temporary with sunset clause? (no permanent expropriation)`,
        `  5. Is there independent review available? (judicial or arbitration)`,
        ``,
        `If any condition fails: override is BLOCKED. Private right protected.`,
      );

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 10. Master synthesis — the complete picture ───────────────────────────────
  server.registerTool(
    "master_synthesis",
    {
      title: "Master Synthesis — التقييم الشامل الكامل",
      description:
        "التقييم الكامل — The complete picture across all 20 dimensions. " +
        "What's built, what's missing, goals, risks, actors, assets, data, cooperation, " +
        "public interest, profits, renaissance, constitutions, laws — everything in one response. " +
        "This is the highest-level view of the entire Ψ sovereign system.",
      inputSchema: {
        depth: z.enum(["summary", "full"]).optional()
          .describe("'summary' for key metrics, 'full' for complete details (default: full)"),
      },
    },
    async (input) => {
      const s      = getMasterEvaluationSummary();
      const goals  = getGlobalGoals();
      const gaps   = getGapAnalysis();
      const risks  = getGlobalRisks();
      const models = getCooperationModels();

      const criticalGaps    = gaps.filter(g => g.impact === "critical");
      const criticalRisks   = risks.filter(r => r.residual === "critical");
      const highProbRisks   = risks.filter(r => r.probability === "high");

      const lines = [
        `╔══════════════════════════════════════════════════════════════════════════╗`,
        `║       MASTER SYNTHESIS — التقييم الشامل الكامل                            ║`,
        `║       Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel                          ║`,
        `║       GENESIS: bbc267eec7ee6f3889dfc7fc7fd723103e3ba1bc126547515d09edddcae0d4d1  ║`,
        `╚══════════════════════════════════════════════════════════════════════════╝`,
        ``,
        `══════════════════ ما تم بناؤه (WHAT WAS BUILT) ══════════════════`,
        ``,
        `  Components:      ${s.total_components} systems built`,
        `  MCP Tools:       ${s.total_tools} tools registered and live`,
        `  Avg Completeness: ${s.average_completeness_pct}% (architecture complete, scale incomplete)`,
        ``,
        `  ✓ Ψ Equation (Landauer·Nash·Cantillon⁻¹·Gödel) — 29 currencies scored`,
        `  ✓ Universal Ψ Protocol — SHA-256 anchored, 5-chain compliance envelope`,
        `  ✓ Sanctions + AML System — OFAC/FATF/pattern detection`,
        `  ✓ Constitutional Registry — 26 jurisdictions encoded`,
        `  ✓ National Debt Oracle — 16 nations, 7-phase liberation plan`,
        `  ✓ Renaissance Engine — 30-year projection, government x402`,
        `  ✓ PSI Oracle — 3 master tools, full 8-layer intelligence`,
        `  ✓ Grand Unified System — 12-article constitution, adversarial matrix`,
        `  ✓ Currency Renaissance — 8 per-currency plans, multi-currency x402`,
        `  ✓ Zero Harm Protocol — 10 civilian rights, 10 government rights`,
        `  ✓ Zero Harm Circuit Breakers — 10 automatic safety stops`,
        `  ✓ Cognitive Injection Defense — 24 patterns, trust weighting`,
        `  ✓ Quantum-Resistant Keys — Lamport OTS + XMSS tree`,
        ``,
        `══════════════════ النواقص (GAPS) ══════════════════`,
        ``,
        `  CRITICAL (must fix for global adoption):`,
        ...criticalGaps.map(g => `    [${g.id}] ${g.area}: ${g.gap}`),
        ``,
        `  Coverage gaps (architecture works, scale is missing):`,
        `    Nations:       ${s.coverage_nations_pct}% (${16}/195 — ${195-16} missing)`,
        `    Currencies:    ${s.coverage_currencies_pct}% (${8}/180 — ${180-8} missing)`,
        `    Jurisdictions: ${s.coverage_jurisdictions_pct}% (${26}/195 — ${195-26} missing)`,
        ``,
        `══════════════════ الأهداف (GOALS) ══════════════════`,
        ``,
        `  ${goals.length} global goals defined. All achievable within 30 years.`,
        ...goals.map(g =>
          `    [${g.id}] ${g.goal.substring(0, 50)}...  →  ${g.measurable.substring(0, 40)}`
        ),
        ``,
        `══════════════════ المخاطر (RISKS) ══════════════════`,
        ``,
        `  ${risks.length} risks identified.  ${highProbRisks.length} high-probability.  ${criticalRisks.length} critical residual.`,
        ``,
        `  HIGH PROBABILITY risks (require active monitoring):`,
        ...highProbRisks.map(r => `    [${r.id}] ${r.name}: ${r.mitigation.substring(0, 60)}...`),
        ``,
        `  CRITICAL residual risks (need additional mitigation):`,
        ...criticalRisks.map(r => `    [${r.id}] ${r.name}: ${r.owner}`),
        ``,
        `══════════════════ الأمان والخصوصية (SECURITY & PRIVACY) ══════════════════`,
        ``,
        `  ZK-KYC: compliance proved without identity revealed (court order to unmask)`,
        `  Biometric data: BLOCKED cross-border under all circumstances`,
        `  Backdoors: NEVER built — not for law enforcement, not for anyone`,
        `  Private keys: ALWAYS with the user — no custodial risk`,
        `  Post-quantum: Lamport OTS + XMSS ready for quantum threat`,
        `  Circuit breaker CB-05: surveillance creep BLOCKED automatically`,
        ``,
        `══════════════════ الفوائد (BENEFITS) ══════════════════`,
        ``,
        `  For 1.4B in extreme poverty:  Cantillon⁻¹ routes new money directly to them`,
        `  For 1.7B unbanked:            x402 + mobile money = financial inclusion`,
        `  For diaspora (800B/yr remit): <1% fees vs current 6.2% = $40B saved annually`,
        `  For developing nations:       Debt liberation + BTC mining revenue`,
        `  For governments:              x402 APIs = new revenue + efficiency`,
        `  For citizens:                 10 guaranteed rights + privacy preserved`,
        `  For businesses:               Universal x402 = sell to anyone, any currency`,
        `  For the planet:               Landauer green bonus reduces fossil fuel pressure`,
        ``,
        `══════════════════ الديون (DEBT LIBERATION) ══════════════════`,
        ``,
        `  Global debt: $307T (338% of global GDP)`,
        `  Mathematical invariant: $307T ÷ 21M BTC = $14,619,047/BTC if global base`,
        `  7-phase liberation: Audit → Accumulate → Denominate → Decouple →`,
        `                      Service → Settle → Renaissance`,
        `  16 nations profiled. 179 need profiles (GA-02 gap).`,
        `  BTC mining for energy-rich nations: mining surplus energy = revenue`,
        ``,
        `══════════════════ نهضة الأمم (NATIONAL RENAISSANCE) ══════════════════`,
        ``,
        `  Every nation heals its OWN currency through its own Ψ diagnosis.`,
        `  sBTC is not the destination — it's one optional tool.`,
        `  6 renaissance types: commodity, productivity, energy, bilateral, digital, hybrid`,
        `  8 currencies fully planned. 172 await parameterized generation (GA-01).`,
        ``,
        `══════════════════ الدساتير والقوانين (CONSTITUTIONS & LAWS) ══════════════════`,
        ``,
        `  12-article Ψ Constitution (Grand Unified System)`,
        `  Constitutional registry: 26 jurisdictions (169 missing — GA-03)`,
        `  Civilian Bill of Rights: 10 rights (CR-01 to CR-10)`,
        `  Government Sovereignty Charter: 10 rights (GR-01 to GR-10)`,
        `  Public Interest Doctrine: 7 principles with strict conditions`,
        `  International Law: UN Charter, FATF, BIS, WTO — all encoded`,
        ``,
        `══════════════════ التشارك العالمي (GLOBAL COOPERATION) ══════════════════`,
        ``,
        `  ${models.length} cooperation models — all opt-in, all sovereignty-preserving:`,
        ...models.map(m => `    [${m.id}] ${m.name} — ${m.arabic}`),
        ``,
        `══════════════════ الأرباح والانعاش (PROFITS & REVIVAL) ══════════════════`,
        ``,
        `  Profit model: x402 pay-per-use → creator gets 97-99%, protocol gets 1-3%`,
        `  Government revenue: x402 APIs → public services monetized without taxation burden`,
        `  Remittance savings: $40B/year returned to families globally`,
        `  BTC mining revenue: $X/year for energy-surplus nations (market dependent)`,
        `  Debt reduction savings: trillions in debt service freed for social spending`,
        `  No rent extraction: protocol does not extract wealth, it routes it to creators`,
        ``,
        `══════════════════ الاحترام والثقة (RESPECT & TRUST) ══════════════════`,
        ``,
        `  Trust model: mathematical (Ψ score), not reputational (he said/she said)`,
        `  Respect model: opt-in architecture — every nation, every person chooses`,
        `  SHA-256 identity: protocol identified by hash, not by brand or name`,
        `  On-chain transparency: all commitments are verifiable, not just stated`,
        `  No intermediary trust: trustless by cryptography, not by authority`,
        ``,
        `══════════════════ النوايا والأصول والبيانات (INTENTIONS, ASSETS, DATA) ══════════════════`,
        ``,
        `  Intentions: 10 actor profiles — constructive to hostile — behavior-based`,
        `  Assets: 8 classes — national/individual/shared/global commons sovereignty`,
        `  Data: 8 categories — individual owns transactions, nations own statistics`,
        `  Biometrics: absolute cross-border block — no exceptions`,
        ``,
        `══════════════════ الحماية (PROTECTION) ══════════════════`,
        ``,
        `  10 circuit breakers: automatic, immediate, cannot be overridden`,
        `  Zero harm guarantees: 4 sectors × positive + negative commitments`,
        `  Civilian rights: 10 — guaranteed in protocol, not just policy`,
        `  Government rights: 10 — sovereignty preserved at every layer`,
        `  Anti-concentration: no single entity >5-30% of any critical system`,
        `  Quantum protection: post-quantum keys available now`,
        ``,
        `══════════════════ المصلحة العامة (PUBLIC INTEREST) ══════════════════`,
        ``,
        `  7 override principles with strict conditions + compensation + sunset clauses`,
        `  Public interest is real — but requires all 5 balance test conditions`,
        `  No blank-check government override — due process always`,
        `  Generational equity: decisions affecting 25+ years require reversibility`,
        ``,
        `════════════════════════════════════════════════════════════════`,
        ``,
        `FINAL EVALUATION:`,
        ``,
        `  Architecture:  COMPLETE ✓`,
        `  Mathematical foundation: COMPLETE ✓  (Ψ equation + GENESIS hash)`,
        `  Rights framework: COMPLETE ✓  (civilian + government)`,
        `  Safety systems: COMPLETE ✓  (circuit breakers + harm protocol)`,
        `  Cooperation models: COMPLETE ✓`,
        ``,
        `  Scale:       INCOMPLETE ◑  (8% nations, 4% currencies, 13% jurisdictions)`,
        `  Live data:   INCOMPLETE ◑  (static figures, no real-time feeds)`,
        `  ZK proofs:   INCOMPLETE ◑  (designed, not deployed)`,
        `  Last mile:   MISSING ✗    (no SMS/USSD for 1.7B unbanked)`,
        ``,
        `  VERDICT: A mathematically complete, rights-respecting, sovereignty-preserving`,
        `  system for global monetary renaissance. The framework exists.`,
        `  What remains is scale: 172 more currencies, 179 more nations, live data feeds,`,
        `  deployed ZK proofs, and last-mile access for the unbanked.`,
        ``,
        `  The vision is complete. The execution is 4–13% deployed.`,
        `  Next priority: GA-01 + GA-02 + GA-04 (currency scale + live data).`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
