/**
 * Nash-Satoshi Complete Tools — All 8 Gaps Filled
 *
 * ICPI-Energy · Currency Competition · Grand Pardoners · Money-as-Measure
 * Trust Cascade · Fee Market · Anti-Fractional-Reserve · Democratic Accountability
 * Complete Synthesis
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import {
  buildIcpiBitcoinEquivalence,
  buildCurrencyCompetitionModel,
  buildGrandPardonersAnalysis,
  buildMoneyMeasureAnalysis,
  buildTrustCascadeModel,
  buildFeeMarketModel,
  buildAntiFractionalReserveModel,
  buildDemocraticAccountabilityModel,
  buildCompleteNashSatoshiSynthesis,
} from "../services/nash-satoshi-complete-engine.js";

export function registerNashSatoshiCompleteTools(server: McpServer): void {

  // ── nash_icpi_energy ───────────────────────────────────────────────────────

  server.registerTool(
    "nash_icpi_energy",
    {
      title:       "ICPI ↔ Bitcoin Energy — Nash's Problem, Satoshi's Solution",
      description: "Nash wanted an Industrial Consumption Price Index (copper, silver, tungsten) as a non-political monetary anchor. Bitcoin's proof-of-work IS that basket — mining cost denominated in real energy. The DAA auto-rebalances it without any committee.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildIcpiBitcoinEquivalence();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║           ICPI ↔ BITCOIN ENERGY EQUIVALENCE                 ║`,
            `║      Nash's commodity basket — implemented by Satoshi       ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `━━━ Nash's ICPI Basket ↔ Bitcoin's Real Cost ━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.nash_icpi.map(c =>
              `  ${c.name.padEnd(12)} → Bitcoin parallel: ${c.btc_parallel}`
            ),
            ``,
            `━━━ Bitcoin's Industrial Energy Footprint ━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  Annual consumption:  ~${r.bitcoin_energy_cost.annual_twh} TWh/year`,
            `  Countries using less: ${r.bitcoin_energy_cost.countries_below.join(", ")}`,
            `  All-in cost/BTC:     ~$${r.bitcoin_energy_cost.cost_usd_per_btc.toLocaleString()}`,
            `  Denominated in:      ${r.bitcoin_energy_cost.denominated_in}`,
            ``,
            `━━━ The DAA — Nash's Auto-Rebalancing Mechanism ━━━━━━━━━━━━━━`,
            ``,
            `  ${r.daa_mechanism.description}`,
            ``,
            `  Nash parallel: ${r.daa_mechanism.nash_parallel}`,
            ``,
            `  Auto-adjusts for:`,
            ...r.daa_mechanism.auto_adjusts_for.map(a => `    • ${a}`),
            ``,
            `━━━ Nash's "Miracle Energy" Problem — Solved ━━━━━━━━━━━━━━━━━`,
            ``,
            `  Nash's concern:   ${r.miracle_energy_problem.nash_concern}`,
            ``,
            `  Bitcoin solution: ${r.miracle_energy_problem.btc_solution}`,
            ``,
            `  Why it works:     ${r.miracle_energy_problem.why_it_works}`,
            ``,
            `━━━ Verdict ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_currency_competition ──────────────────────────────────────────────

  server.registerTool(
    "nash_currency_competition",
    {
      title:       "Currency Competition — Nash's Path to Ideal Money",
      description: "Nash never proposed forcing ideal money on anyone. His mechanism: currencies compete internationally, citizens choose quality, bad monetary policy loses customers. Bitcoin wins through voluntary adoption — the Nash equilibrium of global currency markets.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildCurrencyCompetitionModel();
      const bar = (v: number) => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║         CURRENCY COMPETITION — NASH'S MECHANISM             ║`,
            `║    "Currencies compete. Citizens choose. Quality wins."     ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            r.nash_mechanism,
            ``,
            `━━━ Competitors — Quality Scores ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.competitors.map(c => [
              `  ${c.name.padEnd(24)} ${String(c.quality_score).padStart(3)}/100  [${bar(c.quality_score)}]  ${c.adoption_trend === "rising" ? "↑" : c.adoption_trend === "falling" ? "↓" : "→"}`,
              `    Why chosen: ${c.why_citizens_choose}`,
              `    Exit barrier: ${c.exit_barrier}`,
              ``,
            ].join("\n")),
            `━━━ Path to Nash Equilibrium ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.path_to_ideal.map(p =>
              `  ${p.year}: BTC ${p.btc_share}% / Fiat ${p.fiat_share}%\n    ${p.mechanism}`
            ),
            ``,
            `━━━ Why Mandate Fails ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.why_mandate_fails.map(r => `  ✗ ${r}`),
            ``,
            `━━━ Why Choice Works ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.why_choice_works.map(r => `  ✓ ${r}`),
            ``,
            `━━━ Satoshi Alignment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.satoshi_alignment,
            ``,
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_grand_pardoners ───────────────────────────────────────────────────

  server.registerTool(
    "nash_grand_pardoners",
    {
      title:       "Grand Pardoners — Nash's Central Critique of Central Banking",
      description: "Nash called central banks 'grand pardoners' — they forgive government debt by inflating it away, taxing savers to subsidize debtors. Historical proof across 100 years. Bitcoin makes this mechanism structurally impossible.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildGrandPardonersAnalysis();
      const m = r.mathematical_extraction;
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║              THE GRAND PARDONERS                            ║`,
            `║   Nash's definitive critique of central banking             ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            r.nash_definition,
            ``,
            `━━━ How the Pardon Works ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.how_it_works.map(s => `  ${s}`),
            ``,
            `━━━ The Mathematics of Extraction ━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  Formula: ${m.formula}`,
            `  At ${m.example_10yr.inflation}% inflation:`,
            `    10 years: saver loses ${m.example_10yr.saver_loss_pct}% of purchasing power`,
            `    20 years: saver loses ${m.example_20yr.saver_loss_pct}% of purchasing power`,
            `  On $1,000,000 saved:`,
            `    10yr loss: $${(10_000 * m.example_10yr.saver_loss_pct).toLocaleString()}`,
            `    20yr loss: $${(10_000 * m.example_20yr.saver_loss_pct).toLocaleString()}`,
            ``,
            `━━━ Historical Grand Pardons ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.historical_pardons.map(p => [
              `  ${p.year} — ${p.nation}`,
              `    Mechanism:   ${p.mechanism}`,
              `    Debt forgiven: ~${p.debt_forgiven_pct}% in real terms`,
              `    Victim:      ${p.victim}`,
              `    Beneficiary: ${p.beneficiary}`,
              ``,
            ].join("\n")),
            `━━━ Who Benefits / Who Pays ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  Beneficiaries:`,
            ...r.who_benefits.map(b => `    ✓ ${b}`),
            ``,
            `  Who pays:`,
            ...r.who_pays.map(p => `    ✗ ${p}`),
            ``,
            `━━━ Bitcoin Removes the Pardon ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.bitcoin_removes_pardon.why.map(w => `  • ${w}`),
            ``,
            `  "${r.bitcoin_removes_pardon.satoshi_quote}"`,
            ``,
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_money_measure ─────────────────────────────────────────────────────

  server.registerTool(
    "nash_money_measure",
    {
      title:       "Money as Measurement Standard — Nash's Deepest Insight",
      description: "Nash: money should be like the Watt or the metre — a fixed unit of measure, not a policy tool. From 1971 to 2009, the world had no monetary measurement standard. Bitcoin restored it.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildMoneyMeasureAnalysis();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║         MONEY AS MEASUREMENT STANDARD                       ║`,
            `║    Nash: "like the watt, the degree, the calorie"           ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            r.nash_insight,
            ``,
            `━━━ Physical Standards vs. Money ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  ${"Standard".padEnd(12)} ${"Domain".padEnd(14)} ${"Political?".padEnd(12)} Bitcoin Parallel`,
            `  ${"─".repeat(65)}`,
            ...r.physical_standards.map(s =>
              `  ${s.name.padEnd(12)} ${s.domain.padEnd(14)} ${(s.political ? "YES ⚠" : "NO  ✓").padEnd(12)} ${s.money_parallel}`
            ),
            ``,
            `━━━ Money as Rubber Band (Fiat) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.money_as_rubber_band.description,
            ``,
            `  What changes:`,
            ...r.money_as_rubber_band.what_changes.map(c => `    • ${c}`),
            `  Consequence: ${r.money_as_rubber_band.consequence}`,
            ``,
            `━━━ Money as Ruler (Bitcoin) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.money_as_ruler.description,
            ``,
            `  What stays fixed:`,
            ...r.money_as_ruler.what_stays_fixed.map(c => `    • ${c}`),
            `  Consequence: ${r.money_as_ruler.consequence}`,
            ``,
            `━━━ Contracts Bitcoin Enables ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.bitcoin_as_standard.contracts_enabled.map(c => `  • ${c}`),
            ``,
            `━━━ How the Measurement Standard Was Destroyed ━━━━━━━━━━━━━━`,
            ``,
            ...r.historical_degradation.map(d =>
              `  ${d.year}: ${d.event}\n    Effect: ${d.effect}\n`
            ),
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_trust_cascade ─────────────────────────────────────────────────────

  server.registerTool(
    "nash_trust_cascade",
    {
      title:       "Trust Cascade — Satoshi's Complete Failure Analysis",
      description: "Satoshi: 'The root problem is all the trust that's required.' Seven trust layers in the financial system. Each has been catastrophically breached. Bitcoin eliminates every layer. Full historical proof with USD costs.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildTrustCascadeModel();
      const totalB = (r.total_cost_of_breaches_usd / 1e12).toFixed(1);
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║              THE TRUST CASCADE                              ║`,
            `║   Satoshi: "The root problem is all the trust required"    ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            r.satoshi_insight,
            ``,
            `━━━ The 7 Trust Layers — Each Breached ━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.layers.map(l => [
              `  Layer ${l.layer}: ${l.institution}`,
              `  Trust required: ${l.trust_required}`,
              `  Breach: ${l.historical_breach}`,
              `  Cost: $${(l.cost_usd / 1e9).toFixed(0)}B`,
              `  Bitcoin eliminates: ${l.bitcoin_eliminates}`,
              ``,
            ].join("\n")),
            `  ${"─".repeat(56)}`,
            `  Total cost of trust breaches: $${totalB}T`,
            ``,
            `━━━ How Cascades Work ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.cascade_mechanics.map(m => `  • ${m}`),
            ``,
            `━━━ Bitcoin's Trust Model ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  Trust only in: mathematics`,
            ...r.bitcoin_trust_model.trust_in_what.map(t => `    ✓ ${t}`),
            ``,
            `  Trust NOT required in:`,
            ...r.bitcoin_trust_model.trust_not_in.map(t => `    ✗ ${t}`),
            ``,
            `  Verification: ${r.bitcoin_trust_model.verification}`,
            ``,
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_fee_market ────────────────────────────────────────────────────────

  server.registerTool(
    "nash_fee_market",
    {
      title:       "Bitcoin Fee Market — Satoshi's 132-Year Security Plan",
      description: "Satoshi: 'In a few decades the transaction fee will become the main compensation for nodes.' The full halving schedule from 2009 to 2140, how fees replace subsidy, and why this achieves Nash's asymptotic zero-inflation target.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildFeeMarketModel();
      const keyEpochs = r.halving_epochs.filter(e => [1,5,6,9,10,33].includes(e.epoch));
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║         BITCOIN FEE MARKET — 132-YEAR SECURITY PLAN         ║`,
            `║   Satoshi's full design. Nash's asymptotic ideal: achieved. ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            r.satoshi_insight,
            ``,
            `━━━ Halving Schedule — Inflation Convergence ━━━━━━━━━━━━━━━━━`,
            ``,
            `  ${"Epoch".padEnd(8)} ${"Year".padEnd(8)} ${"Reward/Block".padEnd(16)} ${"Annual BTC".padEnd(14)} ${"Inflation".padEnd(12)} Security`,
            `  ${"─".repeat(72)}`,
            ...keyEpochs.map(e => [
              `  ${String(e.epoch).padEnd(8)}`,
              `${String(e.approx_year).padEnd(8)}`,
              `${String(e.block_reward).padEnd(16)}`,
              `${String(e.annual_issuance.toLocaleString()).padEnd(14)}`,
              `${String(e.inflation_pct + "%").padEnd(12)}`,
              `${e.security_source}`,
            ].join("")),
            ``,
            `━━━ Security Budget Transition ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.fee_projections.map(p => [
              `  ${p.year}: fees ${p.fee_pct}% of security budget`,
              `    Total security: ~$${(p.total_security / 1e9).toFixed(1)}B/year`,
            ].join("\n")),
            ``,
            `━━━ Why Fees Work as Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.why_fees_work.map(w => `  • ${w}`),
            ``,
            `━━━ Gold vs Bitcoin Inflation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `  Gold new supply:   ~${r.comparison_gold.gold_new_supply_pct}%/year (geological — never zero)`,
            `  Bitcoin 2024:      ${r.comparison_gold.btc_inflation_2024}%/year`,
            `  Bitcoin 2140:      ${r.comparison_gold.btc_inflation_2140}%/year (absolute zero)`,
            `  ${r.comparison_gold.btc_fee_security}`,
            ``,
            `━━━ Nash Parallel ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.nash_parallel,
            ``,
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_anti_fractional ───────────────────────────────────────────────────

  server.registerTool(
    "nash_anti_fractional",
    {
      title:       "Anti-Fractional-Reserve — Blockchain as Transparency Engine",
      description: "Fractional reserve banking requires opacity to function. Bitcoin's transparent ledger makes opacity structurally impossible. Full historical fraud analysis (Lehman, FTX, SVB, Argentina) and how on-chain verification would have caught each one.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildAntiFractionalReserveModel();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║      ANTI-FRACTIONAL-RESERVE — BLOCKCHAIN TRANSPARENCY      ║`,
            `║   Nash's ICPI visibility + Satoshi's public ledger = same   ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `━━━ How Fractional Reserve Works ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.how_fractional_reserve_works.map(s => `  ${s}`),
            ``,
            `━━━ Historical Frauds — What On-Chain Would Have Caught ━━━━━━`,
            ``,
            ...r.historical_frauds.map(f => [
              `  ${f.year} — ${f.institution}`,
              `    Claimed:          ${f.claimed}`,
              `    Actual:           ${f.actual}`,
              `    Detection lag:    ${f.detection_lag}`,
              `    How detected:     ${f.how_detected}`,
              `    On-chain solution: ${f.on_chain_detection}`,
              ``,
            ].join("\n")),
            `━━━ Bitcoin's Transparency Mechanisms ━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.bitcoin_transparency.map(t => [
              `  ${t.name}`,
              `    ${t.description}`,
              `    Nash parallel: ${t.nash_parallel}`,
              `    Verifiable by: ${t.verifiable_by}`,
              ``,
            ].join("\n")),
            `━━━ Proof-of-Reserves Protocol ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.proof_of_reserves_protocol.map(s =>
              `  ${s.step}. ${s.action}\n     Verified by: ${s.verified_by}\n`
            ),
            `━━━ Nash ↔ Satoshi Connection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.nash_icpi_connection,
            ``,
            `"${r.satoshi_design}"`,
            ``,
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_democratic_money ──────────────────────────────────────────────────

  server.registerTool(
    "nash_democratic_money",
    {
      title:       "Democratic Monetary Accountability — Citizen Tools",
      description: "Nash: citizens should evaluate their currency like a utility. Complete citizen toolkit for measuring monetary quality, comparing USD vs BTC on 5 accountability metrics, and institutional accountability audit.",
      inputSchema: z.object({
        currency: z.enum(["USD", "BTC", "all"]).optional().describe("Which currency to score (default: all)"),
      }),
    },
    async ({ currency = "all" }) => {
      const r = buildDemocraticAccountabilityModel();
      const scores = currency === "all" ? r.currency_scores
        : r.currency_scores.filter(c => c.currency.includes(currency === "USD" ? "Dollar" : "Bitcoin"));

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║        DEMOCRATIC MONETARY ACCOUNTABILITY                   ║`,
            `║   Nash: "Citizens should evaluate money like a utility"    ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            r.nash_insight,
            ``,
            `━━━ Why Monetary Accountability Matters ━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.why_it_matters.map(w => `  • ${w}`),
            ``,
            `━━━ Currency Accountability Scores ━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...scores.map(cs => [
              `  ${cs.currency}  —  Overall: ${cs.overall}/100`,
              ...cs.metrics.map(m =>
                `    ${m.metric.padEnd(28)} ${String(m.score).padStart(3)}/100  ${m.verdict}`
              ),
              `  Citizen action: ${cs.citizen_action}`,
              ``,
            ].join("\n")),
            `━━━ Citizen Toolkit — Measure Your Money ━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.citizen_toolkit.map(t => [
              `  ◆ ${t.action}`,
              `    Tool: ${t.tool}`,
              `    Reveals: ${t.what_it_reveals}`,
              ``,
            ].join("\n")),
            `━━━ Institutional Accountability Audit ━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.institutional_accountability.map(i => [
              `  ${i.institution.padEnd(22)} Accountability: ${i.accountability}`,
              `    Claim: ${i.what_they_claim}`,
              `    Check: ${i.what_to_check}`,
              ``,
            ].join("\n")),
            r.verdict,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_satoshi_complete ──────────────────────────────────────────────────

  server.registerTool(
    "nash_satoshi_complete",
    {
      title:       "Nash ↔ Satoshi: Complete Synthesis — All Elements",
      description: "Full unified synthesis: all 8 elements, all reforms, all effects, all historical proof. Nash's theory + Satoshi's implementation = the complete picture of what sound money is and how it changes everything.",
      inputSchema: z.object({}),
    },
    async () => {
      const r = buildCompleteNashSatoshiSynthesis();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║      NASH ↔ SATOSHI: COMPLETE SYNTHESIS                     ║`,
            `║  All elements. All reforms. All effects. No gaps.           ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `THE PROBLEM`,
            ``,
            r.the_problem,
            ``,
            `━━━ The Diagnosis ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `Nash:    ${r.the_diagnosis.nash}`,
            ``,
            `Satoshi: ${r.the_diagnosis.satoshi}`,
            ``,
            `Unified: ${r.the_diagnosis.unified}`,
            ``,
            `━━━ The 8 Complete Elements ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.the_eight_elements.map(e => [
              `  ${e.gap}. ${e.name}  [${e.status_in_btc.toUpperCase()}]`,
              `     Nash:    ${e.nash_insight}`,
              `     Satoshi: ${e.satoshi_implementation}`,
              ``,
            ].join("\n")),
            `━━━ THE SOLUTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.the_solution,
            ``,
            `━━━ What Changes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...r.what_changes.map(w => `  • ${w}`),
            ``,
            `━━━ Timeline ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            r.timeline,
            ``,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `"Experimental economics is the ultimate truth.`,
            ` Anyone can write down a theory and just say it is true."`,
            `    — John F. Nash Jr.`,
            ``,
            `Bitcoin is the experiment. It has been running since Jan 3, 2009.`,
            `The data is public. The math is auditable. The result is clear.`,
            ``,
            `SHA256: ${r.hash}`,
          ].join("\n"),
        }],
      };
    },
  );
}
