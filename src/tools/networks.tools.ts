/**
 * Networks Layer — Multi-Chain Read Operations
 *
 * Read-only balance and status queries across major chains.
 * All via public free RPC endpoints — no API keys required.
 *
 * Chains: Bitcoin (L1), Ethereum, Solana, BNB Chain,
 *         Polygon, Avalanche, Arbitrum, Optimism, Base
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import { createHash } from "crypto";

// ── Chain definitions ─────────────────────────────────────────────────────────

const CHAINS = {
  ethereum:  { name: "Ethereum",  symbol: "ETH",  decimals: 18, rpc: "https://eth.llamarpc.com",            explorer: "https://etherscan.io/address/" },
  bnb:       { name: "BNB Chain", symbol: "BNB",  decimals: 18, rpc: "https://bsc-dataseed.binance.org",    explorer: "https://bscscan.com/address/" },
  polygon:   { name: "Polygon",   symbol: "MATIC", decimals: 18, rpc: "https://polygon-rpc.com",            explorer: "https://polygonscan.com/address/" },
  avalanche: { name: "Avalanche", symbol: "AVAX", decimals: 18, rpc: "https://api.avax.network/ext/bc/C/rpc", explorer: "https://snowtrace.io/address/" },
  arbitrum:  { name: "Arbitrum",  symbol: "ETH",  decimals: 18, rpc: "https://arb1.arbitrum.io/rpc",        explorer: "https://arbiscan.io/address/" },
  optimism:  { name: "Optimism",  symbol: "ETH",  decimals: 18, rpc: "https://mainnet.optimism.io",         explorer: "https://optimistic.etherscan.io/address/" },
  base:      { name: "Base",      symbol: "ETH",  decimals: 18, rpc: "https://mainnet.base.org",            explorer: "https://basescan.org/address/" },
} as const;

type ChainKey = keyof typeof CHAINS;

// ── EVM balance via eth_getBalance ────────────────────────────────────────────

async function getEvmBalance(chain: ChainKey, address: string): Promise<{
  chain: string; symbol: string; balance_wei: bigint; balance_native: number; address: string; block: number;
} | null> {
  const cfg = CHAINS[chain];
  try {
    const res  = await fetch(cfg.rpc, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
      signal:  AbortSignal.timeout(8000),
    });
    const blockRes = await fetch(cfg.rpc, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] }),
      signal:  AbortSignal.timeout(8000),
    });

    const data      = await res.json()      as { result?: string };
    const blockData = await blockRes.json() as { result?: string };

    if (!data.result) return null;

    const wei     = BigInt(data.result);
    const native  = Number(wei) / 10 ** cfg.decimals;
    const block   = blockData.result ? parseInt(blockData.result, 16) : 0;

    return { chain: cfg.name, symbol: cfg.symbol, balance_wei: wei, balance_native: native, address, block };
  } catch {
    return null;
  }
}

// ── Solana balance via RPC ────────────────────────────────────────────────────

async function getSolanaBalance(address: string): Promise<{ balance_lamports: number; balance_sol: number } | null> {
  try {
    const res  = await fetch("https://api.mainnet-beta.solana.com", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
      signal:  AbortSignal.timeout(8000),
    });
    const data = await res.json() as { result?: { value: number } };
    if (data.result === undefined) return null;
    return { balance_lamports: data.result.value, balance_sol: data.result.value / 1e9 };
  } catch {
    return null;
  }
}

// ── Solana slot / network info ────────────────────────────────────────────────

async function getSolanaSlot(): Promise<number | null> {
  try {
    const res  = await fetch("https://api.mainnet-beta.solana.com", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }),
      signal:  AbortSignal.timeout(8000),
    });
    const data = await res.json() as { result?: number };
    return data.result ?? null;
  } catch {
    return null;
  }
}

// ── EVM chain status ──────────────────────────────────────────────────────────

async function getEvmChainInfo(chain: ChainKey): Promise<{ block: number; chainId: number } | null> {
  const cfg = CHAINS[chain];
  try {
    const res = await fetch(cfg.rpc, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
        { jsonrpc: "2.0", id: 2, method: "eth_chainId",     params: [] },
      ]),
      signal:  AbortSignal.timeout(8000),
    });
    const data = await res.json() as Array<{ result?: string }>;
    return {
      block:   parseInt(data[0]?.result ?? "0", 16),
      chainId: parseInt(data[1]?.result ?? "0", 16),
    };
  } catch {
    return null;
  }
}

function hashNetwork(chain: string, block: number): string {
  return createHash("sha256").update(`${chain}:${block}:${Date.now()}`).digest("hex");
}

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerNetworksTools(server: McpServer): void {

  // ── network_status ───────────────────────────────────────────────────────────

  server.registerTool(
    "network_status",
    {
      title:       "Network Status",
      description: "Get current block/slot and chain ID for any supported network: ethereum, bnb, polygon, avalanche, arbitrum, optimism, base, solana.",
      inputSchema: z.object({
        network: z.enum(["ethereum","bnb","polygon","avalanche","arbitrum","optimism","base","solana"]).describe("Network name"),
      }),
    },
    async ({ network }) => {
      const ts = new Date().toISOString();

      if (network === "solana") {
        const slot = await getSolanaSlot();
        if (!slot) return { content: [{ type: "text", text: "Solana RPC unavailable." }] };
        return {
          content: [{
            type: "text",
            text: [
              `**Solana** — mainnet-beta`,
              `Current slot: ${slot.toLocaleString()}`,
              `Queried:      ${ts}`,
              `SHA256:       ${hashNetwork("solana", slot)}`,
            ].join("\n"),
          }],
        };
      }

      const info = await getEvmChainInfo(network as ChainKey);
      if (!info) return { content: [{ type: "text", text: `${network} RPC unavailable.` }] };
      const cfg = CHAINS[network as ChainKey];

      return {
        content: [{
          type: "text",
          text: [
            `**${cfg.name}**`,
            `Chain ID:     ${info.chainId}`,
            `Latest block: ${info.block.toLocaleString()}`,
            `Native token: ${cfg.symbol}`,
            `Queried:      ${ts}`,
            `SHA256:       ${hashNetwork(network, info.block)}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── network_balance ──────────────────────────────────────────────────────────

  server.registerTool(
    "network_balance",
    {
      title:       "Network Balance",
      description: "Get native token balance for an address on any supported network. EVM chains (ETH, BNB, MATIC…) or Solana.",
      inputSchema: z.object({
        network: z.enum(["ethereum","bnb","polygon","avalanche","arbitrum","optimism","base","solana"]).describe("Network"),
        address: z.string().describe("Wallet address (0x… for EVM, base58 for Solana)"),
      }),
    },
    async ({ network, address }) => {
      if (network === "solana") {
        const bal = await getSolanaBalance(address);
        if (!bal) return { content: [{ type: "text", text: "Solana RPC unavailable or invalid address." }] };
        return {
          content: [{
            type: "text",
            text: [
              `**Solana balance**`,
              `Address:    ${address}`,
              `Balance:    ${bal.balance_sol.toFixed(9)} SOL`,
              `Lamports:   ${bal.balance_lamports.toLocaleString()}`,
              `Fetched:    ${new Date().toISOString()}`,
            ].join("\n"),
          }],
        };
      }

      const result = await getEvmBalance(network as ChainKey, address);
      if (!result) return { content: [{ type: "text", text: `Could not fetch balance on ${network}.` }] };

      return {
        content: [{
          type: "text",
          text: [
            `**${result.chain} balance**`,
            `Address:    ${address}`,
            `Balance:    ${result.balance_native.toFixed(6)} ${result.symbol}`,
            `Wei:        ${result.balance_wei.toString()}`,
            `At block:   ${result.block.toLocaleString()}`,
            `Fetched:    ${new Date().toISOString()}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── network_multi_balance ────────────────────────────────────────────────────

  server.registerTool(
    "network_multi_balance",
    {
      title:       "Multi-Chain Balance",
      description: "Check the same address (or different addresses) across multiple EVM chains simultaneously. Useful for finding assets spread across chains.",
      inputSchema: z.object({
        address:  z.string().describe("EVM address to check (0x…)"),
        networks: z.array(z.enum(["ethereum","bnb","polygon","avalanche","arbitrum","optimism","base"]))
          .min(1).max(7)
          .optional()
          .describe("Networks to check (default: all 7 EVM chains)"),
      }),
    },
    async ({ address, networks }) => {
      const targets = (networks ?? Object.keys(CHAINS)) as ChainKey[];
      const results = await Promise.allSettled(targets.map(n => getEvmBalance(n, address)));

      const lines = results.map((r, i) => {
        const chain = CHAINS[targets[i]];
        if (r.status === "rejected" || !r.value) {
          return `  ${chain.name.padEnd(12)} — unavailable`;
        }
        const v = r.value;
        return `  ${chain.name.padEnd(12)} ${v.balance_native.toFixed(6)} ${v.symbol}`;
      });

      return {
        content: [{
          type: "text",
          text: [`**Multi-chain balances for ${address}**`, ...lines, ``, `Checked: ${new Date().toISOString()}`].join("\n"),
        }],
      };
    },
  );

  // ── network_list ─────────────────────────────────────────────────────────────

  server.registerTool(
    "network_list",
    {
      title:       "Supported Networks",
      description: "List all networks supported by the protocol with their chain IDs and native tokens.",
      inputSchema: z.object({}),
    },
    async () => {
      const lines = [
        "**Supported Networks**",
        "",
        "EVM-compatible:",
        ...Object.entries(CHAINS).map(([key, c]) =>
          `  ${key.padEnd(12)} ${c.symbol.padEnd(5)} ${c.name}`
        ),
        "",
        "Other:",
        "  solana       SOL   Solana (mainnet-beta)",
        "  bitcoin      BTC   Bitcoin L1 (use btc_* tools)",
        "  stacks       STX   Stacks L2 (use stacks_* tools)",
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );
}
