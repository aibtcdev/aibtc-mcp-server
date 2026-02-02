import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getBitflowService } from "../services/bitflow.service.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";

export function registerBitflowTools(server: McpServer): void {
  // ==========================================================================
  // Public API Tools (No API Key Required)
  // ==========================================================================

  // Get ticker data
  server.registerTool(
    "bitflow_get_ticker",
    {
      description: `Get market ticker data from Bitflow DEX.

Returns price, volume, and liquidity data for all trading pairs.
This endpoint does NOT require an API key.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        baseCurrency: z
          .string()
          .optional()
          .describe("Optional: filter by base currency contract ID"),
        targetCurrency: z
          .string()
          .optional()
          .describe("Optional: filter by target currency contract ID"),
      },
    },
    async ({ baseCurrency, targetCurrency }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (baseCurrency && targetCurrency) {
          const ticker = await bitflowService.getTickerByPair(baseCurrency, targetCurrency);
          if (!ticker) {
            return createJsonResponse({
              error: "Trading pair not found",
              baseCurrency,
              targetCurrency,
            });
          }
          return createJsonResponse({
            network: NETWORK,
            ticker,
          });
        }

        const tickers = await bitflowService.getTicker();

        return createJsonResponse({
          network: NETWORK,
          pairCount: tickers.length,
          tickers: tickers.slice(0, 50), // Limit to 50 for readability
          note: tickers.length > 50 ? `Showing 50 of ${tickers.length} pairs` : undefined,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // SDK Tools (Requires BITFLOW_API_KEY)
  // ==========================================================================

  // Get available tokens
  server.registerTool(
    "bitflow_get_tokens",
    {
      description: `Get all available tokens for swapping on Bitflow.

Returns the list of tokens that can be swapped on Bitflow DEX.
Requires BITFLOW_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {},
    },
    async () => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isSdkAvailable()) {
          return createJsonResponse({
            error: "Bitflow SDK not configured",
            message: "Set BITFLOW_API_KEY environment variable to enable this feature",
            alternative: "Use bitflow_get_ticker for public market data (no API key required)",
          });
        }

        const tokens = await bitflowService.getAvailableTokens();

        return createJsonResponse({
          network: NETWORK,
          tokenCount: tokens.length,
          tokens,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get possible swap targets
  server.registerTool(
    "bitflow_get_swap_targets",
    {
      description: `Get possible swap target tokens for a given input token on Bitflow.

Returns all tokens that can be received when swapping from the specified token.
Requires BITFLOW_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        tokenId: z.string().describe("The input token ID (contract address)"),
      },
    },
    async ({ tokenId }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isSdkAvailable()) {
          return createJsonResponse({
            error: "Bitflow SDK not configured",
            message: "Set BITFLOW_API_KEY environment variable to enable this feature",
          });
        }

        const targets = await bitflowService.getPossibleSwapTargets(tokenId);

        return createJsonResponse({
          network: NETWORK,
          inputToken: tokenId,
          targetCount: targets.length,
          targets,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get swap quote
  server.registerTool(
    "bitflow_get_quote",
    {
      description: `Get a swap quote from Bitflow DEX.

Returns the expected output amount and route for swapping tokens.
Requires BITFLOW_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token ID (contract address)"),
        tokenY: z.string().describe("Output token ID (contract address)"),
        amountIn: z.string().describe("Amount of input token (in smallest units)"),
      },
    },
    async ({ tokenX, tokenY, amountIn }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isSdkAvailable()) {
          return createJsonResponse({
            error: "Bitflow SDK not configured",
            message: "Set BITFLOW_API_KEY environment variable to enable this feature",
          });
        }

        const quote = await bitflowService.getSwapQuote(tokenX, tokenY, Number(amountIn));

        return createJsonResponse({
          network: NETWORK,
          quote,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get all routes between tokens
  server.registerTool(
    "bitflow_get_routes",
    {
      description: `Get all possible swap routes between two tokens on Bitflow.

Returns all available routes for swapping from tokenX to tokenY.
Useful for understanding routing options.
Requires BITFLOW_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token ID (contract address)"),
        tokenY: z.string().describe("Output token ID (contract address)"),
      },
    },
    async ({ tokenX, tokenY }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isSdkAvailable()) {
          return createJsonResponse({
            error: "Bitflow SDK not configured",
            message: "Set BITFLOW_API_KEY environment variable to enable this feature",
          });
        }

        const routes = await bitflowService.getAllRoutes(tokenX, tokenY);

        return createJsonResponse({
          network: NETWORK,
          tokenX,
          tokenY,
          routeCount: routes.length,
          routes: routes.map((r) => ({
            tokenPath: r.token_path,
            dexPath: r.dex_path,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Execute swap
  server.registerTool(
    "bitflow_swap",
    {
      description: `Execute a token swap on Bitflow DEX.

Swaps tokenX for tokenY using Bitflow's aggregated liquidity.
Requires BITFLOW_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token ID (contract address)"),
        tokenY: z.string().describe("Output token ID (contract address)"),
        amountIn: z.string().describe("Amount of input token (in smallest units)"),
        slippageTolerance: z
          .number()
          .optional()
          .default(0.01)
          .describe("Slippage tolerance as decimal (default 0.01 = 1%)"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated."),
      },
    },
    async ({ tokenX, tokenY, amountIn, slippageTolerance, fee }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isSdkAvailable()) {
          return createJsonResponse({
            error: "Bitflow SDK not configured",
            message: "Set BITFLOW_API_KEY environment variable to enable this feature",
          });
        }

        const account = await getAccount();
        const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
        const result = await bitflowService.swap(
          account,
          tokenX,
          tokenY,
          Number(amountIn),
          slippageTolerance || 0.01,
          resolvedFee
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          swap: {
            tokenIn: tokenX,
            tokenOut: tokenY,
            amountIn,
            slippageTolerance: slippageTolerance || 0.01,
          },
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Keeper Tools (Requires BITFLOW_KEEPER_API_KEY)
  // ==========================================================================

  // Get or create keeper contract
  server.registerTool(
    "bitflow_get_keeper_contract",
    {
      description: `Get or create a Bitflow Keeper contract for automated swaps.

Keeper contracts enable scheduled/automated token swaps.
Requires BITFLOW_KEEPER_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        stacksAddress: z
          .string()
          .optional()
          .describe("Stacks address (uses wallet if not specified)"),
      },
    },
    async ({ stacksAddress }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isKeeperAvailable()) {
          return createJsonResponse({
            error: "Bitflow Keeper not configured",
            message: "Set BITFLOW_KEEPER_API_KEY environment variable to enable Keeper features",
          });
        }

        const address = stacksAddress || (await getWalletAddress());
        const result = await bitflowService.getOrCreateKeeperContract(address);

        return createJsonResponse({
          network: NETWORK,
          address,
          contractIdentifier: result.contractIdentifier,
          status: result.status,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Create keeper order
  server.registerTool(
    "bitflow_create_order",
    {
      description: `Create an automated swap order via Bitflow Keeper.

Creates a pending order that will be executed by the Keeper service.
Requires BITFLOW_KEEPER_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        contractIdentifier: z.string().describe("Keeper contract identifier"),
        actionType: z.string().describe("Action type (e.g., 'SWAP_XYK_SWAP_HELPER')"),
        fundingTokens: z
          .record(z.string(), z.string())
          .describe("Map of token IDs to amounts for funding"),
        actionAmount: z.string().describe("Amount for the action"),
        minReceivedAmount: z
          .string()
          .optional()
          .describe("Minimum amount to receive (slippage protection)"),
        autoAdjust: z
          .boolean()
          .optional()
          .default(true)
          .describe("Auto-adjust minimum received based on market (default true)"),
      },
    },
    async ({ contractIdentifier, actionType, fundingTokens, actionAmount, minReceivedAmount, autoAdjust }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isKeeperAvailable()) {
          return createJsonResponse({
            error: "Bitflow Keeper not configured",
            message: "Set BITFLOW_KEEPER_API_KEY environment variable to enable Keeper features",
          });
        }

        const address = await getWalletAddress();
        const result = await bitflowService.createKeeperOrder({
          contractIdentifier,
          stacksAddress: address,
          actionType,
          fundingTokens,
          actionAmount,
          minReceived: minReceivedAmount
            ? { amount: minReceivedAmount, autoAdjust: autoAdjust ?? true }
            : undefined,
        });

        return createJsonResponse({
          success: true,
          network: NETWORK,
          orderId: result.orderId,
          status: result.status,
          order: {
            contractIdentifier,
            actionType,
            fundingTokens,
            actionAmount,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get keeper order
  server.registerTool(
    "bitflow_get_order",
    {
      description: `Get details of a Bitflow Keeper order.

Retrieves the status and details of a specific order.
Requires BITFLOW_KEEPER_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        orderId: z.string().describe("The order ID to retrieve"),
      },
    },
    async ({ orderId }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isKeeperAvailable()) {
          return createJsonResponse({
            error: "Bitflow Keeper not configured",
            message: "Set BITFLOW_KEEPER_API_KEY environment variable to enable Keeper features",
          });
        }

        const order = await bitflowService.getKeeperOrder(orderId);

        return createJsonResponse({
          network: NETWORK,
          order,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Cancel keeper order
  server.registerTool(
    "bitflow_cancel_order",
    {
      description: `Cancel a Bitflow Keeper order.

Cancels a pending order before execution.
Requires BITFLOW_KEEPER_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        orderId: z.string().describe("The order ID to cancel"),
      },
    },
    async ({ orderId }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isKeeperAvailable()) {
          return createJsonResponse({
            error: "Bitflow Keeper not configured",
            message: "Set BITFLOW_KEEPER_API_KEY environment variable to enable Keeper features",
          });
        }

        const result = await bitflowService.cancelKeeperOrder(orderId);

        return createJsonResponse({
          network: NETWORK,
          orderId,
          cancelled: result.success,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get keeper user info
  server.registerTool(
    "bitflow_get_keeper_user",
    {
      description: `Get Bitflow Keeper user info and orders.

Retrieves user's keeper contracts and order history.
Requires BITFLOW_KEEPER_API_KEY environment variable.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        stacksAddress: z
          .string()
          .optional()
          .describe("Stacks address (uses wallet if not specified)"),
      },
    },
    async ({ stacksAddress }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);

        if (!bitflowService.isKeeperAvailable()) {
          return createJsonResponse({
            error: "Bitflow Keeper not configured",
            message: "Set BITFLOW_KEEPER_API_KEY environment variable to enable Keeper features",
          });
        }

        const address = stacksAddress || (await getWalletAddress());
        const userInfo = await bitflowService.getKeeperUser(address);

        return createJsonResponse({
          network: NETWORK,
          userInfo,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
