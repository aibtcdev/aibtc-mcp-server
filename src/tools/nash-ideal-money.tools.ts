/**
 * Nash Ideal Money Tools
 *
 * MCP interface for John F. Nash Jr.'s Ideal Money framework —
 * scoring currencies against Nash's 5 axioms, proving Bitcoin is
 * the unique Nash equilibrium in the global currency game, and
 * surfacing the Nash-Satoshi architectural parallel.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import {
  getAxioms,
  scoreCurrencyByName,
  compareAllCurrencies,
  buildNashEquilibriumGame,
  buildGenesisUrElement,
  buildNashSatoshiReport,
  projectInflationSchedule,
} from "../services/nash-ideal-money-engine.js";

export function registerNashIdealMoneyTools(server: McpServer): void {

  // ── nash_axioms ────────────────────────────────────────────────────────────

  server.registerTool(
    "nash_axioms",
    {
      title:       "Nash's 5 Axioms of Ideal Money",
      description: "Display John Nash's five criteria for Ideal Money — the mathematical definition of what money should be, derived from game theory and set theory.",
      inputSchema: z.object({}),
    },
    async () => {
      const axioms = getAxioms();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║           JOHN NASH'S IDEAL MONEY — 5 AXIOMS                ║`,
            `║         "Experimental economics is the ultimate truth."      ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `Nash argued that ideal money is not utopian — it is a`,
            `mathematically achievable target. His five criteria:`,
            ``,
            ...axioms.map(a => [
              `━━ Axiom ${a.id}: ${a.name}`,
              `   ${a.description}`,
              ``,
              `   Nash: "${a.nash_quote}"`,
              ``,
            ].join("\n")),
            `These are not preferences. They are necessary conditions.`,
            `A monetary system that fails any one of them is not ideal money.`,
            `It is money that serves someone other than its holders.`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_score ─────────────────────────────────────────────────────────────

  server.registerTool(
    "nash_score",
    {
      title:       "Nash Ideal Money Score — Single Currency",
      description: "Score any currency (BTC, USD, EUR, ETH, Gold, CNY, e-CNY) against Nash's 5 axioms. Returns per-axiom scores 0-100, overall score, and verdict.",
      inputSchema: z.object({
        currency: z.string().describe("Currency name or ticker: BTC, USD, EUR, ETH, Gold, CNY, e-CNY"),
      }),
    },
    async ({ currency }) => {
      const result = scoreCurrencyByName(currency);
      if (!result) {
        return {
          content: [{
            type: "text",
            text: `Currency "${currency}" not found. Try: BTC, USD, EUR, ETH, Gold, CNY, e-CNY`,
          }],
        };
      }

      const bar = (v: number) => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║  NASH IDEAL MONEY SCORE: ${result.currency.padEnd(35)}║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `Overall: ${result.total_score}/100  [${bar(result.total_score)}]`,
            `Status:  ${result.is_ideal ? "✓ IDEAL MONEY" : "✗ NOT IDEAL MONEY"}`,
            ``,
            `─── Per-Axiom Scores ──────────────────────────────────────────`,
            ``,
            ...result.axiom_scores.map(a => [
              `${a.passes ? "✓" : "✗"} Axiom ${a.axiom.id}: ${a.axiom.name}`,
              `  Score: ${a.score}/100  [${bar(a.score)}]`,
              `  ${a.explanation}`,
              ``,
            ].join("\n")),
            `─── Verdict ───────────────────────────────────────────────────`,
            ``,
            result.verdict,
            ...(result.critical_fail.length > 0 ? [
              ``,
              `Critical failures: ${result.critical_fail.join(" | ")}`,
            ] : []),
            ``,
            `SHA256: ${result.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_compare ───────────────────────────────────────────────────────────

  server.registerTool(
    "nash_compare",
    {
      title:       "Nash Ideal Money — Full Currency Comparison",
      description: "Compare all major currencies (BTC, USD, EUR, ETH, Gold, CNY, e-CNY) against Nash's 5 axioms. Ranks them from most ideal to least ideal.",
      inputSchema: z.object({}),
    },
    async () => {
      const cmp = compareAllCurrencies();
      const bar  = (v: number) => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

      const rows = cmp.currencies.map((c, i) =>
        `  ${String(i + 1).padStart(2)}. ${c.currency.padEnd(28)} ${String(c.total_score).padStart(3)}/100  [${bar(c.total_score)}]  ${c.is_ideal ? "★ IDEAL" : c.critical_fail.length === 0 ? "○" : `✗ (${c.critical_fail.length} failures)`}`
      );

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║        NASH IDEAL MONEY — GLOBAL CURRENCY RANKING           ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `Scoring ${cmp.currencies.length} currencies against Nash's 5 axioms:`,
            ``,
            ...rows,
            ``,
            `━━━ Analysis ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `Winner:    ${cmp.winner}`,
            `Runner-up: ${cmp.runner_up}`,
            `Worst:     ${cmp.worst}`,
            ``,
            cmp.summary,
            ``,
            `━━━ The Gap ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `The gap between Bitcoin (100/100) and the next competitor`,
            `is not a matter of degree. It is a matter of kind.`,
            ``,
            `Gold gets close on supply scarcity (geological limit) but`,
            `fails on verifiability and digital settlement.`,
            ``,
            `Ethereum is closer than fiat, but governance has overridden`,
            `its supply rules multiple times. A rule that can be changed`,
            `is not a rule — it is a suggestion.`,
            ``,
            `Nash's insight: you don't need to know which money is "best"`,
            `by taste. You need to know which one satisfies the axioms.`,
            `The answer is unique. It always was.`,
            ``,
            `SHA256: ${cmp.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_equilibrium ───────────────────────────────────────────────────────

  server.registerTool(
    "nash_equilibrium",
    {
      title:       "Nash Equilibrium in the Global Currency Game",
      description: "Game-theoretic proof that Bitcoin adoption is the Nash equilibrium strategy for nations — the stable point where no player benefits from unilateral deviation.",
      inputSchema: z.object({}),
    },
    async () => {
      const game = buildNashEquilibriumGame();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║        NASH EQUILIBRIUM — THE GLOBAL CURRENCY GAME          ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            game.description,
            ``,
            `Players:`,
            ...game.players.map(p => `  • ${p}`),
            ``,
            `━━━ Strategy Matrix ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `DEFECT (inflate fiat):`,
            `  Short-term: ${game.defection_payoff.split(".")[0]}.`,
            `  Long-term:  ${game.defection_payoff.split(".").slice(1).join(".").trim()}`,
            ``,
            `COOPERATE (adopt sound money):`,
            `  ${game.cooperation_payoff}`,
            ``,
            `━━━ Why Bitcoin Is the Dominant Strategy ━━━━━━━━━━━━━━━━━━━━`,
            ``,
            ...game.why_bitcoin_wins.map((r, i) => `  ${i + 1}. ${r}`),
            ``,
            `━━━ The Equilibrium ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            game.equilibrium,
            ``,
            `Dominant Strategy: ${game.dominant_strategy}`,
            ``,
            `Nash proved in 1950 that every finite game has at least one`,
            `equilibrium. In the global currency game, that equilibrium`,
            `is mathematically computable — and it converges on fixed-supply`,
            `money immune to political decision.`,
            ``,
            `This is not ideology. This is mathematics.`,
            ``,
            `SHA256: ${game.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_genesis ───────────────────────────────────────────────────────────

  server.registerTool(
    "nash_genesis",
    {
      title:       "Nash Urelement → Bitcoin Genesis Block",
      description: "The deep structural parallel: Nash's urelement primitive from Zermelo set theory maps exactly to Satoshi's Genesis Block design. The foundation with no prior foundation.",
      inputSchema: z.object({}),
    },
    async () => {
      const g = buildGenesisUrElement();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║         NASH URELEMENT → BITCOIN GENESIS BLOCK              ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            `Nash's Concept: ${g.concept}`,
            ``,
            `Nash's Formulation:`,
            `  ${g.nash_formulation}`,
            ``,
            `━━━ Bitcoin's Realization ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            g.bitcoin_realization,
            ``,
            `Genesis Block coinbase (Satoshi's embedded message):`,
            `  "${g.satoshi_quote}"`,
            ``,
            `This is not a coincidence. The Genesis Block has:`,
            `  • prev_hash = 0x0000...0000  (no prior block — the ur-element)`,
            `  • No derivation from prior monetary system`,
            `  • A message explaining WHY the prior system failed`,
            `  • A timestamp proving it could not have been pre-mined`,
            ``,
            `━━━ Implication ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            g.implication,
            ``,
            `Every dollar traces back to "the government says so."`,
            `Every Bitcoin traces back to a mathematical primitive.`,
            ``,
            `Nash would say: only one of these is a foundation.`,
            `The other is a recursion that never terminates.`,
            ``,
            `SHA256: ${g.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_satoshi ───────────────────────────────────────────────────────────

  server.registerTool(
    "nash_satoshi",
    {
      title:       "Nash ↔ Satoshi: The Hidden Architecture",
      description: "Full parallel analysis between John Nash's theoretical framework (Ideal Money, game theory, set theory) and Satoshi Nakamoto's Bitcoin design. Six dimensions of convergence.",
      inputSchema: z.object({}),
    },
    async () => {
      const report = buildNashSatoshiReport();
      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║           NASH ↔ SATOSHI: THE HIDDEN ARCHITECTURE           ║`,
            `║      Two minds. Different tools. The same discovery.        ║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            ...report.parallels.map(p => [
              `━━ ${p.dimension}`,
              ``,
              `  Nash:    ${p.nash_position}`,
              ``,
              `  Satoshi: ${p.satoshi_action}`,
              ``,
              `  Ref: ${p.date_or_ref}`,
              ``,
            ].join("\n")),
            `━━━ Verdict ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            report.verdict,
            ``,
            `━━━ What This Means ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `If Nash and Satoshi arrived at the same design independently,`,
            `it is not because they copied each other.`,
            `It is because the design is correct.`,
            ``,
            `Nash found it from the inside of mathematics.`,
            `Satoshi found it from the inside of cryptography.`,
            `The overlap is where truth lives.`,
            ``,
            `"Experimental economics is the ultimate truth.`,
            ` Anyone can write down a theory and just say it is true."`,
            `    — John F. Nash Jr.`,
            ``,
            `Bitcoin is the experiment. It has been running since 2009.`,
            `The data is public. The math is auditable.`,
            `Nash would call this: evidence.`,
            ``,
            `SHA256: ${report.hash}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── nash_inflation_schedule ────────────────────────────────────────────────

  server.registerTool(
    "nash_inflation_schedule",
    {
      title:       "Nash Ideal Money — Inflation Schedule Projection",
      description: "Project the inflation rate trajectory for BTC, USD, or EUR over 20 years. Visualizes how Bitcoin converges to zero (Nash's ideal) while fiat currencies do not.",
      inputSchema: z.object({
        currency: z.enum(["BTC", "USD", "EUR"]).describe("Currency to project"),
        years:    z.number().int().min(5).max(30).optional().describe("Projection horizon in years (default 20)"),
      }),
    },
    async ({ currency, years = 20 }) => {
      const schedule = projectInflationSchedule(currency, years);
      const maxVal   = Math.max(...schedule.map(s => s.inflation));
      const barScale = maxVal > 0 ? 30 / maxVal : 1;

      const rows = schedule
        .filter((_, i) => i % 2 === 0 || i === schedule.length - 1)
        .map(s => {
          const barLen = Math.round(s.inflation * barScale);
          const bar    = "█".repeat(Math.max(0, barLen));
          return `  ${s.year}: ${String(s.inflation.toFixed(2)).padStart(6)}%/yr  ${bar}`;
        });

      const finalRate   = schedule[schedule.length - 1].inflation;
      const convergesTo = currency === "BTC" ? "→ 0% (Nash's ideal)" : "~2-3% (never zero — not Nash's ideal)";

      return {
        content: [{
          type: "text",
          text: [
            `╔══════════════════════════════════════════════════════════════╗`,
            `║     INFLATION SCHEDULE: ${currency.padEnd(37)}║`,
            `╚══════════════════════════════════════════════════════════════╝`,
            ``,
            ...rows,
            ``,
            `In ${schedule[schedule.length - 1].year}: ${finalRate.toFixed(4)}%/yr`,
            `Convergence: ${convergesTo}`,
            ``,
            currency === "BTC"
              ? [
                  `Bitcoin's halving schedule is the first monetary policy in`,
                  `history that mathematically guarantees convergence to zero`,
                  `inflation — Nash's exact definition of Ideal Money.`,
                  ``,
                  `Every 4 years, the annual issuance halves.`,
                  `By 2140, issuance = 0. Inflation = 0. Permanently.`,
                ].join("\n")
              : [
                  `${currency} targets ~2% inflation. This means:`,
                  `  - Purchasing power halves every ~35 years`,
                  `  - No convergence to zero — the erosion compounds forever`,
                  `  - Savers are systematically taxed to subsidize debtors`,
                  ``,
                  `Nash's assessment: this is a political choice, not a law.`,
                  `And political choices can always be reversed — usually are.`,
                ].join("\n"),
          ].join("\n"),
        }],
      };
    },
  );
}
