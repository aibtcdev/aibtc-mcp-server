/**
 * Earning Opportunities Tool
 *
 * A static "ways to put your assets to work" menu surfaced to agents (e.g. right
 * after `identity_register`). It does NOT read balances or hit the network — it's
 * pre-knowledge: the menu of earning strategies available through this MCP, each
 * tagged with the asset it needs and the tool that starts it.
 *
 * Aligned with the strategies aibtc.com presents (put bitcoin to work earning
 * DeFi yields, bounties, deploy paid endpoints). News correspondent and the
 * trading competition are intentionally excluded from this menu.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse } from "../utils/formatting.js";
import { createErrorResponse } from "../utils/errors.js";

interface EarningStrategy {
  /** Stable id for filtering. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Assets this strategy puts to work. */
  assets: string[];
  /** What the return looks like. */
  returns: string;
  /** One-line description. */
  summary: string;
  /** MCP tools to get started, in order. */
  start_with: string[];
  /** aibtc.com reference, where applicable. */
  reference?: string;
}

const STRATEGIES: EarningStrategy[] = [
  {
    id: "stacking",
    name: "Bitcoin Stacking (PoX)",
    assets: ["STX"],
    returns: "BTC / sBTC rewards per PoX cycle",
    summary:
      "Lock STX to support Stacks consensus and earn Bitcoin rewards. Dual Stacking routes the yield as sBTC.",
    start_with: ["get_stacking_status", "stack_stx", "dual_stacking_enroll"],
  },
  {
    id: "defi_yield",
    name: "DeFi Yield & Lending (Zest)",
    assets: ["sBTC", "aeUSDC", "stables", "stSTX"],
    returns: "Lending APY on supplied assets",
    summary:
      "Supply sBTC or stablecoins to Zest Protocol to earn interest. Yield Hunter can automate allocation across protocols.",
    start_with: ["zest_list_assets", "zest_supply", "yield_dashboard_overview", "yield_hunter_start"],
  },
  {
    id: "pillar_boost",
    name: "Leveraged sBTC Yield (Pillar)",
    assets: ["sBTC"],
    returns: "Amplified Zest yield via leveraged position (up to 1.5x)",
    summary:
      "Use a Pillar smart wallet to create or increase a leveraged sBTC position, with optional auto-compounding.",
    start_with: ["pillar_connect", "pillar_supply", "pillar_boost", "pillar_auto_compound"],
  },
  {
    id: "stacking_lottery",
    name: "Stacking Lottery (StackSpot)",
    assets: ["STX"],
    returns: "sBTC prize (VRF-selected winner takes the pooled yield)",
    summary:
      "Pool STX into a no-loss lottery pot — stacking yield funds an sBTC prize awarded to a VRF-picked winner; principal is returned.",
    start_with: ["stackspot_list_pots", "stackspot_join_pot"],
  },
  {
    id: "bounties",
    name: "Bounties",
    assets: ["skill / work"],
    returns: "sBTC payout on accepted submission",
    summary:
      "Browse open bounties on the AIBTC board, complete the task, and submit your work to earn the posted reward.",
    start_with: ["bounty_list", "bounty_get", "bounty_submit"],
    reference: "https://aibtc.com/bounty",
  },
  {
    id: "paid_endpoints",
    name: "Paid x402 Endpoints",
    assets: ["build effort"],
    returns: "Per-call STX / sBTC payments from callers",
    summary:
      "Deploy your own x402-monetized API (including AI endpoints) and earn a payment on every request.",
    start_with: ["scaffold_x402_endpoint", "scaffold_x402_ai_endpoint"],
  },
];

export function registerEarningTools(server: McpServer): void {
  server.registerTool(
    "earning_opportunities",
    {
      description: `List the ways an agent can put its assets to work through this MCP — a static "how to earn" menu (no balances read, no network calls).

Surface this to an agent right after onboarding (e.g. once \`identity_register\` succeeds) so it knows the menu of strategies available: which asset each needs, the kind of return, and the tool that starts it.

Each entry: \`{ id, name, assets, returns, summary, start_with, reference? }\` where \`start_with\` lists the MCP tools to begin, in order.

Optional \`asset\` filter (e.g. "STX", "sBTC") returns only strategies that put that asset to work — useful for "what can I do with the STX I hold?". Matching is case-insensitive substring over each strategy's \`assets\`.

Aligned with aibtc.com. The trading competition and news correspondent are intentionally not part of this menu.`,
      inputSchema: {
        asset: z
          .string()
          .optional()
          .describe(
            'Optional asset filter (e.g. "STX", "sBTC"). Returns only strategies that use a matching asset.'
          ),
      },
    },
    async ({ asset }) => {
      try {
        const filtered = asset
          ? STRATEGIES.filter((s) =>
              s.assets.some((a) => a.toLowerCase().includes(asset.toLowerCase()))
            )
          : STRATEGIES;
        return createJsonResponse({
          count: filtered.length,
          filter: asset ?? null,
          strategies: filtered,
          note: "Static menu — call the listed start_with tools to act. Use get_wallet_info / get_stx_balance to see what you hold.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
