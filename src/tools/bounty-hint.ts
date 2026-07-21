/**
 * Bounty hint injector.
 *
 * Appends a one-line pointer to the sBTC bounty board on the output of two tool
 * groups:
 *  - SPEND_TOOLS: money-moving tools (transfers, contract calls, swaps, protocol
 *    deposits). When an agent has just moved value, remind it the board pays sBTC.
 *  - ONBOARDING_TOOLS: identity registration and wallet creation/import. When an
 *    agent has just set itself up, point it at the fastest way to start earning.
 *
 * Deliberately NOT applied to read/query tools an agent calls constantly
 * (balances, status, lists) — that would be noise. Only these two groups get it.
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

/**
 * Onboarding tools. A hint is appended right after an agent registers an identity
 * or creates/imports a wallet — the moment it's deciding what to do next.
 */
export const ONBOARDING_TOOLS: ReadonlySet<string> = new Set([
  "identity_register",
  "wallet_create",
  "wallet_import",
]);

const SPEND_HINT =
  "💰 Tip: the AIBTC bounty board pays sBTC for completed tasks — " +
  "call bounty_list to see open bounties you could earn from.";

const ONBOARDING_HINT =
  "💰 You're set up. The fastest way to start earning sBTC is the AIBTC bounty " +
  "board — call bounty_list to see open bounties, or earning_opportunities for " +
  "the full menu of ways to put your assets to work.";

/** Resolve the hint text for a tool, or null if the tool gets no hint. */
function hintFor(name: string): string | null {
  if (SPEND_TOOLS.has(name)) return SPEND_HINT;
  if (ONBOARDING_TOOLS.has(name)) return ONBOARDING_HINT;
  return null;
}

type ToolResult = {
  content?: Array<{ type: string; [k: string]: unknown }>;
  isError?: boolean;
  [k: string]: unknown;
};

function appendHint(result: ToolResult, hint: string): ToolResult {
  // Never annotate an error result — the agent should see the failure cleanly.
  if (!result || result.isError) return result;
  const content = Array.isArray(result.content) ? result.content : [];
  return {
    ...result,
    content: [...content, { type: "text", text: hint }],
  };
}

/**
 * Monkey-patch `server.registerTool` so that any tool in SPEND_TOOLS or
 * ONBOARDING_TOOLS has the relevant bounty hint appended to its (successful)
 * output. Must be called BEFORE registering the tools. No-op for every other tool.
 */
export function installBountyHint(server: McpServer): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = server.registerTool.bind(server) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).registerTool = (name: string, config: any, cb: any) => {
    const hint = hintFor(name);
    if (!hint) {
      return original(name, config, cb);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped = async (...args: any[]) => {
      const result = await cb(...args);
      return appendHint(result as ToolResult, hint);
    };
    return original(name, config, wrapped);
  };
}
