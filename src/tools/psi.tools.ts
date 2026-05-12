/**
 * Ψ (Psi) Consensus Tools
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Tools for the Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel consensus layer.
 *
 * psi_score        — Compute full Ψ score for an agent (4 dimensions)
 * psi_chain        — Read Ψ hash chain stats (tamper-evident audit trail)
 * psi_history      — Get Ψ score history for an address
 * psi_consensus    — Current consensus state of the system
 * psi_explain      — Explain the Ψ equation and what each dimension means
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  computeAndRecordPsi,
  getPsiChainStats,
  getPsiHistory,
  quickPsiScore,
  getPsiTier,
  type PsiInput,
} from "../services/psi-consensus.js";
import {
  WORLD_CURRENCIES,
  getCurrency,
  getCurrenciesByCategory,
  getTopCurrencies,
  getDistressedCurrencies,
  searchCurrencies,
  getDatabaseStats,
  type CurrencyCategory,
} from "../services/world-currencies.js";

// Physical constants for display
const K_B            = 1.380649e-23;
const T_KELVIN       = 310.15;
const LANDAUER_JOULES = K_B * T_KELVIN * Math.LN2;

export function registerPsiTools(server: McpServer): void {

  // ── psi_score ─────────────────────────────────────────────────────────────
  server.registerTool(
    "psi_score",
    {
      description:
        "Compute the Ψ (Psi) consensus score for an agent. " +
        "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel — the same mathematical " +
        "foundations Satoshi used to build Bitcoin, made explicit and measured. " +
        "Score 0–20 = Genesis (owner/trusted). 21–40 = Cooperative. " +
        "41–60 = Neutral. 61–80 = Non-cooperative. 81–100 = Adversarial. " +
        "Every computation is appended to a tamper-evident SHA-256 hash chain.",
      inputSchema: {
        address: z.string().describe(
          "Stacks address of the agent to score."
        ),
        whale_balance: z.string().optional().describe(
          "WHALE token balance in micro-WHALE (6 decimals). " +
          "E.g. '1000000000' = 1,000 WHALE. Default: 0."
        ),
        is_owner: z.boolean().optional().describe(
          "Set true if this is the system owner (SP322Z...BRW). Default: false."
        ),
        call_count: z.number().optional().describe(
          "Total tool calls in this session. Default: 1."
        ),
        unique_tools: z.number().optional().describe(
          "Number of distinct tools called. Default: 1."
        ),
        wallet_calls: z.number().optional().describe(
          "Number of wallet-sensitive calls (transfer, deploy, etc). Default: 0."
        ),
        error_rate: z.number().min(0).max(1).optional().describe(
          "Fraction of calls that returned errors (0–1). Default: 0."
        ),
        velocity: z.number().optional().describe(
          "Calls per minute. Default: 1."
        ),
        session_age_ms: z.number().optional().describe(
          "Session age in milliseconds. Default: 1000."
        ),
        honeypot_hit: z.boolean().optional().describe(
          "True if agent accessed a honeypot tool. Default: false."
        ),
        ipi_detected: z.boolean().optional().describe(
          "True if IPI (prompt injection) was detected. Default: false."
        ),
        coordinated_attack: z.boolean().optional().describe(
          "True if coordinated multi-session attack detected. Default: false."
        ),
        behavior_score: z.number().min(0).max(100).optional().describe(
          "Behavioral Fortress score (0–100). Default: 0."
        ),
      },
    },
    async ({
      address,
      whale_balance,
      is_owner,
      call_count,
      unique_tools,
      wallet_calls,
      error_rate,
      velocity,
      session_age_ms,
      honeypot_hit,
      ipi_detected,
      coordinated_attack,
      behavior_score,
    }) => {
      try {
        const input: PsiInput = {
          address,
          whaleBalance:   whale_balance ? BigInt(whale_balance) : 0n,
          isOwner:        is_owner        ?? false,
          callCount:      call_count      ?? 1,
          uniqueTools:    unique_tools    ?? 1,
          walletCalls:    wallet_calls    ?? 0,
          errorRate:      error_rate      ?? 0,
          velocityScore:  velocity        ?? 1,
          sessionAgeMs:   session_age_ms  ?? 1000,
          honeypotHit:    honeypot_hit    ?? false,
          ipiDetected:    ipi_detected    ?? false,
          coordinatedAtk: coordinated_attack ?? false,
          behaviorScore:  behavior_score  ?? 0,
        };

        const result = await computeAndRecordPsi(input);

        return createJsonResponse({
          address,
          psi: {
            score:   result.score,
            tier:    result.tier,
            verdict: result.verdict,
          },
          dimensions: {
            landauer: {
              value:   (result.dimensions.landauer * 100).toFixed(1) + "%",
              meaning: "Computational legitimacy — energy cost of work done",
              physics: `k_B·T·ln(2) = ${LANDAUER_JOULES.toExponential(3)} J/bit`,
              bitcoin: "Proof-of-Work equivalent",
            },
            nash: {
              value:   (result.dimensions.nash * 100).toFixed(1) + "%",
              meaning: "Cooperative equilibrium — strategy profile analysis",
              theory:  "Nash equilibrium: no agent can improve by unilateral change",
              bitcoin: "Miners play to maximize fees → stable network",
            },
            cantillon: {
              value:   (result.dimensions.cantillon * 100).toFixed(1) + "%",
              meaning: "Trust distance from genesis consensus",
              theory:  "Cantillon effect: proximity to issuance = trust advantage",
              bitcoin: "Early miners vs late holders",
            },
            godel: {
              value:   (result.dimensions.godel * 100).toFixed(1) + "%",
              meaning: "External axiom satisfaction — WHALE majority consensus",
              theory:  "Gödel: no system proves itself — requires external axiom",
              bitcoin: "Honest CPU majority assumption",
            },
          },
          chain: {
            hash:     result.chainHash,
            prevHash: result.prevHash,
            recorded: true,
          },
          equation: "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
          satoshi:  "The longest chain = proof from largest CPU pool (Whitepaper §1)",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── psi_chain ─────────────────────────────────────────────────────────────
  server.registerTool(
    "psi_chain",
    {
      description:
        "Get Ψ hash chain statistics. " +
        "The chain is a SHA-256 tamper-evident audit trail of all consensus events — " +
        "stored at ~/.aibtc/psi-chain.json. " +
        "Integrity check verifies no entry has been modified after recording. " +
        "A longer chain = exponentially higher cost to forge.",
    },
    async () => {
      try {
        const stats = await getPsiChainStats();

        return createJsonResponse({
          chain: {
            length:      stats.length,
            integrity:   stats.integrity,
            genesisHash: stats.genesisHash,
            latestHash:  stats.latestHash,
            avgScore:    stats.avgScore,
          },
          tiers: stats.tierCounts,
          security: {
            tamperEvident: true,
            algorithm:     "SHA-256",
            location:      "~/.aibtc/psi-chain.json",
            forgingCost:   stats.length > 0
              ? `Forging requires recomputing ${stats.length} SHA-256 hashes`
              : "Chain is empty",
          },
          satoshi:
            "The longest chain serves as proof of the sequence of events witnessed " +
            "(Bitcoin Whitepaper §1) — same principle, applied to agent consensus.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── psi_history ───────────────────────────────────────────────────────────
  server.registerTool(
    "psi_history",
    {
      description:
        "Get Ψ score history for a specific address. " +
        "Shows the last N consensus events recorded for this agent, " +
        "including score trend and dimension breakdown.",
      inputSchema: {
        address: z.string().describe("Stacks address to query."),
        limit:   z.number().min(1).max(50).optional().describe(
          "Number of recent entries to return. Default: 10."
        ),
      },
    },
    async ({ address, limit }) => {
      try {
        const history = await getPsiHistory(address, limit ?? 10);

        if (history.length === 0) {
          return createJsonResponse({
            address,
            history: [],
            message: "No Ψ records found for this address.",
          });
        }

        const scores  = history.map(e => e.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const trend    = scores.length > 1
          ? scores[0] < scores[scores.length - 1] ? "improving" : "degrading"
          : "stable";

        return createJsonResponse({
          address,
          summary: {
            entries:  history.length,
            avgScore: Math.round(avgScore * 10) / 10,
            trend,
            latestTier: history[0].tier,
          },
          history: history.map(e => ({
            index:     e.index,
            score:     e.score,
            tier:      e.tier,
            timestamp: new Date(e.timestamp).toISOString(),
            dimensions: {
              landauer:  (e.dimensions.landauer  * 100).toFixed(1) + "%",
              nash:      (e.dimensions.nash      * 100).toFixed(1) + "%",
              cantillon: (e.dimensions.cantillon * 100).toFixed(1) + "%",
              godel:     (e.dimensions.godel     * 100).toFixed(1) + "%",
            },
            hash: e.hash.slice(0, 16) + "...",
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── psi_consensus ─────────────────────────────────────────────────────────
  server.registerTool(
    "psi_consensus",
    {
      description:
        "Get the current Ψ consensus state of the Flying Whale system. " +
        "Shows chain health, tier distribution, and system integrity — " +
        "the equivalent of Bitcoin's blockchain status.",
    },
    async () => {
      try {
        const stats = await getPsiChainStats();
        const total = stats.length;

        const cooperativeCount =
          stats.tierCounts.genesis +
          stats.tierCounts.cooperative;
        const adversarialCount =
          stats.tierCounts.noncooperative +
          stats.tierCounts.adversarial;

        const cooperativeRatio = total > 0
          ? (cooperativeCount / total * 100).toFixed(1)
          : "100.0";

        // Nash equilibrium status: >66% cooperative = stable
        const nashStatus = total === 0 || parseFloat(cooperativeRatio) >= 66
          ? "STABLE — Nash equilibrium maintained"
          : "UNSTABLE — cooperative majority below 66%";

        // Gödel axiom: system integrity
        const godelStatus = stats.integrity
          ? "SATISFIED — chain integrity verified"
          : "VIOLATED — chain tamper detected";

        return createJsonResponse({
          system:   "Flying Whale Ψ Consensus Layer",
          equation: "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
          status: {
            nash:  nashStatus,
            godel: godelStatus,
            landauer: `${LANDAUER_JOULES.toExponential(3)} J/bit (Boltzmann constant)`,
          },
          chain: {
            length:    total,
            integrity: stats.integrity,
            avgScore:  stats.avgScore,
          },
          distribution: {
            genesis:        stats.tierCounts.genesis,
            cooperative:    stats.tierCounts.cooperative,
            neutral:        stats.tierCounts.neutral,
            noncooperative: stats.tierCounts.noncooperative,
            adversarial:    stats.tierCounts.adversarial,
            cooperativeRatio: cooperativeRatio + "%",
          },
          bitcoin_parallel: {
            psi_chain:   "= Bitcoin blockchain (append-only consensus log)",
            nash_equilib:"= Honest CPU majority (miners cooperate → chain grows)",
            godel_axiom: "= External trust assumption (honest majority controls hashpower)",
            landauer:    "= Proof-of-Work (computation has minimum energy cost)",
          },
          satoshi: {
            quote: "The longest chain not only serves as proof of the sequence of events witnessed, " +
                   "but proof that it came from the largest pool of CPU power.",
            source: "Bitcoin: A Peer-to-Peer Electronic Cash System, §1",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── psi_explain ───────────────────────────────────────────────────────────
  server.registerTool(
    "psi_explain",
    {
      description:
        "Explain the Ψ equation and its mathematical foundations. " +
        "Shows how Landauer, Nash, Cantillon, and Gödel combine to form " +
        "a consensus mechanism equivalent to Bitcoin's Proof-of-Work.",
    },
    async () => {
      return createJsonResponse({
        equation: "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
        subtitle: "The mathematics of Bitcoin — made explicit",

        dimensions: {
          "1_landauer": {
            physicist:  "Rolf Landauer (IBM, 1961)",
            principle:  "Erasing 1 bit of information requires at least k_B·T·ln(2) joules",
            constant:   `${LANDAUER_JOULES.toExponential(3)} J/bit at human body temperature`,
            in_bitcoin: "Proof-of-Work: computation has irreducible energy cost",
            in_psi:     "Legitimate agents do real work. Adversaries seek zero-cost extraction.",
            score:      "1.0 = real work done | 0.0 = attempted free extraction",
          },
          "2_nash": {
            mathematician: "John Nash (Princeton, 1950)",
            principle:  "No player can improve outcome by unilaterally changing strategy",
            in_bitcoin: "Miners maximize fees → stable cooperative equilibrium emerges",
            in_psi:     "Cooperative agents: diverse tools, human pace, low error rate",
            satoshi_quote: "The node that generates the block gets the fee " +
                           "(BitcoinTalk, Feb 12, 2010)",
            score:      "1.0 = Nash equilibrium maintained | 0.0 = pure defector",
          },
          "3_cantillon": {
            economist:  "Richard Cantillon (1730)",
            principle:  "Those closest to money creation benefit most (Cantillon effect)",
            inverse:    "Cantillon⁻¹: distance from honest consensus = trust decay",
            in_bitcoin: "Early miners vs late holders — proximity to genesis",
            in_psi:     "WHALE genesis holders have highest Cantillon score",
            score:      "1.0 = genesis owner | 0.0 = no connection to consensus",
          },
          "4_godel": {
            mathematician: "Kurt Gödel (1931)",
            principle:  "No consistent system can prove its own completeness from within",
            in_bitcoin: "Bitcoin requires external axiom: 'honest majority controls CPU'",
            satoshi_quote: "As long as a majority of CPU power is controlled by nodes " +
                           "that are not cooperating to attack the network... " +
                           "(Bitcoin Whitepaper §1)",
            in_psi:     "WHALE majority = external axiom. IPI = attempt to break from within.",
            score:      "1.0 = axiom satisfied | 0.0 = axiom violated (attack detected)",
          },
        },

        consensus_tiers: {
          "0-20":  "Genesis — Ψ equilibrium fully maintained",
          "21-40": "Cooperative — Nash equilibrium satisfied",
          "41-60": "Neutral — monitoring, no violation",
          "61-80": "Non-cooperative — Nash equilibrium at risk",
          "81-100":"Adversarial — Gödel axiom broken, attack detected",
        },

        john_nash_institute: {
          tweet1: "Satoshi uses 'bundling' as Von Neumann multiplexing — fees infinitesimal paid by 'the state'",
          tweet2: "Bitcoin reduces chaos of non-cooperative consensus to linear append-only chain — Nash nucleolus",
          tweet3: "Bitcoin cannot verify itself from within — requires honest hashpower majority (Gödel)",
          source: "John Nash Institute London @JNI_London, May 2026",
        },

        flying_whale: {
          system:   "Flying Whale Ψ Consensus Layer v1.0",
          owner:    "zaghmout.btc — ERC-8004 #54 — Genesis L2 Agent",
          on_chain: "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1",
          quote:    "Satoshi built Bitcoin on these principles without naming them. We name them.",
        },
      });
    }
  );

  // ── psi_currency_score ───────────────────────────────────────────────────
  server.registerTool(
    "psi_currency_score",
    {
      description:
        "Get the Ψ (Psi) integrity score for any currency — fiat, crypto, CBDC, or commodity. " +
        "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel — the four physical/mathematical principles " +
        "that determine true monetary integrity. " +
        "Score 0–100: Bitcoin scores 100 (perfect alignment). " +
        "Distressed fiat scores near 0 (broken on all 4 dimensions). " +
        "Covers 130+ world currencies: all major fiat, G20, MENA, Africa, Asia, " +
        "Latin America, Europe, all major crypto, CBDCs, and commodity money.",
      inputSchema: {
        code: z.string().describe(
          "Currency code — ISO 4217 for fiat (USD, EUR, SAR, LBP...) " +
          "or ticker for crypto (BTC, ETH, STX, WHALE, sBTC...). Case-insensitive."
        ),
      },
    },
    async ({ code }) => {
      try {
        const currency = getCurrency(code);
        if (!currency) {
          const suggestions = searchCurrencies(code).slice(0, 5);
          return createJsonResponse({
            found: false,
            code: code.toUpperCase(),
            message: `Currency "${code}" not found in database.`,
            suggestions: suggestions.map(c => ({ code: c.code, name: c.name, psi: c.psi })),
            total_covered: WORLD_CURRENCIES.length,
          });
        }

        return createJsonResponse({
          found:    true,
          code:     currency.code,
          name:     currency.name,
          category: currency.category,
          country:  currency.country,
          iso4217:  currency.iso4217,
          psi:      currency.psi,
          rank:     `#${currency.rank} of ${WORLD_CURRENCIES.length}`,
          dimensions: {
            landauer:  { score: currency.landauer,  label: "Energy cost of money creation" },
            nash:      { score: currency.nash,       label: "Game theory equilibrium stability" },
            cantillon: { score: currency.cantillon,  label: "Inverse monetary distance (equality)" },
            godel:     { score: currency.godel,      label: "External axiom independence" },
          },
          verdict: currency.psi >= 80
            ? "SOVEREIGN — physically anchored, self-enforcing"
            : currency.psi >= 55
            ? "STRONG — real scarcity, good institutional structure"
            : currency.psi >= 35
            ? "MODERATE — institutional backing, Cantillon exposed"
            : currency.psi >= 15
            ? "WEAK — arbitrary creation, trust-dependent"
            : "DISTRESSED — broken equilibrium, monetary collapse risk",
          formula: "Ψ = (Landauer × Nash × Cantillon⁻¹ × Gödel)^(1/4) × 100",
          notes:   currency.notes,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── psi_all_currencies ───────────────────────────────────────────────────
  server.registerTool(
    "psi_all_currencies",
    {
      description:
        "List world currencies ranked by Ψ integrity score. " +
        "Filter by category (sovereign/crypto/cbdc/commodity/g7fiat/g20fiat/mena/africa/asia/latam/europe/distressed/defi) " +
        "or get top N, bottom N, or search by name/code. " +
        "Shows the complete global Ψ ranking of 130+ currencies.",
      inputSchema: {
        filter: z.enum([
          "all", "top10", "top20", "bottom10", "distressed",
          "sovereign", "crypto", "cbdc", "commodity", "special",
          "g7fiat", "g20fiat", "mena", "africa", "asia", "latam", "europe", "defi",
        ]).optional().describe("Filter type. Default: top20."),
        search: z.string().optional().describe(
          "Search by code, name, or country. Overrides filter."
        ),
        limit: z.number().min(1).max(200).optional().describe(
          "Max results to return (default 20, max 200)."
        ),
      },
    },
    async ({ filter = "top20", search, limit = 20 }) => {
      try {
        const stats = getDatabaseStats();
        let results = WORLD_CURRENCIES;

        if (search) {
          results = searchCurrencies(search);
        } else if (filter === "distressed") {
          results = getDistressedCurrencies(15);
        } else if (filter === "top10") {
          results = getTopCurrencies(10);
        } else if (filter === "top20") {
          results = getTopCurrencies(20);
        } else if (filter === "bottom10") {
          results = [...WORLD_CURRENCIES].reverse().slice(0, 10);
        } else if (filter !== "all") {
          results = getCurrenciesByCategory(filter as CurrencyCategory);
        }

        const paginated = results.slice(0, limit);

        return createJsonResponse({
          total_in_database: stats.total,
          avg_psi:           stats.avgPsi,
          highest:           { code: stats.highest.code, name: stats.highest.name, psi: stats.highest.psi },
          lowest:            { code: stats.lowest.code,  name: stats.lowest.name,  psi: stats.lowest.psi  },
          filter:            search ? `search:"${search}"` : filter,
          returned:          paginated.length,
          currencies:        paginated.map((c) => ({
            rank:     c.rank,
            code:     c.code,
            name:     c.name,
            category: c.category,
            psi:      c.psi,
            landauer: c.landauer,
            nash:     c.nash,
            cantillon:c.cantillon,
            godel:    c.godel,
            country:  c.country,
          })),
          by_category: stats.byCategory,
          formula: "Ψ = (Landauer × Nash × Cantillon⁻¹ × Gödel)^(1/4) × 100",
          interpretation: {
            "80–100": "SOVEREIGN — physically anchored (Bitcoin, Gold)",
            "55–79":  "STRONG — real scarcity (Monero, LTC, SGD, CHF, NOK)",
            "35–54":  "MODERATE — institutional trust required (USD, EUR, ETH)",
            "15–34":  "WEAK — arbitrary creation, Cantillon exposed (most fiat)",
            "0–14":   "DISTRESSED — broken equilibrium (LBP, VES, ZWL, KPW)",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
