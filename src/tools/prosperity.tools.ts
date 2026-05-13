/**
 * Prosperity Tools — The Complete Equation
 *
 * Sound Money + Transparent Resources + Open Access = Real Prosperity
 *
 * Tools:
 *   prosperity_cantillon   — who gains from money printing (and by how much)
 *   prosperity_monetary    — monetary health score for any currency
 *   prosperity_resource    — fair resource taxation model
 *   prosperity_transition  — transition path from fiat to sound money
 *   prosperity_index       — full prosperity score for any economy
 *   prosperity_equation    — run the complete equation in one call
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import {
  computeCantillon,
  computeMonetaryHealth,
  computeResourceTax,
  computeTransitionPath,
  computeProsperityIndex,
} from "../services/prosperity-engine.js";

export function registerProsperityTools(server: McpServer): void {

  // ── prosperity_cantillon ───────────────────────────────────────────────────

  server.registerTool(
    "prosperity_cantillon",
    {
      title:       "Cantillon Effect Calculator",
      description: "Show how newly printed money distributes through the economy — who gets it first (full value) vs last (devalued). Quantifies the hidden wealth transfer from the poor to the financial sector.",
      inputSchema: z.object({
        printed_amount: z.number().positive().describe("Amount of new money printed/created (in local currency units)"),
        currency:       z.string().optional().describe("Currency name (default: USD)"),
      }),
    },
    async ({ printed_amount, currency }) => {
      const r = computeCantillon(printed_amount, currency ?? "USD");
      return {
        content: [{
          type: "text",
          text: [
            `**Cantillon Effect — ${r.currency} ${r.printed_amount.toLocaleString()} printed**`,
            ``,
            `Who receives it (in order):`,
            `  1. Banks & financial sector  ${r.reaches_banks.toFixed(0)}%  → full value`,
            `  2. Corporations              ${r.reaches_corps.toFixed(0)}%  → near-full value`,
            `  3. Middle class              ${r.reaches_middle.toFixed(0)}%  → already inflated`,
            `  4. Poor (last, devalued)     ${r.reaches_poor.toFixed(0)}%  → real value: ${r.currency} ${r.real_value_poor.toLocaleString(undefined, {maximumFractionDigits:0})}`,
            ``,
            `Wealth gap factor:  ${r.wealth_gap_factor}×`,
            `(banks gain ${r.wealth_gap_factor}× more real value than the poor from the same print)`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── prosperity_monetary ───────────────────────────────────────────────────

  server.registerTool(
    "prosperity_monetary",
    {
      title:       "Monetary Health Score",
      description: "Calculate the health score (0-100) of any currency based on inflation, supply growth, debt load, and structural soundness. Compare fiat vs Bitcoin.",
      inputSchema: z.object({
        currency:        z.string().describe("Currency name (e.g. USD, EUR, LBP, BTC)"),
        inflation_rate:  z.number().describe("Annual inflation rate in % (e.g. 3.5)"),
        supply_growth:   z.number().describe("Annual money supply growth in % (e.g. 7.0)"),
        debt_to_gdp:     z.number().describe("Government debt as % of GDP (e.g. 120)"),
        is_fixed_supply: z.boolean().optional().describe("True for Bitcoin/fixed-supply assets"),
      }),
    },
    async ({ currency, inflation_rate, supply_growth, debt_to_gdp, is_fixed_supply }) => {
      const r = computeMonetaryHealth({ currency, inflation_rate, supply_growth, debt_to_gdp, is_fixed_supply });
      const bar = "█".repeat(Math.round(r.score / 5)) + "░".repeat(20 - Math.round(r.score / 5));
      return {
        content: [{
          type: "text",
          text: [
            `**${r.currency} — Monetary Health**`,
            ``,
            `Score:  ${r.score}/100  [${bar}]`,
            ``,
            `Inflation rate:          ${r.inflation_rate}% / year`,
            `Supply growth:           ${r.supply_growth}% / year`,
            `Debt / GDP:              ${r.debt_to_gdp}%`,
            `Purchasing power loss:   ${r.purchasing_power_loss_10y}% over 10 years`,
            `Cantillon gap:           ${r.cantillon_gap}× (wealth gap amplifier)`,
            ``,
            `Verdict: ${r.verdict}`,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── prosperity_resource ───────────────────────────────────────────────────

  server.registerTool(
    "prosperity_resource",
    {
      title:       "Resource Tax Model",
      description: "Model fair resource taxation (Henry George principle): tax the commons (land, spectrum, water, air), not production. Shows who gains and how much workers save.",
      inputSchema: z.object({
        resource:          z.string().describe("Resource type (e.g. 'urban land', 'radio spectrum', 'river water rights')"),
        current_user:      z.string().describe("Who currently controls it (e.g. 'real estate developers')"),
        annual_value_usd:  z.number().positive().describe("Annual economic value of the resource in USD"),
        workers_in_region: z.number().positive().describe("Number of workers in the affected region"),
      }),
    },
    async ({ resource, current_user, annual_value_usd, workers_in_region }) => {
      const r = computeResourceTax({ resource, current_user, annual_value_usd, workers_in_region });
      return {
        content: [{
          type: "text",
          text: [
            `**Resource Tax Model — ${r.resource}**`,
            ``,
            `Currently controlled by:  ${r.current_user}`,
            `Annual resource value:    $${r.annual_value.toLocaleString()}`,
            ``,
            `Proposed resource fee:    $${r.proposed_fee.toLocaleString()} / year`,
            `Public treasury revenue:  $${r.public_revenue.toLocaleString()} / year`,
            ``,
            `Production taxes removed: $${r.production_tax_saved.toLocaleString()} / year (saved by workers)`,
            `Net benefit per worker:   $${r.net_benefit_worker.toLocaleString()} / year`,
            ``,
            `Result: workers keep more, commons fund public services,`,
            `${r.current_user} pay fair share for what belongs to everyone.`,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── prosperity_transition ─────────────────────────────────────────────────

  server.registerTool(
    "prosperity_transition",
    {
      title:       "Transition Path Planner",
      description: "Model a peaceful 3-phase transition from the current fiat system to sound money — without destroying existing wealth. Shows who gains at each phase, who loses (spoiler: almost nobody).",
      inputSchema: z.object({
        country:    z.string().describe("Country or economy name"),
        population: z.number().positive().describe("Population size"),
        gdp_usd:    z.number().positive().describe("GDP in USD"),
        debt_usd:   z.number().positive().describe("Total government debt in USD"),
      }),
    },
    async ({ country, population, gdp_usd, debt_usd }) => {
      const r = computeTransitionPath({ country, population, gdp_usd, debt_usd });
      const fmtPhase = (p: typeof r.phase_1, n: number) => [
        `Phase ${n}: ${p.name} (${p.duration_years} years)`,
        `  Actions:`,
        ...p.actions.map(a => `    • ${a}`),
        `  Loses: ${p.who_loses}`,
        `  Gains: ${p.who_gains}`,
      ].join("\n");

      return {
        content: [{
          type: "text",
          text: [
            `**Transition Path — ${r.country}**`,
            `GDP: $${(r.gdp_usd/1e12).toFixed(2)}T  |  Debt: $${(r.current_debt_usd/1e12).toFixed(2)}T  |  Population: ${(r.population/1e6).toFixed(1)}M`,
            ``,
            fmtPhase(r.phase_1, 1),
            ``,
            fmtPhase(r.phase_2, 2),
            ``,
            fmtPhase(r.phase_3, 3),
            ``,
            `Total duration: ${r.total_years} years`,
            `Outcome: ${r.citizen_benefit}`,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── prosperity_index ──────────────────────────────────────────────────────

  server.registerTool(
    "prosperity_index",
    {
      title:       "Prosperity Index",
      description: "Full prosperity score (0-100) for any economy across 5 dimensions: monetary soundness, financial access, resource equity, production freedom, and transparency. Identifies the single biggest bottleneck.",
      inputSchema: z.object({
        economy:               z.string().describe("Economy name (country or region)"),
        inflation_rate:        z.number().describe("Annual inflation %"),
        supply_growth:         z.number().describe("Annual money supply growth %"),
        debt_to_gdp:           z.number().describe("Govt debt as % of GDP"),
        banked_population_pct: z.number().min(0).max(100).describe("% of population with bank/financial access"),
        gini_coefficient:      z.number().min(0).max(1).describe("Gini inequality (0=equal, 1=extreme inequality)"),
        production_tax_rate:   z.number().describe("Effective tax rate on labor/production (%)"),
        transparency_score:    z.number().min(0).max(100).describe("Government transparency 0-100"),
        is_bitcoin_legal:      z.boolean().describe("Is Bitcoin legal tender or allowed?"),
      }),
    },
    async (params) => {
      const r = computeProsperityIndex(params);
      const bar = (v: number, max = 20) => "█".repeat(Math.round(v / max * 10)) + "░".repeat(10 - Math.round(v / max * 10));
      return {
        content: [{
          type: "text",
          text: [
            `**Prosperity Index — ${r.economy}**`,
            ``,
            `Overall: ${r.score}/100  [${r.tier.toUpperCase()}]`,
            ``,
            `Monetary soundness    ${r.monetary_score.toFixed(1)}/20  [${bar(r.monetary_score)}]`,
            `Financial access      ${r.access_score.toFixed(1)}/20  [${bar(r.access_score)}]`,
            `Resource equity       ${r.resource_score.toFixed(1)}/20  [${bar(r.resource_score)}]`,
            `Production freedom    ${r.production_score.toFixed(1)}/20  [${bar(r.production_score)}]`,
            `Transparency          ${r.trust_score.toFixed(1)}/20  [${bar(r.trust_score)}]`,
            ``,
            `Bottleneck: ${r.bottleneck}`,
            `→ ${r.recommendation}`,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── prosperity_equation ───────────────────────────────────────────────────

  server.registerTool(
    "prosperity_equation",
    {
      title:       "The Complete Equation",
      description: "Run the full prosperity equation in one call. Given any economy's parameters, outputs the Cantillon effect, monetary health, recommended resource taxes, transition path, and full prosperity index — all SHA256-anchored.",
      inputSchema: z.object({
        economy:               z.string().describe("Economy name"),
        population:            z.number().positive().describe("Population"),
        gdp_usd:               z.number().positive().describe("GDP in USD"),
        debt_usd:              z.number().positive().describe("Government debt in USD"),
        inflation_rate:        z.number().describe("Annual inflation %"),
        supply_growth:         z.number().describe("Annual money supply growth %"),
        banked_population_pct: z.number().min(0).max(100).describe("% population with financial access"),
        gini_coefficient:      z.number().min(0).max(1).describe("Gini coefficient"),
        production_tax_rate:   z.number().describe("Effective production/labor tax %"),
        transparency_score:    z.number().min(0).max(100).describe("Govt transparency 0-100"),
        is_bitcoin_legal:      z.boolean().describe("Bitcoin legal/allowed?"),
        new_money_this_year:   z.number().positive().describe("New money printed this year (local currency)"),
      }),
    },
    async (p) => {
      const debt_to_gdp = (p.debt_usd / p.gdp_usd) * 100;

      const [cantillon, monetary, transition, index] = [
        computeCantillon(p.new_money_this_year, p.economy),
        computeMonetaryHealth({
          currency:       p.economy + " currency",
          inflation_rate: p.inflation_rate,
          supply_growth:  p.supply_growth,
          debt_to_gdp,
        }),
        computeTransitionPath({
          country:    p.economy,
          population: p.population,
          gdp_usd:    p.gdp_usd,
          debt_usd:   p.debt_usd,
        }),
        computeProsperityIndex({
          economy:               p.economy,
          inflation_rate:        p.inflation_rate,
          supply_growth:         p.supply_growth,
          debt_to_gdp,
          banked_population_pct: p.banked_population_pct,
          gini_coefficient:      p.gini_coefficient,
          production_tax_rate:   p.production_tax_rate,
          transparency_score:    p.transparency_score,
          is_bitcoin_legal:      p.is_bitcoin_legal,
        }),
      ];

      const bar = (v: number, max = 20) =>
        "█".repeat(Math.round(v / max * 10)) + "░".repeat(10 - Math.round(v / max * 10));

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════╗`,
            `║     THE COMPLETE EQUATION — ${p.economy.padEnd(24)}║`,
            `╚══════════════════════════════════════════════════════╝`,
            ``,
            `Sound Money + Transparent Resources + Open Access = Real Prosperity`,
            ``,
            `━━━ 1. CANTILLON EFFECT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `New money printed: ${p.new_money_this_year.toLocaleString()}`,
            `Banks get first:   ${cantillon.reaches_banks.toFixed(0)}% at full value`,
            `Poor get last:     ${cantillon.reaches_poor.toFixed(0)}% at ${(100 - 22).toFixed(0)}% value`,
            `Wealth gap factor: ${cantillon.wealth_gap_factor}× — the hidden tax on the poor`,
            ``,
            `━━━ 2. MONETARY HEALTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Score:  ${monetary.score}/100  —  ${monetary.verdict}`,
            `10-year purchasing power loss: ${monetary.purchasing_power_loss_10y}%`,
            ``,
            `━━━ 3. PROSPERITY INDEX ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Overall: ${index.score}/100  [${index.tier.toUpperCase()}]`,
            `Monetary    ${index.monetary_score.toFixed(1)}/20  [${bar(index.monetary_score)}]`,
            `Access      ${index.access_score.toFixed(1)}/20  [${bar(index.access_score)}]`,
            `Equity      ${index.resource_score.toFixed(1)}/20  [${bar(index.resource_score)}]`,
            `Production  ${index.production_score.toFixed(1)}/20  [${bar(index.production_score)}]`,
            `Trust       ${index.trust_score.toFixed(1)}/20  [${bar(index.trust_score)}]`,
            ``,
            `━━━ 4. TRANSITION PATH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Phase 1 (${transition.phase_1.duration_years}y): ${transition.phase_1.name} — ${transition.phase_1.who_loses}`,
            `Phase 2 (${transition.phase_2.duration_years}y): ${transition.phase_2.name} — ${transition.phase_2.who_loses}`,
            `Phase 3 (${transition.phase_3.duration_years}y): ${transition.phase_3.name} — ${transition.phase_3.who_loses}`,
            ``,
            `━━━ 5. VERDICT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Bottleneck: ${index.bottleneck}`,
            `Fix this first → greatest leverage for ${p.economy}`,
            ``,
            `In ${transition.total_years} years: ${transition.citizen_benefit}`,
          ].join("\n"),
        }],
      };
    },
  );
}
