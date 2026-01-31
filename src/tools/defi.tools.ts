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
  // Zest Protocol Tools
  // ==========================================================================

  // List available assets
  server.registerTool(
    "zest_list_assets",
    {
      description: `List all supported assets on Zest Protocol.

Returns the list of assets that can be supplied, borrowed, or used as collateral.
Each asset includes its symbol, name, and contract ID.

Use this to discover available assets before supplying or borrowing.

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
          assetCount: assets.length,
          assets: assets.map((a) => ({
            symbol: a.symbol,
            name: a.name,
            contractId: a.contractId,
          })),
          usage: "Use the symbol (e.g., 'stSTX') or full contract ID in other Zest commands",
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
      description: `Get user's lending position on Zest Protocol.

Returns supplied and borrowed amounts for a specific asset.
You can use the asset symbol (e.g., 'stSTX') or full contract ID.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'stSTX', 'aeUSDC') or full contract ID"),
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
            message: "No position found for this asset",
          });
        }

        return createJsonResponse({
          network: NETWORK,
          address: userAddress,
          position,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Supply to Zest
  server.registerTool(
    "zest_supply",
    {
      description: `Supply assets to Zest Protocol lending pool.

Deposits assets to earn interest from borrowers.
You can use the asset symbol (e.g., 'stSTX') or full contract ID.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'stSTX', 'aeUSDC') or full contract ID"),
        amount: z.string().describe("Amount to supply (in smallest units)"),
        onBehalfOf: z
          .string()
          .optional()
          .describe("Optional: supply on behalf of another address"),
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
        const result = await zestService.supply(
          account,
          resolvedAsset,
          BigInt(amount),
          onBehalfOf
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "supply",
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

  // Withdraw from Zest
  server.registerTool(
    "zest_withdraw",
    {
      description: `Withdraw assets from Zest Protocol lending pool.

Redeems supplied assets plus earned interest.
You can use the asset symbol (e.g., 'stSTX') or full contract ID.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'stSTX', 'aeUSDC') or full contract ID"),
        amount: z.string().describe("Amount to withdraw (in smallest units)"),
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

  // Borrow from Zest
  server.registerTool(
    "zest_borrow",
    {
      description: `Borrow assets from Zest Protocol.

Borrows assets against your supplied collateral.
Ensure you have sufficient collateral to maintain a healthy position.
You can use the asset symbol (e.g., 'aeUSDC') or full contract ID.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'stSTX', 'aeUSDC') or full contract ID"),
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

  // Repay to Zest
  server.registerTool(
    "zest_repay",
    {
      description: `Repay borrowed assets to Zest Protocol.

Repays borrowed assets plus accrued interest.
You can use the asset symbol (e.g., 'aeUSDC') or full contract ID.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z.string().describe("Asset symbol (e.g., 'stSTX', 'aeUSDC') or full contract ID"),
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

  // Claim rewards from Zest
  server.registerTool(
    "zest_claim_rewards",
    {
      description: `Claim accumulated rewards from Zest Protocol incentives program.

Currently, sBTC suppliers earn wSTX rewards. This function claims any accumulated
rewards and sends them to your wallet.

You can use the asset symbol (e.g., 'sBTC') or full contract ID.

Note: Zest Protocol is only available on mainnet.`,
      inputSchema: {
        asset: z
          .string()
          .default("sBTC")
          .describe("Asset you supplied to earn rewards (default: sBTC)"),
      },
    },
    async ({ asset }) => {
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
        const result = await zestService.claimRewards(account, resolvedAsset);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "claim_rewards",
          asset: resolvedAsset,
          rewardAsset: "wSTX",
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          note: "Rewards will be sent to your wallet once the transaction confirms.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
