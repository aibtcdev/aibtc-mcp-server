/**
 * Tool profiles: which tools the server exposes.
 *
 * Every tool definition is sent to the client's model on each session, so
 * `--install` writes `AIBTC_TOOLS=core`: a lean set covering wallet, balances,
 * transfers, x402 and earning. Other groups are added with
 * `AIBTC_TOOLS=core,defi,ordinals` (the core set is always included).
 *
 * An unset AIBTC_TOOLS loads every tool: configs written before profiles
 * existed have no AIBTC_TOOLS, and their users keep the tools they had.
 */

/**
 * Tools exposed by default, whatever groups are enabled. wallet_export is
 * deliberately left out: it hands the mnemonic to the agent, which can then
 * sign outside every spending limit (it stays in the `wallet` group).
 */
export const CORE_TOOLS: ReadonlySet<string> = new Set([
  // Wallet
  "get_wallet_info",
  "wallet_status",
  "wallet_create",
  "wallet_import",
  "wallet_unlock",
  "wallet_lock",
  "wallet_rotate_password",
  // Balances
  "get_stx_balance",
  "get_btc_balance",
  "sbtc_get_balance",
  "get_token_balance",
  // Move funds
  "transfer_stx",
  "transfer_btc",
  "sbtc_transfer",
  "get_transaction_status",
  "get_btc_fees",
  // x402
  "list_x402_endpoints",
  "probe_x402_endpoint",
  "execute_x402_endpoint",
  // Earn (bounty_submit requires a registered identity)
  "earning_opportunities",
  "bounty_list",
  "bounty_get",
  "bounty_submit",
  "identity_register",
]);

export const TOOL_GROUPS = {
  wallet: "Wallet management extras, encrypted credential store",
  stacks: "Stacks transactions, contracts, tokens, NFTs, chain queries, nonce tools",
  sbtc: "sBTC deposit/withdraw, Styx BTC→sBTC",
  bitcoin: "Bitcoin L1 UTXOs, mempool watch",
  lightning: "Lightning (Spark) wallet and L402 payments",
  stacking: "PoX stacking, dual stacking, StackSpot",
  defi: "ALEX, Zest, Bitflow, Jingswap, yield hunter/dashboard, Tenero analytics",
  pillar: "Pillar smart wallet",
  ordinals: "Inscriptions, runes, PSBT, ordinals marketplace/P2P, taproot multisig",
  bns: "BNS names",
  identity: "ERC-8004 identity and reputation, message signing",
  social: "Nostr, AIBTC inbox",
  earn: "Bounty board (create, accept, pay, my views)",
  legion: "AIBTC News Legion",
  markets: "Stacks prediction market, At Stake",
  dev: "Scaffolding, OpenRouter, settings, inference marketplace, arXiv",
} as const;

export type ToolGroup = keyof typeof TOOL_GROUPS;

/** Which tools to expose: every tool, or the core set plus the named groups. */
export type ToolSelection = { all: true } | { all: false; groups: ReadonlySet<ToolGroup> };

export const ALL_TOOLS: ToolSelection = { all: true };

export function isToolGroup(name: string): name is ToolGroup {
  return Object.prototype.hasOwnProperty.call(TOOL_GROUPS, name);
}

export function isToolSelected(
  selection: ToolSelection,
  name: string,
  group: ToolGroup
): boolean {
  return selection.all || CORE_TOOLS.has(name) || selection.groups.has(group);
}

/**
 * Resolve the selection from `--profile <lean|full>` and `AIBTC_TOOLS`
 * (`all`, or `core` and/or comma-separated group names; unset means `all`).
 * Unknown values throw so a typo doesn't silently hide tools.
 */
export function resolveToolSelection(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): ToolSelection {
  const flag = argv.indexOf("--profile");
  const profile = flag === -1 ? undefined : argv[flag + 1];
  if (profile !== undefined && profile !== "lean" && profile !== "full") {
    throw new Error(`Unknown --profile "${profile}". Use "lean" or "full".`);
  }
  if (profile === "full") return ALL_TOOLS;
  if (profile === "lean") return { all: false, groups: new Set() };

  const names = (env.AIBTC_TOOLS ?? "all")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((n) => n && n !== "core");
  if (names.includes("all")) return ALL_TOOLS;

  const unknown = names.filter((n) => !isToolGroup(n));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown AIBTC_TOOLS group(s): ${unknown.join(", ")}. ` +
        `Valid: all, core, ${Object.keys(TOOL_GROUPS).join(", ")}.`
    );
  }
  return { all: false, groups: new Set(names as ToolGroup[]) };
}

/** Server-instructions paragraph telling the agent what is off and how to turn it on. */
export function describeSelection(selection: ToolSelection): string {
  if (selection.all) return "All tool groups are enabled.";
  const off = (Object.keys(TOOL_GROUPS) as ToolGroup[]).filter((g) => !selection.groups.has(g));
  const on = [...selection.groups];
  return [
    `Tool profile: lean core${on.length > 0 ? ` + ${on.join(", ")}` : ""}.`,
    "These groups are not loaded; if the user needs one, tell them to set",
    "AIBTC_TOOLS=core,<group,...> (or all) in this server's config and restart:",
    ...off.map((g) => `- ${g}: ${TOOL_GROUPS[g]}`),
  ].join("\n");
}
