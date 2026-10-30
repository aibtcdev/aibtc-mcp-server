/**
 * Guard: no tool takes a spend cap (or a consent to spend) from the model.
 *
 * The spend limiter keeps its caps out of the model's reach: SPEND_LIMIT_* is
 * read from env and the only other setter is the operator's --max-spend-*
 * launch flags. Nothing else stops a future tool from accepting an argument
 * that raises or replaces the cap (e.g. `confirm: "APPROVE"` plus a
 * caller-supplied `maxSpendUsdc`), so this test fails when a registered tool
 * input name looks cap-shaped and is not on the reviewed allowlist below.
 *
 * Adding a tool that matches means adding a one-line entry here, which puts the
 * argument in front of a reviewer: confirm it can only tighten a bound that is
 * still metered against the env cap, or is not a spend at all.
 *
 * Limits: this checks names only. Aliases such as `allowance`, `ceiling` or
 * `threshold` pass, and so does a generic options object that carries a cap
 * without naming it. A cap called `amount` also passes; the env cap is what
 * stops that case.
 */

import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "../../src/tools/index.js";
import { ALL_TOOLS } from "../../src/tools/profiles.js";

const CAP_LIKE = /spend|cap|limit|budget|max/i;

/** Reviewed `tool.input` pairs. Keep each group's reason accurate. */
const ALLOWED_GROUPS: Record<string, string[]> = {
  // Page sizes and search filters: bound a result set, not a payment.
  "list sizes and search filters": [
    "get_token_holders.limit",
    "get_nft_holdings.limit",
    "get_nft_history.limit",
    "get_account_transactions.limit",
    "get_mempool_info.limit",
    "get_contract_events.limit",
    "reputation_approve_client.indexLimit",
    "alex_list_pools.limit",
    "nostr_read_feed.limit",
    "nostr_search_tags.limit",
    "stacks_market_list.limit",
    "stacks_market_search.limit",
    "tenero_top_gainers.limit",
    "tenero_top_losers.limit",
    "tenero_trending_pools.limit",
    "tenero_wallet_trades.limit",
    "tenero_whale_trades.limit",
    "ordinals_p2p_list_trades.limit",
    "ordinals_p2p_my_trades.limit",
    "ordinals_p2p_agents.limit",
    "ordinals_get_listings.limit",
    "ordinals_get_listings.maxPriceSats",
    "legion_list_stories.limit",
    "bounty_list.limit",
    "bounty_submissions.limit",
    "runes_list_etchings.limit",
    "runes_get_holders.limit",
    "runes_get_activity.limit",
    "runes_get_address_activity.limit",
    "arxiv_search.max_results",
    "arxiv_compile_digest.max_results",
    "arxiv_list_digests.limit",
    "taskmarket_search.limit",
    "taskmarket_search.rewardMax",
    "inbox_auto_reply.maxRepliesPerRun",
  ],

  // Per-call bounds that can only tighten: they become post conditions or
  // caller spend caps that are still metered against the env cap, or they sit
  // inside an already-metered amount.
  "per-call bounds that only tighten": [
    // Post conditions + callerSpendCaps, metered in contract.tools.ts.
    "call_contract.maxStxSpend",
    "call_contract.maxSbtcSpend",
    // max_cost_ustx is passed as callerSpendCaps.ustx; target_cap_ustx is a
    // contract argument, not a spend.
    "stacks_market_buy_yes.max_cost_ustx",
    "stacks_market_buy_yes.target_cap_ustx",
    "stacks_market_buy_no.max_cost_ustx",
    "stacks_market_buy_no.target_cap_ustx",
    // The post condition locks amount + maxFee, so the fee is inside the
    // metered amount.
    "sbtc_withdraw.maxFee",
    "sbtc_initiate_withdrawal.maxFee",
    // Deducted by the signers from a deposit broadcast via meteredBtcBroadcast.
    "sbtc_deposit.maxSignerFee",
    // Encoded into payout calldata for future reward withdrawals; not spent
    // from the wallet at signing.
    "stack_stx.maxWithdrawalFeeSats",
    "extend_stacking.maxWithdrawalFeeSats",
    // A secondary, model-settable daily cap on reply inference. It sits on top
    // of the wallet-wide limiter, which still books every x402 payment, so it
    // can only tighten.
    "inbox_auto_reply_configure.dailyCapSats",
  ],

  // Caller-set consent flag, fine as an accident guard: both broadcasts go
  // through meteredBtcBroadcast, which books against the sats cap.
  "consent flag": ["legion_inscribe_story.confirmMainnetSpend"],

  // KNOWN GAP, allowlisted so the test can land; do not copy this pattern.
  // lightning_pay_invoice reserves only the invoice face value, so the routing
  // fee up to the caller's maxFeeSats is spent without touching the sats
  // ledger. Fix: reserve amountSats + maxFeeSats (and release the unused part),
  // and/or add a schema .max(). Remove this entry once that lands.
  "unmetered outflow (tracked gap)": ["lightning_pay_invoice.maxFeeSats"],
};

const ALLOWED = new Set(Object.values(ALLOWED_GROUPS).flat());

type ToolConfig = { inputSchema?: { shape?: Record<string, unknown> } | Record<string, unknown> };

/** Names of cap-like tool inputs that are not on the allowlist, as `tool.input`. */
function findOffenders(
  tools: Array<{ name: string; config?: ToolConfig }>,
  allowed: ReadonlySet<string>
): string[] {
  const offenders: string[] = [];
  for (const { name, config } of tools) {
    const schema = config?.inputSchema as { shape?: Record<string, unknown> } | undefined;
    const shape = schema?.shape ?? schema ?? {};
    for (const input of Object.keys(shape)) {
      const key = `${name}.${input}`;
      if (CAP_LIKE.test(input) && !allowed.has(key)) offenders.push(key);
    }
  }
  return offenders;
}

function collectTools(): Array<{ name: string; config?: ToolConfig }> {
  const tools: Array<{ name: string; config?: ToolConfig }> = [];
  const server = new McpServer({
    name: "test-server",
    version: "0.0.0",
  });

  // Same approach as register-all.test.ts: a stub that only records.
  server.registerTool = ((name: string, config: ToolConfig) => {
    tools.push({ name, config });
  }) as unknown as typeof server.registerTool;

  registerAllTools(server, ALL_TOOLS);
  return tools;
}

describe("tool inputs that look like spend caps", () => {
  it("every cap-like input is on the reviewed allowlist", () => {
    const tools = collectTools();
    // Sanity check: ensure we actually collected tools
    expect(tools.length).toBeGreaterThanOrEqual(50);

    expect(findOffenders(tools, ALLOWED)).toEqual([]);
  });

  it("fails on a raise-capable input (the check can fail)", () => {
    // Deliberate regression fixture: an argument that replaces the operator
    // cap instead of tightening it.
    const fixture = [
      {
        name: "fake_transfer",
        config: { inputSchema: { shape: { recipient: {}, maxSpendUsdc: {}, confirm: {} } } },
      },
    ];
    expect(findOffenders(fixture, ALLOWED)).toEqual(["fake_transfer.maxSpendUsdc"]);
  });

  it("has no duplicate allowlist entries", () => {
    const all = Object.values(ALLOWED_GROUPS).flat();
    expect(all.filter((k, i) => all.indexOf(k) !== i)).toEqual([]);
  });
});
