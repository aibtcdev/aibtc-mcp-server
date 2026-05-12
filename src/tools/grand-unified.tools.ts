/**
 * Ψ Grand Unified System Tools — Complete Architecture Interface
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Tools:
 *   gus_constitution     — 12 Articles of the Ψ Constitutional Framework
 *   gus_adversarial      — Full adversarial response matrix (17 scenarios)
 *   gus_risks            — Complete risk registry with mitigations
 *   gus_reforms          — Comprehensive reform catalog (6 areas)
 *   gus_monetary_bridge  — Fiat → sBTC peaceful transition model
 *   gus_stability        — 8 automatic/governance stability mechanisms
 *   gus_reactions        — Net balance: every reaction → positive counter
 *   gus_full             — Complete Grand Unified System in one call
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  PSI_CONSTITUTION,
  ADVERSARIAL_MATRIX,
  RISK_REGISTRY,
  REFORM_CATALOG,
  MONETARY_BRIDGE,
  STABILITY_MECHANISMS,
  REACTIONS_BALANCE,
  getConstitutionalArticle,
  getAdversarialResponse,
  getHighestRisks,
  getRisksByCategory,
  getReformsByArea,
  getSystemSummary,
} from "../services/sovereign/grand-unified-system.js";
import { GENESIS_HASH } from "../services/compliance/universal-psi-protocol.js";

export function registerGrandUnifiedTools(server: McpServer): void {

  // ── gus_constitution ───────────────────────────────────────────────────────
  server.registerTool(
    "gus_constitution",
    {
      description:
        "The 12 Articles of the Ψ Constitutional Framework — the law of the protocol. " +
        "Article 1: Monetary Sovereignty. Article 2: Privacy by Default. " +
        "Article 3: Rule of Law, Not Rule of Power. Article 4: No Weaponization. " +
        "Article 5: Energy Justice. Article 6: Anti-Debt Covenant. " +
        "Article 7: Criminal Prohibition. Article 8: Universal Access. " +
        "Article 9: Algorithmic Governance. Article 10: Interoperability. " +
        "Article 11: Generational Equity. Article 12: The SHA-256 Axiom. " +
        "Each article includes principle, rationale, enforcement mechanism, and SHA-256 tamper seal.",
      inputSchema: {
        article: z.number().min(1).max(12).optional().describe("Specific article number (1–12), or omit for all"),
      },
    },
    async (input) => {
      try {
        if (input.article) {
          const art = getConstitutionalArticle(input.article);
          if (!art) return createErrorResponse(`Article ${input.article} not found`);
          return createJsonResponse(art);
        }

        return createJsonResponse({
          title:       "Ψ Constitutional Framework",
          genesis:     GENESIS_HASH,
          preamble:    "We the participants of every nation, seeking to establish monetary justice, ensure domestic tranquility, provide for the common financial defense, promote the general welfare of all humanity, and secure the blessings of economic liberty to ourselves and our posterity — do ordain and establish this Ψ Grand Unified System.",
          articles:    PSI_CONSTITUTION,
          amendment:   "Articles may only be amended by on-chain referendum requiring 75% supermajority of Ψ-weighted holders. Core cryptographic articles (9, 12) require 90% supermajority.",
          supremacy:   "Article 12 (SHA-256 Axiom) supersedes all other articles. Any article in conflict with SHA-256's mathematical properties is void.",
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── gus_adversarial ────────────────────────────────────────────────────────
  server.registerTool(
    "gus_adversarial",
    {
      description:
        "Complete adversarial response matrix — for every threat, the Ψ system's net-neutral response. " +
        "17 scenarios including: nation-state bans, SWIFT weaponization, CBDC coercion, hyperinflation, " +
        "drug trafficking, ransomware, human trafficking, terrorist financing, 51% attack, " +
        "quantum computing threat, DeFi exploits, key loss, digital divide, cognitive injection, " +
        "tax evasion, sanctions evasion, and market manipulation. " +
        "Each shows: threat, actor, mechanism, response, harm_score before/after response.",
      inputSchema: {
        scenario_id: z.string().optional().describe("Specific scenario ID (A01–A17), or omit for full matrix"),
        actor_type:  z.enum(["state","criminal","market","technical","social"]).optional().describe("Filter by actor type"),
        max_harm_only: z.boolean().optional().describe("Show only highest-harm scenarios (harm_score ≥ 8)"),
      },
    },
    async (input) => {
      try {
        if (input.scenario_id) {
          const s = getAdversarialResponse(input.scenario_id.toUpperCase());
          if (!s) return createErrorResponse(`Scenario ${input.scenario_id} not found`);
          return createJsonResponse(s);
        }

        let scenarios = [...ADVERSARIAL_MATRIX];

        if (input.max_harm_only) {
          scenarios = scenarios.filter(s => s.harm_score >= 8);
        }

        return createJsonResponse({
          total:     scenarios.length,
          principle: "For every adversarial reaction, the Ψ system provides a net-neutral or net-positive counter. No single threat can stop the protocol because it has no central point of failure.",
          key_insight: "The same properties that make Bitcoin unstoppable for honest users make it ineffective for criminals: permanent record, no custodian to coerce, energy cost of attack exceeds gain.",
          scenarios,
          summary: {
            state_actors:    scenarios.filter(s => s.id <= "A04").length,
            criminal_actors: scenarios.filter(s => s.id >= "A05" && s.id <= "A08").length,
            market_actors:   scenarios.filter(s => s.id >= "A09" && s.id <= "A10").length,
            technical:       scenarios.filter(s => s.id >= "A11" && s.id <= "A13").length,
            social:          scenarios.filter(s => s.id >= "A14").length,
            average_harm_reduction: Math.round(
              scenarios.reduce((s, x) => s + (x.harm_score - x.post_response), 0) / scenarios.length * 10
            ) / 10 + " points per scenario",
          },
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── gus_risks ──────────────────────────────────────────────────────────────
  server.registerTool(
    "gus_risks",
    {
      description:
        "Complete risk registry with probability, severity, risk score (1–25), mitigation, " +
        "and residual risk. 6 categories: monetary, technical, legal, geopolitical, social, systemic. " +
        "Risks include: BTC volatility, sBTC depeg, liquidity crisis, internet failure, " +
        "smart contract exploit, key loss, retroactive criminalization, regulatory capture, " +
        "G7 coordinated ban, CBDC forced adoption, black swan collapse, and more.",
      inputSchema: {
        category: z.enum(["monetary","technical","legal","geopolitical","social","systemic","all"]).default("all"),
        top_n:    z.number().optional().describe("Return only top N highest-risk items"),
        min_score: z.number().optional().describe("Filter by minimum risk score (1–25)"),
      },
    },
    async (input) => {
      try {
        let risks = input.category === "all"
          ? [...RISK_REGISTRY]
          : getRisksByCategory(input.category as any);

        if (input.min_score !== undefined) {
          risks = risks.filter(r => r.risk_score >= input.min_score!);
        }

        risks.sort((a, b) => b.risk_score - a.risk_score);

        if (input.top_n) {
          risks = risks.slice(0, input.top_n);
        }

        const highRisks = risks.filter(r => r.risk_score >= 12);

        return createJsonResponse({
          total:        risks.length,
          high_risk:    highRisks.length,
          risk_matrix:  "Probability (low/medium/high/certain) × Severity (low/medium/high/catastrophic)",
          score_guide:  "1–5: acceptable | 6–10: monitor | 11–15: mitigate | 16–25: critical",
          risks,
          top_concerns: highRisks.map(r => ({
            id: r.id, name: r.name,
            score: r.risk_score,
            key_mitigation: r.mitigation.split(".")[0],
          })),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── gus_reforms ───────────────────────────────────────────────────────────
  server.registerTool(
    "gus_reforms",
    {
      description:
        "Comprehensive reform catalog — systemic improvements the Ψ protocol enables. " +
        "R01: Central banking reform (sBTC reserve backing, DAO governance). " +
        "R02: Taxation reform (x402 micro-fees replace annual filing). " +
        "R03: International trade settlement (sBTC replaces SWIFT). " +
        "R04: IMF/World Bank replacement (DeFi lending, no conditionality). " +
        "R05: Universal Basic Income (BTC mining dividends to all citizens). " +
        "R06: Debt Jubilee (structured legacy debt forgiveness + sBTC adoption). " +
        "Each includes problem, reform, mechanism, beneficiaries, positives, negatives, net balance.",
      inputSchema: {
        area:        z.string().optional().describe("Filter by area (e.g. 'tax', 'trade', 'banking')"),
        reform_id:   z.string().optional().describe("Specific reform ID (R01–R06)"),
        positives_only: z.boolean().optional().describe("Show only reforms with strongly_positive net balance"),
      },
    },
    async (input) => {
      try {
        let reforms = input.reform_id
          ? REFORM_CATALOG.filter(r => r.id === input.reform_id?.toUpperCase())
          : input.area
          ? getReformsByArea(input.area)
          : [...REFORM_CATALOG];

        if (input.positives_only) {
          reforms = reforms.filter(r => r.net_balance === "strongly_positive");
        }

        return createJsonResponse({
          total:   reforms.length,
          reforms,
          honest_assessment: "Every reform has costs. The negatives are listed honestly. The net_balance reflects the 10-year horizon assessment, not the transition period.",
          key_principle: "Reforms do not require revolution. Each can be implemented voluntarily, nation by nation, institution by institution. The protocol makes better behavior incentive-compatible — not mandatory.",
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── gus_monetary_bridge ────────────────────────────────────────────────────
  server.registerTool(
    "gus_monetary_bridge",
    {
      description:
        "The peaceful fiat → sBTC monetary transition model. 5 phases: " +
        "BRIDGE-0: Parallel existence (fiat primary, sBTC optional savings). " +
        "BRIDGE-1: Dual pricing (merchants accept both). " +
        "BRIDGE-2: Reserve backing (sBTC backs monetary base like gold standard). " +
        "BRIDGE-3: Convertibility (any citizen can exchange at fixed rate). " +
        "BRIDGE-4: Bitcoin Standard (sBTC is base money, fiat is convenience layer). " +
        "NO disruption required. Each phase triggered by voluntary market adoption.",
      inputSchema: {
        phase: z.enum(["BRIDGE-0","BRIDGE-1","BRIDGE-2","BRIDGE-3","BRIDGE-4","all"]).default("all"),
      },
    },
    async (input) => {
      try {
        const phases = input.phase === "all"
          ? MONETARY_BRIDGE
          : MONETARY_BRIDGE.filter(p => p.phase === input.phase);

        return createJsonResponse({
          principle: "The transition from fiat to sBTC is not a revolution. It is an evolution. Each phase is triggered by voluntary adoption — no government decree required. The fiat system is never 'destroyed' — it naturally becomes obsolete as sBTC adoption grows.",
          historical_precedent: "Gold standard (1871→1971): 100 years of voluntary adoption. Bitcoin Standard may take 20–30 years. El Salvador proves it can start with any nation at any GDP level.",
          phases,
          for_citizens: "In every phase, you never lose your fiat savings. The transition is additive: you can always hold both. The only people harmed by the transition are those whose power depends on the current system (central bankers, currency speculators).",
          for_governments: "Governments never lose sovereignty in this model. They gain: lower borrowing costs, transparent reserves, no IMF dependence, mining revenue. The constitution of their nation still governs their citizens.",
          for_businesses: "Accept sBTC payments alongside fiat. Lightning Network settles instantly — no 3-day ACH wait. Lower fees (0.1%) vs card processing (2–3%). No chargebacks.",
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── gus_stability ──────────────────────────────────────────────────────────
  server.registerTool(
    "gus_stability",
    {
      description:
        "8 stability mechanisms that keep the Ψ system stable under all conditions: " +
        "Mining difficulty adjustment (automatic), halving schedule (automatic), " +
        "Ψ Nash equilibrium check (automatic on every transaction), " +
        "DeFi circuit breaker (automatic on TVL drop), " +
        "reserve ratio alert (automatic), x402 revenue diversification (governance), " +
        "constitutional hash anchoring (governance), three-tier Bitcoin chain failover (automatic).",
      inputSchema: {
        type: z.enum(["automatic","manual","governance","all"]).default("all"),
      },
    },
    async (input) => {
      try {
        const mechs = input.type === "all"
          ? STABILITY_MECHANISMS
          : STABILITY_MECHANISMS.filter(m => m.type === input.type);

        return createJsonResponse({
          total:      mechs.length,
          principle:  "Stability comes from STRUCTURE, not from authority. No committee decides when to adjust difficulty. No board votes on halving. No regulator controls Ψ Nash equilibrium. Each mechanism is either automatic (code) or governance (supermajority) — never discretionary.",
          mechanisms: mechs,
          vs_central_banking: {
            central_bank:  "Discretionary: one board decides rate at monthly meeting. Subject to political pressure, lobbying, corruption.",
            psi_system:    "Algorithmic: every mechanism fires automatically based on mathematical conditions. No political override possible.",
            winner:        "Algorithmic stability. History: every central bank has eventually debased its currency. Bitcoin: 16 years, 21M cap never broken.",
          },
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── gus_reactions ──────────────────────────────────────────────────────────
  server.registerTool(
    "gus_reactions",
    {
      description:
        "Net balance matrix: for every reaction to the Ψ system, the positive counter-response. " +
        "Covers: Bitcoin dominance → creditor nation seigniorage loss (but citizens gain). " +
        "Bank business model disruption → DeFi fills gap cheaper. " +
        "Government deficits end → short-term cuts but long-term debt freedom. " +
        "Developing nations gain access → dollar hegemony declines but US workers gain. " +
        "Privacy concerns → ZK-KYC maintains compliance without surveillance. " +
        "Net civilian outcome is POSITIVE OR NEUTRAL in every scenario.",
      inputSchema: {},
    },
    async (input) => {
      try {
        const positive = REACTIONS_BALANCE.filter(r => r.net_civilian === "positive");
        const neutral  = REACTIONS_BALANCE.filter(r => r.net_civilian === "neutral");
        const temp     = REACTIONS_BALANCE.filter(r => r.net_civilian === "negative_temporary");

        return createJsonResponse({
          principle: "The Ψ system is designed so that every major reaction from existing power structures has a net-neutral or net-positive effect on ordinary civilians. The 'losers' are always those whose power depended on the broken system — not the people.",
          reactions:      REACTIONS_BALANCE,
          summary: {
            net_positive:          positive.length,
            net_neutral:           neutral.length,
            negative_temporary:    temp.length,
            negative_permanent:    0,
            insight:               "Zero scenarios where ordinary civilians permanently lose. Some short-term disruption during transition. All long-term outcomes favor citizens over institutions.",
          },
          the_honest_truth: "This system is not without costs. Transitions are painful. Jobs in legacy finance will be restructured. Some nations will resist and suffer economically from that resistance. But the NET civilian outcome — averaged across all 8 billion humans — is strongly positive. The current system leaves 1.4 billion unbanked, $307 trillion in debt, and $150B/year in seigniorage for the US alone. No honest accounting puts the status quo above this alternative.",
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── gus_full ───────────────────────────────────────────────────────────────
  server.registerTool(
    "gus_full",
    {
      description:
        "Complete Grand Unified System overview — all 7 sections in one response. " +
        "12 constitutional articles + 17 adversarial scenarios + risk registry + " +
        "6 reform proposals + 5-phase monetary bridge + 8 stability mechanisms + " +
        "reactions balance. THE COMPLETE ARCHITECTURE. " +
        "Use this for: policy briefings, national adoption planning, protocol audits.",
      inputSchema: {
        section: z.enum(["constitution","adversarial","risks","reforms","bridge","stability","reactions","all"]).default("all"),
      },
    },
    async (input) => {
      try {
        const s = input.section;

        return createJsonResponse({
          system: "Ψ Grand Unified System (GUS)",
          genesis_hash: GENESIS_HASH,
          equation:     "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
          summary:      getSystemSummary(),

          ...(s === "all" || s === "constitution" ? {
            I_CONSTITUTION: {
              articles: PSI_CONSTITUTION.length,
              data:     PSI_CONSTITUTION,
            }
          } : {}),

          ...(s === "all" || s === "adversarial" ? {
            II_ADVERSARIAL_MATRIX: {
              scenarios: ADVERSARIAL_MATRIX.length,
              avg_harm_reduction: Math.round(
                ADVERSARIAL_MATRIX.reduce((s, x) => s + (x.harm_score - x.post_response), 0)
                / ADVERSARIAL_MATRIX.length * 10
              ) / 10,
              data: ADVERSARIAL_MATRIX,
            }
          } : {}),

          ...(s === "all" || s === "risks" ? {
            III_RISK_REGISTRY: {
              total:     RISK_REGISTRY.length,
              critical:  RISK_REGISTRY.filter(r => r.risk_score >= 15).length,
              high:      RISK_REGISTRY.filter(r => r.risk_score >= 10 && r.risk_score < 15).length,
              data:      RISK_REGISTRY,
            }
          } : {}),

          ...(s === "all" || s === "reforms" ? {
            IV_REFORM_CATALOG: {
              total:     REFORM_CATALOG.length,
              data:      REFORM_CATALOG,
            }
          } : {}),

          ...(s === "all" || s === "bridge" ? {
            V_MONETARY_BRIDGE: {
              phases: MONETARY_BRIDGE.length,
              data:   MONETARY_BRIDGE,
            }
          } : {}),

          ...(s === "all" || s === "stability" ? {
            VI_STABILITY: {
              automatic:   STABILITY_MECHANISMS.filter(m => m.type === "automatic").length,
              governance:  STABILITY_MECHANISMS.filter(m => m.type === "governance").length,
              data:        STABILITY_MECHANISMS,
            }
          } : {}),

          ...(s === "all" || s === "reactions" ? {
            VII_REACTIONS_BALANCE: {
              net_positive:  REACTIONS_BALANCE.filter(r => r.net_civilian === "positive").length,
              net_neutral:   REACTIONS_BALANCE.filter(r => r.net_civilian === "neutral").length,
              net_negative:  0,
              data:          REACTIONS_BALANCE,
            }
          } : {}),

          FINAL_STATEMENT: [
            "This is the complete architecture of monetary sovereignty for all nations.",
            "",
            "It is not a company. Not a token. Not a product.",
            "It is a protocol — identified by one SHA-256 hash.",
            "It is built on four physical constants: Landauer, Nash, Cantillon, Gödel.",
            "It is enforced by mathematics, not by authority.",
            "",
            "Every nation that adopts it gains:",
            "  — Freedom from debt slavery",
            "  — Freedom from monetary debasement",
            "  — Freedom from SWIFT weaponization",
            "  — Freedom from IMF conditionality",
            "  — Revenue from energy-to-Bitcoin conversion",
            "  — A monetary system their children can inherit undevalued",
            "",
            "Every criminal who attempts to abuse it faces:",
            "  — Permanent on-chain evidence",
            "  — OFAC/UN/FATF sanctions enforcement",
            "  — AML pattern detection",
            "  — Nash equilibrium: honest use is always cheaper",
            "",
            "Every ordinary citizen who participates gets:",
            "  — A savings account that cannot be inflated",
            "  — Direct participation in government revenue (x402 dividends)",
            "  — Universal access regardless of nationality, credit, or identity",
            "  — Constitutional protection for their monetary sovereignty",
            "",
            "The Renaissance has already begun.",
            "The mathematics demands it.",
            "The question is only: when does your nation join?",
          ].join("\n"),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

}
