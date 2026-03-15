/**
 * Tenero market analytics tools
 *
 * Read-only MCP tools for Stacks ecosystem market data via the Tenero API
 * (formerly STXTools) at https://api.tenero.io. No authentication required.
 *
 * Tools:
 * - tenero_token_info        — Token metadata, price, and volume
 * - tenero_market_summary    — Price history and pool liquidity for a token
 * - tenero_market_stats      — Overall market volume, netflow, and active traders
 * - tenero_top_gainers       — Top gaining tokens by 24h price change
 * - tenero_top_losers        — Top losing tokens by 24h price change
 * - tenero_trending_pools    — Trending DEX liquidity pools by 1h volume
 * - tenero_wallet_trades     — Trade history for a wallet address
 * - tenero_wallet_holdings   — Token holdings with current USD value for a wallet
 * - tenero_whale_trades      — Recent large trades above threshold value
 * - tenero_holder_stats      — Token holder distribution and concentration stats
 * - tenero_search            — Search tokens, pools, and wallets by name or address
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  getTokenInfo,
  getMarketSummary,
  getMarketStats,
  getTopGainers,
  getTopLosers,
  getTrendingPools,
  getWalletTrades,
  getWalletHoldings,
  getWhaleTrades,
  getHolderStats,
  searchTokens,
} from "../services/tenero-api.js";

export function registerTeneroTools(server: McpServer): void {
  // Token info
  server.registerTool(
    "tenero_token_info",
    {
      description:
        "Get token details including metadata, current price, market cap, and 24h volume. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        contractId: z
          .string()
          .describe(
            "Token contract address in format PRINCIPAL.contract-name " +
              "(e.g. SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex)"
          ),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ contractId, chain }) => {
      try {
        const data = await getTokenInfo(contractId, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Market summary (per token)
  server.registerTool(
    "tenero_market_summary",
    {
      description:
        "Get token market summary including price history, 24h volume, and pool liquidity. " +
        "Returns weighted price across all pools trading this token. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        contractId: z
          .string()
          .describe(
            "Token contract address in format PRINCIPAL.contract-name " +
              "(e.g. SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex)"
          ),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ contractId, chain }) => {
      try {
        const data = await getMarketSummary(contractId, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Overall market stats
  server.registerTool(
    "tenero_market_stats",
    {
      description:
        "Get overall Stacks ecosystem market statistics including total volume, " +
        "buy/sell netflow, unique traders, and active pools. " +
        "Returns a time series of daily stats for recent periods. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ chain }) => {
      try {
        const data = await getMarketStats(chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Top gainers
  server.registerTool(
    "tenero_top_gainers",
    {
      description:
        "List top gaining tokens by 24h price change percentage on the Stacks ecosystem. " +
        "Useful for spotting momentum and trending assets. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Maximum number of tokens to return (default: 10, max: 50)"),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ limit, chain }) => {
      try {
        const data = await getTopGainers(limit, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Top losers
  server.registerTool(
    "tenero_top_losers",
    {
      description:
        "List top losing tokens by 24h price change percentage on the Stacks ecosystem. " +
        "Useful for identifying underperforming assets or potential reversal candidates. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Maximum number of tokens to return (default: 10, max: 50)"),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ limit, chain }) => {
      try {
        const data = await getTopLosers(limit, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Trending pools
  server.registerTool(
    "tenero_trending_pools",
    {
      description:
        "List trending DEX liquidity pools by volume over the last hour. " +
        "Includes pool platform, token pair, volume, and liquidity details. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Maximum number of pools to return (default: 10, max: 50)"),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ limit, chain }) => {
      try {
        const data = await getTrendingPools(limit, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Wallet trades
  server.registerTool(
    "tenero_wallet_trades",
    {
      description:
        "Get trade history for a Stacks wallet address. " +
        "Returns recent buy/sell events with token, pool, and USD value details. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        address: z
          .string()
          .describe("Stacks wallet address (SP... or SM...)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe("Maximum number of trades to return (default: 20, max: 100)"),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ address, limit, chain }) => {
      try {
        const data = await getWalletTrades(address, limit, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Wallet holdings
  server.registerTool(
    "tenero_wallet_holdings",
    {
      description:
        "Get token holdings with current USD value for a Stacks wallet address. " +
        "Shows portfolio composition including token balances and estimated values. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        address: z
          .string()
          .describe("Stacks wallet address (SP... or SM...)"),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ address, chain }) => {
      try {
        const data = await getWalletHoldings(address, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Whale trades
  server.registerTool(
    "tenero_whale_trades",
    {
      description:
        "Get recent large/whale trades above threshold value on the Stacks ecosystem. " +
        "Useful for tracking smart money and large market movements. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Maximum number of whale trades to return (default: 10, max: 50)"),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ limit, chain }) => {
      try {
        const data = await getWhaleTrades(limit, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Holder stats
  server.registerTool(
    "tenero_holder_stats",
    {
      description:
        "Get token holder distribution and concentration statistics. " +
        "Shows total holders, top holder percentages, and Gini coefficient. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        contractId: z
          .string()
          .describe(
            "Token contract address in format PRINCIPAL.contract-name " +
              "(e.g. SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex)"
          ),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ contractId, chain }) => {
      try {
        const data = await getHolderStats(contractId, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Search
  server.registerTool(
    "tenero_search",
    {
      description:
        "Search tokens, pools, and wallets by name, symbol, or contract address. " +
        "Returns matching tokens with metadata and pricing information. " +
        "Powered by the Tenero API (api.tenero.io). No authentication required.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Search query: token name, symbol, or contract address"),
        chain: z
          .string()
          .optional()
          .default("stacks")
          .describe("Chain to query: stacks, spark, or sportsfun (default: stacks)"),
      },
    },
    async ({ query, chain }) => {
      try {
        const data = await searchTokens(query, chain);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
