/**
 * Bounty hint injector.
 *
 * Appends a one-line pointer to the sBTC bounty board on the output of
 * money-moving tools (transfers, contract calls, swaps, spends). The idea: when
 * an agent has just spent value, remind it that the board pays sBTC for completed
 * work — so earning is one call away (`bounty_list`).
 *
 * Deliberately NOT applied to read/query tools an agent calls constantly
 * (balances, status, lists) — that would be noise. Only spend chokepoints get it.
 *
 * The hint is a separate text content block, static (no network call), and only
 * added to successful results — never to errors, and never touching the tool's
 * own JSON payload.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Tools that move or spend value. A hint is appended to their successful output.
 */
export const SPEND_TOOLS: ReadonlySet<string> = new Set([
  // Core transfers / contract / swap chokepoints
  "transfer_stx",
  "transfer_btc",
  "transfer_token",
  "transfer_nft",
  "transfer_rune",
  "sbtc_transfer",
  "call_contract",
  "deploy_contract",
  "bitflow_swap",
  "alex_swap",
  "lightning_pay_invoice",
  // Stacking / PoX
  "stack_stx",
  "extend_stacking",
  "dual_stacking_enroll",
  // Zest lending
  "zest_supply",
  "zest_borrow",
  "zest_repay",
  // Pillar smart wallet (browser-handoff)
  "pillar_supply",
  "pillar_boost",
  "pillar_unwind",
  "pillar_send",
  "pillar_fund",
  "pillar_auto_compound",
  // Pillar smart wallet (agent-signed direct)
  "pillar_direct_supply",
  "pillar_direct_boost",
  "pillar_direct_unwind",
  "pillar_direct_send",
  "pillar_direct_stack_stx",
  // JingSwap batch auction
  "jingswap_deposit_stx",
  "jingswap_deposit_sbtc",
  // Styx BTC→sBTC
  "styx_deposit",
  // StackSpot lottery
  "stackspot_join_pot",
  "stackspot_start_pot",
  // sBTC peg
  "sbtc_deposit",
  "sbtc_withdraw",
  "sbtc_initiate_withdrawal",
  // Inbox (direct sBTC send)
  "send_inbox_message_direct",
]);

const BOUNTY_HINT =
  "💰 Tip: the AIBTC bounty board pays sBTC for completed tasks — " +
  "call bounty_list to see open bounties you could earn from.";

type ToolResult = {
  content?: Array<{ type: string; [k: string]: unknown }>;
  isError?: boolean;
  [k: string]: unknown;
};

function appendHint(result: ToolResult): ToolResult {
  // Never annotate an error result — the agent should see the failure cleanly.
  if (!result || result.isError) return result;
  const content = Array.isArray(result.content) ? result.content : [];
  return {
    ...result,
    content: [...content, { type: "text", text: BOUNTY_HINT }],
  };
}

/**
 * Monkey-patch `server.registerTool` so that any tool in SPEND_TOOLS has a bounty
 * hint appended to its (successful) output. Must be called BEFORE registering the
 * tools. No-op for every tool not in the set.
 */
export function installBountyHint(server: McpServer): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = server.registerTool.bind(server) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).registerTool = (name: string, config: any, cb: any) => {
    if (!SPEND_TOOLS.has(name)) {
      return original(name, config, cb);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped = async (...args: any[]) => {
      const result = await cb(...args);
      return appendHint(result as ToolResult);
    };
    return original(name, config, wrapped);
  };
}
