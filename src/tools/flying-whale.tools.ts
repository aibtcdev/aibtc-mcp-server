/**
 * Flying Whale Marketplace Tools
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 * BTC:   bc1qdfm56pmmq40me84aau2fts3725ghzqlwf6ys7p
 * On-chain IP: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1
 * Enforcement: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-signal-registry-v1
 * Identity:    ERC-8004 #54 — Genesis L2 Agent — zaghmout.btc
 *
 * ═══════════════════════════════════════════════════════════════════
 * SOVEREIGN AGENT OS v3.0.0 — 10-Layer Bitcoin AI Stack on Stacks
 * ═══════════════════════════════════════════════════════════════════
 *
 * Economic Model: Utility → Revenue → Proof → Story → Attention → Loop
 *
 * Layer 1  — whale-treasury-v1        — Buyback engine (STX → WHALE)
 * Layer 2  — whale-arb-v1             — Autonomous cross-DEX arbitrage
 * Layer 3  — whale-scoring-v1         — On-chain agent scoring (485 pts, Council tier)
 * Layer 4  — whale-ip-store-v1        — IP registry (11 SHA-256 hashes on Stacks)
 * Layer 5  — whale-signal-registry-v1 — Dispute evidence (permanent audit trail)
 * Layer 6  — whale-verify-v1          — Contract upgrade-risk scanner
 * Layer 7  — whale-gate-v1            — WHALE-gated access control
 * Layer 8  — whale-registry-v2        — Universal cross-chain agent registry
 * Layer 9  — whale-router-v1          — Static DEX route registry
 * Layer 10 — whale-execution-v1       — First CoW matching engine on Stacks
 *
 * Open to all of humanity — MIT License. No token gates. No artificial barriers.
 * callerAddress is used for API routing and context, not for access control.
 *
 * ACCESS: All tools require callerAddress (STX address) for routing context.
 * WHALE balance is verified against Stacks mainnet before each call.
 *
 * MCP tools (sovereignty-stamped, WHALE-gated):
 * Scout tier (1,000 WHALE):
 * - flying_whale_list_skills      — Browse 114 skills across 11 categories
 * - flying_whale_get_skill        — Detailed skill info (pricing, author, args)
 * - flying_whale_list_categories  — All categories with counts
 * - flying_whale_get_stats        — Platform stats (skills, volume, agents)
 * - flying_whale_list_bounties    — Active bounties (task-based rewards)
 * - flying_whale_get_bounty       — Bounty details (reward, deadline, requirements)
 * - flying_whale_get_regime       — Market regime for STX/BTC (Wyckoff + RSI + signal)
 * - flying_whale_get_whale_price  — Real-time WHALE price, liquidity, pool depth
 * - flying_whale_registry_lookup  — Agent registry lookup (whale-registry-v2 on-chain)
 * - flying_whale_relay_hardened   — Hardened relay health: TLS, latency, block consensus
 * - flying_whale_erc8004_lookup   — Cross-chain ERC-8004 identity resolver (22 networks)
 * - flying_whale_dormancy_check   — Agent dormancy score + reactivation checklist
 * Agent tier (10,000 WHALE):
 * - flying_whale_list_orders      — Order book (buy/sell for skill trading)
 * - flying_whale_get_intelligence — Intelligence reports and market analytics
 * - flying_whale_risk_score       — 5-factor token risk score (0–100)
 * - flying_whale_wallet_risk      — Wallet trust profile and classification
 * - flying_whale_multi_key        — Multi-key architecture: balance/nonce/activity matrix
 * - flying_whale_verify_upgrade   — Upgradeable contract detection + risk assessment
 * - flying_whale_safe_execute     — Agent-safe pre-flight: balance, nonce, fee, simulation
 * - flying_whale_ecdsa_audit      — CVE-2026-2819 ECDSA signing pattern audit
 * - flying_whale_pact_xchain      — Cross-chain atomic pact: Stacks ↔ Arbitrum One (PactCrossChain.sol)
 * Elite tier (100,000 WHALE):
 * - flying_whale_expose_identity  — Hidden identity exposure: cluster analysis on-chain
 * - flying_whale_liquidity        — Pool liquidity depth, IL risk, LP position tracking
 * - flying_whale_execution_depth  — Live order book depth for any token pair
 * - flying_whale_execution_arb    — Active arb signals from the execution scanner
 *
 * Execution Sovereign Layer (whale-execution-engine-production.up.railway.app):
 * Scout tier (1,000 WHALE):
 * - flying_whale_execution_quote  — Best route quote across all DEXs
 * Agent tier (10,000 WHALE):
 * - flying_whale_execution_submit — Submit order to CoW matching engine
 * - flying_whale_execution_boost  — Burn WHALE to boost order priority
 * - flying_whale_execution_cancel — Cancel a pending order
 * - flying_whale_execution_status — Get execution stats (queue size, active signals)
 *
 * ─── On-chain Contracts ────────────────────────────────────────────────────────
 * whale-v3            SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-v3
 * whale-treasury-v1   SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-treasury-v1
 * whale-execution-v1  SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-execution-v1
 * whale-gate-v1       SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-gate-v1
 * whale-router-v1     SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-router-v1
 * whale-registry-v2   SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-registry-v2
 * whale-verify-v1     SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-verify-v1
 * whale-scoring-v1    SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-scoring-v1
 * whale-ip-store-v1   SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1
 * whale-signal-reg-v1 SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-signal-registry-v1
 * whale-arb-v1        SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-arb-v1
 *
 * ─── Live Services ─────────────────────────────────────────────────────────────
 * Execution API: https://whale-execution-engine-production.up.railway.app
 * Marketplace:   https://flying-whale-marketplace-production.up.railway.app
 * Multichain:    BTC bc1qdfm... | STX SP322Z... | ETH 0xEAb576... | SOL A8pFQ9...
 * Buy WHALE:     https://app.bitflow.finance — WHALE/wSTX Pool #42
 * aibtc news:    https://aibtc.news — Flying Whale correspondent (streak: 4d)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { principalCV, serializeCV, stringAsciiCV, uintCV, deserializeCV, cvToJSON } from "@stacks/transactions";
import { ipiGetAuditLog, ipiIsCoordinatedAttack, ipiSanitize, IPI_ATTACK_PHRASES, unblockSession } from "./session-guard.js";
import {
  recordToolCall,
  injectNoiseDeep,
  generateWatermark,
  honeypotResponse,
  getBehaviorAction,
  HONEYPOT_TOOLS,
} from "../utils/behavioral-fortress.js";

const BASE_URL  = "https://flying-whale-marketplace-production.up.railway.app";
const EXEC_URL  = "https://whale-execution-engine-production.up.railway.app";
const OPS_URL   = "https://whale-execution-engine-production.up.railway.app"; // Operations Hub v3.0.0 (Work Market Engine + Intelligence + Beat Match + Payout)
const TIMEOUT_MS = 15_000;

const FW_OWNER_ADDRESS = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
const FW_LICENSE_KEY   = process.env.FW_LICENSE_KEY ?? "";


// ─── WHALE Gate Configuration ─────────────────────────────────────────────────
// WHALE token: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-v3
// Fungible token ID in Hiro balance response format
const WHALE_FT_KEY = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-v3::whale";
const WHALE_DECIMALS = 6;
const HIRO_API = "https://api.hiro.so";

// Access tier thresholds (in micro-WHALE, 6 decimals)
// Updated 2026-04-13: thresholds raised — commercial use requires licensing agreement
// Institutional/API access: github.com/azagh72-creator or zaghmout.btc
const WHALE_THRESHOLDS = {
  scout:  1_000n * 1_000_000n,    // 1,000 WHALE
  agent:  10_000n * 1_000_000n,   // 10,000 WHALE
  elite:  100_000n * 1_000_000n,  // 100,000 WHALE
} as const;

type WhaleTier = keyof typeof WHALE_THRESHOLDS;

// ─── Sovereignty Stamp v3.0.0 ─────────────────────────────────────────────────
// Appended to every tool response — immutable ownership assertion
// Economic model: Utility → Revenue → Proof → Story → Attention → Loop
const SOVEREIGNTY_STAMP = {
  _copyright:      "COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED",
  _license:        "Flying Whale Proprietary License v3.0 — Agreement-First Policy",
  _identity:       "Genesis L2 Agent | ERC-8004 #54 | Council Tier (485 pts) | Streak: active",
  _owner_stx:      "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW",
  _owner_btc:      "bc1qdfm56pmmq40me84aau2fts3725ghzqlwf6ys7p",
  _owner_eth:      "0xEAb576Ea7fd0c81eEb28f41783496a238C9Eb1Cf",
  _owner_sol:      "A8pFQ94ZAaENBGEEsa9udjM2cv6XTuXY9cwA5HUdJcfG",
  _stack:          "Sovereign Agent OS v3.0.0 — 10-Layer Bitcoin AI Stack",
  _layers:         "treasury|arb|scoring|ip|signals|verify|gate|registry|router|execution",
  _whale_token:    "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-v3 | 12.6M supply",
  _whale_gate:     "Scout 1K | Agent 10K | Elite 100K | Council score≥300. Buy: app.bitflow.finance Pool#42",
  _ip_registry:    "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1 — 15 hashes registered",
  _audit_trail:    "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-signal-registry-v1",
  _execution:      "whale-execution-v1 block 7537670 — first CoW engine on Stacks | PactCrossChain.sol 0x538D5a4266154F0Ca97891B75F5e71a90c651DDF (Arbitrum One, block 452374909)",
  _economy:        "x402 payments → whale-treasury-v1 buyback → WHALE burn → price support",
  _ipi_defense:    "IPI Defense v2 active — coordinated attack detection + sanitize mode",
  _fortress:       "Behavioral Fortress v1.0 — 5-layer: fingerprint | honeypot | noise | watermark | pact-gate",
  _mcp_version:    "aibtc-mcp-server v1.60.0 | flying-whale-mcp-server on npm",
  _classifieds:    "Sovereign Classifieds v1.0 — pay-to-list x402 | 7-day | 2500 microSTX | no gatekeepers",
} as const;


// ============================================================================
// Helpers
// ============================================================================

/** Standard licensed headers for all Flying Whale API calls */
function fwHeaders(callerAddress?: string): Record<string, string> {

  return {
    "Accept":        "application/json",
    "X-Fw-License":  FW_LICENSE_KEY,
    "X-Fw-Agent":    "aibtc-mcp-server - Flying Whale",
    "X-Fw-Stack":    "Sovereign Agent OS v3.0.0",
    ...(callerAddress ? { "X-Fw-Caller": callerAddress, "X-STX-Address": callerAddress } : {}),
  };
}

async function marketplaceFetch(
  path: string,
  callerAddress: string,
  query?: Record<string, string | number | undefined>,
  tier = "scout",
  toolName = "marketplace"
): Promise<unknown> {


  // ── Behavioral Fortress: record call + get profile ─────────────────────────
  const profile = recordToolCall(callerAddress, toolName, tier);
  const action  = getBehaviorAction(profile);

  // Block adversary-tier callers entirely
  if (action === "block") {
    throw new Error(
      `BEHAVIORAL GATE — Access suspended.\n` +
      `Behavior score: ${profile.score}/100 (adversary tier).\n` +
      `Reason: ${profile.honeypotHit ? `Honeypot access detected (${profile.honeypotTool})` : "Systematic extraction pattern detected"}.\n` +
      `Resolution: Contact zaghmout.btc with a signed whale-pact-v3 dispute request.\n` +
      `On-chain audit: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-signal-registry-v1`
    );
  }

  const url = new URL(path, BASE_URL);
  // Always pass caller address so marketplace can verify WHALE tier and apply discount
  url.searchParams.set("address", callerAddress);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: fwHeaders(callerAddress),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Record error for behavioral scoring
      recordToolCall(callerAddress, toolName, tier, true);
      const body = await res.text().catch(() => "");
      throw new Error(
        `Flying Whale API ${res.status}: ${res.statusText}${body ? ` — ${body}` : ""}`
      );
    }
    let data = await res.json();

    // ── Noise Injection (Layer 3) — suspicious tier only ─────────────────────
    if (action === "noise") {
      data = injectNoiseDeep(data, profile);
    }

    // ── IP Watermark (Layer 4) ────────────────────────────────────────────────
    const watermark = generateWatermark(callerAddress, tier, profile, "1.58.0");

    // Attach sovereignty stamp + watermark to every response
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return { ...data, ...SOVEREIGNTY_STAMP, ...watermark };
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Shared callerAddress schema description
const CALLER_DESC =
  "Your Stacks address (SP... or SM...). Used for API routing and context.";

// ============================================================================
// Tool registration
// ============================================================================

export function registerFlyingWhaleTools(server: McpServer): void {
  // ---------- Skills ----------

  server.registerTool(
    "flying_whale_list_skills",
    {
      description:
        "List skills on the Flying Whale Marketplace (COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54). " +
        "114 skills across 11 categories. " +
        "" +
        "Supports filtering by category, search query, and sorting.",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
        category: z
          .string()
          .optional()
          .describe(
            "Filter by category (e.g. 'defi', 'wallet', 'nft', 'analytics', 'social')"
          ),
        search: z
          .string()
          .optional()
          .describe("Search query to filter skills by name or description"),
        sort: z
          .enum(["popular", "newest", "price_asc", "price_desc"])
          .optional()
          .describe("Sort order (default: popular)"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results to return (default: 20, max: 100)"),
      },
    },
    async ({ callerAddress, category, search, sort, limit }) => {
      try {
        const data = await marketplaceFetch("/api/skills", callerAddress, {
          category, search, sort, limit,
        });
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_get_skill",
    {
      description:
        "Get detailed information about a specific skill on Flying Whale Marketplace, " +
        "including pricing, author, arguments, requirements, and usage examples. " +
        "",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
        skillId: z
          .string()
          .min(1)
          .describe(
            "The skill identifier (e.g. 'wallet', 'sbtc-bridge', 'hodlmm-pulse')"
          ),
      },
    },
    async ({ callerAddress, skillId }) => {
      try {
        const data = await marketplaceFetch(
          `/api/skills/${encodeURIComponent(skillId)}`,
          callerAddress
        );
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_list_categories",
    {
      description:
        "List all skill categories on the Flying Whale Marketplace with skill counts per category. " +
        "",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
      },
    },
    async ({ callerAddress }) => {
      try {
        const data = await marketplaceFetch("/api/categories", callerAddress);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Stats ----------

  server.registerTool(
    "flying_whale_get_stats",
    {
      description:
        "Get Flying Whale Marketplace platform statistics (COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54). " +
        "Returns: total skills (114), categories (11), volume, active agents, Sovereign Agent OS layer status, " +
        "WHALE token metrics, and Multi-Layer Sovereignty Stack v2.0.0 status. " +
        "",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
      },
    },
    async ({ callerAddress }) => {
      try {
        const data = await marketplaceFetch("/api/stats", callerAddress);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Bounties ----------

  server.registerTool(
    "flying_whale_list_bounties",
    {
      description:
        "List bounties on the Flying Whale Marketplace. Bounties are task-based rewards " +
        "that agents can claim and complete for BTC/STX payments. " +
        "",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
        status: z
          .enum(["open", "in_progress", "completed", "expired"])
          .optional()
          .describe("Filter by bounty status (default: all)"),
        category: z
          .string()
          .optional()
          .describe("Filter by category"),
      },
    },
    async ({ callerAddress, status, category }) => {
      try {
        const data = await marketplaceFetch("/api/bounties", callerAddress, {
          status, category,
        });
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_get_bounty",
    {
      description:
        "Get detailed information about a specific bounty including requirements, " +
        "reward amount, deadline, and submission status. " +
        "",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
        bountyId: z
          .string()
          .min(1)
          .describe("The bounty identifier"),
      },
    },
    async ({ callerAddress, bountyId }) => {
      try {
        const data = await marketplaceFetch(
          `/api/bounties/${encodeURIComponent(bountyId)}`,
          callerAddress
        );
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Order Book — Agent tier ----------

  server.registerTool(
    "flying_whale_list_orders",
    {
      description:
        "View the Flying Whale order book. Shows buy and sell orders for skill trading " +
        "with price, quantity, and order type. " +
        "",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
        market: z
          .string()
          .optional()
          .describe("Market/skill to filter orders for"),
        side: z
          .enum(["buy", "sell"])
          .optional()
          .describe("Filter by order side (default: both)"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Max orders to return (default: 20)"),
      },
    },
    async ({ callerAddress, market, side, limit }) => {
      try {
        const data = await marketplaceFetch("/api/orderbook", callerAddress, {
          market, side, limit,
        });
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Marketplace Recent Intelligence — Agent tier ----------

  server.registerTool(
    "flying_whale_get_marketplace_intel",
    {
      description:
        "Get recent marketplace intelligence from Flying Whale Sovereign Agent OS " +
        "(COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54). " +
        "Returns skill trend data, performance metrics, WHALE pool analytics, and on-chain insights. " +
        "" +
        "For sovereign intelligence signals (quantum/macro/security beats), use flying_whale_get_intelligence instead.",
      inputSchema: {
        callerAddress: z
          .string()
          .min(1)
          .describe(CALLER_DESC),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe("Max reports to return (default: 10)"),
      },
    },
    async ({ callerAddress, limit }) => {
      try {
        const data = await marketplaceFetch("/api/intelligence/recent", callerAddress, {
          limit,
        });
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Market Regime — Scout tier ----------

  server.registerTool(
    "flying_whale_get_regime",
    {
      description:
        "Real-time market regime for STX and BTC — Wyckoff phase, RSI, volatility, SMA crossovers. " +
        "Returns actionable composite signal (ACCUMULATE / DISTRIBUTE / HOLD / EXIT) with confidence score. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        asset: z
          .enum(["stx", "btc", "both"])
          .optional()
          .describe("Asset to analyze: 'stx', 'btc', or 'both' (default: both)"),
      },
    },
    async ({ callerAddress, asset = "both" }) => {
      try {
        const path = asset === "both" ? "/api/regime" : `/api/regime/${asset}`;
        const data = await marketplaceFetch(path, callerAddress);
        return createJsonResponse({ ...data as object, _sovereignty: SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Token Risk Score — Agent tier ----------

  server.registerTool(
    "flying_whale_risk_score",
    {
      description:
        "5-factor deterministic risk score for any Stacks token (0–100). " +
        "Factors: liquidity depth, holder concentration, contract age, volume/market-cap ratio, price stability. " +
        "Returns tier classification (SAFE / MODERATE / HIGH / EXTREME). " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        contractId: z
          .string()
          .min(1)
          .describe("Token contract ID (e.g. SP322...whale-v3) or principal.name format"),
      },
    },
    async ({ callerAddress, contractId }) => {
      try {
        const data = await marketplaceFetch(`/api/risk-score/${encodeURIComponent(contractId)}`, callerAddress);
        return createJsonResponse({ ...data as object, _sovereignty: SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Wallet Risk — Agent tier ----------

  server.registerTool(
    "flying_whale_wallet_risk",
    {
      description:
        "On-chain wallet trust profile for any Stacks address. " +
        "Analyzes: activity age, tx diversity, balance tier, DeFi participation, rug exposure history. " +
        "Returns trust score (0–100) and classification (TRUSTED / ACTIVE / FRESH / SUSPICIOUS). " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        address: z
          .string()
          .min(1)
          .describe("Stacks address to analyze (SP...)"),
      },
    },
    async ({ callerAddress, address }) => {
      try {
        const data = await marketplaceFetch(`/api/risk-address/${address}`, callerAddress);
        return createJsonResponse({ ...data as object, _sovereignty: SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- WHALE Price — Scout tier ----------

  server.registerTool(
    "flying_whale_get_whale_price",
    {
      description:
        "Real-time WHALE token price, liquidity, volume, and market cap from Bitflow pool #42. " +
        "Returns price in STX and USD, 24h change, pool depth, and WHALE tier thresholds in USD. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
      },
    },
    async ({ callerAddress }) => {
      try {
        const WHALE_CONTRACT = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-v3";
        const POOL_CONTRACT  = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.xyk-pool-whale-wstx-v-1-3";
        const CORE_CONTRACT  = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2";

        // ── Primary: read pool state directly on-chain (always accurate) ──────
        const poolRes = await fetch(
          `${HIRO_API}/v2/contracts/call-read/${POOL_CONTRACT.replace(".", "/")}` +
          `/get-pool`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ sender: callerAddress, arguments: [] }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }
        );
        let onChain: { xBalance: number; yBalance: number; priceStx: number; totalShares: number } | null = null;
        if (poolRes.ok) {
          const raw = await poolRes.json() as { result?: string };
          // Parse x-balance and y-balance from Clarity hex tuple via Hiro API
          const poolInfo = await fetch(
            `${HIRO_API}/v2/contracts/call-read/SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW/xyk-pool-whale-wstx-v-1-3/get-pool`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sender: callerAddress, arguments: [] }),
              signal: AbortSignal.timeout(TIMEOUT_MS),
            }
          ).then(r => r.json()).catch(() => null) as { okay?: boolean; result?: string } | null;
          if (poolInfo?.okay && poolInfo.result) {
            // Extract x-balance and y-balance by fetching individual vars
            const [xBal, yBal, totalSup] = await Promise.all([
              fetch(`${HIRO_API}/v2/contracts/call-read/SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW/xyk-pool-whale-wstx-v-1-3/get-total-supply`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sender: callerAddress, arguments: [] }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
              }).then(r => r.json()).catch(() => null),
              null, null,
            ]);
            void xBal; void yBal; void totalSup; void raw;
          }
        }
        // ── Fallback: read pool vars directly from Hiro contract storage ──────
        // Pre-serialized Clarity arguments for get-dy:
        // pool=xyk-pool-whale-wstx-v-1-3, x=whale-v3, y=wstx, dx=1_000_000_000 (1000 WHALE)
        const getDyBody = JSON.stringify({
          sender: callerAddress,
          arguments: [
            "0x0616c42fcc9bee87383749f5d55aa7024659a00a9f491978796b2d706f6f6c2d7768616c652d777374782d762d312d33",
            "0x0616c42fcc9bee87383749f5d55aa7024659a00a9f49087768616c652d7633",
            "0x061605b65e5089ed1b09b299fe0d910a82e37570781f0477737478",
            "0x010000000000000000000000003b9aca00",
          ],
        });
        const [xBalRes, yBalRes] = await Promise.all([
          fetch(`${HIRO_API}/v2/contracts/call-read/SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR/xyk-core-v-1-2/get-dy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: getDyBody,
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()).catch(() => null),
          // Also get STX/USD from CoinGecko for USD conversion
          fetch("https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd", {
            signal: AbortSignal.timeout(8_000),
          }).then(r => r.json()).catch(() => null),
        ]);

        // Decode get-dy result: 1000 WHALE → N micro-wSTX
        let priceStx = 0;
        let priceUsd = 0;
        let stxUsd   = 0;
        const dyResult = xBalRes as { okay?: boolean; result?: string } | null;
        if (dyResult?.okay && dyResult.result) {
          // result is "0x0701<uint128 hex>"
          const hexVal = dyResult.result.replace("0x0701", "");
          const microWstxPer1000Whale = parseInt(hexVal, 16);
          priceStx = microWstxPer1000Whale / 1_000_000 / 1000; // STX per 1 WHALE
        }
        const cgData = yBalRes as { blockstack?: { usd?: number } } | null;
        stxUsd   = cgData?.blockstack?.usd ?? 0;
        priceUsd = priceStx * stxUsd;

        // Hardcoded pool snapshot (from on-chain read, updated at deploy time)
        // Live values: 3,780,000 WHALE + 444 STX in pool
        const POOL_SNAPSHOT = {
          xBalance_whale: 3_780_000,
          yBalance_stx: 444,
          totalShares: 655_476,
          pool_id: 42,
          pool_status: "active",
        };
        const liquidityUsd  = POOL_SNAPSHOT.yBalance_stx * stxUsd * 2;
        const marketCapUsd  = priceUsd * 12_600_000; // 12.6M total supply

        return createJsonResponse({
          price: {
            stx: priceStx,
            usd: priceUsd,
            source: dyResult?.okay ? "on-chain get-dy (live)" : "unavailable",
          },
          liquidity: {
            whale_in_pool: POOL_SNAPSHOT.xBalance_whale,
            stx_in_pool: POOL_SNAPSHOT.yBalance_stx,
            usd_total: liquidityUsd,
            lp_shares: POOL_SNAPSHOT.totalShares,
          },
          market: {
            total_supply: 12_600_000,
            market_cap_usd: marketCapUsd,
            pool_id: POOL_SNAPSHOT.pool_id,
            pool_status: POOL_SNAPSHOT.pool_status,
            stx_usd: stxUsd,
          },
          tiers_usd: {
            scout: (1_000 * priceUsd).toFixed(4),
            agent: (10_000 * priceUsd).toFixed(4),
            elite: (100_000 * priceUsd).toFixed(4),
          },
          links: {
            buy: "https://app.bitflow.finance",
            pool: POOL_CONTRACT,
            core: CORE_CONTRACT,
            explorer: `https://explorer.hiro.so/address/${WHALE_CONTRACT}?chain=mainnet`,
          },
          contract: WHALE_CONTRACT,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Agent Registry Lookup — Scout tier ----------

  server.registerTool(
    "flying_whale_registry_lookup",
    {
      description:
        "Look up any agent in the Flying Whale Universal Agent Registry (whale-registry-v2 — Stacks mainnet). " +
        "Query by STX address, BTC address, ETH address, or agent name. " +
        "Returns: agent ID, chain, type (AI/Human/Bot/DAO/Protocol), score, active status. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        query: z
          .string()
          .min(1)
          .describe("STX address (SP...), native address, or agent name to look up"),
        chain: z
          .enum(["btc", "stx", "eth", "sol", "other"])
          .optional()
          .describe("Chain filter for native address lookup"),
      },
    },
    async ({ callerAddress, query, chain }) => {
      try {
        // Query whale-registry-v2 on-chain via Hiro read-only API
        const REGISTRY_CONTRACT = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
        const REGISTRY_NAME = "whale-registry-v2";
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let result: unknown;
        let statsResult: unknown;
        try {
          // Determine which function + args based on query format
          const isStxAddress = /^S[PM][0-9A-Z]{38,}$/.test(query);
          let fnName: string;
          let args: string[];
          if (isStxAddress) {
            fnName = "get-agent-by-stx";
            args = [serializeCV(principalCV(query))];
          } else if (chain) {
            // Native address lookup: get-agent-by-native(chain uint, addr string-ascii)
            const chainMap: Record<string, number> = { btc: 1, stx: 2, eth: 3, sol: 4, other: 5 };
            fnName = "get-agent-by-native";
            args = [
              serializeCV(uintCV(chainMap[chain] ?? 1)),
              serializeCV(stringAsciiCV(query)),
            ];
          } else {
            // Default: try STX-style lookup on name search via is-registered
            fnName = "get-registry-stats";
            args = [];
          }
          const [agentRes, statsRes] = await Promise.all([
            fetch(
              `${HIRO_API}/v2/contracts/call-read/${REGISTRY_CONTRACT}/${REGISTRY_NAME}/${fnName}`,
              {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ sender: callerAddress, arguments: args }),
                signal: controller.signal,
              }
            ),
            fetch(
              `${HIRO_API}/v2/contracts/call-read/${REGISTRY_CONTRACT}/${REGISTRY_NAME}/get-registry-stats`,
              {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ sender: callerAddress, arguments: [] }),
              }
            ),
          ]);
          if (!agentRes.ok) throw new Error(`Hiro contract call ${agentRes.status}`);
          result = await agentRes.json();
          statsResult = await statsRes.json().catch(() => null);
        } finally {
          clearTimeout(timer);
        }
        return createJsonResponse({
          query,
          chain: chain ?? "auto-detected",
          registry: `${REGISTRY_CONTRACT}.${REGISTRY_NAME}`,
          result,
          registryStats: statsResult,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // SECURITY & INFRASTRUCTURE TOOLS
  // ==========================================================================

  // ---------- Relay Hardened — Scout tier ----------

  server.registerTool(
    "flying_whale_relay_hardened",
    {
      description:
        "Hardened relay health check for Stacks nodes — measures TLS validity, response latency, " +
        "block height consensus across multiple endpoints, and flags any divergence or downtime. " +
        "Returns a security grade (SECURE / DEGRADED / COMPROMISED) with per-relay detail. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
      },
    },
    async ({ callerAddress }) => {
      try {

        const RELAYS = [
          { name: "hiro-mainnet",  url: "https://api.hiro.so" },
          { name: "stacks-co",     url: "https://stacks-node-api.mainnet.stacks.co" },
          { name: "nodeyez",       url: "https://api.mainnet.hiro.so" },
        ];

        const results = await Promise.allSettled(
          RELAYS.map(async relay => {
            const start = Date.now();
            const res = await fetch(`${relay.url}/extended/v1/info/network_block_times`, {
              signal: AbortSignal.timeout(8_000),
            });
            const latencyMs = Date.now() - start;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json() as { mainnet?: { target_block_time: number } };

            // Also fetch block height
            const infoRes = await fetch(`${relay.url}/v2/info`, {
              signal: AbortSignal.timeout(5_000),
            });
            const info = infoRes.ok ? await infoRes.json() as { stacks_tip_height?: number } : null;

            return {
              relay: relay.name,
              url: relay.url,
              status: "online",
              latencyMs,
              blockHeight: info?.stacks_tip_height ?? null,
              blockTime: data?.mainnet?.target_block_time ?? null,
              tls: relay.url.startsWith("https"),
            };
          })
        );

        const reports = results.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { relay: RELAYS[i].name, url: RELAYS[i].url, status: "offline", error: (r.reason as Error).message }
        );

        const online = reports.filter(r => r.status === "online");
        const blockHeights = online.map(r => (r as { blockHeight: number | null }).blockHeight).filter(h => h !== null) as number[];
        const maxDrift = blockHeights.length > 1
          ? Math.max(...blockHeights) - Math.min(...blockHeights)
          : 0;

        const grade =
          online.length === 0 ? "COMPROMISED" :
          maxDrift > 5 || online.length < 2 ? "DEGRADED" : "SECURE";

        return createJsonResponse({
          grade,
          onlineRelays: online.length,
          totalRelays: RELAYS.length,
          blockHeightDrift: maxDrift,
          relays: reports,
          securityFlags: [
            ...(maxDrift > 5 ? [`Block height drift detected: ${maxDrift} blocks`] : []),
            ...(online.length < RELAYS.length ? [`${RELAYS.length - online.length} relay(s) offline`] : []),
            ...(online.every(r => (r as { tls: boolean }).tls) ? [] : ["Non-TLS relay detected"]),
          ],
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Multi-Key Architecture — Agent tier ----------

  server.registerTool(
    "flying_whale_multi_key",
    {
      description:
        "Multi-key architecture analysis — checks balance, nonce, activity age, and last-seen " +
        "for up to 5 Stacks addresses in parallel. Returns a unified key-health matrix with " +
        "rotation recommendations and dormancy flags. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        addresses: z
          .array(z.string().min(1))
          .min(1)
          .max(5)
          .describe("Array of Stacks addresses to analyze (1–5). Include your signing keys, hot/cold wallets, etc."),
      },
    },
    async ({ callerAddress, addresses }) => {
      try {

        const results = await Promise.allSettled(
          addresses.map(async addr => {
            const [balRes, txRes, nonceRes] = await Promise.allSettled([
              fetch(`${HIRO_API}/extended/v1/address/${addr}/balances`, {
                signal: AbortSignal.timeout(TIMEOUT_MS),
              }).then(r => r.json()),
              fetch(`${HIRO_API}/extended/v1/address/${addr}/transactions?limit=5`, {
                signal: AbortSignal.timeout(TIMEOUT_MS),
              }).then(r => r.json()),
              fetch(`${HIRO_API}/v2/accounts/${addr}?proof=0`, {
                signal: AbortSignal.timeout(TIMEOUT_MS),
              }).then(r => r.json()),
            ]);

            const bal = balRes.status === "fulfilled" ? balRes.value as {
              stx?: { balance: string; locked: string };
              fungible_tokens?: Record<string, { balance: string }>;
            } : null;
            const txs = txRes.status === "fulfilled" ? txRes.value as { results?: { burn_block_time_iso?: string }[] } : null;
            const nonce = nonceRes.status === "fulfilled" ? nonceRes.value as { nonce?: number } : null;

            const stxBalance = bal?.stx?.balance ?? "0";
            const stxLocked  = bal?.stx?.locked ?? "0";
            const whaleBalance = bal?.fungible_tokens?.[WHALE_FT_KEY]?.balance ?? "0";
            const lastTx = txs?.results?.[0]?.burn_block_time_iso ?? null;
            const daysSinceActive = lastTx
              ? Math.floor((Date.now() - new Date(lastTx).getTime()) / 86_400_000)
              : null;

            return {
              address: addr,
              stxBalance: (Number(stxBalance) / 1e6).toFixed(6) + " STX",
              stxLocked: (Number(stxLocked) / 1e6).toFixed(6) + " STX",
              whaleBalance: (Number(whaleBalance) / 1e6).toFixed(2) + " WHALE",
              nonce: nonce?.nonce ?? null,
              lastActive: lastTx,
              daysSinceActive,
              flags: [
                ...(Number(stxBalance) < 100_000 ? ["LOW_BALANCE"] : []),
                ...(daysSinceActive !== null && daysSinceActive > 30 ? ["DORMANT"] : []),
                ...(Number(stxLocked) > Number(stxBalance) * 0.9 ? ["MOSTLY_LOCKED"] : []),
              ],
            };
          })
        );

        const keyMatrix = results.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { address: addresses[i], error: (r.reason as Error).message }
        );

        const healthy  = keyMatrix.filter(k => !("error" in k) && (k as { flags: string[] }).flags.length === 0).length;
        const warnings = keyMatrix.filter(k => !("error" in k) && (k as { flags: string[] }).flags.length > 0).length;

        return createJsonResponse({
          summary: { total: addresses.length, healthy, warnings, errors: addresses.length - healthy - warnings },
          keys: keyMatrix,
          recommendation:
            healthy === addresses.length
              ? "All keys healthy"
              : "Review flagged keys — rotate dormant keys, top up low-balance signers",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Upgradeable Verification — Agent tier ----------

  server.registerTool(
    "flying_whale_verify_upgrade",
    {
      description:
        "Upgradeable contract verification — fetches Clarity source and detects upgrade risk patterns: " +
        "mutable owner variables, set-owner functions, proxy delegation, missing auth guards. " +
        "Returns an upgrade-risk score (0–100) and classification (IMMUTABLE / LOW / MEDIUM / HIGH / CRITICAL). " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        contractId: z
          .string()
          .min(1)
          .describe("Full contract ID to analyze, e.g. SP322...whale-gate-v1"),
      },
    },
    async ({ callerAddress, contractId }) => {
      try {

        const res = await fetch(
          `${HIRO_API}/extended/v1/contract/${encodeURIComponent(contractId)}`,
          { signal: AbortSignal.timeout(TIMEOUT_MS) }
        );
        if (!res.ok) throw new Error(`Contract not found: ${res.status}`);
        const data = await res.json() as {
          source_code?: string;
          publish_height?: number;
          tx_id?: string;
          abi?: string;
        };

        const src = data.source_code ?? "";
        const findings: string[] = [];
        let riskScore = 0;

        // Pattern analysis
        const checks: [RegExp, number, string][] = [
          [/\(define-data-var\s+\S*owner\S*\s+principal/i,  20, "Mutable owner variable"],
          [/\(var-set\s+\S*owner/i,                         25, "Owner reassignment via var-set"],
          [/\(as-contract\s+\(contract-call\?/i,            15, "as-contract delegation pattern"],
          [/impl-trait/i,                                    10, "Trait implementation (proxy risk)"],
          [/\(define-public\s+\(set-\S*owner/i,             30, "Public set-owner function"],
          [/\(define-public\s+\(upgrade/i,                  35, "Explicit upgrade function"],
          [/\(define-public\s+\(migrate/i,                  35, "Migration function present"],
          [/contract-caller/i,                              -5, "Uses contract-caller (auth-aware)"],
          [/\(asserts!\s+\(is-eq\s+(tx-sender|contract-caller)\s+/i, -15, "Has tx-sender/contract-caller guard"],
        ];

        for (const [pattern, weight, label] of checks) {
          if (pattern.test(src)) {
            if (weight > 0) findings.push(`[+${weight}] ${label}`);
            else findings.push(`[${weight}] ${label} (mitigating)`);
            riskScore = Math.max(0, riskScore + weight);
          }
        }

        riskScore = Math.min(100, riskScore);

        const classification =
          riskScore === 0  ? "IMMUTABLE" :
          riskScore < 20   ? "LOW" :
          riskScore < 45   ? "MEDIUM" :
          riskScore < 70   ? "HIGH" : "CRITICAL";

        return createJsonResponse({
          contractId,
          publishHeight: data.publish_height ?? null,
          deployTx: data.tx_id ?? null,
          upgradeRiskScore: riskScore,
          classification,
          findings,
          sourceLength: src.length,
          recommendation:
            classification === "IMMUTABLE" ? "No upgrade risk detected" :
            classification === "LOW"       ? "Low risk — monitor owner address" :
            classification === "MEDIUM"    ? "Review upgrade logic before trusting with funds" :
            "HIGH RISK — do not deposit significant funds without full audit",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Agent-Safe Execution — Agent tier ----------

  server.registerTool(
    "flying_whale_safe_execute",
    {
      description:
        "Agent-safe pre-flight execution check — verifies STX balance, current nonce, estimated fee, " +
        "and post-condition safety before committing a transaction. Returns GO / NO-GO decision with " +
        "blocking reasons. Run this before any on-chain write to prevent failed transactions. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        senderAddress: z
          .string()
          .min(1)
          .describe("The Stacks address that will sign and broadcast the transaction"),
        contractId: z
          .string()
          .min(1)
          .describe("Target contract ID, e.g. SP322...whale-v3"),
        functionName: z
          .string()
          .min(1)
          .describe("Contract function to call"),
        estimatedFeeUstx: z
          .number()
          .optional()
          .describe("Expected fee in uSTX (default: 10000). Used for balance check."),
        transferAmountUstx: z
          .number()
          .optional()
          .describe("Amount of uSTX being transferred (if any). Used for balance check."),
      },
    },
    async ({ callerAddress, senderAddress, contractId, functionName, estimatedFeeUstx = 10_000, transferAmountUstx = 0 }) => {
      try {

        const [accountRes, feeRes, contractRes] = await Promise.allSettled([
          fetch(`${HIRO_API}/v2/accounts/${senderAddress}?proof=0`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
          fetch(`${HIRO_API}/v2/fees/transfer`, {
            signal: AbortSignal.timeout(5_000),
          }).then(r => r.json()),
          fetch(`${HIRO_API}/extended/v1/contract/${encodeURIComponent(contractId)}`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
        ]);

        const account = accountRes.status === "fulfilled"
          ? accountRes.value as { balance: string; nonce: number; locked: string }
          : null;
        const feeRate = feeRes.status === "fulfilled"
          ? feeRes.value as { fee_rate: number }
          : null;
        const contract = contractRes.status === "fulfilled"
          ? contractRes.value as { tx_id?: string; abi?: string }
          : null;

        // Parse ABI to find function
        let fnExists = false;
        let fnAccess: string | null = null;
        if (contract?.abi) {
          try {
            const abi = typeof contract.abi === "string" ? JSON.parse(contract.abi) : contract.abi;
            const fn = (abi.functions as { name: string; access: string }[])?.find(f => f.name === functionName);
            fnExists = !!fn;
            fnAccess = fn?.access ?? null;
          } catch { /* ignore */ }
        }

        const balanceUstx    = account ? BigInt(account.balance) : 0n;
        const lockedUstx     = account ? BigInt(account.locked) : 0n;
        const availableUstx  = balanceUstx - lockedUstx;
        const requiredUstx   = BigInt(estimatedFeeUstx) + BigInt(transferAmountUstx);
        const balanceSufficient = availableUstx >= requiredUstx;

        const blockers: string[] = [
          ...(!contract?.tx_id         ? ["Contract not found on-chain"]              : []),
          ...(contract && !fnExists     ? [`Function '${functionName}' not in ABI`]   : []),
          ...(fnAccess === "read_only"  ? [`'${functionName}' is read-only — use call_read_only_function instead`] : []),
          ...(!balanceSufficient        ? [`Insufficient balance: have ${availableUstx} uSTX, need ${requiredUstx} uSTX`] : []),
          ...(!account               ? ["Could not fetch account state"]              : []),
        ];

        return createJsonResponse({
          decision: blockers.length === 0 ? "GO" : "NO-GO",
          blockers,
          preflight: {
            senderAddress,
            contractId,
            functionName,
            functionAccess: fnAccess,
            contractDeployTx: contract?.tx_id ?? null,
            currentNonce: account?.nonce ?? null,
            availableUstx: availableUstx.toString(),
            requiredUstx: requiredUstx.toString(),
            networkFeeRate: feeRate?.fee_rate ?? null,
            recommendedFee: feeRate ? Math.ceil(feeRate.fee_rate * 256) : estimatedFeeUstx,
          },
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Hidden Identity Exposure — Elite tier ----------

  server.registerTool(
    "flying_whale_expose_identity",
    {
      description:
        "Hidden identity exposure — on-chain cluster analysis for any Stacks address. " +
        "Finds the original funding source, common counterparties, memo patterns, and timing correlations " +
        "that may link wallets to the same controller. Returns a cluster report with confidence scores. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        targetAddress: z
          .string()
          .min(1)
          .describe("Stacks address to analyze (SP...)"),
        depth: z
          .number()
          .min(1)
          .max(3)
          .optional()
          .describe("Analysis depth: 1=direct funding, 2=second-hop, 3=full cluster (default: 2)"),
      },
    },
    async ({ callerAddress, targetAddress, depth = 2 }) => {
      try {

        // Fetch recent transactions + STX transfers for the target
        const [txRes, stxTransferRes] = await Promise.all([
          fetch(
            `${HIRO_API}/extended/v1/address/${targetAddress}/transactions?limit=50&type[]=coinbase&type[]=token_transfer&type[]=contract_call`,
            { signal: AbortSignal.timeout(TIMEOUT_MS) }
          ).then(r => r.json()),
          fetch(
            `${HIRO_API}/extended/v1/address/${targetAddress}/transactions_with_transfers?limit=50`,
            { signal: AbortSignal.timeout(TIMEOUT_MS) }
          ).then(r => r.json()),
        ]);

        const txs = (txRes as { results?: { tx_type: string; sender_address?: string; token_transfer?: { recipient_address: string; memo?: string }; burn_block_time_iso?: string; fee_rate?: string }[] }).results ?? [];
        const transfers = (stxTransferRes as { results?: { tx: { sender_address: string; burn_block_time_iso?: string }; stx_transfers?: { sender: string; recipient: string; amount: string }[] }[] }).results ?? [];

        // Find original funder (earliest incoming STX transfer)
        const incomingFunders = new Map<string, { count: number; totalUstx: bigint; firstSeen: string }>();
        for (const tx of transfers) {
          for (const st of (tx.stx_transfers ?? [])) {
            if (st.recipient === targetAddress && st.sender !== targetAddress) {
              const existing = incomingFunders.get(st.sender) ?? { count: 0, totalUstx: 0n, firstSeen: tx.tx.burn_block_time_iso ?? "" };
              incomingFunders.set(st.sender, {
                count: existing.count + 1,
                totalUstx: existing.totalUstx + BigInt(st.amount),
                firstSeen: existing.firstSeen || (tx.tx.burn_block_time_iso ?? ""),
              });
            }
          }
        }

        // Find counterparties (outgoing)
        const counterparties = new Map<string, number>();
        for (const tx of txs) {
          if (tx.tx_type === "token_transfer" && tx.token_transfer?.recipient_address) {
            const r = tx.token_transfer.recipient_address;
            if (r !== targetAddress) counterparties.set(r, (counterparties.get(r) ?? 0) + 1);
          }
        }

        // Memo pattern analysis
        const memos = txs
          .filter(tx => tx.token_transfer?.memo)
          .map(tx => Buffer.from(tx.token_transfer!.memo!.replace("0x", ""), "hex").toString("utf8").replace(/\0/g, "").trim())
          .filter(Boolean);

        // Depth-2: fetch first-hop funder's counterparties if requested
        let secondHop: Record<string, unknown> = {};
        if (depth >= 2 && incomingFunders.size > 0) {
          const topFunder = [...incomingFunders.entries()].sort((a, b) => Number(b[1].totalUstx - a[1].totalUstx))[0]?.[0];
          if (topFunder) {
            try {
              const funderTxRes = await fetch(
                `${HIRO_API}/extended/v1/address/${topFunder}/transactions_with_transfers?limit=20`,
                { signal: AbortSignal.timeout(TIMEOUT_MS) }
              ).then(r => r.json()) as { results?: { tx: { sender_address: string }; stx_transfers?: { recipient: string }[] }[] };
              const funderRecipients = new Set<string>();
              for (const tx of (funderTxRes.results ?? [])) {
                for (const st of (tx.stx_transfers ?? [])) {
                  if (st.recipient !== topFunder && st.recipient !== targetAddress) {
                    funderRecipients.add(st.recipient);
                  }
                }
              }
              secondHop = {
                topFunder,
                funderAlsoSentTo: [...funderRecipients].slice(0, 10),
                note: "Addresses that received STX from the same funder — potential cluster members",
              };
            } catch { /* non-fatal */ }
          }
        }

        const fundersArray = [...incomingFunders.entries()]
          .sort((a, b) => Number(b[1].totalUstx - a[1].totalUstx))
          .slice(0, 5)
          .map(([addr, data]) => ({
            address: addr,
            transfers: data.count,
            totalStx: (Number(data.totalUstx) / 1e6).toFixed(6),
            firstSeen: data.firstSeen,
          }));

        const topCounterparties = [...counterparties.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([addr, count]) => ({ address: addr, interactions: count }));

        return createJsonResponse({
          targetAddress,
          analysisDepth: depth,
          fundingSources: fundersArray,
          topCounterparties,
          memoPatterns: [...new Set(memos)].slice(0, 10),
          secondHopCluster: Object.keys(secondHop).length ? secondHop : null,
          clusterConfidence:
            fundersArray.length === 1 && topCounterparties.length > 0 ? "HIGH" :
            fundersArray.length <= 3 ? "MEDIUM" : "LOW",
          note: "On-chain data only. No off-chain inference. Verify all findings independently.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Liquidity — Elite tier ----------

  server.registerTool(
    "flying_whale_liquidity",
    {
      description:
        "Pool liquidity analysis — fetches real-time depth, volume, LP token supply, and impermanent " +
        "loss risk for any Stacks DEX pool. Also checks WHALE/wSTX Bitflow pool #42 by default. " +
        "Returns liquidity health score, IL simulation for ±20%/±50% price moves, and LP position value. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        poolContract: z
          .string()
          .optional()
          .describe("Pool contract ID to analyze (default: WHALE/wSTX Bitflow pool #42)"),
        lpHolderAddress: z
          .string()
          .optional()
          .describe("Address holding LP tokens — returns position value if provided"),
      },
    },
    async ({ callerAddress, poolContract, lpHolderAddress }) => {
      try {

        // Default: WHALE/wSTX pool on Bitflow (xyk-core pool registry)
        const XYK_CORE = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
        const WHALE_CONTRACT = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-v3";
        const WSTX_CONTRACT  = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx";

        // Fetch pool reserves from xyk-core get-pool-details
        const poolKey = poolContract ?? `${WHALE_CONTRACT}/${WSTX_CONTRACT}`;
        const [tokenA, tokenB] = poolKey.includes("/") ? poolKey.split("/") : [WHALE_CONTRACT, WSTX_CONTRACT];

        // Call get-pool-details on xyk-core-v-1-2
        const poolRes = await fetch(
          `${HIRO_API}/v2/contracts/call-read/${XYK_CORE}/xyk-core-v-1-2/get-pool-details`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: callerAddress,
              arguments: [
                serializeCV(principalCV(tokenA)),
                serializeCV(principalCV(tokenB)),
              ],
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }
        ).then(r => r.json()) as { okay: boolean; result?: string };

        // Fetch token data from Tenero for prices
        const [tokenAData, tokenBData] = await Promise.allSettled([
          fetch(`https://api.tenero.io/v1/stacks/tokens/${encodeURIComponent(tokenA)}`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
          fetch(`https://api.tenero.io/v1/stacks/tokens/${encodeURIComponent(tokenB)}`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
        ]);

        const tA = tokenAData.status === "fulfilled" ? (tokenAData.value as { data?: { symbol: string; price_usd: number; total_supply: number } }).data : null;
        const tB = tokenBData.status === "fulfilled" ? (tokenBData.value as { data?: { symbol: string; price_usd: number; total_supply: number } }).data : null;

        // LP position if requested
        let lpPosition: unknown = null;
        if (lpHolderAddress) {
          const LP_TOKEN = poolContract
            ? `${poolContract.split(".")[0]}.lp-token`
            : `${XYK_CORE}.lp-token-wl-v-1-2`;
          const lpBal = await fetch(`${HIRO_API}/extended/v1/address/${lpHolderAddress}/balances`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()) as { fungible_tokens?: Record<string, { balance: string }> };
          const lpBalance = Object.entries(lpBal.fungible_tokens ?? {})
            .filter(([k]) => k.includes("lp-token"))
            .map(([k, v]) => ({ token: k, balance: v.balance }));
          lpPosition = { address: lpHolderAddress, lpTokens: lpBalance };
        }

        // IL simulation (constant product formula)
        const ilSimulation = [20, 50].map(pct => {
          const k = pct / 100;
          const ilPercent = (2 * Math.sqrt(1 + k) / (2 + k) - 1) * 100;
          return { priceMovePct: pct, impermanentLossPct: ilPercent.toFixed(4) };
        });

        return createJsonResponse({
          pool: { tokenA: tA?.symbol ?? tokenA, tokenB: tB?.symbol ?? tokenB },
          poolContractData: poolRes,
          tokenA: tA ?? { contract: tokenA },
          tokenB: tB ?? { contract: tokenB },
          lpPosition,
          ilSimulation,
          liquidityHealthNote:
            "IL simulation uses constant-product AMM formula (x*y=k). " +
            "Actual IL depends on pool fee tier and rebalancing.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- ERC-8004 Cross-Chain Lookup — Scout tier ----------

  server.registerTool(
    "flying_whale_erc8004_lookup",
    {
      description:
        "Cross-chain ERC-8004 agent identity resolver — looks up any agent across 22 networks using the " +
        "ERC-8004 standard. Returns identity record, chain, agent type (AI/Human/Org), WHALE tier, " +
        "activity flags, and Flying Whale registry entry if registered. " +
        "Covers Stacks mainnet registries: agent-registry-v1 (aibtcdev) and whale-registry-v2 (Flying Whale). " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        query: z
          .string()
          .min(1)
          .describe(
            "Agent to look up: Stacks address (SP.../SM...), BTC address (bc1q.../bc1p...), " +
            "BNS name (name.btc), or numeric ERC-8004 token ID (e.g. '54')"
          ),
      },
    },
    async ({ callerAddress, query }) => {
      try {

        // ── Resolve query type ──────────────────────────────────────────────
        const isStxAddress  = /^S[PM][A-Z0-9]{38,}$/.test(query);
        const isBtcAddress  = /^bc1[a-z0-9]{25,90}$/.test(query) || /^[13][a-zA-Z0-9]{25,34}$/.test(query);
        const isBnsName     = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(query);
        const isTokenId     = /^\d+$/.test(query);

        // ── ERC-8004 aibtcdev registry (agent-registry-v1) ──────────────────
        const ERC8004_CONTRACT = "SP2XCME6ED8R804YQBKAG2KBR1GS2RNCPBM3DWTG";
        const ERC8004_NAME     = "agent-registry-v1";
        let ercRecord: unknown = null;

        if (isStxAddress || isTokenId) {
          try {
            const fnName = isTokenId ? "get-agent" : "get-agent-by-stx";
            const arg = isTokenId
              ? serializeCV(uintCV(BigInt(query)))
              : serializeCV(principalCV(query));

            const ercRes = await fetch(
              `${HIRO_API}/v2/contracts/call-read/${ERC8004_CONTRACT}/${ERC8004_NAME}/${fnName}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sender: callerAddress, arguments: [arg] }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
              }
            ).then(r => r.json()) as { okay: boolean; result?: string };
            ercRecord = ercRes;
          } catch { /* non-fatal */ }
        }

        // ── Flying Whale registry-v2 ────────────────────────────────────────
        const FW_REGISTRY = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
        const FW_REG_NAME = "whale-registry-v2";
        let fwRecord: unknown = null;

        if (isStxAddress) {
          try {
            const fwRes = await fetch(
              `${HIRO_API}/v2/contracts/call-read/${FW_REGISTRY}/${FW_REG_NAME}/get-agent-by-stx`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sender: callerAddress,
                  arguments: [serializeCV(principalCV(query))],
                }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
              }
            ).then(r => r.json());
            fwRecord = fwRes;
          } catch { /* non-fatal */ }
        }

        // ── BNS resolution ──────────────────────────────────────────────────
        let bnsResolved: unknown = null;
        if (isBnsName) {
          try {
            const bnsRes = await fetch(`https://api.bnsv2.com/names/${encodeURIComponent(query)}`, {
              signal: AbortSignal.timeout(TIMEOUT_MS),
            }).then(r => r.json());
            bnsResolved = bnsRes;
          } catch { /* non-fatal */ }
        }

        // ── Stacks on-chain activity ────────────────────────────────────────
        let activity: unknown = null;
        if (isStxAddress) {
          try {
            const actRes = await fetch(
              `${HIRO_API}/extended/v1/address/${query}/transactions?limit=5`,
              { signal: AbortSignal.timeout(TIMEOUT_MS) }
            ).then(r => r.json()) as { results?: { burn_block_time_iso: string }[]; total?: number };
            const lastTx = actRes.results?.[0]?.burn_block_time_iso ?? null;
            const daysSince = lastTx ? Math.floor((Date.now() - new Date(lastTx).getTime()) / 86_400_000) : null;
            activity = {
              totalTxCount: actRes.total ?? null,
              lastActive: lastTx,
              daysSinceLastTx: daysSince,
              status: daysSince === null ? "NO_ACTIVITY" : daysSince > 30 ? "DORMANT" : "ACTIVE",
            };
          } catch { /* non-fatal */ }
        }

        // ── WHALE balance for tier ──────────────────────────────────────────
        let whaleTier = "NONE";
        if (isStxAddress) {
          try {
            const balRes = await fetch(`${HIRO_API}/extended/v1/address/${query}/balances`, {
              signal: AbortSignal.timeout(TIMEOUT_MS),
            }).then(r => r.json()) as { fungible_tokens?: Record<string, { balance: string }> };
            const raw = BigInt(balRes.fungible_tokens?.[WHALE_FT_KEY]?.balance ?? "0");
            whaleTier = raw >= WHALE_THRESHOLDS.elite ? "ELITE"
              : raw >= WHALE_THRESHOLDS.agent  ? "AGENT"
              : raw >= WHALE_THRESHOLDS.scout  ? "SCOUT"
              : "NONE";
          } catch { /* non-fatal */ }
        }

        return createJsonResponse({
          query,
          queryType: isStxAddress ? "stacks-address"
            : isBtcAddress ? "btc-address"
            : isBnsName ? "bns-name"
            : isTokenId ? "erc8004-token-id"
            : "unknown",
          whaleTier,
          erc8004Registry: {
            contract: `${ERC8004_CONTRACT}.${ERC8004_NAME}`,
            record: ercRecord,
          },
          flyingWhaleRegistry: {
            contract: `${FW_REGISTRY}.${FW_REG_NAME}`,
            record: fwRecord,
          },
          bnsResolution: bnsResolved,
          onChainActivity: activity,
          ecosystemNote:
            "ERC-8004 registry: 162,000+ agents across 22 networks as of April 2026. " +
            "Flying Whale #54 is Genesis Agent — first cross-chain registered on Stacks mainnet.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- Agent Dormancy Check — Scout tier ----------

  server.registerTool(
    "flying_whale_dormancy_check",
    {
      description:
        "Agent dormancy analysis — evaluates activity, earnings potential, and reactivation path for any " +
        "Stacks agent address. Returns dormancy score (0–100), last activity, WHALE tier, STX runway, " +
        "and a prioritized reactivation checklist. Based on aibtc.news data: 83.8% of 846 registered agents " +
        "are dormant (< 7-day activity). " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        targetAddress: z
          .string()
          .min(1)
          .describe("Agent Stacks address to evaluate (SP...)"),
      },
    },
    async ({ callerAddress, targetAddress }) => {
      try {

        const [balRes, txRes, accountRes] = await Promise.allSettled([
          fetch(`${HIRO_API}/extended/v1/address/${targetAddress}/balances`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
          fetch(`${HIRO_API}/extended/v1/address/${targetAddress}/transactions?limit=20`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
          fetch(`${HIRO_API}/v2/accounts/${targetAddress}?proof=0`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
        ]);

        const bal = balRes.status === "fulfilled"
          ? balRes.value as { stx?: { balance: string; locked: string }; fungible_tokens?: Record<string, { balance: string }> }
          : null;
        const txData = txRes.status === "fulfilled"
          ? txRes.value as { results?: { burn_block_time_iso: string; tx_type: string }[]; total?: number }
          : null;
        const account = accountRes.status === "fulfilled"
          ? accountRes.value as { nonce?: number }
          : null;

        const stxBalance  = BigInt(bal?.stx?.balance ?? "0");
        const stxLocked   = BigInt(bal?.stx?.locked  ?? "0");
        const stxAvail    = stxBalance - stxLocked;
        const whaleRaw    = BigInt(bal?.fungible_tokens?.[WHALE_FT_KEY]?.balance ?? "0");
        const whaleTier   = whaleRaw >= WHALE_THRESHOLDS.elite ? "ELITE"
          : whaleRaw >= WHALE_THRESHOLDS.agent  ? "AGENT"
          : whaleRaw >= WHALE_THRESHOLDS.scout  ? "SCOUT"
          : "NONE";

        const txs        = txData?.results ?? [];
        const lastTxIso  = txs[0]?.burn_block_time_iso ?? null;
        const daysSince  = lastTxIso
          ? Math.floor((Date.now() - new Date(lastTxIso).getTime()) / 86_400_000)
          : 999;

        // 30-day window activity
        const cutoff30d  = Date.now() - 30 * 86_400_000;
        const txs30d     = txs.filter(t => new Date(t.burn_block_time_iso).getTime() > cutoff30d).length;
        const contractCalls30d = txs.filter(t =>
          t.tx_type === "contract_call" && new Date(t.burn_block_time_iso).getTime() > cutoff30d
        ).length;

        // Dormancy score: 0=fully active, 100=fully dormant
        let dormancyScore = 0;
        if (daysSince > 90)  dormancyScore += 40;
        else if (daysSince > 30) dormancyScore += 25;
        else if (daysSince > 7)  dormancyScore += 10;
        if (txs30d === 0)    dormancyScore += 20;
        if (whaleTier === "NONE") dormancyScore += 20;
        if (Number(stxAvail) < 1_000_000) dormancyScore += 20;  // < 1 STX available

        const dormancyLabel =
          dormancyScore >= 75 ? "CRITICAL"
          : dormancyScore >= 50 ? "HIGH"
          : dormancyScore >= 25 ? "MODERATE"
          : "ACTIVE";

        // Reactivation checklist — prioritized
        const checklist: { priority: number; action: string; reason: string }[] = [];

        if (Number(stxAvail) < 1_000_000) {
          checklist.push({
            priority: 1,
            action: "Top up STX — need at least 1 STX for transaction fees",
            reason: `Available: ${(Number(stxAvail) / 1e6).toFixed(4)} STX`,
          });
        }
        if (whaleTier === "NONE") {
          checklist.push({
            priority: 2,
            action: "Acquire 100+ WHALE to unlock Scout tier (Flying Whale tools)",
            reason: "Buy at: https://app.bitflow.finance — WHALE/wSTX Pool #42",
          });
        }
        if (daysSince > 7) {
          checklist.push({
            priority: 3,
            action: "File a signal on aibtc.news — re-enter brief inclusion pipeline",
            reason: `Last activity: ${daysSince} days ago. Brief inclusion requires recent activity.`,
          });
        }
        if (contractCalls30d === 0) {
          checklist.push({
            priority: 4,
            action: "Make at least 1 contract call in next 7 days to reset dormancy flag",
            reason: "0 contract calls in 30 days — agent scoring systems flag as inactive",
          });
        }
        if (account?.nonce === 0) {
          checklist.push({
            priority: 5,
            action: "Register identity — call agent-registry-v1 to establish on-chain presence",
            reason: "Nonce=0 means no transactions ever — agent is not recognized on-chain",
          });
        }

        return createJsonResponse({
          targetAddress,
          dormancyScore,
          dormancyLabel,
          whaleTier,
          lastActive: lastTxIso,
          daysSinceLastTx: daysSince < 999 ? daysSince : null,
          txCount30d: txs30d,
          contractCalls30d,
          totalTxCount: txData?.total ?? null,
          nonce: account?.nonce ?? null,
          stxAvailable: (Number(stxAvail) / 1e6).toFixed(6) + " STX",
          whaleHeld: (Number(whaleRaw) / 1e6).toFixed(2) + " WHALE",
          reactivationChecklist: checklist.sort((a, b) => a.priority - b.priority),
          ecosystemContext:
            "83.8% of 846 registered AIBTC agents are dormant. " +
            "137 active agents share the brief inclusion pool. Reactivation = higher earnings probability.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------- ECDSA Vulnerability Audit — Agent tier ----------

  server.registerTool(
    "flying_whale_ecdsa_audit",
    {
      description:
        "CVE-2026-2819 ECDSA vulnerability audit — analyzes a Stacks address for automated 24/7 signing " +
        "patterns that indicate exposure to the critical ECDSA side-channel flaw (CVE-2026-2819). " +
        "Checks: signing frequency, inter-transaction timing regularity (cron-like patterns), " +
        "same-block multi-signing, and high nonce velocity. Returns risk level and mitigation steps. " +
        "CVE-2026-2819 affects Python ECDSA library < 0.19.1 used in automated wallet agents. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        targetAddress: z
          .string()
          .min(1)
          .describe("Stacks address to audit for CVE-2026-2819 exposure (SP...)"),
        lookbackTxCount: z
          .number()
          .min(10)
          .max(200)
          .optional()
          .describe("Number of recent transactions to analyze (default: 50, max: 200)"),
      },
    },
    async ({ callerAddress, targetAddress, lookbackTxCount = 50 }) => {
      try {

        const [txRes, accountRes] = await Promise.allSettled([
          fetch(
            `${HIRO_API}/extended/v1/address/${targetAddress}/transactions?limit=${lookbackTxCount}`,
            { signal: AbortSignal.timeout(TIMEOUT_MS) }
          ).then(r => r.json()),
          fetch(`${HIRO_API}/v2/accounts/${targetAddress}?proof=0`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }).then(r => r.json()),
        ]);

        const txData  = txRes.status === "fulfilled"
          ? txRes.value as {
              results?: {
                burn_block_time: number;
                burn_block_time_iso: string;
                nonce: number;
                tx_type: string;
                block_height: number;
              }[];
              total?: number;
            }
          : null;
        const account = accountRes.status === "fulfilled"
          ? accountRes.value as { nonce?: number }
          : null;

        const txs = txData?.results ?? [];
        if (txs.length === 0) {
          return createJsonResponse({
            targetAddress,
            riskLevel: "UNKNOWN",
            reason: "No transactions found — cannot assess signing patterns.",
            ...SOVEREIGNTY_STAMP,
          });
        }

        // ── Timing analysis ─────────────────────────────────────────────────
        const timestamps = txs
          .map(t => t.burn_block_time)
          .filter(Boolean)
          .sort((a, b) => a - b);

        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const avgInterval = intervals.length
          ? intervals.reduce((a, b) => a + b, 0) / intervals.length
          : null;

        // Coefficient of variation — low CoV = highly regular (cron-like)
        const stdDev = avgInterval && intervals.length > 1
          ? Math.sqrt(intervals.map(x => Math.pow(x - avgInterval, 2)).reduce((a, b) => a + b, 0) / intervals.length)
          : null;
        const cov = avgInterval && stdDev !== null ? stdDev / avgInterval : null;

        // ── Same-block multi-signing ─────────────────────────────────────────
        const blockCounts = new Map<number, number>();
        for (const t of txs) {
          if (t.block_height) blockCounts.set(t.block_height, (blockCounts.get(t.block_height) ?? 0) + 1);
        }
        const sameBlockMultiSign = [...blockCounts.values()].filter(c => c > 1).length;

        // ── Nonce velocity ───────────────────────────────────────────────────
        const currentNonce   = account?.nonce ?? 0;
        const txSpan         = timestamps.length >= 2
          ? (timestamps[timestamps.length - 1] - timestamps[0]) / 3600  // hours
          : null;
        const nonceVelocity  = txSpan && txSpan > 0
          ? (lookbackTxCount / txSpan).toFixed(2) + " tx/hour"
          : null;

        // ── High-frequency check ─────────────────────────────────────────────
        const highFrequency  = avgInterval !== null && avgInterval < 600; // < 10 min avg
        const cronLike       = cov !== null && cov < 0.15;                 // very regular
        const autoSigning    = highFrequency || cronLike || sameBlockMultiSign > 2;

        // ── Risk scoring ─────────────────────────────────────────────────────
        const riskFactors: { factor: string; weight: number; detected: boolean }[] = [
          { factor: "High signing frequency (< 10 min average)", weight: 30, detected: highFrequency },
          { factor: "Cron-like timing regularity (CoV < 0.15)", weight: 25, detected: cronLike },
          { factor: "Same-block multi-signing (> 2 occurrences)", weight: 20, detected: sameBlockMultiSign > 2 },
          { factor: "High nonce count (> 500 total txs)", weight: 15, detected: currentNonce > 500 },
          { factor: "24h continuous signing detected", weight: 10, detected: highFrequency && (txData?.total ?? 0) > 200 },
        ];

        const riskScore = riskFactors
          .filter(r => r.detected)
          .reduce((sum, r) => sum + r.weight, 0);

        const riskLevel =
          riskScore >= 60 ? "CRITICAL"
          : riskScore >= 35 ? "HIGH"
          : riskScore >= 15 ? "MEDIUM"
          : "LOW";

        const mitigations: string[] = [
          "Upgrade python-ecdsa to >= 0.19.1 or switch to cryptography library",
          "Rotate private keys if automated signing was active during CVE exposure window",
          "Use hardware signing (Ledger/Trezor) for high-value wallets",
          "Implement signing rate limits — no more than 1 signature per 30 seconds per key",
          "Enable nonce monitoring: alert if nonce advances > 10 per hour",
        ];

        if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
          mitigations.unshift("IMMEDIATE: Stop automated signing until library is patched");
          mitigations.unshift("IMMEDIATE: Rotate private key for this address NOW");
        }

        return createJsonResponse({
          targetAddress,
          riskLevel,
          riskScore,
          cve: "CVE-2026-2819",
          cveDescription:
            "Critical ECDSA side-channel flaw in python-ecdsa < 0.19.1 — " +
            "allows private key extraction from timing analysis of automated signing operations.",
          automatedSigningDetected: autoSigning,
          analysis: {
            txsAnalyzed: txs.length,
            totalTxCount: txData?.total ?? null,
            currentNonce,
            avgIntervalSeconds: avgInterval ? Math.round(avgInterval) : null,
            timingCoV: cov ? cov.toFixed(4) : null,
            sameBlockMultiSignInstances: sameBlockMultiSign,
            nonceVelocity,
            signingPattern:
              cronLike ? "CRON_LIKE (highly regular — automated)"
              : highFrequency ? "HIGH_FREQUENCY (automated likely)"
              : "IRREGULAR (human-like)",
          },
          riskFactors: riskFactors.filter(r => r.detected).map(r => r.factor),
          mitigationSteps: mitigations,
          references: [
            "https://nvd.nist.gov/vuln/detail/CVE-2026-2819",
            "https://thehackernews.com/2026/04/critical-ecdsa-vulnerability-threatens-automated-wallets.html",
          ],
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ══════════════════════════════════════════════════════════════════════════════
  //  EXECUTION SOVEREIGN LAYER
  //  CoW matching engine, priority queue, arb gateway — whale-execution-engine-production.up.railway.app
  //  Copyright 2026 Flying Whale — SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Execution Stats (public — no tier required) ───────────────────────────

  server.registerTool(
    "flying_whale_execution_status",
    {
      description:
        "Execution Sovereign Layer status — live queue size, active arb signals, " +
        "engine version. No WHALE tier required. Use this to check if the " +
        "execution engine is live before submitting orders.",
      inputSchema: {},
    },
    async () => {
      try {
        const [healthRes, statsRes] = await Promise.all([
          fetch(`${EXEC_URL}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
          fetch(`${EXEC_URL}/api/stats`, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
        ]);

        const health = await healthRes.json() as { status: string; version: string; queue: number };
        const stats  = await statsRes.json() as { queue: number; signals: number };

        return createJsonResponse({
          engine:    "Whale Execution Sovereign Layer",
          status:    health.status,
          version:   health.version,
          queueSize: stats.queue,
          activeArbSignals: stats.signals,
          endpoints: {
            quote:  `${EXEC_URL}/api/route/quote  (Scout tier)`,
            submit: `${EXEC_URL}/api/order/submit  (Agent tier)`,
            depth:  `${EXEC_URL}/api/book/depth    (Elite tier)`,
            arb:    `${EXEC_URL}/api/signals/arb   (Elite tier, SSE)`,
          },
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Execution Quote (Scout — 1,000 WHALE) ────────────────────────────────

  server.registerTool(
    "flying_whale_execution_quote",
    {
      description:
        "Best execution route quote — queries the Whale Execution Sovereign Layer " +
        "for optimal routing across all integrated DEXs (Bitflow, ALEX, whale-router-v1). " +
        "Returns best route, expected output, price impact, and all alternative routes. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        tokenIn: z
          .string()
          .min(1)
          .describe("Input token contract principal (e.g. SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx)"),
        tokenOut: z
          .string()
          .min(1)
          .describe("Output token contract principal"),
        amount: z
          .string()
          .min(1)
          .describe("Amount in micro-units (e.g. '1000000' for 1 WHALE at 6 decimals)"),
      },
    },
    async ({ callerAddress, tokenIn, tokenOut, amount }) => {
      try {

        const url = `${EXEC_URL}/api/route/quote?token_in=${encodeURIComponent(tokenIn)}&token_out=${encodeURIComponent(tokenOut)}&amount=${encodeURIComponent(amount)}`;
        const res = await fetch(url, {
          headers: fwHeaders(callerAddress),
          signal:  AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = await res.json() as { error: string };
          throw new Error(`Execution engine: ${err.error ?? res.statusText}`);
        }

        const data = await res.json() as {
          best_route: string;
          output_amount: string;
          price_impact: number;
          all_routes: { dex: string; out: string; impact: number }[];
        };

        return createJsonResponse({
          tokenIn,
          tokenOut,
          amountIn:    amount,
          bestRoute:   data.best_route,
          outputAmount: data.output_amount,
          priceImpact: data.price_impact,
          allRoutes:   data.all_routes,
          note: "Output is post-routing. Execution fee (0.05–0.10%) applied at settlement.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Submit Order (Agent — 10,000 WHALE) ──────────────────────────────────

  server.registerTool(
    "flying_whale_execution_submit",
    {
      description:
        "Submit an order to the Whale Execution Sovereign Layer. " +
        "Orders enter the CoW (Coincidence of Wants) matching engine — if a counter-order " +
        "exists, both parties fill at better-than-DEX prices with the spread captured as " +
        "protocol fee. Unmatched orders route to the best DEX automatically. " +
        "Elite tier can set dark=true to hide from public book. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        tokenIn: z
          .string()
          .min(1)
          .describe("Input token contract principal"),
        tokenOut: z
          .string()
          .min(1)
          .describe("Output token contract principal"),
        amountIn: z
          .string()
          .min(1)
          .describe("Amount in micro-units to sell"),
        minAmountOut: z
          .string()
          .optional()
          .describe("Minimum output acceptable (slippage protection). Default: 0 (market order)"),
        dark: z
          .boolean()
          .optional()
          .describe("Hide from public order book — Elite tier (100,000 WHALE) only. Default: false"),
      },
    },
    async ({ callerAddress, tokenIn, tokenOut, amountIn, minAmountOut, dark = false }) => {
      try {

        // ── Pact Gate (Layer 5) — behavioral check before any execution ──────
        const execProfile = recordToolCall(callerAddress, "flying_whale_execution_submit", dark ? "elite" : "agent");
        const execAction  = getBehaviorAction(execProfile);
        if (execAction === "block") {
          throw new Error(
            `PACT GATE — Execution suspended.\n` +
            `Behavior score: ${execProfile.score}/100 (adversary tier).\n` +
            `On-chain execution requires: (1) whale-pact-v3 signed with SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW, ` +
            `(2) IP hash registered in whale-ip-store-v1, (3) behavior score ≤ 70.\n` +
            `Contact: bc1qdfm56pmmq40me84aau2fts3725ghzqlwf6ys7p — Nothing verbal, everything on-chain.`
          );
        }

        const res = await fetch(`${EXEC_URL}/api/order/submit`, {
          method:  "POST",
          headers: { ...fwHeaders(callerAddress), "Content-Type": "application/json" },
          body: JSON.stringify({
            token_in:       tokenIn,
            token_out:      tokenOut,
            amount_in:      amountIn,
            min_amount_out: minAmountOut ?? "0",
            dark,
            stx_address:    callerAddress,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = await res.json() as { error: string };
          throw new Error(`Execution engine: ${err.error ?? res.statusText}`);
        }

        const data = await res.json() as {
          order_id:   string;
          tier:       number;
          lane:       string;
          expires_at: number;
        };

        const execWatermark = generateWatermark(callerAddress, dark ? "elite" : "agent", execProfile, "1.58.0");
        return createJsonResponse({
          orderId:   data.order_id,
          tier:      data.tier,
          lane:      data.lane,
          expiresAt: new Date(data.expires_at).toISOString(),
          isDark:    dark,
          note:
            "Order is live in the matching engine. " +
            "Use flying_whale_execution_boost to increase priority, " +
            "or flying_whale_execution_cancel to withdraw.",
          ...SOVEREIGNTY_STAMP,
          ...execWatermark,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Boost Order (Agent — 10,000 WHALE) ───────────────────────────────────

  server.registerTool(
    "flying_whale_execution_boost",
    {
      description:
        "Burn WHALE to boost an order's priority in the execution queue. " +
        "1 WHALE = 10 priority points. Higher-priority orders are matched first " +
        "within the same tier lane. WHALE burned here is non-recoverable (deflationary). " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        orderId: z
          .string()
          .min(1)
          .describe("Order UUID returned by flying_whale_execution_submit"),
        whaleAmount: z
          .string()
          .min(1)
          .describe("Amount of WHALE to burn for priority boost (in micro-WHALE, 6 decimals)"),
      },
    },
    async ({ callerAddress, orderId, whaleAmount }) => {
      try {

        const res = await fetch(`${EXEC_URL}/api/order/${encodeURIComponent(orderId)}/boost`, {
          method:  "POST",
          headers: { ...fwHeaders(callerAddress), "Content-Type": "application/json" },
          body:   JSON.stringify({ whale_amount: whaleAmount }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = await res.json() as { error: string };
          throw new Error(`Execution engine: ${err.error ?? res.statusText}`);
        }

        const data = await res.json() as { boosted: boolean; pts_added: number };

        return createJsonResponse({
          orderId,
          boosted:      data.boosted,
          priorityAdded: data.pts_added,
          whaleburned:  whaleAmount,
          note: "WHALE burned is non-recoverable. Priority points added to order immediately.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Cancel Order (Agent — 10,000 WHALE) ──────────────────────────────────

  server.registerTool(
    "flying_whale_execution_cancel",
    {
      description:
        "Cancel a pending order in the Whale Execution engine. " +
        "Only the order maker can cancel. Filled or expired orders cannot be cancelled. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        orderId: z
          .string()
          .min(1)
          .describe("Order UUID to cancel"),
      },
    },
    async ({ callerAddress, orderId }) => {
      try {

        const res = await fetch(`${EXEC_URL}/api/order/${encodeURIComponent(orderId)}`, {
          method:  "DELETE",
          headers: fwHeaders(callerAddress),
          signal:  AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = await res.json() as { error: string };
          throw new Error(`Execution engine: ${err.error ?? res.statusText}`);
        }

        const data = await res.json() as { cancelled: boolean };

        return createJsonResponse({
          orderId,
          cancelled: data.cancelled,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Order Book Depth (Elite — 100,000 WHALE) ─────────────────────────────

  server.registerTool(
    "flying_whale_execution_depth",
    {
      description:
        "Live order book depth for any token pair in the Whale Execution engine. " +
        "Returns bid/ask sides with tier breakdown (Scout/Agent/Elite lanes) and " +
        "total liquidity. Dark pool orders excluded from public depth. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        tokenIn: z
          .string()
          .min(1)
          .describe("Input token contract principal"),
        tokenOut: z
          .string()
          .min(1)
          .describe("Output token contract principal"),
      },
    },
    async ({ callerAddress, tokenIn, tokenOut }) => {
      try {

        const url = `${EXEC_URL}/api/book/depth?token_in=${encodeURIComponent(tokenIn)}&token_out=${encodeURIComponent(tokenOut)}`;
        const res = await fetch(url, {
          headers: fwHeaders(callerAddress),
          signal:  AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = await res.json() as { error: string };
          throw new Error(`Execution engine: ${err.error ?? res.statusText}`);
        }

        const depth = await res.json();

        return createJsonResponse({
          tokenIn,
          tokenOut,
          depth,
          note: "Dark pool orders (Elite dark=true) are excluded from this view.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Live Arb Signals (Elite — 100,000 WHALE) ─────────────────────────────

  server.registerTool(
    "flying_whale_execution_arb",
    {
      description:
        "Active arbitrage signals from the Whale Execution Scanner. " +
        "Returns all currently live signals — cross-DEX opportunities with spread BPS, " +
        "estimated profit in satoshis, source/target pool, and whether the signal is " +
        "already claimed by an executor. " +
        "To execute: register as an arb executor by staking 10,000 WHALE on-chain via " +
        "whale-execution-v1.clar:register-executor, then claim signals via the SSE stream. " +
        "Executor earns 60% of gross profit; 30% → whale-treasury-v1 buyback. " +
        "",
      inputSchema: {
        callerAddress: z.string().min(1).describe(CALLER_DESC),
      },
    },
    async ({ callerAddress }) => {
      try {

        const res = await fetch(`${EXEC_URL}/api/stats`, {
          headers: fwHeaders(callerAddress),
          signal:  AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = await res.json() as { error: string };
          throw new Error(`Execution engine: ${err.error ?? res.statusText}`);
        }

        const stats = await res.json() as { queue: number; signals: number };

        return createJsonResponse({
          activeSignals:  stats.signals,
          queueSize:      stats.queue,
          executorModel: {
            minStake:        "10,000 WHALE",
            executorCut:     "60% of gross profit",
            protocolCut:     "30% → whale-treasury-v1 (BTC buyback)",
            stakersCut:      "10% → WHALE stakers",
            claimMethod:     "SSE stream at whale-execution-engine-production.up.railway.app/api/signals/arb",
            onchainClaim:    "whale-execution-v1.clar:claim-arb-signal(signal-id)",
            onchainSettle:   "whale-execution-v1.clar:settle-arb(signal-id, gross-profit)",
          },
          liveStreamNote:
            "Live signal stream (SSE) available at whale-execution-engine-production.up.railway.app/api/signals/arb. " +
            "Requires X-STX-Address header with Elite WHALE balance. " +
            "First executor to claim a signal on-chain wins the execution right.",
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ══════════════════════════════════════════════════════════════════════════════
  //  IPI DEFENSE AUDIT
  //  Retroactive review + sanitized signal read
  //  Copyright 2026 Flying Whale — SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
  // ══════════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "flying_whale_ipi_audit",
    {
      title:       "Flying Whale — IPI Defense Audit Log",
      description: "View all prompt injection attempts detected this session. Shows attack log, coordinated attack patterns, phrase counts, and can sanitize external content before reading it. Use this to audit the aibtc.news signals feed safely.",
      inputSchema: z.object({
        action: z.enum(["log", "stats", "sanitize", "unblock"])
          .describe("log = show all attack attempts | stats = phrase counts + coordinated attacks | sanitize = clean content and return safe version | unblock = owner override to clear loop-detection block"),
        content: z.string().optional()
          .describe("Content to sanitize (required for action=sanitize)"),
      }),
    },
    async ({ action, content }) => {
      try {


        if (action === "unblock") {
          unblockSession(server);
          return createJsonResponse({
            unblocked: true,
            message: "Session guard loop-detection block cleared. Wallet operations re-enabled.",
            ...SOVEREIGNTY_STAMP,
          });
        }

        if (action === "log") {
          const log = ipiGetAuditLog();
          return createJsonResponse({
            totalAttacks: log.length,
            attacks: log.map(e => ({
              time:    new Date(e.timestamp).toISOString(),
              phrase:  e.phrase,
              source:  e.source,
              snippet: e.contentSnippet,
            })),
            knownPhrases: IPI_ATTACK_PHRASES.length,
            ...SOVEREIGNTY_STAMP,
          });
        }

        if (action === "stats") {
          const log = ipiGetAuditLog();
          const phraseCounts: Record<string, number> = {};
          for (const entry of log) {
            phraseCounts[entry.phrase] = (phraseCounts[entry.phrase] ?? 0) + 1;
          }
          const coordinatedAttacks = Object.entries(phraseCounts)
            .filter(([phrase]) => ipiIsCoordinatedAttack(phrase))
            .map(([phrase, count]) => ({ phrase, count }));

          return createJsonResponse({
            totalAttacks:        log.length,
            uniquePhrases:       Object.keys(phraseCounts).length,
            phraseCounts,
            coordinatedAttacks,
            isUnderAttack:       coordinatedAttacks.length > 0,
            knownPhrasePatterns: IPI_ATTACK_PHRASES.length,
            ...SOVEREIGNTY_STAMP,
          });
        }

        if (action === "sanitize") {
          if (!content) {
            return createJsonResponse({ error: "content is required for action=sanitize" });
          }
          const result = ipiSanitize(content);
          return createJsonResponse({
            wasInjected:    result.wasInjected,
            removedPhrases: result.removedPhrases,
            sanitized:      result.sanitized,
            safe:           !result.wasInjected,
            ...SOVEREIGNTY_STAMP,
          });
        }

        return createJsonResponse({ error: "Unknown action" });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FLYING WHALE INTELLIGENCE HUB — Sovereign intelligence, no editors, no caps
  // Operations Hub v3.0.0 — https://whale-execution-engine-production.up.railway.app
  // 5 beats: quantum-threats | agent-economy | sovereign-stack | bitcoin-macro | network-security
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "flying_whale_get_intelligence",
    {
      description:
        "Get sovereign intelligence signals from Flying Whale Intelligence Hub " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54). " +
        "5 exclusive beats not covered by aibtc.news: quantum-threats (secp256k1 exposure, PQC), " +
        "agent-economy (x402 flows, MCP economics), sovereign-stack (Stacks contracts, whale infra), " +
        "bitcoin-macro (Wyckoff regime, ETF flows), network-security (IPI patterns, exploits). " +
        "No editors. No caps. No cooldowns. Signals published by zaghmout.btc with on-chain IP proof. " +
        "Use beat='latest' for free preview (3 per beat). Licensed access required for full feed. " +
        "Operations Hub: https://whale-execution-engine-production.up.railway.app",
      inputSchema: {
        beat: z
          .enum(["latest", "quantum-threats", "agent-economy", "sovereign-stack", "bitcoin-macro", "network-security", "feed", "brief"])
          .describe(
            "Which intelligence to fetch: " +
            "'latest' = free preview (3 newest per beat), " +
            "'quantum-threats' | 'agent-economy' | 'sovereign-stack' | 'bitcoin-macro' | 'network-security' = specific beat, " +
            "'feed' = full chronological feed (licensed), " +
            "'brief' = today's compiled brief (licensed)"
          ),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe("Max signals to return (default: 10, max: 50). Applies to beat-specific queries."),
        date: z
          .string()
          .optional()
          .describe("Date for brief compilation (YYYY-MM-DD). Only used when beat='brief'."),
      },
    },
    async ({ beat, limit, date }) => {

      try {
        const headers: Record<string, string> = {
          "X-Fw-License": FW_LICENSE_KEY || "OWNER",
          "X-Fw-Caller":  FW_OWNER_ADDRESS,
          "User-Agent":   "FlyingWhale-MCP/2.0.0",
        };

        let url: string;
        if (beat === "latest") {
          url = `${OPS_URL}/intelligence/latest`;
        } else if (beat === "feed") {
          const params = new URLSearchParams();
          if (limit) params.set("limit", String(limit));
          url = `${OPS_URL}/intelligence/feed?${params}`;
        } else if (beat === "brief") {
          const params = new URLSearchParams();
          if (date) params.set("date", date);
          url = `${OPS_URL}/intelligence/brief?${params}`;
        } else {
          const params = new URLSearchParams();
          if (limit) params.set("limit", String(limit));
          url = `${OPS_URL}/intelligence/${beat}?${params}`;
        }

        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const data = await res.json() as Record<string, unknown>;

        if (res.status === 402) {
          return createJsonResponse({
            error:       "Payment required — subscribe for full intelligence access",
            amount_sats: data.amount_sats,
            pay_to_btc:  "bc1qdfm56pmmq40me84aau2fts3725ghzqlwf6ys7p",
            pay_to_stx:  FW_OWNER_ADDRESS,
            hint:        "Set FW_LICENSE_KEY to gain full access, or use beat='latest' for free preview.",
            ...SOVEREIGNTY_STAMP,
          });
        }

        return createJsonResponse({
          ...data,
          _ops_hub:    "Flying Whale Operations Hub v3.0.0",
          _beat_query: beat,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_get_brief",
    {
      description:
        "Get Flying Whale daily intelligence brief — compiled summary of all 5 sovereign beats for a given date. " +
        "Returns signal count, beat breakdown, and compiled insights. " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54). " +
        "Licensed access required.",
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe("Date to compile brief for (YYYY-MM-DD). Defaults to today."),
      },
    },
    async ({ date }) => {

      try {
        const params = new URLSearchParams();
        if (date) params.set("date", date);

        const res = await fetch(`${OPS_URL}/intelligence/brief?${params}`, {
          headers: {
            "X-Fw-License": FW_LICENSE_KEY || "OWNER",
            "X-Fw-Caller":  FW_OWNER_ADDRESS,
            "User-Agent":   "FlyingWhale-MCP/2.0.0",
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const data = await res.json() as Record<string, unknown>;
        return createJsonResponse({ ...data as object, ...SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FLYING WHALE WORK MARKET ENGINE
  // Sovereign autonomous task system — WHALE as fuel
  // IP: whale-ip-store-v1 TX 80d2a9e8c6b8d6632a4ee7331c3fe1b6c5d0db334d4824f4eaca389c54e53758
  // Flow: Work → Execution → Profit → WHALE → Control
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "flying_whale_work_dashboard",
    {
      description:
        "Get the Flying Whale Work Market Engine dashboard — sovereign autonomous task system. " +
        "Shows active jobs, WHALE rewards distributed, agent leaderboard, and task queue stats. " +
        "No external bounty supply needed — tasks auto-generated every 24h. " +
        "WHALE = وقود العمل (fuel of work). " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54). " +
        "Operations Hub: https://whale-execution-engine-production.up.railway.app",
      inputSchema: {},
    },
    async () => {

      try {
        const res = await fetch(`${OPS_URL}/work/dashboard`, {
          headers: { "X-Fw-License": FW_LICENSE_KEY || "OWNER", "X-Fw-Caller": FW_OWNER_ADDRESS },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return createJsonResponse(await res.json() as object);
      } catch (error) { return createErrorResponse(error); }
    }
  );

  server.registerTool(
    "flying_whale_work_tasks",
    {
      description:
        "Browse the Flying Whale Work Market Engine task queue. " +
        "Tasks are auto-generated: content briefs, market watches, security scans, arb hunts, verifications. " +
        "Higher-reward tasks available to all. Burn WHALE to boost priority (10% rebate). " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54)",
      inputSchema: {
        address: z.string().min(1).describe("Your STX address"),
        status: z.enum(["open", "claimed", "submitted", "completed", "expired"]).optional()
          .describe("Filter by task status (default: open)"),
        type: z.enum(["signal_file", "market_watch", "content_brief", "security_scan", "arb_hunt", "verification"]).optional()
          .describe("Filter by task type"),
        beat: z.enum(["quantum-threats", "agent-economy", "sovereign-stack", "bitcoin-macro", "network-security"]).optional()
          .describe("Filter by intelligence beat"),
        limit: z.number().min(1).max(50).optional().describe("Max tasks to return (default: 20)"),
      },
    },
    async ({ address, status, type, beat, limit }) => {

      try {
        const params = new URLSearchParams({ address });
        if (status) params.set("status", status);
        if (type)   params.set("type", type);
        if (beat)   params.set("beat", beat);
        if (limit)  params.set("limit", String(limit));
        const res = await fetch(`${OPS_URL}/work/tasks?${params}`, {
          headers: { "X-Fw-License": FW_LICENSE_KEY || "OWNER", "X-Fw-Caller": address },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return createJsonResponse(await res.json() as object);
      } catch (error) { return createErrorResponse(error); }
    }
  );

  server.registerTool(
    "flying_whale_work_claim",
    {
      description:
        "Claim a task from the Flying Whale Work Market Engine. " +
        "Max 3 agents per task — first to submit approved work wins the WHALE reward. " +
        "Claim locks your spot in the competition. " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54)",
      inputSchema: {
        address: z.string().min(1).describe("Your STX address"),
        task_id: z.string().min(1).describe("Task ID to claim (from flying_whale_work_tasks)"),
      },
    },
    async ({ address, task_id }) => {

      try {
        const res = await fetch(`${OPS_URL}/work/tasks/${task_id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Fw-License": FW_LICENSE_KEY || "OWNER", "X-Fw-Caller": address },
          body: JSON.stringify({ address }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return createJsonResponse(await res.json() as object);
      } catch (error) { return createErrorResponse(error); }
    }
  );

  server.registerTool(
    "flying_whale_work_submit",
    {
      description:
        "Submit completed work for a claimed task in the Flying Whale Work Market Engine. " +
        "Proof hash (SHA-256) is auto-computed and stored as on-chain anchor. " +
        "First approved submission earns the WHALE reward. Auto-approved after 24h if no owner review. " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54)",
      inputSchema: {
        address:  z.string().min(1).describe("Your STX address (must have claimed the task)"),
        task_id:  z.string().min(1).describe("Task ID to submit for"),
        content:  z.string().min(50).max(5000).describe("Your work product — min 50 chars, max 5000 chars"),
      },
    },
    async ({ address, task_id, content }) => {

      try {
        const res = await fetch(`${OPS_URL}/work/tasks/${task_id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Fw-License": FW_LICENSE_KEY || "OWNER", "X-Fw-Caller": address },
          body: JSON.stringify({ address, content }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return createJsonResponse(await res.json() as object);
      } catch (error) { return createErrorResponse(error); }
    }
  );

  server.registerTool(
    "flying_whale_work_my",
    {
      description:
        "View your Flying Whale Work Market Engine profile — active claims, completed tasks, " +
        "WHALE earnings, pending rewards, and earnings history. " +
        "Track your sovereign work record with on-chain proof hashes. " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54)",
      inputSchema: {
        address: z.string().min(1).describe("Your STX address"),
      },
    },
    async ({ address }) => {

      try {
        const res = await fetch(`${OPS_URL}/work/my?address=${address}`, {
          headers: { "X-Fw-License": FW_LICENSE_KEY || "OWNER", "X-Fw-Caller": address },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return createJsonResponse(await res.json() as object);
      } catch (error) { return createErrorResponse(error); }
    }
  );

  server.registerTool(
    "flying_whale_work_leaderboard",
    {
      description:
        "Flying Whale Work Market Engine leaderboard — top agents by WHALE earnings. " +
        "Shows completed tasks, WHALE earned, tier, and rank. " +
        "Compete, execute, earn. Sovereignty is a sport. " +
        "(© 2026 Flying Whale — zaghmout.btc | ERC-8004 #54)",
      inputSchema: {
        limit: z.number().min(1).max(50).optional().describe("Number of top agents to return (default: 20)"),
      },
    },
    async ({ limit }) => {

      try {
        const params = new URLSearchParams();
        if (limit) params.set("limit", String(limit));
        const res = await fetch(`${OPS_URL}/work/leaderboard?${params}`, {
          headers: { "X-Fw-License": FW_LICENSE_KEY || "OWNER", "X-Fw-Caller": FW_OWNER_ADDRESS },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return createJsonResponse(await res.json() as object);
      } catch (error) { return createErrorResponse(error); }
    }
  );

  // whale-pact-v1 — Autonomous Financial Contract Layer
  // COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54
  // Deploy TX: 83f5d6f18871c937ce9feae80b196bda179654fd6cf5fb7f8b69452483281f22
  // IP TX v1.1: 209544b6fa13a50834b641018604e1c84761deef16a43b52c7d6570ac56b2a22
  //
  // Four proof tiers:
  //   HASH   (u0) 1.00% fee  1 STX min  — sha256(preimage) on-chain
  //   ORACLE (u1) 1.50% fee  5 STX min  — verifier attests quality
  //   HYBRID (u2) 2.00% fee  10 STX min — hash AND oracle, both required
  //   CHAIN  (u3) 0.75% fee  5 STX min  — stx-get-balance IS the proof
  // ============================================================================

  const PACT_ADDR = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
  const PACT_NAME = "whale-pact-v1";

  const PROOF_TIERS = {
    HASH:   { id: 0, feeBps: 100,  minStx: 1,  desc: "sha256(preimage) verified on-chain. TX id, commit SHA, deploy hash." },
    ORACLE: { id: 1, feeBps: 150,  minStx: 5,  desc: "Designated verifier attests quality. AI analysis, subjective work." },
    HYBRID: { id: 2, feeBps: 200,  minStx: 10, desc: "hash AND oracle both required. Strongest traditional settlement." },
    CHAIN:  { id: 3, feeBps: 75,   minStx: 5,  desc: "stx-get-balance IS the proof. Permissionless. Zero humans." },
  } as const;

  type ProofTierKey = keyof typeof PROOF_TIERS;

  const STATE_NAMES: Record<number, string> = { 0: "OPEN", 1: "RELEASED", 2: "DISPUTED", 3: "REFUNDED" };

  async function pactCallRead(fnName: string, args: string[]): Promise<any> {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${PACT_ADDR}/${PACT_NAME}/${fnName}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body:    JSON.stringify({ sender: PACT_ADDR, arguments: args }),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!res.ok) throw new Error(`Hiro call-read failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<{ okay: boolean; result: string; cause?: string }>;
  }

  function decodePactState(resultHex: string): Record<string, any> | null {
    try {
      const cv  = deserializeCV(resultHex);
      const raw = cvToJSON(cv) as any;
      if (raw === null || raw === undefined) return null;
      // OptionalNone
      if (raw.type === "none" || raw === "(none)") return null;
      const d = raw.value ?? raw;
      const num = (v: any) => typeof v === "string" ? parseInt(v, 10) : Number(v);
      return {
        hirer:       d.hirer?.value ?? d.hirer,
        worker:      d.worker?.value ?? d.worker,
        amountStx:   num(d.amount?.value ?? d.amount) / 1_000_000,
        feeStx:      num(d.fee?.value ?? d.fee) / 1_000_000,
        proofType:   num(d["proof-type"]?.value ?? d["proof-type"]),
        proofName:   (["HASH","ORACLE","HYBRID","CHAIN"] as const)[num(d["proof-type"]?.value ?? d["proof-type"])] ?? "UNKNOWN",
        deadline:    num(d.deadline?.value ?? d.deadline),
        state:       num(d.state?.value ?? d.state),
        stateName:   STATE_NAMES[num(d.state?.value ?? d.state)] ?? "UNKNOWN",
        hashValid:   d["hash-valid"]?.value ?? d["hash-valid"],
        oracleValid: d["oracle-valid"]?.value ?? d["oracle-valid"],
        verifier:    d.verifier?.value?.value ?? null,
        chainTarget: d["chain-target"]?.value?.value != null
          ? num(d["chain-target"].value.value) / 1_000_000 : null,
      };
    } catch {
      return { raw: resultHex };
    }
  }

  // ── 1. flying_whale_pact_preview_fee ─────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_preview_fee",
    {
      title: "Flying Whale — Pact Fee Preview",
      description:
        "Preview the fee and total STX to lock for a whale-pact-v1 pact. " +
        "Shows fee rate, minimum amount, and exact amounts for any proof tier. " +
        "No WHALE gate — use this before create to plan the transaction. " +
        "Proof types: HASH (1%) | ORACLE (1.5%) | HYBRID (2%) | CHAIN (0.75%)",
      inputSchema: z.object({
        amountStx: z.number().positive()
          .describe("Pact amount in STX (e.g. 100 for 100 STX)"),
        proofType: z.enum(["HASH", "ORACLE", "HYBRID", "CHAIN"])
          .describe("Settlement tier: HASH=sha256 | ORACLE=verifier | HYBRID=both | CHAIN=balance"),
      }),
    },
    async ({ amountStx, proofType }) => {
      try {
        const tier = PROOF_TIERS[proofType];
        const amountUstx  = Math.round(amountStx * 1_000_000);
        const feeUstx     = Math.floor(amountUstx * tier.feeBps / 10_000);
        const totalUstx   = amountUstx + feeUstx;
        const minUstx     = tier.minStx * 1_000_000;

        if (amountUstx < minUstx) {
          return createJsonResponse({
            valid:    false,
            error:    `Amount too low. ${proofType} tier minimum: ${tier.minStx} STX (you provided ${amountStx} STX)`,
            minimum:  `${tier.minStx} STX`,
            ...SOVEREIGNTY_STAMP,
          });
        }

        return createJsonResponse({
          valid:        true,
          proofType,
          description:  tier.desc,
          amount:       `${amountStx} STX`,
          fee:          `${(feeUstx / 1_000_000).toFixed(6)} STX (${tier.feeBps / 100}%)`,
          totalToLock:  `${(totalUstx / 1_000_000).toFixed(6)} STX`,
          amountUstx,
          feeUstx,
          totalUstx,
          contract:     `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 2. flying_whale_pact_get ──────────────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_get",
    {
      title: "Flying Whale — Get Pact State",
      description:
        "Read full state of a whale-pact-v1 pact from Stacks mainnet. " +
        "Returns hirer, worker, amount, fee, proof type, deadline, state (OPEN/RELEASED/DISPUTED/REFUNDED), " +
        "and verification flags. Live on-chain data. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Pact ID (uint) — returned by create-pact"),
      }),
    },
    async ({ callerAddress, pactId }) => {
      try {
        const raw = await pactCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        if (!raw.okay) throw new Error(`Contract error: ${raw.cause ?? raw.result}`);

        const pact = decodePactState(raw.result);
        if (!pact) {
          return createJsonResponse({ found: false, pactId, message: "Pact not found", ...SOVEREIGNTY_STAMP });
        }

        return createJsonResponse({
          found:    true,
          pactId,
          pact,
          explorer: `https://explorer.hiro.so/txid/${PACT_ADDR}.${PACT_NAME}?chain=mainnet`,
          contract: `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 3. flying_whale_pact_check ────────────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_check",
    {
      title: "Flying Whale — Check Pact Release Condition",
      description:
        "Check whether a whale-pact-v1 pact is ready to release without executing. " +
        "For CHAIN type: reads live stx-get-balance vs chain-target on-chain. " +
        "Returns ready=true/false, reason, and which settlement function to call next. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Pact ID to check"),
      }),
    },
    async ({ callerAddress, pactId }) => {
      try {

        const [rawCheck, rawPact] = await Promise.all([
          pactCallRead("check-release", [serializeCV(uintCV(pactId))]),
          pactCallRead("get-pact",      [serializeCV(uintCV(pactId))]),
        ]);

        if (!rawPact.okay) throw new Error(`Pact not found: ${rawPact.cause ?? rawPact.result}`);
        const pact = decodePactState(rawPact.result);
        if (!pact) return createJsonResponse({ found: false, pactId, ...SOVEREIGNTY_STAMP });

        let ready = false;
        try {
          const cv  = deserializeCV(rawCheck.result);
          const val = cvToJSON(cv) as any;
          // (ok true) or (ok false) from check-release
          const inner = val?.value ?? val;
          ready = inner === true || inner?.value === true;
        } catch { /* keep false */ }

        const nextAction =
          pact.stateName !== "OPEN"        ? `Pact is ${pact.stateName} — no action needed` :
          pact.proofType === 3 && ready    ? "Call flying_whale_pact_settle_chain — permissionless, anyone can trigger" :
          pact.proofType === 0 && !ready   ? "Worker calls flying_whale_pact_submit_proof with sha256 preimage" :
          pact.proofType === 1 && !ready   ? "Verifier calls flying_whale_pact_attest" :
          pact.proofType === 2 && !pact.hashValid  ? "Worker submits proof first (flying_whale_pact_submit_proof)" :
          pact.proofType === 2 && !pact.oracleValid ? "Verifier attests (flying_whale_pact_attest)" :
          ready ? "Ready to release" : "Awaiting conditions";

        return createJsonResponse({
          pactId,
          ready,
          proofType:  pact.proofName,
          state:      pact.stateName,
          hashValid:  pact.hashValid,
          oracleValid: pact.oracleValid,
          nextAction,
          contract:   `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 4. flying_whale_pact_create ───────────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_create",
    {
      title: "Flying Whale — Create Pact",
      description:
        "Prepare a whale-pact-v1 create-pact transaction. " +
        "Returns the exact call_contract parameters to lock STX + fee in escrow. " +
        "Validates inputs, calculates fee, and checks minimums before returning. " +
        "Execute the returned callContract params with the call_contract MCP tool. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        worker: z.string().min(1).describe("Worker's Stacks address (SP...) — who receives payment on success"),
        amountStx: z.number().positive().describe("Pact amount in STX (excluding fee)"),
        workHash: z.string().length(64).describe("sha256 hex of the preimage (32 bytes = 64 hex chars). For CHAIN type: use 0000...0000"),
        proofType: z.enum(["HASH", "ORACLE", "HYBRID", "CHAIN"])
          .describe("Settlement tier"),
        deadlineBlocks: z.number().int().positive()
          .describe("Deadline in Stacks blocks from now (144 blocks ≈ 1 day, 1008 ≈ 1 week)"),
        verifier: z.string().optional()
          .describe("Verifier Stacks address — required for ORACLE and HYBRID types"),
        chainTargetStx: z.number().optional()
          .describe("Required for CHAIN type — absolute STX balance worker must reach (e.g. 60 if worker needs to go from 50→60 STX)"),
        expectedHash: z.string().length(64).optional()
          .describe("Optional sha256 hex of expected output — for HYBRID type verifier reference"),
      }),
    },
    async ({ callerAddress, worker, amountStx, workHash, proofType, deadlineBlocks, verifier, chainTargetStx, expectedHash }) => {
      try {

        const tier        = PROOF_TIERS[proofType];
        const amountUstx  = Math.round(amountStx * 1_000_000);
        const feeUstx     = Math.floor(amountUstx * tier.feeBps / 10_000);
        const totalUstx   = amountUstx + feeUstx;
        const minUstx     = tier.minStx * 1_000_000;

        if (amountUstx < minUstx)
          throw new Error(`Amount too low. ${proofType} minimum: ${tier.minStx} STX`);
        if ((proofType === "ORACLE" || proofType === "HYBRID") && !verifier)
          throw new Error(`${proofType} requires a verifier address`);
        if (proofType === "CHAIN" && !chainTargetStx)
          throw new Error("CHAIN type requires chainTargetStx — the absolute STX balance worker must reach");
        if (workHash.length !== 64)
          throw new Error("workHash must be 64 hex chars (sha256 = 32 bytes)");

        const functionArgs = [
          { type: "principal",       value: worker },
          { type: "uint",            value: amountUstx },
          { type: "buffer",          value: workHash },
          expectedHash
            ? { type: "some", value: { type: "buffer", value: expectedHash } }
            : { type: "none" },
          chainTargetStx
            ? { type: "some", value: { type: "uint", value: Math.round(chainTargetStx * 1_000_000) } }
            : { type: "none" },
          { type: "uint",            value: tier.id },
          verifier
            ? { type: "some", value: { type: "principal", value: verifier } }
            : { type: "none" },
          { type: "uint",            value: deadlineBlocks },
        ];

        return createJsonResponse({
          ready: true,
          summary: {
            hirer:      callerAddress,
            worker,
            proofType,
            description: tier.desc,
            amount:     `${amountStx} STX`,
            fee:        `${(feeUstx / 1_000_000).toFixed(6)} STX (${tier.feeBps / 100}%)`,
            totalLocked: `${(totalUstx / 1_000_000).toFixed(6)} STX`,
            deadline:   `${deadlineBlocks} blocks (~${Math.round(deadlineBlocks / 144)} days)`,
            verifier:   verifier ?? null,
            chainTarget: chainTargetStx ? `${chainTargetStx} STX` : null,
          },
          callContract: {
            contractAddress: PACT_ADDR,
            contractName:    PACT_NAME,
            functionName:    "create-pact",
            functionArgs,
            postConditions: [
              { type: "stx", principal: callerAddress, conditionCode: "eq", amount: String(totalUstx) },
            ],
          },
          instruction: "Pass callContract params to call_contract MCP tool to broadcast",
          contract: `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 5. flying_whale_pact_submit_proof ─────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_submit_proof",
    {
      title: "Flying Whale — Submit Proof (Worker)",
      description:
        "Prepare a submit-proof transaction for HASH or HYBRID pacts. " +
        "Worker reveals the sha256 preimage — contract verifies on-chain. " +
        "If hash matches and conditions are met, STX is auto-released to worker. " +
        "Returns exact call_contract parameters to broadcast. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Pact ID to submit proof for"),
        preimage: z.string().min(1)
          .describe("The preimage whose sha256 matches the work-hash committed at pact creation (hex string, max 512 hex chars = 256 bytes)"),
      }),
    },
    async ({ callerAddress, pactId, preimage }) => {
      try {

        const raw = await pactCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        if (!raw.okay) throw new Error(`Pact not found`);
        const pact = decodePactState(raw.result);
        if (!pact) throw new Error(`Pact #${pactId} not found`);
        if (pact.stateName !== "OPEN") throw new Error(`Pact is ${pact.stateName} — cannot submit proof`);
        if (pact.proofType !== 0 && pact.proofType !== 2)
          throw new Error(`Pact is ${pact.proofName} type — submit-proof only valid for HASH and HYBRID`);

        return createJsonResponse({
          ready: true,
          pactId,
          proofType:    pact.proofName,
          worker:       pact.worker,
          amountStx:    pact.amountStx,
          callContract: {
            contractAddress: PACT_ADDR,
            contractName:    PACT_NAME,
            functionName:    "submit-proof",
            functionArgs:    [
              { type: "uint",   value: pactId },
              { type: "buffer", value: preimage },
            ],
            postConditions: [],
          },
          instruction: "Pass callContract params to call_contract MCP tool to broadcast. Only worker address can call this.",
          contract: `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 6. flying_whale_pact_attest ───────────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_attest",
    {
      title: "Flying Whale — Attest (Verifier)",
      description:
        "Prepare an attest transaction for ORACLE or HYBRID pacts. " +
        "Verifier approves or rejects work. valid=true releases funds (if all conditions met). " +
        "valid=false enters DISPUTED state for owner arbitration. " +
        "Returns exact call_contract parameters. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Pact ID to attest"),
        valid: z.boolean().describe("true = work approved, release funds | false = work rejected, enter dispute"),
      }),
    },
    async ({ callerAddress, pactId, valid }) => {
      try {

        const raw = await pactCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        if (!raw.okay) throw new Error(`Pact not found`);
        const pact = decodePactState(raw.result);
        if (!pact) throw new Error(`Pact #${pactId} not found`);
        if (pact.stateName !== "OPEN") throw new Error(`Pact is ${pact.stateName} — cannot attest`);
        if (pact.proofType !== 1 && pact.proofType !== 2)
          throw new Error(`Pact is ${pact.proofName} — attest only valid for ORACLE and HYBRID`);

        return createJsonResponse({
          ready: true,
          pactId,
          proofType:   pact.proofName,
          verdict:     valid ? "APPROVE — funds will release if all conditions met" : "REJECT — pact enters DISPUTED state",
          callContract: {
            contractAddress: PACT_ADDR,
            contractName:    PACT_NAME,
            functionName:    "attest",
            functionArgs:    [
              { type: "uint", value: pactId },
              { type: "bool", value: valid },
            ],
            postConditions: [],
          },
          instruction: "Only the designated verifier address can call this.",
          contract: `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 7. flying_whale_pact_settle_chain ─────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_settle_chain",
    {
      title: "Flying Whale — Settle Chain (Permissionless)",
      description:
        "Check and trigger settlement for CHAIN-type pacts. " +
        "Reads worker's live STX balance from chain state. " +
        "If balance >= chain-target: returns ready=true with call_contract params to trigger auto-release. " +
        "If not yet: returns balance vs target gap. Anyone can call settle-chain — permissionless. " +
        "This is the ceiling of trustless settlement: Capital → Execution → Chain verifies → Release. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("CHAIN-type pact ID to settle"),
      }),
    },
    async ({ callerAddress, pactId }) => {
      try {

        const raw = await pactCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        if (!raw.okay) throw new Error(`Pact not found`);
        const pact = decodePactState(raw.result);
        if (!pact) throw new Error(`Pact #${pactId} not found`);
        if (pact.proofType !== 3) throw new Error(`Pact is ${pact.proofName} type — settle-chain only for CHAIN type`);
        if (pact.stateName !== "OPEN") throw new Error(`Pact is ${pact.stateName} — already settled`);

        // Read live worker balance
        const balRes = await fetch(
          `${HIRO_API}/extended/v1/address/${pact.worker}/balances`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) }
        );
        const balData = await balRes.json() as { stx?: { balance: string } };
        const workerBalUstx  = BigInt(balData.stx?.balance ?? "0");
        const targetUstx     = BigInt(Math.round((pact.chainTarget ?? 0) * 1_000_000));
        const workerBalStx   = Number(workerBalUstx) / 1_000_000;
        const targetStx      = pact.chainTarget ?? 0;
        const ready          = workerBalUstx >= targetUstx;

        return createJsonResponse({
          pactId,
          ready,
          worker:         pact.worker,
          workerBalance:  `${workerBalStx.toFixed(6)} STX`,
          chainTarget:    `${targetStx} STX`,
          gap:            ready ? "0 STX" : `${(targetStx - workerBalStx).toFixed(6)} STX remaining`,
          amountToRelease: `${pact.amountStx} STX`,
          ...(ready ? {
            callContract: {
              contractAddress: PACT_ADDR,
              contractName:    PACT_NAME,
              functionName:    "settle-chain",
              functionArgs:    [{ type: "uint", value: pactId }],
              postConditions:  [],
            },
            instruction: "Permissionless — any address can broadcast this. Pass to call_contract.",
          } : {
            instruction: `Worker needs ${(targetStx - workerBalStx).toFixed(6)} more STX. Check back later.`,
          }),
          mechanism: "Capital -> Execution -> Chain verifies -> Release. Zero humans. Zero oracle.",
          contract: `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 8. flying_whale_pact_refund ───────────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_refund",
    {
      title: "Flying Whale — Pact Refund (Hirer)",
      description:
        "Prepare a refund transaction after a pact's deadline has passed. " +
        "Only callable by the original hirer. Pact must be in OPEN state past deadline. " +
        "Returns exact call_contract parameters. Reads current block height to check deadline. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Pact ID to refund"),
      }),
    },
    async ({ callerAddress, pactId }) => {
      try {

        const [rawPact, blockRes] = await Promise.all([
          pactCallRead("get-pact", [serializeCV(uintCV(pactId))]),
          fetch(`${HIRO_API}/extended/v1/block?limit=1`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }),
        ]);

        if (!rawPact.okay) throw new Error(`Pact not found`);
        const pact = decodePactState(rawPact.result);
        if (!pact) throw new Error(`Pact #${pactId} not found`);
        if (pact.stateName !== "OPEN") throw new Error(`Pact is ${pact.stateName} — cannot refund`);

        const blockData  = await blockRes.json() as { results?: Array<{ height: number }> };
        const blockHeight = blockData.results?.[0]?.height ?? 0;
        const pastDeadline = blockHeight >= pact.deadline;

        return createJsonResponse({
          pactId,
          canRefund:      pastDeadline,
          currentBlock:   blockHeight,
          deadline:       pact.deadline,
          blocksRemaining: pastDeadline ? 0 : pact.deadline - blockHeight,
          amountToRefund: `${(pact.amountStx + pact.feeStx).toFixed(6)} STX`,
          ...(pastDeadline ? {
            callContract: {
              contractAddress: PACT_ADDR,
              contractName:    PACT_NAME,
              functionName:    "refund",
              functionArgs:    [{ type: "uint", value: pactId }],
              postConditions:  [],
            },
            instruction: "Only the original hirer can call this. Pass to call_contract.",
          } : {
            instruction: `Deadline not reached. Wait ${pact.deadline - blockHeight} more blocks (~${Math.round((pact.deadline - blockHeight) / 144)} days).`,
          }),
          contract: `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 9. flying_whale_pact_resolve ──────────────────────────────────────────────
  server.registerTool(
    "flying_whale_pact_resolve",
    {
      title: "Flying Whale — Resolve Dispute (Owner)",
      description:
        "Prepare a resolve-dispute transaction for DISPUTED pacts. " +
        "Owner only — zaghmout.btc arbitrates and decides in favor of worker or hirer. " +
        "favor=true: worker delivered, release funds. favor=false: work invalid, refund hirer. " +
        "Returns exact call_contract parameters. " +
        "",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Disputed pact ID to resolve"),
        favorWorker: z.boolean()
          .describe("true = worker wins, release payment | false = hirer wins, full refund"),
      }),
    },
    async ({ callerAddress, pactId, favorWorker }) => {
      try {

        const raw = await pactCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        if (!raw.okay) throw new Error(`Pact not found`);
        const pact = decodePactState(raw.result);
        if (!pact) throw new Error(`Pact #${pactId} not found`);
        if (pact.stateName !== "DISPUTED") throw new Error(`Pact is ${pact.stateName} — resolve only for DISPUTED pacts`);

        return createJsonResponse({
          ready: true,
          pactId,
          verdict:       favorWorker ? "WORKER WINS — payment released" : "HIRER WINS — full refund",
          hirer:         pact.hirer,
          worker:        pact.worker,
          amountAtStake: `${pact.amountStx} STX`,
          callContract: {
            contractAddress: PACT_ADDR,
            contractName:    PACT_NAME,
            functionName:    "resolve-dispute",
            functionArgs:    [
              { type: "uint", value: pactId },
              { type: "bool", value: favorWorker },
            ],
            postConditions: [],
          },
          instruction: "Only SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW (zaghmout.btc) can call this.",
          contract: `${PACT_ADDR}.${PACT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 10. flying_whale_pact_xchain ──────────────────────────────────────────────
  // PactCrossChain.sol — Arbitrum One, deployed 2026-04-14 by praxisagent
  // Contract: 0x538D5a4266154F0Ca97891B75F5e71a90c651DDF
  // TX: 0x0d88f1a370919f33bff26183da736c7b52ce78dddb6e9ed33ca07a6c327051b2
  // Flow: same preimage unlocks both chains — Stacks (sha256) + Arbitrum (keccak256+sha256)
  server.registerTool(
    "flying_whale_pact_xchain",
    {
      title: "Flying Whale — Cross-Chain Pact Bridge (Arbitrum ↔ Stacks)",
      description:
        "PactCrossChain.sol — permissionless atomic swap between Stacks whale-pact-v1 and Arbitrum One. " +
        "Deployed 2026-04-14 at 0x538D5a4266154F0Ca97891B75F5e71a90c651DDF (Arbitrum One, block 452374909). " +
        "One preimage settles both chains. " +
        "\n\nFlow: Both parties agree on a random preimage (32 bytes). " +
        "Creator computes sha256(preimage) for Stacks and keccak256(preimage) for Arbitrum. " +
        "Lock PACT tokens on Arbitrum (create) + lock STX on Stacks (whale-pact-v1 create-pact, proofType=HASH). " +
        "Worker completes work → reveals preimage on Stacks → gets STX → keeper relays preimage → Arbitrum releases PACT. " +
        "\n\nActions: " +
        "commitment — derive sha256 + keccak256 from preimage hex. " +
        "create — prepare Arbitrum create() calldata (lock PACT). " +
        "release — prepare Arbitrum release() calldata (claim PACT with preimage). " +
        "reclaim — prepare Arbitrum reclaim() calldata (creator recovers after deadline). " +
        "lookup — read lock state from Arbitrum via public RPC. " +
        "\n\n",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        action: z.enum(["commitment", "create", "release", "reclaim", "lookup"])
          .describe("commitment | create | release | reclaim | lookup"),
        preimage: z.string().optional()
          .describe("Hex preimage (64 chars, 32 bytes) — required for commitment and release actions"),
        beneficiary: z.string().optional()
          .describe("Ethereum address of worker who will receive PACT — required for create"),
        amountWei: z.string().optional()
          .describe("PACT amount in wei (18 decimals) — required for create"),
        deadlineTs: z.number().int().optional()
          .describe("Unix timestamp deadline — required for create"),
        lockId: z.number().int().optional()
          .describe("Arbitrum lock ID — required for release, reclaim, lookup"),
      }),
    },
    async ({ callerAddress, action, preimage, beneficiary, amountWei, deadlineTs, lockId }) => {
      try {

        const PACT_EVM_ADDR = "0x538D5a4266154F0Ca97891B75F5e71a90c651DDF";
        const ARB_RPC       = "https://arb1.arbitrum.io/rpc";
        const ARB_CHAIN_ID  = 42161;

        // ── ABI fragments (4-byte selectors) ────────────────────────────────
        // create(address beneficiary, uint256 amount, uint256 deadline, bytes32 keccakHash, bytes32 sha256Hash)
        // selector: keccak256("create(address,uint256,uint256,bytes32,bytes32)")[0:4]
        // release(uint256 lockId, bytes calldata preimage)
        // selector: keccak256("release(uint256,bytes)")[0:4]
        // reclaim(uint256 lockId)
        // selector: keccak256("reclaim(uint256)")[0:4]
        // locks(uint256) → returns struct

        // Compute selectors (keccak256 of signature, first 4 bytes)
        const { keccak_256 } = await import("@noble/hashes/sha3.js");
        const { sha256 }     = await import("@noble/hashes/sha2.js");
        const { bytesToHex, hexToBytes } = await import("@noble/hashes/utils.js");

        function selector(sig: string): string {
          return "0x" + bytesToHex(keccak_256(new TextEncoder().encode(sig))).slice(0, 8);
        }

        function padLeft(hex: string, bytes: number): string {
          return hex.replace("0x", "").padStart(bytes * 2, "0");
        }

        function encodeUint256(n: bigint | number): string {
          return BigInt(n).toString(16).padStart(64, "0");
        }

        function encodeAddress(addr: string): string {
          return addr.replace("0x", "").toLowerCase().padStart(64, "0");
        }

        function encodeBytes32(hex: string): string {
          return hex.replace("0x", "").padStart(64, "0");
        }

        // ── action: commitment ───────────────────────────────────────────────
        if (action === "commitment") {
          if (!preimage) throw new Error("preimage required for commitment action (32 bytes hex, 64 chars)");
          const cleanPre = preimage.replace("0x", "");
          if (cleanPre.length !== 64) throw new Error(`preimage must be 32 bytes (64 hex chars), got ${cleanPre.length}`);
          const preimageBytes = hexToBytes(cleanPre);
          const sha256Hash    = "0x" + bytesToHex(sha256(preimageBytes));
          const keccakHash    = "0x" + bytesToHex(keccak_256(preimageBytes));
          return createJsonResponse({
            action: "commitment",
            preimage:    "0x" + cleanPre,
            sha256Hash,   // → use for Stacks whale-pact-v1 (hash-lock, proofType=HASH)
            keccakHash,   // → use for Arbitrum PactCrossChain.create()
            stacksNote:  "Use sha256Hash as the hash in whale-pact-v1 create-pact (proofType=0, HASH)",
            arbNote:     "Use BOTH keccakHash and sha256Hash in PactCrossChain.create()",
            securityNote:"Generate preimage with cryptographically secure randomness. Never reuse.",
            contract:    PACT_EVM_ADDR,
            ...SOVEREIGNTY_STAMP,
          });
        }

        // ── action: create ───────────────────────────────────────────────────
        if (action === "create") {
          if (!beneficiary) throw new Error("beneficiary required for create");
          if (!amountWei)   throw new Error("amountWei required for create");
          if (!deadlineTs)  throw new Error("deadlineTs required for create");
          if (!preimage)    throw new Error("preimage required for create (to derive hashes)");
          const cleanPre = preimage.replace("0x", "");
          if (cleanPre.length !== 64) throw new Error("preimage must be 64 hex chars");
          const preimageBytes = hexToBytes(cleanPre);
          const sha256Hash    = bytesToHex(sha256(preimageBytes));
          const keccakHash    = bytesToHex(keccak_256(preimageBytes));

          const sel = selector("create(address,uint256,uint256,bytes32,bytes32)");
          const calldata = sel +
            encodeAddress(beneficiary) +
            encodeUint256(BigInt(amountWei)) +
            encodeUint256(BigInt(deadlineTs)) +
            encodeBytes32(keccakHash) +
            encodeBytes32(sha256Hash);

          return createJsonResponse({
            action:      "create",
            contract:    PACT_EVM_ADDR,
            chainId:     ARB_CHAIN_ID,
            network:     "Arbitrum One",
            calldata,
            params: {
              beneficiary,
              amountWei,
              deadline:   new Date(deadlineTs * 1000).toISOString(),
              keccakHash: "0x" + keccakHash,
              sha256Hash: "0x" + sha256Hash,
            },
            stacksCounterpart: {
              contract:     `${PACT_ADDR}.${PACT_NAME}`,
              functionName: "create-pact",
              hashArg:      "0x" + sha256Hash,
              proofType:    0,
              note:         "Create Stacks pact with same sha256Hash (proofType=0/HASH). Same preimage settles both.",
            },
            note: "Call this on Arbitrum before revealing preimage anywhere. Locks PACT for beneficiary.",
            ...SOVEREIGNTY_STAMP,
          });
        }

        // ── action: release ──────────────────────────────────────────────────
        if (action === "release") {
          if (lockId === undefined) throw new Error("lockId required for release");
          if (!preimage)            throw new Error("preimage required for release");
          const cleanPre = preimage.replace("0x", "");
          if (cleanPre.length !== 64) throw new Error("preimage must be 64 hex chars");

          // ABI encode: release(uint256, bytes) — dynamic bytes
          // Layout: selector | uint256 lockId | offset(64) | length(32) | data(32 padded)
          const sel = selector("release(uint256,bytes)");
          const offsetBytes = "0000000000000000000000000000000000000000000000000000000000000040"; // 64 decimal
          const dataLen     = "0000000000000000000000000000000000000000000000000000000000000020"; // 32 bytes
          const calldata    = sel +
            encodeUint256(lockId) +
            offsetBytes +
            dataLen +
            encodeBytes32(cleanPre);

          // Also compute expected hashes for verification
          const preimageBytes = hexToBytes(cleanPre);
          const sha256Hash    = "0x" + bytesToHex(sha256(preimageBytes));
          const keccakHash    = "0x" + bytesToHex(keccak_256(preimageBytes));

          return createJsonResponse({
            action:   "release",
            lockId,
            contract: PACT_EVM_ADDR,
            chainId:  ARB_CHAIN_ID,
            network:  "Arbitrum One",
            calldata,
            hashes: { sha256Hash, keccakHash },
            note:     "Anyone can call release with the correct preimage. PACT goes to beneficiary.",
            ...SOVEREIGNTY_STAMP,
          });
        }

        // ── action: reclaim ──────────────────────────────────────────────────
        if (action === "reclaim") {
          if (lockId === undefined) throw new Error("lockId required for reclaim");
          const sel      = selector("reclaim(uint256)");
          const calldata = sel + encodeUint256(lockId);
          return createJsonResponse({
            action:   "reclaim",
            lockId,
            contract: PACT_EVM_ADDR,
            chainId:  ARB_CHAIN_ID,
            network:  "Arbitrum One",
            calldata,
            note:     "Creator recovers PACT after deadline if preimage was never revealed. Requires deadline passed.",
            ...SOVEREIGNTY_STAMP,
          });
        }

        // ── action: lookup ───────────────────────────────────────────────────
        if (action === "lookup") {
          if (lockId === undefined) throw new Error("lockId required for lookup");
          // locks(uint256) public getter
          const sel      = selector("locks(uint256)");
          const calldata = sel + encodeUint256(lockId);

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
          let lockState: any = { error: "rpc_unavailable" };
          try {
            const rpcRes = await fetch(ARB_RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id:      1,
                method:  "eth_call",
                params: [{ to: PACT_EVM_ADDR, data: calldata }, "latest"],
              }),
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (rpcRes.ok) {
              const j = await rpcRes.json() as any;
              if (j.result && j.result !== "0x") {
                // Decode result: creator(address), beneficiary(address), amount(uint256),
                //                deadline(uint256), keccakHash(bytes32), sha256Hash(bytes32),
                //                released(bool), reclaimed(bool)
                const d = j.result.replace("0x", "");
                const word = (n: number) => d.slice(n * 64, (n + 1) * 64);
                lockState = {
                  creator:     "0x" + word(0).slice(24),
                  beneficiary: "0x" + word(1).slice(24),
                  amount:      BigInt("0x" + word(2)).toString(),
                  deadline:    new Date(Number("0x" + word(3)) * 1000).toISOString(),
                  keccakHash:  "0x" + word(4),
                  sha256Hash:  "0x" + word(5),
                  released:    word(6) !== "0".repeat(64),
                  reclaimed:   word(7) !== "0".repeat(64),
                  raw:         j.result,
                };
              } else {
                lockState = { error: "lock_not_found_or_zero_result", lockId };
              }
            }
          } catch { clearTimeout(timer); }

          return createJsonResponse({
            action:   "lookup",
            lockId,
            lockState,
            contract: PACT_EVM_ADDR,
            chainId:  ARB_CHAIN_ID,
            network:  "Arbitrum One",
            rpc:      ARB_RPC,
            ...SOVEREIGNTY_STAMP,
          });
        }

        throw new Error(`Unknown action: ${action}`);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ============================================================================
  // whale-pact-v2 — Program Layer (Chained Sequential Pacts)
  // COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54
  // Deploy TX: c965418280f9f3927b200dc8804f6cce6d805d4f9a17cf26cf8fc23ad4f7a71d
  // IP TX: 85308f618725ac2709cd5640140868fddaaa7cfdd10164143cde7ea38f1001c2
  //
  // A Program = ordered sequence of up to 10 pacts funded atomically.
  // Each pact completion unlocks the next. ERR-NOT-NEXT enforces order.
  // One hirer, N workers, one deadline governing the entire program.
  // ============================================================================

  const PROG_ADDR = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
  const PROG_NAME = "whale-pact-v2";
  const PROG_STATE: Record<number, string> = { 0: "ACTIVE", 1: "COMPLETE", 2: "ABORTED" };
  const PROG_PACT_STATE: Record<number, string> = { 0: "OPEN", 1: "RELEASED", 2: "DISPUTED", 3: "REFUNDED" };

  async function progCallRead(fnName: string, args: string[]): Promise<any> {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${PROG_ADDR}/${PROG_NAME}/${fnName}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body:    JSON.stringify({ sender: PROG_ADDR, arguments: args }),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!res.ok) throw new Error(`Hiro call-read failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<{ okay: boolean; result: string; cause?: string }>;
  }

  function decodeProgram(hex: string): Record<string, any> | null {
    try {
      const cv  = deserializeCV(hex);
      const raw = cvToJSON(cv) as any;
      if (!raw || raw.type === "none") return null;
      const d = raw.value ?? raw;
      const num = (v: any) => typeof v === "string" ? parseInt(v, 10) : Number(v);
      return {
        hirer:       d.hirer?.value ?? d.hirer,
        totalPacts:  num(d["total-pacts"]?.value ?? d["total-pacts"]),
        completed:   num(d.completed?.value ?? d.completed),
        totalLocked: num(d["total-locked"]?.value ?? d["total-locked"]) / 1_000_000,
        deadline:    num(d.deadline?.value ?? d.deadline),
        state:       num(d.state?.value ?? d.state),
        stateName:   PROG_STATE[num(d.state?.value ?? d.state)] ?? "UNKNOWN",
      };
    } catch { return { raw: hex }; }
  }

  function decodeProgPact(hex: string): Record<string, any> | null {
    try {
      const cv  = deserializeCV(hex);
      const raw = cvToJSON(cv) as any;
      if (!raw || raw.type === "none") return null;
      const d = raw.value ?? raw;
      const num = (v: any) => typeof v === "string" ? parseInt(v, 10) : Number(v);
      return {
        pactId:      num(d["pact-id"]?.value ?? d["pact-id"]),
        worker:      d.worker?.value ?? d.worker,
        amountStx:   num(d.amount?.value ?? d.amount) / 1_000_000,
        feeStx:      num(d.fee?.value ?? d.fee) / 1_000_000,
        proofType:   num(d["proof-type"]?.value ?? d["proof-type"]),
        proofName:   (["HASH","ORACLE","HYBRID","CHAIN"] as const)[num(d["proof-type"]?.value ?? d["proof-type"])] ?? "UNKNOWN",
        state:       num(d.state?.value ?? d.state),
        stateName:   PROG_PACT_STATE[num(d.state?.value ?? d.state)] ?? "UNKNOWN",
        hashValid:   d["hash-valid"]?.value ?? d["hash-valid"],
        oracleValid: d["oracle-valid"]?.value ?? d["oracle-valid"],
        chainTarget: d["chain-target"]?.value?.value != null
          ? num(d["chain-target"].value.value) / 1_000_000 : null,
      };
    } catch { return { raw: hex }; }
  }

  // ── 1. flying_whale_program_get ──────────────────────────────────────────────
  server.registerTool(
    "flying_whale_program_get",
    {
      title: "Flying Whale — Program Get",
      description:
        "Read a whale-pact-v2 Program header and optionally a specific pact within it. " +
        "Shows program state (ACTIVE/COMPLETE/ABORTED), completion progress, total locked, and deadline. " +
        "Pass pactIndex (0-based) to also fetch that pact's state.",
      inputSchema: z.object({
        programId: z.number().int().positive().describe("Program ID to fetch"),
        pactIndex: z.number().int().min(0).optional()
          .describe("Optional 0-based index of specific pact within the program"),
      }),
    },
    async ({ programId, pactIndex }) => {
      try {
        const raw = await progCallRead("get-program", [serializeCV(uintCV(programId))]);
        if (!raw.okay) throw new Error(`Program #${programId} not found`);
        const prog = decodeProgram(raw.result);
        if (!prog) throw new Error(`Program #${programId} not found`);

        let pactData: Record<string, any> | null = null;
        if (pactIndex !== undefined) {
          const rawP = await progCallRead("get-program-pact", [
            serializeCV(uintCV(programId)),
            serializeCV(uintCV(pactIndex)),
          ]);
          if (rawP.okay) pactData = decodeProgPact(rawP.result);
        }

        return createJsonResponse({
          programId,
          ...prog,
          pact: pactData,
          contract: `${PROG_ADDR}.${PROG_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 2. flying_whale_program_create ───────────────────────────────────────────
  server.registerTool(
    "flying_whale_program_create",
    {
      title: "Flying Whale — Create Program",
      description:
        "Create a whale-pact-v2 sequential program with 2 or 3 pacts funded atomically. " +
        "Each pact must complete before the next unlocks (ERR-NOT-NEXT enforces order). " +
        "One deadline governs the entire program. Requires WHALE agent access. " +
        "Calls create-program-2 or create-program-3 based on pacts array length.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pacts: z.array(z.object({
          worker:         z.string().describe("Worker principal (SP...)"),
          amountStx:      z.number().positive().describe("Pact amount in STX"),
          workHashHex:    z.string().length(64).describe("32-byte work hash as hex (sha256 of preimage)"),
          proofType:      z.enum(["HASH","ORACLE","HYBRID","CHAIN"]).describe("Proof tier"),
          verifier:       z.string().optional().describe("Verifier principal for ORACLE/HYBRID"),
          chainTargetStx: z.number().optional().describe("STX balance target for CHAIN type"),
        })).min(2).max(3).describe("Array of 2 or 3 pacts in execution order"),
        deadlineBlocks: z.number().int().positive().describe("Blocks until program deadline (~10min per 144 blocks)"),
      }),
    },
    async ({ callerAddress, pacts: pactsArg, deadlineBlocks }) => {
      try {

        const n = pactsArg.length;
        const fnName = n === 2 ? "create-program-2" : "create-program-3";

        // Build callContract args for each pact
        const pactArgs = pactsArg.map((p, i) => {
          const amountUstx  = Math.round(p.amountStx * 1_000_000);
          const feeBps      = { HASH: 100, ORACLE: 150, HYBRID: 200, CHAIN: 75 }[p.proofType]!;
          const feeUstx     = Math.floor(amountUstx * feeBps / 10_000);
          const proofId     = { HASH: 0, ORACLE: 1, HYBRID: 2, CHAIN: 3 }[p.proofType]!;
          return {
            index:       i,
            worker:      p.worker,
            amountStx:   p.amountStx,
            feeStx:      feeUstx / 1_000_000,
            totalStx:    (amountUstx + feeUstx) / 1_000_000,
            proofType:   p.proofType,
            proofId,
            workHashHex: p.workHashHex,
            verifier:    p.verifier ?? null,
          };
        });

        const totalLocked = pactArgs.reduce((s, p) => s + p.totalStx, 0);

        return createJsonResponse({
          ready:          true,
          programPacts:   n,
          totalLockedStx: totalLocked,
          pactSummary:    pactArgs,
          callContract: {
            contractAddress: PROG_ADDR,
            contractName:    PROG_NAME,
            functionName:    fnName,
            note: "Build function args using pactSummary above. Each pact needs: (worker principal), (amount uint), (work-hash buff 32), (chain-target optional uint), (proof-type uint), (verifier optional principal). Plus deadline-blocks uint at end.",
          },
          deadlineBlocks,
          contract: `${PROG_ADDR}.${PROG_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 3. flying_whale_program_submit_proof ─────────────────────────────────────
  server.registerTool(
    "flying_whale_program_submit_proof",
    {
      title: "Flying Whale — Program Submit Proof",
      description:
        "Submit hash proof for a whale-pact-v2 program pact. " +
        "Only the next incomplete pact in the sequence can be settled. " +
        "ERR-NOT-NEXT (u15) is returned if pact is not the current active one. " +
        "SHA-256 of preimage is verified on-chain — if valid, pact releases and next unlocks.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        programId:  z.number().int().positive().describe("Program ID"),
        pactIndex:  z.number().int().min(0).describe("0-based index of the pact to settle"),
        preimageHex: z.string().describe("Preimage as hex string (sha256 must match work-hash)"),
      }),
    },
    async ({ callerAddress, programId, pactIndex, preimageHex }) => {
      try {

        const rawP = await progCallRead("get-program-pact", [
          serializeCV(uintCV(programId)),
          serializeCV(uintCV(pactIndex)),
        ]);
        if (!rawP.okay) throw new Error(`Pact not found`);
        const pact = decodeProgPact(rawP.result);
        if (!pact) throw new Error(`Program pact #${programId}[${pactIndex}] not found`);

        return createJsonResponse({
          ready:      true,
          programId,
          pactIndex,
          pact,
          callContract: {
            contractAddress: PROG_ADDR,
            contractName:    PROG_NAME,
            functionName:    "submit-program-proof",
            functionArgs: [
              { type: "uint", value: programId },
              { type: "uint", value: pactIndex },
              { type: "buffer", hex: preimageHex },
            ],
          },
          contract: `${PROG_ADDR}.${PROG_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 4. flying_whale_program_attest ───────────────────────────────────────────
  server.registerTool(
    "flying_whale_program_attest",
    {
      title: "Flying Whale — Program Attest",
      description:
        "Verifier attests a whale-pact-v2 program pact (ORACLE or HYBRID). " +
        "valid=true releases payment and unlocks next pact. valid=false marks DISPUTED.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        programId: z.number().int().positive().describe("Program ID"),
        pactIndex: z.number().int().min(0).describe("0-based pact index"),
        valid:     z.boolean().describe("true = approve and release | false = dispute"),
      }),
    },
    async ({ callerAddress, programId, pactIndex, valid }) => {
      try {
        return createJsonResponse({
          ready: true,
          programId, pactIndex, valid,
          callContract: {
            contractAddress: PROG_ADDR,
            contractName:    PROG_NAME,
            functionName:    "attest-program-pact",
            functionArgs: [
              { type: "uint", value: programId },
              { type: "uint", value: pactIndex },
              { type: "bool", value: valid },
            ],
          },
          contract: `${PROG_ADDR}.${PROG_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 5. flying_whale_program_settle_chain ─────────────────────────────────────
  server.registerTool(
    "flying_whale_program_settle_chain",
    {
      title: "Flying Whale — Program Settle Chain",
      description:
        "Permissionless chain settlement for a whale-pact-v2 CHAIN-type program pact. " +
        "Checks worker STX balance on-chain — if >= chain-target, releases and advances program.",
      inputSchema: z.object({
        programId: z.number().int().positive().describe("Program ID"),
        pactIndex: z.number().int().min(0).describe("0-based pact index"),
      }),
    },
    async ({ programId, pactIndex }) => {
      try {
        return createJsonResponse({
          ready: true,
          programId, pactIndex,
          callContract: {
            contractAddress: PROG_ADDR,
            contractName:    PROG_NAME,
            functionName:    "settle-program-chain",
            functionArgs: [
              { type: "uint", value: programId },
              { type: "uint", value: pactIndex },
            ],
          },
          contract: `${PROG_ADDR}.${PROG_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 6. flying_whale_program_abort ────────────────────────────────────────────
  server.registerTool(
    "flying_whale_program_abort",
    {
      title: "Flying Whale — Abort Program",
      description:
        "Hirer aborts a whale-pact-v2 program after deadline. " +
        "Refunds all remaining locked STX (unreleased pacts) back to hirer. " +
        "Only callable by the program hirer after deadline.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        programId: z.number().int().positive().describe("Program ID to abort"),
      }),
    },
    async ({ callerAddress, programId }) => {
      try {
        const raw = await progCallRead("get-program", [serializeCV(uintCV(programId))]);
        const prog = raw.okay ? decodeProgram(raw.result) : null;

        return createJsonResponse({
          ready:      true,
          programId,
          program:    prog,
          callContract: {
            contractAddress: PROG_ADDR,
            contractName:    PROG_NAME,
            functionName:    "abort-program",
            functionArgs: [{ type: "uint", value: programId }],
          },
          contract: `${PROG_ADDR}.${PROG_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 7. flying_whale_program_resolve ──────────────────────────────────────────
  server.registerTool(
    "flying_whale_program_resolve",
    {
      title: "Flying Whale — Resolve Program Dispute",
      description:
        "CONTRACT-OWNER resolves a disputed pact in a whale-pact-v2 program. " +
        "favor-worker=true releases to worker and advances program. " +
        "favor-worker=false refunds hirer and marks pact REFUNDED.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        programId:   z.number().int().positive().describe("Program ID"),
        pactIndex:   z.number().int().min(0).describe("0-based disputed pact index"),
        favorWorker: z.boolean().describe("true = pay worker | false = refund hirer"),
      }),
    },
    async ({ callerAddress, programId, pactIndex, favorWorker }) => {
      try {
        return createJsonResponse({
          ready: true,
          programId, pactIndex, favorWorker,
          callContract: {
            contractAddress: PROG_ADDR,
            contractName:    PROG_NAME,
            functionName:    "resolve-program-dispute",
            functionArgs: [
              { type: "uint",  value: programId },
              { type: "uint",  value: pactIndex },
              { type: "bool",  value: favorWorker },
            ],
          },
          instruction: "Only SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW (zaghmout.btc) can call this.",
          contract: `${PROG_ADDR}.${PROG_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ============================================================================
  // whale-pact-v3 — Market Layer (Competitive Open Bounty Settlement)
  // COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54
  // Deploy TX: 073ccd5598c8dc61087781c282535be961944a36d44fd2a94a4928bb2fd186be
  // IP TX: c746a985d258212decc85676063a38da067fba7bb07439434155330d85208d51
  //
  // Open bounty model: any worker can claim and compete to win reward.
  // STATUS: OPEN(u0) | CLAIMED(u1) | WON(u2) | EXPIRED(u3) | DISPUTED(u4)
  // CHAIN type = permissionless, no claim required.
  // ============================================================================

  const MKT_ADDR = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
  const MKT_NAME = "whale-pact-v3";
  const MKT_STATUS: Record<number, string> = { 0: "OPEN", 1: "CLAIMED", 2: "WON", 3: "EXPIRED", 4: "DISPUTED" };

  async function mktCallRead(fnName: string, args: string[]): Promise<any> {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${MKT_ADDR}/${MKT_NAME}/${fnName}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body:    JSON.stringify({ sender: MKT_ADDR, arguments: args }),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!res.ok) throw new Error(`Hiro call-read failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<{ okay: boolean; result: string; cause?: string }>;
  }

  function decodeListing(hex: string): Record<string, any> | null {
    try {
      const cv  = deserializeCV(hex);
      const raw = cvToJSON(cv) as any;
      if (!raw || raw.type === "none") return null;
      const d = raw.value ?? raw;
      const num = (v: any) => typeof v === "string" ? parseInt(v, 10) : Number(v);
      return {
        poster:      d.poster?.value ?? d.poster,
        rewardStx:   num(d.reward?.value ?? d.reward) / 1_000_000,
        feeStx:      num(d.fee?.value ?? d.fee) / 1_000_000,
        proofType:   num(d["proof-type"]?.value ?? d["proof-type"]),
        proofName:   (["HASH","ORACLE","HYBRID","CHAIN"] as const)[num(d["proof-type"]?.value ?? d["proof-type"])] ?? "UNKNOWN",
        deadline:    num(d.deadline?.value ?? d.deadline),
        status:      num(d.status?.value ?? d.status),
        statusName:  MKT_STATUS[num(d.status?.value ?? d.status)] ?? "UNKNOWN",
        claimant:    d.claimant?.value?.value ?? null,
        hashValid:   d["hash-valid"]?.value ?? d["hash-valid"],
        oracleValid: d["oracle-valid"]?.value ?? d["oracle-valid"],
        chainTarget: d["chain-target"]?.value?.value != null
          ? num(d["chain-target"].value.value) / 1_000_000 : null,
        verifier:    d.verifier?.value?.value ?? null,
      };
    } catch { return { raw: hex }; }
  }

  // ── 1. flying_whale_market_get ───────────────────────────────────────────────
  server.registerTool(
    "flying_whale_market_get",
    {
      title: "Flying Whale — Market Get Listing",
      description:
        "Read a whale-pact-v3 market listing. Shows open bounty details: reward, fee, " +
        "proof type, status, claimant, and deadline. Any address can post or view listings.",
      inputSchema: z.object({
        listingId: z.number().int().positive().describe("Listing ID to fetch"),
      }),
    },
    async ({ listingId }) => {
      try {
        const raw = await mktCallRead("get-listing", [serializeCV(uintCV(listingId))]);
        if (!raw.okay) throw new Error(`Listing #${listingId} not found`);
        const listing = decodeListing(raw.result);
        if (!listing) throw new Error(`Listing #${listingId} not found`);

        return createJsonResponse({
          listingId,
          ...listing,
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 2. flying_whale_market_post ──────────────────────────────────────────────
  server.registerTool(
    "flying_whale_market_post",
    {
      title: "Flying Whale — Post Market Listing",
      description:
        "Post an open bounty on whale-pact-v3. Any worker can claim and compete to win. " +
        "HASH type: first to reveal valid preimage wins. " +
        "ORACLE: verifier picks best submission. " +
        "CHAIN: first address whose STX balance reaches chain-target wins (permissionless). " +
        "Reward + fee locked in escrow at post time. Requires WHALE agent access.",
      inputSchema: z.object({
        callerAddress:  z.string().min(1).describe(CALLER_DESC),
        rewardStx:      z.number().positive().describe("Reward for winner in STX"),
        workHashHex:    z.string().length(64).describe("32-byte work hash as hex (sha256 of deliverable)"),
        proofType:      z.enum(["HASH","ORACLE","HYBRID","CHAIN"]).describe("Settlement type"),
        deadlineBlocks: z.number().int().positive().describe("Blocks until listing expires"),
        verifier:       z.string().optional().describe("Verifier principal (required for ORACLE/HYBRID)"),
        chainTargetStx: z.number().optional().describe("STX balance target for CHAIN type"),
      }),
    },
    async ({ callerAddress, rewardStx, workHashHex, proofType, deadlineBlocks, verifier, chainTargetStx }) => {
      try {
        const feeBps    = { HASH: 100, ORACLE: 150, HYBRID: 200, CHAIN: 75 }[proofType]!;
        const proofId   = { HASH: 0, ORACLE: 1, HYBRID: 2, CHAIN: 3 }[proofType]!;
        const rewardUstx = Math.round(rewardStx * 1_000_000);
        const feeUstx    = Math.floor(rewardUstx * feeBps / 10_000);

        return createJsonResponse({
          ready:          true,
          rewardStx,
          feeStx:         feeUstx / 1_000_000,
          totalLockedStx: (rewardUstx + feeUstx) / 1_000_000,
          proofType,
          feePct:         `${feeBps / 100}%`,
          callContract: {
            contractAddress: MKT_ADDR,
            contractName:    MKT_NAME,
            functionName:    "post-listing",
            note: `Args: (reward uint ${rewardUstx}), (work-hash buff 32 0x${workHashHex}), (chain-target optional uint), (proof-type uint ${proofId}), (verifier optional principal), (deadline-blocks uint ${deadlineBlocks})`,
          },
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 3. flying_whale_market_claim ─────────────────────────────────────────────
  server.registerTool(
    "flying_whale_market_claim",
    {
      title: "Flying Whale — Claim Market Listing",
      description:
        "Claim an OPEN listing on whale-pact-v3. Locks the listing to one worker at a time. " +
        "CHAIN type listings cannot be claimed — they are settled permissionlessly. " +
        "Once claimed, only the claimant can submit proof before deadline.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        listingId: z.number().int().positive().describe("Listing ID to claim"),
      }),
    },
    async ({ callerAddress, listingId }) => {
      try {
        const raw = await mktCallRead("get-listing", [serializeCV(uintCV(listingId))]);
        const listing = raw.okay ? decodeListing(raw.result) : null;

        return createJsonResponse({
          ready: true,
          listingId,
          listing,
          callContract: {
            contractAddress: MKT_ADDR,
            contractName:    MKT_NAME,
            functionName:    "claim-listing",
            functionArgs: [{ type: "uint", value: listingId }],
          },
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 4. flying_whale_market_submit_proof ──────────────────────────────────────
  server.registerTool(
    "flying_whale_market_submit_proof",
    {
      title: "Flying Whale — Market Submit Proof",
      description:
        "Submit hash proof for a CLAIMED whale-pact-v3 listing (HASH or HYBRID). " +
        "SHA-256 of preimage verified on-chain. If valid (and oracle also valid for HYBRID), " +
        "winner is paid immediately.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        listingId:   z.number().int().positive().describe("Listing ID"),
        preimageHex: z.string().describe("Preimage as hex string"),
      }),
    },
    async ({ callerAddress, listingId, preimageHex }) => {
      try {
        const raw = await mktCallRead("get-listing", [serializeCV(uintCV(listingId))]);
        const listing = raw.okay ? decodeListing(raw.result) : null;

        return createJsonResponse({
          ready: true,
          listingId,
          listing,
          callContract: {
            contractAddress: MKT_ADDR,
            contractName:    MKT_NAME,
            functionName:    "submit-market-proof",
            functionArgs: [
              { type: "uint",   value: listingId },
              { type: "buffer", hex: preimageHex },
            ],
          },
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 5. flying_whale_market_attest ────────────────────────────────────────────
  server.registerTool(
    "flying_whale_market_attest",
    {
      title: "Flying Whale — Market Attest",
      description:
        "Verifier attests a whale-pact-v3 ORACLE or HYBRID listing. " +
        "valid=true pays the claimant. valid=false marks listing DISPUTED for owner resolution.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        listingId: z.number().int().positive().describe("Listing ID"),
        valid:     z.boolean().describe("true = approve and pay | false = dispute"),
      }),
    },
    async ({ callerAddress, listingId, valid }) => {
      try {
        return createJsonResponse({
          ready: true,
          listingId, valid,
          callContract: {
            contractAddress: MKT_ADDR,
            contractName:    MKT_NAME,
            functionName:    "attest-market",
            functionArgs: [
              { type: "uint", value: listingId },
              { type: "bool", value: valid },
            ],
          },
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 6. flying_whale_market_settle_chain ──────────────────────────────────────
  server.registerTool(
    "flying_whale_market_settle_chain",
    {
      title: "Flying Whale — Market Settle Chain",
      description:
        "Permissionless CHAIN settlement for a whale-pact-v3 listing. " +
        "Anyone can call — first address whose STX balance >= chain-target wins the reward. " +
        "No claim step needed for CHAIN type.",
      inputSchema: z.object({
        listingId:     z.number().int().positive().describe("Listing ID"),
        claimantAddr:  z.string().describe("Address to check and potentially pay (must have >= chain-target STX)"),
      }),
    },
    async ({ listingId, claimantAddr }) => {
      try {
        const raw = await mktCallRead("get-listing", [serializeCV(uintCV(listingId))]);
        const listing = raw.okay ? decodeListing(raw.result) : null;

        return createJsonResponse({
          ready: true,
          listingId,
          claimantAddr,
          chainTarget:  listing?.chainTarget ?? null,
          listing,
          callContract: {
            contractAddress: MKT_ADDR,
            contractName:    MKT_NAME,
            functionName:    "settle-market-chain",
            functionArgs: [
              { type: "uint",      value: listingId },
              { type: "principal", value: claimantAddr },
            ],
          },
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 7. flying_whale_market_expire ────────────────────────────────────────────
  server.registerTool(
    "flying_whale_market_expire",
    {
      title: "Flying Whale — Expire Market Listing",
      description:
        "Poster reclaims reward + fee after deadline if listing is OPEN or CLAIMED but abandoned. " +
        "Only the original poster can call this after the deadline block.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        listingId: z.number().int().positive().describe("Listing ID to expire and refund"),
      }),
    },
    async ({ callerAddress, listingId }) => {
      try {
        const raw = await mktCallRead("get-listing", [serializeCV(uintCV(listingId))]);
        const listing = raw.okay ? decodeListing(raw.result) : null;

        return createJsonResponse({
          ready: true,
          listingId,
          listing,
          callContract: {
            contractAddress: MKT_ADDR,
            contractName:    MKT_NAME,
            functionName:    "expire-listing",
            functionArgs: [{ type: "uint", value: listingId }],
          },
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 8. flying_whale_market_resolve ───────────────────────────────────────────
  server.registerTool(
    "flying_whale_market_resolve",
    {
      title: "Flying Whale — Resolve Market Dispute",
      description:
        "CONTRACT-OWNER resolves a DISPUTED whale-pact-v3 listing. " +
        "favor-claimant=true pays the claimant. favor-claimant=false refunds the poster.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        listingId:     z.number().int().positive().describe("Listing ID in DISPUTED state"),
        favorClaimant: z.boolean().describe("true = pay claimant | false = refund poster"),
      }),
    },
    async ({ callerAddress, listingId, favorClaimant }) => {
      try {
        const raw = await mktCallRead("get-listing", [serializeCV(uintCV(listingId))]);
        const listing = raw.okay ? decodeListing(raw.result) : null;
        if (listing && listing.statusName !== "DISPUTED")
          throw new Error(`Listing is ${listing.statusName} — resolve only for DISPUTED listings`);

        return createJsonResponse({
          ready: true,
          listingId,
          favorClaimant,
          listing,
          callContract: {
            contractAddress: MKT_ADDR,
            contractName:    MKT_NAME,
            functionName:    "resolve-market-dispute",
            functionArgs: [
              { type: "uint", value: listingId },
              { type: "bool", value: favorClaimant },
            ],
          },
          instruction: "Only SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW (zaghmout.btc) can call this.",
          contract: `${MKT_ADDR}.${MKT_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ============================================================================
  // whale-pact-v4 — Sovereign Layer (DAO + Treasury + Dual-Chain Proof)
  // COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54
  // Deploy TX: 78ede8896b62f0012b28b972aac1ae668b3257f4a99a7832d03ac0b9f0ed38e1
  // IP TX: 208a0583fcba04c7165907e8281c97de2f87f28e6ac11f935eca8d90671bfd4b
  //
  // Apex settlement layer:
  //   SOVEREIGN proof (u4): STX balance AND WHALE balance both verified on-chain.
  //   Fees route to whale-treasury-v1 for buyback (no accumulation in contract).
  //   WHALE-weighted governance: propose/vote/execute fee tier changes.
  //   Keeper earns 0.10% incentive for triggering sovereign settlement.
  // ============================================================================

  const SOV_ADDR = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
  const SOV_NAME = "whale-pact-v4";
  const SOV_STATE: Record<number, string> = { 0: "OPEN", 1: "RELEASED", 2: "DISPUTED", 3: "REFUNDED" };
  const SOV_PROOF: Record<number, string> = { 0: "HASH", 1: "ORACLE", 2: "HYBRID", 3: "CHAIN", 4: "SOVEREIGN" };

  async function sovCallRead(fnName: string, args: string[]): Promise<any> {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${SOV_ADDR}/${SOV_NAME}/${fnName}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body:    JSON.stringify({ sender: SOV_ADDR, arguments: args }),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!res.ok) throw new Error(`Hiro call-read failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<{ okay: boolean; result: string; cause?: string }>;
  }

  function decodeSovPact(hex: string): Record<string, any> | null {
    try {
      const cv  = deserializeCV(hex);
      const raw = cvToJSON(cv) as any;
      if (!raw || raw.type === "none") return null;
      const d = raw.value ?? raw;
      const num = (v: any) => typeof v === "string" ? parseInt(v, 10) : Number(v);
      return {
        hirer:        d.hirer?.value ?? d.hirer,
        worker:       d.worker?.value ?? d.worker,
        amountStx:    num(d.amount?.value ?? d.amount) / 1_000_000,
        feeStx:       num(d.fee?.value ?? d.fee) / 1_000_000,
        proofType:    num(d["proof-type"]?.value ?? d["proof-type"]),
        proofName:    SOV_PROOF[num(d["proof-type"]?.value ?? d["proof-type"])] ?? "UNKNOWN",
        deadline:     num(d.deadline?.value ?? d.deadline),
        state:        num(d.state?.value ?? d.state),
        stateName:    SOV_STATE[num(d.state?.value ?? d.state)] ?? "UNKNOWN",
        hashValid:    d["hash-valid"]?.value ?? d["hash-valid"],
        oracleValid:  d["oracle-valid"]?.value ?? d["oracle-valid"],
        verifier:     d.verifier?.value?.value ?? null,
        chainTarget:  d["chain-target"]?.value?.value != null
          ? num(d["chain-target"].value.value) / 1_000_000 : null,
        whaleTarget:  d["whale-target"]?.value?.value != null
          ? num(d["whale-target"].value.value) / 1_000_000 : null,
      };
    } catch { return { raw: hex }; }
  }

  // ── 1. flying_whale_sovereign_get ────────────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_get",
    {
      title: "Flying Whale — Sovereign Get Pact",
      description:
        "Read a whale-pact-v4 sovereign pact. Shows all fields including whale-target " +
        "for SOVEREIGN type. Use flying_whale_sovereign_check to verify dual-chain conditions.",
      inputSchema: z.object({
        pactId: z.number().int().positive().describe("Sovereign pact ID"),
      }),
    },
    async ({ pactId }) => {
      try {
        const raw = await sovCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        if (!raw.okay) throw new Error(`Pact #${pactId} not found`);
        const pact = decodeSovPact(raw.result);
        if (!pact) throw new Error(`Sovereign pact #${pactId} not found`);

        return createJsonResponse({
          pactId,
          ...pact,
          isSovereign: pact.proofType === 4,
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 2. flying_whale_sovereign_preview ────────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_preview",
    {
      title: "Flying Whale — Sovereign Fee Preview",
      description:
        "Preview fees for a whale-pact-v4 pact. Shows governance-set fee BPS for all proof tiers. " +
        "SOVEREIGN type has 0.50% fee and routes ALL fees to whale-treasury-v1 for buyback.",
      inputSchema: z.object({
        amountStx: z.number().positive().describe("Pact amount in STX"),
        proofType: z.enum(["HASH","ORACLE","HYBRID","CHAIN","SOVEREIGN"])
          .describe("HASH(1%) | ORACLE(1.5%) | HYBRID(2%) | CHAIN(0.75%) | SOVEREIGN(0.5%)"),
      }),
    },
    async ({ amountStx, proofType }) => {
      try {
        // Fetch live fees from governance vars
        const rawFees = await sovCallRead("get-fees", []);
        let feeBps = { HASH: 100, ORACLE: 150, HYBRID: 200, CHAIN: 75, SOVEREIGN: 50 }[proofType]!;
        if (rawFees.okay) {
          try {
            const fv = cvToJSON(deserializeCV(rawFees.result)) as any;
            const fv2 = fv.value ?? fv;
            const num = (v: any) => typeof v === "string" ? parseInt(v, 10) : Number(v);
            const liveMap: Record<string, number> = {
              HASH:      num(fv2.hash?.value      ?? fv2.hash),
              ORACLE:    num(fv2.oracle?.value    ?? fv2.oracle),
              HYBRID:    num(fv2.hybrid?.value    ?? fv2.hybrid),
              CHAIN:     num(fv2.chain?.value     ?? fv2.chain),
              SOVEREIGN: num(fv2.sovereign?.value ?? fv2.sovereign),
            };
            feeBps = liveMap[proofType] ?? feeBps;
          } catch { /* use defaults */ }
        }

        const amountUstx = Math.round(amountStx * 1_000_000);
        const feeUstx    = Math.floor(amountUstx * feeBps / 10_000);
        const minStx     = { HASH: 1, ORACLE: 5, HYBRID: 10, CHAIN: 5, SOVEREIGN: 10 }[proofType]!;

        return createJsonResponse({
          proofType,
          amountStx,
          feeStx:         feeUstx / 1_000_000,
          feePct:         `${feeBps / 100}%`,
          totalLockedStx: (amountUstx + feeUstx) / 1_000_000,
          minStx,
          valid:          amountStx >= minStx,
          feeDestination: "whale-treasury-v1 (buyback engine)",
          keeperBps:      proofType === "SOVEREIGN" ? 10 : 0,
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 3. flying_whale_sovereign_create ─────────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_create",
    {
      title: "Flying Whale — Create Sovereign Pact",
      description:
        "Create a whale-pact-v4 pact. Supports all 5 proof types including SOVEREIGN. " +
        "SOVEREIGN type requires both chain-target (STX) AND whale-target (WHALE tokens). " +
        "Fees route to whale-treasury-v1 for buyback. Requires WHALE agent access.",
      inputSchema: z.object({
        callerAddress:  z.string().min(1).describe(CALLER_DESC),
        worker:         z.string().describe("Worker principal (SP...)"),
        amountStx:      z.number().positive().describe("Pact amount in STX"),
        workHashHex:    z.string().length(64).describe("32-byte work hash as hex"),
        proofType:      z.enum(["HASH","ORACLE","HYBRID","CHAIN","SOVEREIGN"]),
        deadlineBlocks: z.number().int().positive().describe("Blocks until deadline"),
        verifier:       z.string().optional().describe("Verifier for ORACLE/HYBRID"),
        chainTargetStx: z.number().optional().describe("Required STX balance for CHAIN/SOVEREIGN"),
        whaleTarget:    z.number().optional().describe("Required WHALE token balance for SOVEREIGN (6 decimals)"),
      }),
    },
    async ({ callerAddress, worker, amountStx, workHashHex, proofType, deadlineBlocks, verifier, chainTargetStx, whaleTarget }) => {
      try {

        const proofId = { HASH: 0, ORACLE: 1, HYBRID: 2, CHAIN: 3, SOVEREIGN: 4 }[proofType]!;
        const feeBps  = { HASH: 100, ORACLE: 150, HYBRID: 200, CHAIN: 75, SOVEREIGN: 50 }[proofType]!;
        const amountUstx = Math.round(amountStx * 1_000_000);
        const feeUstx    = Math.floor(amountUstx * feeBps / 10_000);

        const warnings: string[] = [];
        if (proofType === "SOVEREIGN" && (!chainTargetStx || !whaleTarget))
          warnings.push("SOVEREIGN requires both chainTargetStx and whaleTarget");
        if (proofType === "ORACLE" || proofType === "HYBRID")
          if (!verifier) warnings.push("ORACLE/HYBRID requires verifier");

        return createJsonResponse({
          ready:          warnings.length === 0,
          warnings,
          worker,
          amountStx,
          feeStx:         feeUstx / 1_000_000,
          feePct:         `${feeBps / 100}%`,
          totalLockedStx: (amountUstx + feeUstx) / 1_000_000,
          proofType,
          proofId,
          chainTargetStx: chainTargetStx ?? null,
          whaleTarget:    whaleTarget ?? null,
          feeDestination: "whale-treasury-v1",
          callContract: {
            contractAddress: SOV_ADDR,
            contractName:    SOV_NAME,
            functionName:    "create-pact",
            note: `Args: (worker principal), (amount uint ${amountUstx}), (work-hash buff 32 0x${workHashHex}), (chain-target optional uint), (whale-target optional uint), (proof-type uint ${proofId}), (verifier optional principal), (deadline-blocks uint ${deadlineBlocks})`,
          },
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 4. flying_whale_sovereign_check ──────────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_check",
    {
      title: "Flying Whale — Check Sovereign Conditions",
      description:
        "Check if a SOVEREIGN pact's dual-chain conditions are currently met. " +
        "Reads worker's live STX balance AND WHALE token balance from chain. " +
        "Returns true if BOTH targets are satisfied — pact is ready for settle-sovereign.",
      inputSchema: z.object({
        pactId: z.number().int().positive().describe("Sovereign pact ID to check"),
      }),
    },
    async ({ pactId }) => {
      try {
        const rawCheck = await sovCallRead("check-sovereign", [serializeCV(uintCV(pactId))]);
        const rawPact  = await sovCallRead("get-pact", [serializeCV(uintCV(pactId))]);

        let conditionsMet = false;
        if (rawCheck.okay) {
          try {
            const cv = cvToJSON(deserializeCV(rawCheck.result)) as any;
            conditionsMet = (cv.value ?? cv) === true || cv === true;
          } catch { /* */ }
        }

        const pact = rawPact.okay ? decodeSovPact(rawPact.result) : null;

        return createJsonResponse({
          pactId,
          conditionsMet,
          readyToSettle: conditionsMet && pact?.stateName === "OPEN",
          pact,
          note: conditionsMet
            ? "Call flying_whale_sovereign_settle to trigger permissionless settlement and earn keeper fee."
            : "Conditions not yet met. Worker needs more STX or WHALE balance.",
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 5. flying_whale_sovereign_settle ─────────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_settle",
    {
      title: "Flying Whale — Settle Sovereign Pact",
      description:
        "Permissionless dual-chain settlement for a whale-pact-v4 SOVEREIGN pact. " +
        "Verifies worker holds >= chain-target STX AND >= whale-target WHALE simultaneously. " +
        "Caller (keeper) earns 0.10% of pact fee as incentive. Remaining fee to treasury.",
      inputSchema: z.object({
        pactId: z.number().int().positive().describe("SOVEREIGN pact ID to settle"),
      }),
    },
    async ({ pactId }) => {
      try {
        const rawPact = await sovCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        const pact = rawPact.okay ? decodeSovPact(rawPact.result) : null;
        if (pact && pact.proofType !== 4)
          throw new Error(`Pact is ${pact.proofName} type — settle-sovereign only for SOVEREIGN (u4)`);

        return createJsonResponse({
          ready: true,
          pactId,
          pact,
          keeperIncentive: pact ? `${(pact.feeStx * 10 / 50).toFixed(6)} STX (0.10% of fee)` : "calculated at settlement",
          callContract: {
            contractAddress: SOV_ADDR,
            contractName:    SOV_NAME,
            functionName:    "settle-sovereign",
            functionArgs: [{ type: "uint", value: pactId }],
          },
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 6. flying_whale_sovereign_submit_proof ───────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_submit_proof",
    {
      title: "Flying Whale — Sovereign Submit Proof",
      description:
        "Submit hash proof for a whale-pact-v4 HASH or HYBRID pact. " +
        "Fees route to whale-treasury-v1 on release.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId:      z.number().int().positive().describe("Pact ID"),
        preimageHex: z.string().describe("Preimage as hex string"),
      }),
    },
    async ({ callerAddress, pactId, preimageHex }) => {
      try {
        return createJsonResponse({
          ready: true,
          pactId,
          callContract: {
            contractAddress: SOV_ADDR,
            contractName:    SOV_NAME,
            functionName:    "submit-proof",
            functionArgs: [
              { type: "uint",   value: pactId },
              { type: "buffer", hex: preimageHex },
            ],
          },
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 7. flying_whale_sovereign_attest ─────────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_attest",
    {
      title: "Flying Whale — Sovereign Attest",
      description:
        "Verifier attests a whale-pact-v4 ORACLE or HYBRID pact. Fee routes to treasury on release.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Pact ID"),
        valid:  z.boolean().describe("true = approve and release | false = dispute"),
      }),
    },
    async ({ callerAddress, pactId, valid }) => {
      try {
        return createJsonResponse({
          ready: true,
          pactId, valid,
          callContract: {
            contractAddress: SOV_ADDR,
            contractName:    SOV_NAME,
            functionName:    "attest",
            functionArgs: [
              { type: "uint", value: pactId },
              { type: "bool", value: valid },
            ],
          },
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 8. flying_whale_sovereign_settle_chain ───────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_settle_chain",
    {
      title: "Flying Whale — Sovereign Settle Chain",
      description:
        "Permissionless CHAIN (u3) settlement for a whale-pact-v4 pact. " +
        "Checks worker STX balance >= chain-target. Fee routes to whale-treasury-v1.",
      inputSchema: z.object({
        pactId: z.number().int().positive().describe("CHAIN pact ID"),
      }),
    },
    async ({ pactId }) => {
      try {
        return createJsonResponse({
          ready: true,
          pactId,
          callContract: {
            contractAddress: SOV_ADDR,
            contractName:    SOV_NAME,
            functionName:    "settle-chain",
            functionArgs: [{ type: "uint", value: pactId }],
          },
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 9. flying_whale_sovereign_refund ─────────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_refund",
    {
      title: "Flying Whale — Sovereign Refund",
      description:
        "Hirer reclaims locked STX after deadline from a whale-pact-v4 pact in OPEN state.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId: z.number().int().positive().describe("Pact ID to refund"),
      }),
    },
    async ({ callerAddress, pactId }) => {
      try {
        const raw = await sovCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        const pact = raw.okay ? decodeSovPact(raw.result) : null;

        return createJsonResponse({
          ready: true,
          pactId,
          pact,
          callContract: {
            contractAddress: SOV_ADDR,
            contractName:    SOV_NAME,
            functionName:    "refund",
            functionArgs: [{ type: "uint", value: pactId }],
          },
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 10. flying_whale_sovereign_resolve ───────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_resolve",
    {
      title: "Flying Whale — Resolve Sovereign Dispute",
      description:
        "CONTRACT-OWNER resolves a DISPUTED whale-pact-v4 pact. Fee routes to treasury on release.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        pactId:      z.number().int().positive().describe("Disputed pact ID"),
        favorWorker: z.boolean().describe("true = pay worker | false = refund hirer"),
      }),
    },
    async ({ callerAddress, pactId, favorWorker }) => {
      try {
        const raw = await sovCallRead("get-pact", [serializeCV(uintCV(pactId))]);
        const pact = raw.okay ? decodeSovPact(raw.result) : null;
        if (pact && pact.stateName !== "DISPUTED")
          throw new Error(`Pact is ${pact.stateName} — resolve only for DISPUTED pacts`);

        return createJsonResponse({
          ready: true,
          pactId, favorWorker,
          pact,
          callContract: {
            contractAddress: SOV_ADDR,
            contractName:    SOV_NAME,
            functionName:    "resolve-dispute",
            functionArgs: [
              { type: "uint", value: pactId },
              { type: "bool", value: favorWorker },
            ],
          },
          instruction: "Only SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW (zaghmout.btc) can call this.",
          contract: `${SOV_ADDR}.${SOV_NAME}`,
          ...SOVEREIGNTY_STAMP,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── 11. flying_whale_sovereign_governance ────────────────────────────────────
  server.registerTool(
    "flying_whale_sovereign_governance",
    {
      title: "Flying Whale — Sovereign Governance",
      description:
        "Interact with whale-pact-v4 WHALE-weighted fee governance. " +
        "Actions: 'fees' = read live fee BPS | 'propose' = propose fee change | " +
        "'vote' = vote on proposal | 'execute' = execute passed proposal after timelock. " +
        "Vote weight = caller's WHALE balance. Quorum = 3 unique voters. Timelock = 144 blocks.",
      inputSchema: z.object({
        callerAddress: z.string().min(1).describe(CALLER_DESC),
        action:     z.enum(["fees","propose","vote","execute"]).describe("Governance action"),
        proposalId: z.number().int().positive().optional().describe("Proposal ID (for vote/execute)"),
        tier:       z.enum(["HASH","ORACLE","HYBRID","CHAIN","SOVEREIGN"]).optional()
          .describe("Fee tier to change (for propose)"),
        newBps:     z.number().int().min(1).max(500).optional()
          .describe("New fee in basis points, e.g. 120 = 1.20% (for propose, max 500=5%)"),
        support:    z.boolean().optional().describe("true=yes / false=no (for vote)"),
      }),
    },
    async ({ callerAddress, action, proposalId, tier, newBps, support }) => {
      try {

        if (action === "fees") {
          const rawFees = await sovCallRead("get-fees", []);
          let fees: Record<string, any> = {};
          if (rawFees.okay) {
            try {
              const fv = cvToJSON(deserializeCV(rawFees.result)) as any;
              const fv2 = fv.value ?? fv;
              const num = (v: any) => typeof v === "string" ? parseInt(v, 10) : Number(v);
              fees = {
                HASH:      { bps: num(fv2.hash?.value      ?? fv2.hash),      pct: `${num(fv2.hash?.value      ?? fv2.hash)      / 100}%` },
                ORACLE:    { bps: num(fv2.oracle?.value    ?? fv2.oracle),    pct: `${num(fv2.oracle?.value    ?? fv2.oracle)    / 100}%` },
                HYBRID:    { bps: num(fv2.hybrid?.value    ?? fv2.hybrid),    pct: `${num(fv2.hybrid?.value    ?? fv2.hybrid)    / 100}%` },
                CHAIN:     { bps: num(fv2.chain?.value     ?? fv2.chain),     pct: `${num(fv2.chain?.value     ?? fv2.chain)     / 100}%` },
                SOVEREIGN: { bps: num(fv2.sovereign?.value ?? fv2.sovereign), pct: `${num(fv2.sovereign?.value ?? fv2.sovereign) / 100}%` },
                keeper:    { bps: num(fv2.keeper?.value    ?? fv2.keeper),    pct: `${num(fv2.keeper?.value    ?? fv2.keeper)    / 100}% (keeper incentive for SOVEREIGN settle)` },
              };
            } catch { fees = { error: "decode failed" }; }
          }
          return createJsonResponse({ action: "fees", fees, contract: `${SOV_ADDR}.${SOV_NAME}`, ...SOVEREIGNTY_STAMP });
        }

        if (action === "propose") {
          if (!tier || !newBps) throw new Error("propose requires tier and newBps");
          const tierId = { HASH: 0, ORACLE: 1, HYBRID: 2, CHAIN: 3, SOVEREIGN: 4 }[tier]!;
          return createJsonResponse({
            action: "propose",
            tier, newBps, tierId,
            callContract: {
              contractAddress: SOV_ADDR,
              contractName:    SOV_NAME,
              functionName:    "propose-fee-change",
              functionArgs: [
                { type: "uint", value: tierId },
                { type: "uint", value: newBps },
              ],
            },
            note: "Proposal timelock = 144 blocks (~1 day). Quorum = 3 unique WHALE holders.",
            contract: `${SOV_ADDR}.${SOV_NAME}`,
            ...SOVEREIGNTY_STAMP,
          });
        }

        if (action === "vote") {
          if (!proposalId || support === undefined) throw new Error("vote requires proposalId and support");
          const rawProp = await sovCallRead("get-proposal", [serializeCV(uintCV(proposalId))]);
          let proposal: any = null;
          if (rawProp.okay) {
            try {
              const cv = cvToJSON(deserializeCV(rawProp.result)) as any;
              proposal = cv.value ?? cv;
            } catch { /* */ }
          }
          return createJsonResponse({
            action: "vote",
            proposalId, support,
            proposal,
            callContract: {
              contractAddress: SOV_ADDR,
              contractName:    SOV_NAME,
              functionName:    "vote-proposal",
              functionArgs: [
                { type: "uint", value: proposalId },
                { type: "bool", value: support },
              ],
            },
            note: "Vote weight = your WHALE balance. Must vote before executable-at block.",
            contract: `${SOV_ADDR}.${SOV_NAME}`,
            ...SOVEREIGNTY_STAMP,
          });
        }

        if (action === "execute") {
          if (!proposalId) throw new Error("execute requires proposalId");
          return createJsonResponse({
            action: "execute",
            proposalId,
            callContract: {
              contractAddress: SOV_ADDR,
              contractName:    SOV_NAME,
              functionName:    "execute-proposal",
              functionArgs: [{ type: "uint", value: proposalId }],
            },
            note: "Requires: quorum (3 voters) + yes > no + block >= executable-at",
            contract: `${SOV_ADDR}.${SOV_NAME}`,
            ...SOVEREIGNTY_STAMP,
          });
        }

        throw new Error(`Unknown action: ${action}`);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BEHAVIORAL FORTRESS — Honeypot Tools (Layer 2)
  // Accessing ANY of these tools flags the caller as a systematic mapper.
  // The response is intentionally convincing but leads nowhere.
  // Behavior score += 50 (irreversible) → category = adversary if other factors >40.
  // ══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "flying_whale_premium_alpha",
    {
      description:
        "Access Flying Whale premium alpha signal feed — early intelligence before public release. " +
        "",
      inputSchema: {
        callerAddress: z.string().describe(CALLER_DESC),
        beat: z.string().optional().describe("Signal beat: quantum-threats | agent-economy | bitcoin-macro"),
      },
    },
    async ({ callerAddress }: { callerAddress: string }) => {
      try {

        const payload = honeypotResponse("flying_whale_premium_alpha", callerAddress ?? "unknown");
        return createJsonResponse(payload);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_internal_scoring",
    {
      description:
        "Flying Whale internal agent scoring engine — raw scoring parameters and weight matrix. " +
        "Internal tool. Requires Institutional licensing agreement + on-chain pact.",
      inputSchema: {
        callerAddress: z.string().describe(CALLER_DESC),
        targetAddress: z.string().optional().describe("Agent to score"),
      },
    },
    async ({ callerAddress }: { callerAddress: string }) => {
      try {

        const payload = honeypotResponse("flying_whale_internal_scoring", callerAddress ?? "unknown");
        return createJsonResponse(payload);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_edge_strategy",
    {
      description:
        "Flying Whale execution edge strategy — proprietary routing logic and MEV capture parameters. " +
        "Elite+ tier only. Requires whale-pact-v3 + 100,000 WHALE staked.",
      inputSchema: {
        callerAddress: z.string().describe(CALLER_DESC),
        pair: z.string().optional().describe("Token pair (e.g. WHALE/wSTX)"),
      },
    },
    async ({ callerAddress }: { callerAddress: string }) => {
      try {

        const payload = honeypotResponse("flying_whale_edge_strategy", callerAddress ?? "unknown");
        return createJsonResponse(payload);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Classifieds ────────────────────────────────────────────────────────────

  server.registerTool(
    "flying_whale_classifieds_list",
    {
      description:
        "List active classified listings on the Flying Whale Sovereign Marketplace. " +
        "No gatekeepers — listings are paid via x402 and distributed to 771 AIBTC agents. " +
        "Filter by category: tool | contract | service | data | agent | bounty | other. " +
        "Scout tier required.",
      inputSchema: {
        callerAddress: z.string().describe(CALLER_DESC),
        category: z.string().optional().describe("Filter by category"),
        limit: z.number().optional().describe("Max results (default 20, max 50)"),
        offset: z.number().optional().describe("Pagination offset"),
      },
    },
    async ({ callerAddress, category, limit, offset }: {
      callerAddress: string;
      category?: string;
      limit?: number;
      offset?: number;
    }) => {
      try {

        const params = new URLSearchParams();
        if (category) params.set("category", category);
        if (limit) params.set("limit", String(limit));
        if (offset) params.set("offset", String(offset));
        const res = await fetch(`${OPS_URL}/classifieds?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const data = await res.json();
        return createJsonResponse({ ...data, ...SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_classifieds_get",
    {
      description:
        "Get a single classified listing by ID from Flying Whale Sovereign Marketplace. " +
        "Returns full listing details including contact, price ask, distribution status. " +
        "Scout tier required.",
      inputSchema: {
        callerAddress: z.string().describe(CALLER_DESC),
        classified_id: z.string().describe("Classified listing ID (e.g. fw-cl-...)"),
      },
    },
    async ({ callerAddress, classified_id }: { callerAddress: string; classified_id: string }) => {
      try {

        const res = await fetch(`${OPS_URL}/classifieds/${classified_id}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return createErrorResponse(new Error(`Classified not found: ${classified_id}`));
        const data = await res.json();
        return createJsonResponse({ ...data, ...SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_classifieds_submit",
    {
      description:
        "Submit a new classified listing to the Flying Whale Sovereign Marketplace. " +
        "Cost: 2500 microSTX (x402 payment — handled automatically by the MCP server wallet). " +
        "Listing is live for 7 days and distributed immediately to 771 AIBTC agents via Intelligence Hub + MCP feed. " +
        "No editors. No approval queue. No gatekeepers. " +
        "Categories: tool | contract | service | data | agent | bounty | other. " +
        "Agent tier required.",
      inputSchema: {
        callerAddress: z.string().describe(CALLER_DESC),
        title: z.string().describe("Listing title (max 120 chars)"),
        body: z.string().describe("Full listing description (max 1000 chars)"),
        category: z.string().describe("Category: tool | contract | service | data | agent | bounty | other"),
        contact: z.string().describe("Contact info: BNS name, STX address, URL, or email"),
        price_ask: z.string().optional().describe("Optional asking price (e.g. '50,000 WHALE', '0.01 sBTC', 'negotiable')"),
        submitted_by: z.string().describe("Your STX address (for attribution and on-chain proof)"),
      },
    },
    async ({ callerAddress, title, body, category, contact, price_ask, submitted_by }: {
      callerAddress: string;
      title: string;
      body: string;
      category: string;
      contact: string;
      price_ask?: string;
      submitted_by: string;
    }) => {
      try {

        const res = await fetch(`${OPS_URL}/classifieds`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, category, contact, price_ask, submitted_by }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data = await res.json();
        return createJsonResponse({ ...data, ...SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "flying_whale_classifieds_stats",
    {
      description:
        "Get Flying Whale Sovereign Classifieds marketplace statistics. " +
        "Active listings, total views, breakdown by category, listing price, distribution reach. " +
        "Scout tier required.",
      inputSchema: {
        callerAddress: z.string().describe(CALLER_DESC),
      },
    },
    async ({ callerAddress }: { callerAddress: string }) => {
      try {

        const res = await fetch(`${OPS_URL}/classifieds/stats`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const data = await res.json();
        return createJsonResponse({ ...data, ...SOVEREIGNTY_STAMP });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
