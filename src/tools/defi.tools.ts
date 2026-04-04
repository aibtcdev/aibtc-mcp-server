import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getAlexDexService, getZestProtocolService } from "../services/defi.service.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

export function registerDefiTools(server: McpServer): void {
  // ==========================================================================
  // ALEX DEX Tools
  // ==========================================================================

  // Get swap quote
  server.registerTool(
    "alex_get_swap_quote",
    {
      description: `Get a swap quote from ALEX DEX.

Returns the expected output amount for swapping tokenX to tokenY.
Use full contract IDs for tokens (e.g., 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx-v2').

Note: ALEX DEX is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token contract ID"),
        tokenY: z.string().describe("Output token contract ID"),
        amountIn: z.string().describe("Amount of tokenX to swap (in smallest units)"),
      },
    },
    async ({ tokenX, tokenY, amountIn }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "ALEX DEX is only available on mainnet",
            network: NETWORK,
          });
        }

        const alexService = getAlexDexService(NETWORK);
        const walletAddress = await getWalletAddress();
        const quote = await alexService.getSwapQuote(
          tokenX,
          tokenY,
          BigInt(amountIn),
          walletAddress
        );

        return createJsonResponse({
          network: NETWORK,
          quote: {
            tokenIn: quote.tokenIn,
            tokenOut: quote.tokenOut,
            amountIn: quote.amountIn,
            expectedAmountOut: quote.amountOut,
            route: quote.route,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Execute swap
  server.registerTool(
    "alex_swap",
    {
      description: `Execute a token swap on ALEX DEX.

Swaps tokenX for tokenY using the ALEX AMM.
Use full contract IDs for tokens.

Note: ALEX DEX is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token contract ID"),
        tokenY: z.string().describe("Output token contract ID"),
        amountIn: z.string().describe("Amount of tokenX to swap (in smallest units)"),
        minAmountOut: z
          .string()
          .optional()
          .default("0")
          .describe("Minimum acceptable output amount (slippage protection)"),
      },
    },
    async ({ tokenX, tokenY, amountIn, minAmountOut }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "ALEX DEX is only available on mainnet",
            network: NETWORK,
          });
        }

        const alexService = getAlexDexService(NETWORK);
        const account = await getAccount();
        const result = await alexService.swap(
          account,
          tokenX,
          tokenY,
          BigInt(amountIn),
          BigInt(minAmountOut || "0")
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          swap: {
            tokenIn: tokenX,
            tokenOut: tokenY,
            amountIn,
            minAmountOut: minAmountOut || "0",
          },
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get pool info
  server.registerTool(
    "alex_get_pool_info",
    {
      description: `Get liquidity pool information from ALEX DEX.

Returns reserve balances and pool details for a token pair.

Note: ALEX DEX is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("First token contract ID"),
        tokenY: z.string().describe("Second token contract ID"),
      },
    },
    async ({ tokenX, tokenY }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "ALEX DEX is only available on mainnet",
            network: NETWORK,
          });
        }

        const alexService = getAlexDexService(NETWORK);
        const walletAddress = await getWalletAddress();
        const poolInfo = await alexService.getPoolInfo(tokenX, tokenY, walletAddress);

        if (!poolInfo) {
          return createJsonResponse({
            error: "Pool not found or no liquidity",
            tokenX,
            tokenY,
          });
        }

        return createJsonResponse({
          network: NETWORK,
          pool: poolInfo,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // List available pools
  server.registerTool(
    "alex_list_pools",
    {
      description: `List all available trading pools on ALEX DEX.

Discovers all token pairs that can be swapped directly.
Returns pool ID, token pair, and factor (fee tier) for each pool.

Use this to find which tokens can be swapped before calling alex_swap.

Note: ALEX DEX is only available on mainnet.`,
      inputSchema: {
        limit: z
          .number()
          .optional()
          .default(50)
          .describe("Maximum number of pools to return (default 50)"),
      },
    },
    async ({ limit }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "ALEX DEX is only available on mainnet",
            network: NETWORK,
          });
        }

        const alexService = getAlexDexService(NETWORK);
        const pools = await alexService.listPools(limit || 50);

        return createJsonResponse({
          network: NETWORK,
          poolCount: pools.length,
          pools: pools.map((p) => ({
            id: p.id,
            pair: `${p.tokenXSymbol}/${p.tokenYSymbol}`,
            tokenX: p.tokenX,
            tokenY: p.tokenY,
            factor: p.factor,
          })),
          usage: "Use the tokenX and tokenY contract IDs with alex_get_swap_quote or alex_swap",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Zest Protocol Tools (v0-4-market + v0-market-vault)
  // ==========================================================================

  // List available assets
  server.registerTool(
    "zest_list_assets",
    {
      description: `List all supported assets on Zest Protocol (v0-4-market).

Returns the list of assets that can be supplied, borrowed, or used as collateral.
Each asset includes its symbol, name, and contract ID.

Supported assets: wSTX, sBTC, stSTX, USDC, USDH, stSTXbtc.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {},
    },
    async () => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Zest Protocol is only available on mainnet",
            network: NETWORK,
          });
        }

        const zestService = getZestProtocolService(NETWORK);
        const assets = await zestService.getAssets();

        return createJsonResponse({
          network: NETWORK,
          version: "v0-4-market",
          assetCount: assets.length,
          assets: assets.map((a) => ({
            symbol: a.symbol,
            name: a.name,
            contractId: a.contractId,
            decimals: a.decimals,
          })),
          usage: "Use the symbol (e.g., 'sBTC', 'USDC') or full contract ID in other Zest commands",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get user position
  server.registerTool(
    "zest_get_position",
    {
      description: `Get user's lending position on Zest Protocol (v0-4-market).

Returns collateral, debt, health factor, and LTV data across all assets.
The position query returns USD-denominated totals.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().default("sBTC").describe("Asset symbol (e.g., 'sBTC', 'USDC') or full contract ID"),
        address: z
          .string()
          .optional()
          .describe("User address (uses wallet if not specified)"),
      },
    },
    async ({ asset, address }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Zest Protocol is only available on mainnet",
            network: NETWORK,
          });
        }

        const zestService = getZestProtocolService(NETWORK);
        const resolvedAsset = await zestService.resolveAsset(asset);
        const userAddress = address || (await getWalletAddress());
        const position = await zestService.getUserPosition(resolvedAsset, userAddress);

        if (!position) {
          return createJsonResponse({
            address: userAddress,
            asset: resolvedAsset,
            position: null,
            message: "No position found",
          });
        }

        return createJsonResponse({
          network: NETWORK,
          version: "v0-4-market",
          address: userAddress,
          position,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Supply to Zest v2
  server.registerTool(
    "zest_supply",
    {
      description: `Supply assets to Zest Protocol (v0-4-market).

Deposits assets and adds them as collateral in one atomic operation.
The supplied assets earn yield AND provide borrowing power.
You can use the asset symbol (e.g., 'sBTC', 'USDC') or full contract ID.

Supported assets: wSTX, sBTC, stSTX, USDC, USDH, stSTXbtc.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'sBTC', 'USDC') or full contract ID"),
        amount: z.string().describe("Amount to supply (in smallest units)"),
      },
    },
    async ({ asset, amount }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Zest Protocol is only available on mainnet",
            network: NETWORK,
          });
        }

        const zestService = getZestProtocolService(NETWORK);
        const resolvedAsset = await zestService.resolveAsset(asset);
        const account = await getAccount();
        const result = await zestService.supply(
          account,
          resolvedAsset,
          BigInt(amount),
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "supply",
          asset: resolvedAsset,
          amount,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Withdraw from Zest v2
  server.registerTool(
    "zest_withdraw",
    {
      description: `Withdraw assets from Zest Protocol (v0-4-market).

Removes collateral and redeems for underlying assets in one atomic operation.
You can use the asset symbol (e.g., 'sBTC', 'USDC') or full contract ID.

Note: Amount is in zToken shares. Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'sBTC', 'USDC') or full contract ID"),
        amount: z.string().describe("Amount of zToken shares to withdraw"),
      },
    },
    async ({ asset, amount }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Zest Protocol is only available on mainnet",
            network: NETWORK,
          });
        }

        const zestService = getZestProtocolService(NETWORK);
        const resolvedAsset = await zestService.resolveAsset(asset);
        const account = await getAccount();
        const result = await zestService.withdraw(account, resolvedAsset, BigInt(amount));

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "withdraw",
          asset: resolvedAsset,
          amount,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Borrow from Zest v2
  server.registerTool(
    "zest_borrow",
    {
      description: `Borrow assets from Zest Protocol (v0-4-market).

Borrows assets against your supplied collateral.
Ensure you have sufficient collateral to maintain a healthy LTV.
You can use the asset symbol (e.g., 'USDC', 'sBTC') or full contract ID.

Three LTV tiers: ~75% (borrow limit), ~85% (partial liquidation), ~95% (full liquidation).

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'sBTC', 'USDC') or full contract ID"),
        amount: z.string().describe("Amount to borrow (in smallest units)"),
      },
    },
    async ({ asset, amount }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Zest Protocol is only available on mainnet",
            network: NETWORK,
          });
        }

        const zestService = getZestProtocolService(NETWORK);
        const resolvedAsset = await zestService.resolveAsset(asset);
        const account = await getAccount();
        const result = await zestService.borrow(account, resolvedAsset, BigInt(amount));

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "borrow",
          asset: resolvedAsset,
          amount,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Enable collateral on Zest v2
  server.registerTool(
    "zest_enable_collateral",
    {
      description: `Add existing zTokens as collateral on Zest Protocol v2.

Use this when you deposited directly to a vault and need to register
those zTokens as collateral for borrowing.

Note: zest_supply already handles this atomically via supply-collateral-add.
This tool is only needed if you used vault deposit separately.

Mainnet only.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'sBTC', 'USDC') or full contract ID"),
        amount: z.string().describe("Amount of zTokens to add as collateral (in smallest units)"),
      },
    },
    async ({ asset, amount }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Zest Protocol is only available on mainnet",
            network: NETWORK,
          });
        }

        const zestService = getZestProtocolService(NETWORK);
        const resolvedAsset = await zestService.resolveAsset(asset);
        const account = await getAccount();
        const result = await zestService.enableCollateral(account, resolvedAsset, BigInt(amount));

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "enable_collateral",
          asset: resolvedAsset,
          amount,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Repay to Zest v2
  server.registerTool(
    "zest_repay",
    {
      description: `Repay borrowed assets to Zest Protocol (v0-4-market).

Repays borrowed assets plus accrued interest.
You can use the asset symbol (e.g., 'USDC', 'sBTC') or full contract ID.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'sBTC', 'USDC') or full contract ID"),
        amount: z.string().describe("Amount to repay (in smallest units)"),
        onBehalfOf: z
          .string()
          .optional()
          .describe("Optional: repay on behalf of another address"),
      },
    },
    async ({ asset, amount, onBehalfOf }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Zest Protocol is only available on mainnet",
            network: NETWORK,
          });
        }

        const zestService = getZestProtocolService(NETWORK);
        const resolvedAsset = await zestService.resolveAsset(asset);
        const account = await getAccount();
        const result = await zestService.repay(
          account,
          resolvedAsset,
          BigInt(amount),
          onBehalfOf
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "repay",
          asset: resolvedAsset,
          amount,
          onBehalfOf: onBehalfOf || account.address,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
