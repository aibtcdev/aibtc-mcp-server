/**
 * Currency Renaissance Tools — Every Currency Strengthens Itself
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * THE CORE PRINCIPLE:
 *   USD hegemony → sBTC hegemony = same problem, different chain.
 *   CORRECT: Every currency heals through its own Ψ diagnosis.
 *   sBTC is ONE optional tool, never the mandatory destination.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getRenaissancePlan,
  getAllRenaissancePlans,
  getTopReforms,
  getRenaissanceByType,
  getCurrencyRelationships,
  buildMultiCurrencyConfig,
  RenaissanceType,
} from "../services/sovereign/currency-renaissance.js";

export function registerCurrencyRenaissanceTools(server: McpServer): void {
  // ── 1. Get renaissance plan for a specific currency ──────────────────────────
  server.registerTool(
    "currency_renaissance_plan",
    {
      title: "Currency Renaissance Plan",
      description:
        "Get the full Ψ-based renaissance plan for a specific national currency. " +
        "Shows: diagnosis (which Landauer/Nash/Cantillon/Gödel dimensions are failing), " +
        "ordered concrete reforms, expected Ψ score improvement, and what role (if any) " +
        "Bitcoin/sBTC plays. Every currency strengthens IN ITSELF — no forced sBTC adoption.",
      inputSchema: {
        currency_code: z.string().describe("ISO 4217 currency code (e.g. LBP, NGN, ARS, USD, EUR, JPY, INR, SAR)"),
      },
    },
    async (input) => {
      const plan = getRenaissancePlan(input.currency_code);
      if (!plan) {
        const all = getAllRenaissancePlans().map(p => `${p.currency_code} (${p.country})`);
        return {
          content: [{
            type: "text" as const,
            text: `No renaissance plan found for "${input.currency_code.toUpperCase()}".\n\nAvailable: ${all.join(", ")}`,
          }],
        };
      }

      const psiGain = plan.target_psi - plan.current_psi;
      const topReform = plan.reforms[0];

      const lines: string[] = [
        `═══ Ψ RENAISSANCE: ${plan.currency_name} (${plan.currency_code}) ═══`,
        `Country: ${plan.country}`,
        `Ψ Score: ${plan.current_psi} → ${plan.target_psi}  (+${psiGain.toFixed(1)} over ${plan.years_to_target} years)`,
        `Renaissance Type: ${plan.renaissance_type}`,
        `Reason: ${plan.type_reason}`,
        ``,
        `─── DIAGNOSIS ───`,
        plan.diagnosis.landauer_issue ? `Landauer: ${plan.diagnosis.landauer_issue}` : `Landauer: OK`,
        plan.diagnosis.nash_issue     ? `Nash:     ${plan.diagnosis.nash_issue}`     : `Nash:     OK`,
        plan.diagnosis.cantillon_issue? `Cantillon:${plan.diagnosis.cantillon_issue}` : `Cantillon: OK`,
        plan.diagnosis.godel_issue    ? `Gödel:    ${plan.diagnosis.godel_issue}`    : `Gödel:    OK`,
        `Root Cause: ${plan.diagnosis.root_cause}`,
        ``,
        `─── REFORMS (priority order) ───`,
        ...plan.reforms.map(r =>
          `[${r.priority}] ${r.title} [${r.dimension.toUpperCase()}] Ψ+${r.psi_impact}\n` +
          `    Action: ${r.action}\n` +
          `    Mechanism: ${r.mechanism}\n` +
          `    Cost: ${r.cost}  |  Timeline: ${r.timeline}`
        ),
        ``,
        `─── BITCOIN/sBTC ROLE ───`,
        `Role: ${plan.btc_role}`,
        plan.btc_role_note,
        ``,
        `─── x402 MULTI-CURRENCY ───`,
        `Settlement Currency: ${plan.x402_currency}`,
        plan.x402_conversion,
        ``,
        `─── EXPECTED OUTCOMES ───`,
        `Inflation: ${plan.outcomes.inflation_current}% → ${plan.outcomes.inflation_target}%`,
        `Purchasing Power (5yr): ${plan.outcomes.purchasing_power_5yr}`,
        `Employment: ${plan.outcomes.employment_effect}`,
        `Trade: ${plan.outcomes.trade_effect}`,
        ``,
        `HIGHEST-IMPACT FIRST STEP:`,
        `"${topReform.title}" — cost: ${topReform.cost}, Ψ impact: +${topReform.psi_impact}`,
        topReform.action,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 2. Multi-currency x402 config ────────────────────────────────────────────
  server.registerTool(
    "currency_x402_config",
    {
      title: "Multi-Currency x402 Configuration",
      description:
        "Generate an x402 endpoint configuration that accepts ANY national currency. " +
        "No user is forced to hold sBTC or BTC — Lebanese pay in LBP, Japanese in JPY, etc. " +
        "Provide base USD amount and optional currencies list to get per-currency fee equivalents.",
      inputSchema: {
        endpoint_path:    z.string().describe("API endpoint path (e.g. /api/analytics/market-data)"),
        base_amount_usd:  z.number().describe("Price in USD (e.g. 0.01 for 1 cent)"),
        currencies:       z.array(z.string()).optional().describe("Currency codes to support (e.g. ['LBP','NGN','JPY','EUR','INR','SAR']). Omit for all major currencies."),
      },
    },
    async (input) => {
      // Default exchange rates (approximate mid-market)
      const DEFAULT_RATES: Record<string, number> = {
        USD:  1,
        EUR:  0.92,
        JPY:  157,
        GBP:  0.79,
        INR:  83.5,
        SAR:  3.75,
        NGN:  1580,
        ARS:  900,
        LBP:  89500,
        EGP:  49,
        TRY:  32,
        BRL:  5.1,
        CNY:  7.25,
        CAD:  1.36,
        AUD:  1.53,
      };

      const selectedCodes = input.currencies && input.currencies.length > 0
        ? input.currencies.map(c => c.toUpperCase())
        : Object.keys(DEFAULT_RATES);

      const rates: Record<string, number> = {};
      const missing: string[] = [];
      for (const code of selectedCodes) {
        if (DEFAULT_RATES[code] !== undefined) {
          rates[code] = DEFAULT_RATES[code];
        } else {
          missing.push(code);
        }
      }

      const config = buildMultiCurrencyConfig(input.base_amount_usd, input.endpoint_path, rates);

      const feeTable = Object.entries(config.fee_equivalents)
        .map(([cur, amt]) => `  ${cur.padEnd(5)} ${amt.toLocaleString()} ${cur}`)
        .join("\n");

      const lines = [
        `═══ MULTI-CURRENCY x402 CONFIG ═══`,
        `Endpoint: ${config.endpoint}`,
        `Base price: $${input.base_amount_usd} USD`,
        ``,
        `Accepted currencies: ${config.accepted_currencies.join(", ")}`,
        `Settlement: ${config.primary_settlement}`,
        `Conversion: ${config.conversion_method}`,
        ``,
        `─── Fee equivalents ───`,
        feeTable,
        ``,
        `─── Design principle ───`,
        `Every user pays in their OWN currency.`,
        `No user is required to hold sBTC, BTC, or any foreign currency.`,
        `The x402 gateway converts at the moment of payment using live DEX rates.`,
        config.accepted_currencies.includes("LBP")
          ? `\nLebanese users see: "Pay 15,000 LBP" (not "Pay 0.00017 sBTC")`
          : "",
        missing.length > 0
          ? `\nNote: Rates not found for: ${missing.join(", ")}. Provide custom rates manually.`
          : "",
      ].filter(l => l !== "");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 3. Currency relationships ─────────────────────────────────────────────────
  server.registerTool(
    "currency_relationships",
    {
      title: "Currency Bilateral Relationships",
      description:
        "Show how currency renaissances reinforce each other. " +
        "When every currency gets stronger, the whole global economy benefits. " +
        "Maps bilateral relationships: which country's renaissance helps another.",
      inputSchema: {
        filter_currency: z.string().optional().describe("Optional: filter to only relationships involving this currency code"),
      },
    },
    async (input) => {
      let rels = getCurrencyRelationships();

      if (input.filter_currency) {
        const code = input.filter_currency.toUpperCase();
        rels = rels.filter(r => r.from === code || r.to === code);
      }

      if (rels.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No relationships found for "${input.filter_currency}".`,
          }],
        };
      }

      const lines = [
        `═══ CURRENCY BILATERAL RENAISSANCE RELATIONSHIPS ═══`,
        ``,
        `When every currency heals, economies lift each other:`,
        ``,
        ...rels.map(r =>
          `${r.from} → ${r.to}\n` +
          `  Relationship: ${r.relationship}\n` +
          `  Benefit: ${r.benefit}`
        ),
        ``,
        `KEY INSIGHT:`,
        `These are NOT zero-sum. A stronger SAR does NOT weaken LBP.`,
        `A stronger EUR helps ARS (green investment). A stronger INR helps NGN (tech model).`,
        `Ψ renaissance is positive-sum across all nations.`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 4. High-impact reform priorities across all currencies ────────────────────
  server.registerTool(
    "currency_reform_priorities",
    {
      title: "Global Currency Reform Priorities",
      description:
        "Rank the highest-Ψ-impact reforms across ALL currencies. " +
        "Shows which specific actions, in which countries, produce the greatest " +
        "monetary healing per unit of effort. All zero-cost policy changes ranked first.",
      inputSchema: {
        top_n:          z.number().optional().describe("How many top reforms to return (default: 15)"),
        zero_cost_only: z.boolean().optional().describe("Only show zero-cost policy changes (no funding required)"),
        dimension:      z.enum(["landauer", "nash", "cantillon", "godel"]).optional().describe("Filter by Ψ dimension"),
      },
    },
    async (input) => {
      let reforms = getTopReforms(50);

      if (input.zero_cost_only) {
        reforms = reforms.filter(r => r.reform.cost === "zero");
      }
      if (input.dimension) {
        reforms = reforms.filter(r => r.reform.dimension === input.dimension);
      }

      const topN = input.top_n ?? 15;
      reforms = reforms.slice(0, topN);

      const lines = [
        `═══ GLOBAL CURRENCY REFORM PRIORITIES (top ${reforms.length}) ═══`,
        input.zero_cost_only ? `Filter: Zero-cost only (policy changes, no funding needed)` : "",
        input.dimension ? `Filter: ${input.dimension.toUpperCase()} dimension only` : "",
        ``,
        ...reforms.map((item, i) =>
          `[${i + 1}] ${item.currency}  Ψ+${item.reform.psi_impact}  [${item.reform.dimension.toUpperCase()}]\n` +
          `    ${item.reform.title}\n` +
          `    ${item.reform.action}\n` +
          `    Cost: ${item.reform.cost}  |  Timeline: ${item.reform.timeline}`
        ),
        ``,
        `OBSERVATION:`,
        `Most high-impact reforms cost ZERO — they are policy decisions, not budget items.`,
        `The biggest barrier is political will, not money.`,
        `Ψ equation shows the way. Each government can act NOW.`,
      ].filter(l => l !== "");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  // ── 5. Multi-currency comparison ──────────────────────────────────────────────
  server.registerTool(
    "multi_currency_comparison",
    {
      title: "Multi-Currency Ψ Comparison",
      description:
        "Compare Ψ scores, renaissance types, and reform urgency across multiple currencies or all available plans. " +
        "Shows current vs target Ψ, primary failure dimension, and most impactful first step for each.",
      inputSchema: {
        currencies:       z.array(z.string()).optional().describe("Currency codes to compare. Omit to see all 8 available plans."),
        sort_by:          z.enum(["current_psi", "psi_gain", "years_to_target"]).optional().describe("Sort order (default: current_psi ascending — weakest first)"),
        renaissance_type: z.enum(["A_commodity", "B_productivity", "C_energy", "D_bilateral", "E_digital_sovereign", "F_hybrid"]).optional().describe("Filter by renaissance type"),
      },
    },
    async (input) => {
      let plans = input.renaissance_type
        ? getRenaissanceByType(input.renaissance_type as RenaissanceType)
        : getAllRenaissancePlans();

      if (input.currencies && input.currencies.length > 0) {
        const codes = input.currencies.map(c => c.toUpperCase());
        plans = plans.filter(p => codes.includes(p.currency_code));
      }

      if (input.sort_by === "psi_gain") {
        plans = plans.sort((a, b) => (b.target_psi - b.current_psi) - (a.target_psi - a.current_psi));
      } else if (input.sort_by === "years_to_target") {
        plans = plans.sort((a, b) => a.years_to_target - b.years_to_target);
      }

      const header = `${"Code".padEnd(6)} ${"Current".padEnd(8)} ${"Target".padEnd(7)} ${"Gain".padEnd(6)} ${"Yrs".padEnd(5)} ${"Type".padEnd(16)} ${"BTC Role".padEnd(20)} Country`;
      const divider = "─".repeat(header.length);

      const rows = plans.map(p =>
        `${p.currency_code.padEnd(6)} ${p.current_psi.toFixed(1).padEnd(8)} ${p.target_psi.toFixed(1).padEnd(7)} ` +
        `+${(p.target_psi - p.current_psi).toFixed(1).padEnd(5)} ${String(p.years_to_target).padEnd(5)} ` +
        `${p.renaissance_type.padEnd(16)} ${p.btc_role.padEnd(20)} ${p.country}`
      );

      const topSteps = plans.map(p => {
        const r = p.reforms[0];
        return `${p.currency_code}: [${r.dimension.toUpperCase()}] "${r.title}" — Ψ+${r.psi_impact}, cost: ${r.cost}`;
      });

      const lines = [
        `═══ MULTI-CURRENCY Ψ COMPARISON ═══`,
        input.renaissance_type ? `Filter: ${input.renaissance_type}` : "",
        ``,
        header,
        divider,
        ...rows,
        ``,
        `─── HIGHEST-IMPACT FIRST STEP PER CURRENCY ───`,
        ...topSteps,
        ``,
        `─── KEY INSIGHT ───`,
        `No currency needs to die. No hegemony replaces another.`,
        `Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel is a diagnostic, not a verdict.`,
        `Every currency on this list can reach Ψ > 30 within 10 years with correct policy.`,
        `The global economy is positive-sum: stronger currencies = more stable trade = prosperity for all.`,
      ].filter(l => l !== "");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
