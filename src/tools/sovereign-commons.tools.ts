/**
 * Sovereign Commons Tools
 *
 * Every nation sovereign. Humanity shares the commons.
 * Sound money bridges both. The result: prosperity beyond imagination.
 *
 * Tools:
 *   commons_global        — value of all global commons + per-human dividend
 *   commons_sovereign     — any nation's sovereignty profile + commons flow
 *   commons_revival       — economic revival projection for any economy
 *   commons_environment   — planetary restoration plan + jobs
 *   commons_employment    — universal employment model
 *   commons_full          — complete vision in one call
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import {
  computeGlobalCommons,
  computeSovereignProfile,
  computeEconomicRevival,
  computeEnvironmentalPlan,
  computeUniversalEmployment,
} from "../services/sovereign-commons-engine.js";

export function registerSovereignCommonsTools(server: McpServer): void {

  // ── commons_global ─────────────────────────────────────────────────────────

  server.registerTool(
    "commons_global",
    {
      title:       "Global Commons Value",
      description: "Calculate the true annual value of all global commons: atmosphere, oceans, biodiversity, knowledge, spectrum, space. Shows how much each human on Earth is owed as their share.",
      inputSchema: z.object({}),
    },
    async () => {
      const c = computeGlobalCommons();
      const fmt = (n: number) => `$${(n/1e12).toFixed(2)}T`;
      const gap = (a: typeof c.atmosphere) =>
        `  ${a.name.padEnd(36)} value: ${fmt(a.total_value_usd)}  fair fee: ${fmt(a.fair_fee)}  gap: ${fmt(a.annual_gap)}`;

      return {
        content: [{
          type: "text",
          text: [
            `**Global Commons — What Belongs to All Humanity**`,
            ``,
            `Asset                                Value/yr         Fair Fee         Gap (uncaptured)`,
            gap(c.atmosphere),
            gap(c.oceans),
            gap(c.biodiversity),
            gap(c.knowledge),
            gap(c.spectrum),
            gap(c.space),
            ``,
            `Total fair commons revenue:  $${(c.total_annual_value_usd/1e12).toFixed(2)}T / year`,
            ``,
            `If distributed equally to all 8.1B humans:`,
            `  Every person on Earth receives: $${c.per_human_dividend_usd}/year`,
            `  Every month:                    $${Math.round(c.per_human_dividend_usd/12)}/month`,
            ``,
            `Current depletion rate:  ${c.current_depletion_rate}%/year`,
            `Current restoration:     ${c.restoration_rate}%/year`,
            `Net loss:                ${(c.current_depletion_rate - c.restoration_rate).toFixed(1)}%/year`,
            ``,
            `→ Charging fair fees stops depletion + funds universal dividend.`,
            `  No new taxes. No redistribution. Just pricing what belongs to everyone.`,
            ``,
            `SHA256: ${c.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── commons_sovereign ──────────────────────────────────────────────────────

  server.registerTool(
    "commons_sovereign",
    {
      title:       "Nation Sovereignty Profile",
      description: "Model any nation's sovereignty score and its net flow from global commons. Each country keeps full control of its money, laws, and culture — while sharing in the global commons dividend.",
      inputSchema: z.object({
        nation:            z.string().describe("Nation or economy name"),
        population:        z.number().positive().describe("Population"),
        gdp_usd:           z.number().positive().describe("GDP in USD"),
        has_sound_money:   z.boolean().describe("Does it use sound/Bitcoin-backed money?"),
        resource_wealth:   z.enum(["low","medium","high","exceptional"]).describe("Natural resource endowment"),
        cultural_strength: z.enum(["low","medium","high"]).describe("Cultural cohesion and identity strength"),
        commons_use:       z.enum(["minimal","moderate","heavy"]).describe("How much global commons does this nation consume?"),
      }),
    },
    async (p) => {
      const r = computeSovereignProfile(p);
      const bar = (v: number) => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));
      const flow = r.net_commons_flow >= 0
        ? `+$${(r.net_commons_flow/1e9).toFixed(1)}B net INFLOW (receives more than contributes)`
        : `-$${(Math.abs(r.net_commons_flow)/1e9).toFixed(1)}B net OUTFLOW (contributes more than receives)`;

      return {
        content: [{
          type: "text",
          text: [
            `**${r.nation} — Sovereignty Profile**`,
            `Population: ${(r.population/1e6).toFixed(1)}M  |  GDP: $${(r.gdp_usd/1e12).toFixed(2)}T`,
            ``,
            `Sovereignty Score: ${r.sovereignty_score}/100`,
            `  Monetary control    ${r.monetary_control}/100  [${bar(r.monetary_control)}]`,
            `  Resource control    ${r.resource_control}/100  [${bar(r.resource_control)}]`,
            `  Cultural identity   ${r.cultural_index}/100  [${bar(r.cultural_index)}]`,
            ``,
            `Commons Flow:`,
            `  Contribution (commons used):  $${(r.commons_contribution/1e9).toFixed(1)}B/year`,
            `  Dividend (equal per-capita):   $${(r.commons_dividend/1e9).toFixed(1)}B/year`,
            `  Net: ${flow}`,
            ``,
            `Annual new jobs from sound money + commons: ${r.annual_jobs_created.toLocaleString()}`,
            ``,
            `Key insight: sovereignty is NOT threatened by the commons.`,
            `${r.nation} makes its own laws, keeps its culture, controls its land.`,
            `The commons only covers what no single nation owns: atmosphere, oceans, space.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── commons_revival ────────────────────────────────────────────────────────

  server.registerTool(
    "commons_revival",
    {
      title:       "Economic Revival Projection",
      description: "Project economic revival for any economy when sound money + commons dividend + open knowledge combine. Shows GDP growth, sector by sector drivers, and jobs created over 10 years.",
      inputSchema: z.object({
        economy:          z.string().describe("Economy name"),
        population:       z.number().positive().describe("Population"),
        current_gdp:      z.number().positive().describe("Current GDP in USD"),
        has_sound_money:  z.boolean().describe("Using sound/Bitcoin-backed money?"),
        commons_dividend: z.number().positive().describe("Annual commons dividend flowing to this economy (USD)"),
        natural_resources: z.boolean().describe("Does it have significant natural resources?"),
        tech_capacity:    z.enum(["low","medium","high"]).describe("Current technological capacity"),
      }),
    },
    async (p) => {
      const r = computeEconomicRevival(p);
      return {
        content: [{
          type: "text",
          text: [
            `**Economic Revival — ${r.economy}**`,
            ``,
            `Current GDP:     $${(r.current_gdp/1e12).toFixed(2)}T`,
            `GDP in 10 years: $${(r.revival_gdp_10y/1e12).toFixed(2)}T`,
            `Multiplier:      ${r.growth_multiplier}× current size`,
            ``,
            `Growth Drivers:`,
            ...r.drivers.map(d =>
              `  ▸ ${d.sector.padEnd(28)} +$${(d.gdp_boost/1e9).toFixed(0)}B GDP  |  ${d.jobs.toLocaleString()} jobs\n    ${d.mechanism}`
            ),
            ``,
            `Total new jobs:         ${r.jobs_created.toLocaleString()}`,
            `Environmental impact:   +${r.environmental_score_change} points`,
            ``,
            `This is not aid. Not charity. Not debt.`,
            `It is the natural result of removing the hidden tax of bad money`,
            `and adding the dividend of shared commons.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── commons_environment ────────────────────────────────────────────────────

  server.registerTool(
    "commons_environment",
    {
      title:       "Planetary Restoration Plan",
      description: "Full environmental healing plan funded entirely by commons fees — no new taxes on anyone. Shows all restoration projects, jobs created, and planetary health trajectory over 50 years.",
      inputSchema: z.object({
        annual_commons_revenue: z.number().positive().describe("Annual global commons revenue in USD (use commons_global to calculate)"),
      }),
    },
    async ({ annual_commons_revenue }) => {
      const r = computeEnvironmentalPlan(annual_commons_revenue);
      return {
        content: [{
          type: "text",
          text: [
            `**Planetary Restoration Plan**`,
            `Funded by: commons fees (zero new taxes on people or production)`,
            ``,
            `Planet Health Score:  ${r.planet_health_score}/100 → ${r.target_score_50y}/100 in 50 years`,
            `Annual commons fund:  $${(r.annual_commons_revenue/1e12).toFixed(2)}T`,
            ``,
            `Restoration Projects:`,
            ...r.restoration_projects.map(p => [
              ``,
              `  ◆ ${p.name}`,
              `    Scale:    ${p.scale}`,
              `    Cost:     $${(p.cost_usd/1e9).toFixed(0)}B/year`,
              `    Jobs:     ${p.jobs.toLocaleString()}`,
              `    Impact:   ${p.impact}`,
              `    Funded:   ${p.funded_by}`,
            ].join("\n")),
            ``,
            `50-Year Outcomes:`,
            `  CO2 reduced:         ${r.carbon_reduction_gt} gigatons`,
            `  Species protected:   ${r.species_protected.toLocaleString()}+`,
            `  Ocean restored:      ${r.ocean_restored_pct}%`,
            `  Forests restored:    ${r.forest_restored_mha}M hectares`,
            `  Global jobs created: ${(r.jobs_created_global/1e6).toFixed(0)}M`,
            ``,
            `The commons fees ARE the environmental policy.`,
            `No bureaucracy. No enforcement. Price signals do it automatically.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── commons_employment ─────────────────────────────────────────────────────

  server.registerTool(
    "commons_employment",
    {
      title:       "Universal Employment Model",
      description: "Show how the commons model creates enough new jobs to employ every person on Earth who wants to work — across restoration, digital, care, and innovation sectors.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = computeUniversalEmployment();
      const fmt = (n: number) => `${(n/1e9).toFixed(2)}B`;
      return {
        content: [{
          type: "text",
          text: [
            `**Universal Employment — Global Model**`,
            ``,
            `Current workforce:   ${fmt(r.global_workforce)} people`,
            `Currently without:   ${fmt(r.currently_unemployed)} people (unemployed + underemployed)`,
            ``,
            `New Jobs by Sector:`,
            `  Commons restoration  ${fmt(r.new_jobs_commons)}  (forests, oceans, soil, clean energy, water)`,
            `  Digital commons      ${fmt(r.new_jobs_digital)}  (open internet, open source, knowledge)`,
            `  Care economy         ${fmt(r.new_jobs_care)}  (teachers, nurses, doctors, elderly care)`,
            `  Innovation           ${fmt(r.new_jobs_innovation)}  (science, research, engineering)`,
            `                       ─────────`,
            `  Total new jobs:      ${fmt(r.total_new_jobs)}`,
            ``,
            `Commons dividend floor income:  $${r.commons_dividend_usd}/person/year`,
            `                                $${Math.round(r.commons_dividend_usd/12)}/month`,
            ``,
            `No person on Earth goes without basic income.`,
            `Not from charity — from their rightful share of the commons.`,
            ``,
            `The jobs above are not government make-work.`,
            `They are the most urgently needed work on the planet:`,
            `  healing the biosphere, caring for each other,`,
            `  building open knowledge, advancing science.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── commons_full ───────────────────────────────────────────────────────────

  server.registerTool(
    "commons_full",
    {
      title:       "The Complete Vision",
      description: "Run the complete sovereign commons vision for any nation: sovereignty profile, global commons share, economic revival, environmental plan, and universal employment — all in one call.",
      inputSchema: z.object({
        nation:            z.string().describe("Nation name"),
        population:        z.number().positive().describe("Population"),
        gdp_usd:           z.number().positive().describe("GDP in USD"),
        has_sound_money:   z.boolean().describe("Using sound money?"),
        resource_wealth:   z.enum(["low","medium","high","exceptional"]),
        cultural_strength: z.enum(["low","medium","high"]),
        commons_use:       z.enum(["minimal","moderate","heavy"]),
        tech_capacity:     z.enum(["low","medium","high"]),
        natural_resources: z.boolean(),
      }),
    },
    async (p) => {
      const commons   = computeGlobalCommons();
      const sovereign = computeSovereignProfile({ ...p });
      const revival   = computeEconomicRevival({
        economy:          p.nation,
        population:       p.population,
        current_gdp:      p.gdp_usd,
        has_sound_money:  p.has_sound_money,
        commons_dividend: sovereign.commons_dividend,
        natural_resources: p.natural_resources,
        tech_capacity:    p.tech_capacity,
      });
      const envplan   = computeEnvironmentalPlan(commons.total_annual_value_usd);
      const employ    = computeUniversalEmployment();

      const gdp_mult = revival.growth_multiplier;

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║         THE COMPLETE VISION — ${p.nation.padEnd(30)}║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `"Every nation sovereign. All humanity sharing the commons."`,
            ``,
            `━━━ 1. SOVEREIGNTY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `${p.nation} keeps:`,
            `  ✓ Its own money and monetary policy`,
            `  ✓ Its own laws and constitution`,
            `  ✓ Its own land, resources, culture`,
            `  ✓ Full control over its borders`,
            `Sovereignty score: ${sovereign.sovereignty_score}/100`,
            ``,
            `━━━ 2. COMMONS DIVIDEND ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Global commons value:  $${(commons.total_annual_value_usd/1e12).toFixed(1)}T/year`,
            `${p.nation}'s share:  $${(sovereign.commons_dividend/1e9).toFixed(1)}B/year`,
            `Per citizen:           $${Math.round(sovereign.commons_dividend/p.population)}/year`,
            `Net flow:              ${sovereign.net_commons_flow >= 0 ? "+" : ""}$${(sovereign.net_commons_flow/1e9).toFixed(1)}B`,
            ``,
            `━━━ 3. ECONOMIC REVIVAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Current GDP:      $${(p.gdp_usd/1e12).toFixed(2)}T`,
            `GDP in 10 years:  $${(revival.revival_gdp_10y/1e12).toFixed(2)}T  (${gdp_mult}× growth)`,
            `New jobs created: ${revival.jobs_created.toLocaleString()}`,
            ``,
            `━━━ 4. ENVIRONMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Planet health: 38/100 → 72/100 in 50 years`,
            `CO2 reduced:   320 gigatons`,
            `Jobs globally: ${(envplan.jobs_created_global/1e6).toFixed(0)}M restoration workers`,
            `Funded by:     commons fees — zero tax on people or production`,
            ``,
            `━━━ 5. UNIVERSAL JOBS + INCOME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `New jobs globally: ${(employ.total_new_jobs/1e9).toFixed(2)}B`,
            `Floor income:      $${employ.commons_dividend_usd}/person/year from commons dividend`,
            `No one left out:   every human has income + job opportunity`,
            ``,
            `━━━ THE EQUATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  National Sovereignty`,
            `  × Sound Money (no inflation theft)`,
            `  × Global Commons Dividend (your share of Earth)`,
            `  × Open Knowledge (build anything, anywhere)`,
            `  ─────────────────────────────────────────────`,
            `  = Prosperity beyond imagination`,
            `    for every human, every nation, the planet itself`,
            ``,
            `No utopia. No central planner. No force.`,
            `Just mathematics, fairness, and open access.`,
          ].join("\n"),
        }],
      };
    },
  );
}
