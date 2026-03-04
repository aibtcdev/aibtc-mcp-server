import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getBitflowService, type BitflowService } from "../services/bitflow.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";

const HIGH_IMPACT_THRESHOLD = 0.05; // 5%

/**
 * How many times larger than the wallet balance an amount must be before
 * we suspect the caller passed base-units instead of human-units.
 */
const AMOUNT_SCALE_SUSPICION_MULTIPLIER = 10;

/**
 * Thrown by checkAmountScaling when the requested amount looks like it was
 * supplied in base units instead of human units.
 */
class AmountUnitMismatchError extends Error {
  readonly code = "AMOUNT_UNIT_MISMATCH_SUSPECTED";
  readonly details: {
    requestedAmountHuman: number;
    requestedAmountInput: string;
    walletBalanceHuman: number;
    tokenDecimals: number;
    tokenSymbol: string;
    correctedHumanAmount: number;
    correctedBaseAmount: string;
    suspicionMultiplier: number;
  };

  constructor(
    message: string,
    details: AmountUnitMismatchError["details"]
  ) {
    super(message);
    this.name = "AmountUnitMismatchError";
    this.details = details;
  }
}

/**
 * Metadata describing how amountIn was interpreted and converted.
 */
interface AmountMetadata {
  amountInRawInput: string;
  amountUnit: "human" | "base";
  tokenDecimals: number | null;
  amountInHuman: number;
  amountInBase: string;
  interpretation: string;
}

/**
 * Resolve amountIn to the human-unit number the Bitflow SDK expects,
 * and return full interpretation metadata for auditability.
 * When amountUnit is "human" (default), validates and passes through.
 * When amountUnit is "base", converts from smallest units using token decimals.
 */
async function resolveAmountIn(
  bitflowService: BitflowService,
  tokenX: string,
  amountIn: string,
  amountUnit: "human" | "base"
): Promise<{ normalizedAmountIn: number; amountMetadata: AmountMetadata }> {
  if (amountUnit === "base") {
    if (!/^[1-9]\d*$/.test(amountIn)) {
      throw new Error("amountIn must be a positive integer when amountUnit='base'");
    }
    const tokens = await bitflowService.getAvailableTokens();
    const tokenIn = tokens.find((t) => t.id === tokenX);
    if (!tokenIn) {
      throw new Error(`Unknown tokenX '${tokenX}' for base-unit conversion`);
    }
    const numeric = Number(amountIn) / 10 ** tokenIn.decimals;
    if (!Number.isFinite(numeric)) {
      throw new Error("Converted amount is too large to handle safely");
    }
    const amountMetadata: AmountMetadata = {
      amountInRawInput: amountIn,
      amountUnit: "base",
      tokenDecimals: tokenIn.decimals,
      amountInHuman: numeric,
      amountInBase: amountIn,
      interpretation: `Input '${amountIn}' interpreted as base units; converted to ${numeric} human units using ${tokenIn.decimals} decimals`,
    };
    return { normalizedAmountIn: numeric, amountMetadata };
  }

  const numeric = Number(amountIn);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("amountIn must be a positive number");
  }
  // For human units we don't need decimals from the token list; base = round(human * 10^decimals).
  // Since we don't know decimals without an extra fetch, we omit the base string here and
  // attempt a best-effort lookup so the metadata is as complete as possible.
  let tokenDecimals: number | null = null;
  let amountInBase: string = "unknown (decimals not fetched for human-unit input)";
  try {
    const tokens = await bitflowService.getAvailableTokens();
    const tokenIn = tokens.find((t) => t.id === tokenX);
    if (tokenIn) {
      tokenDecimals = tokenIn.decimals;
      amountInBase = String(Math.round(numeric * 10 ** tokenIn.decimals));
    }
  } catch {
    // Non-fatal: metadata degrades gracefully if token list is unavailable
  }
  const amountMetadata: AmountMetadata = {
    amountInRawInput: amountIn,
    amountUnit: "human",
    tokenDecimals,
    amountInHuman: numeric,
    amountInBase,
    interpretation:
      tokenDecimals !== null
        ? `Input '${amountIn}' interpreted as human units (${tokenDecimals} decimals); base unit equivalent is ${amountInBase}`
        : `Input '${amountIn}' interpreted as human units; token decimals unavailable so base unit string is omitted`,
  };
  return { normalizedAmountIn: numeric, amountMetadata };
}

/**
 * Preflight guardrail: detect likely base-unit / human-unit confusion.
 *
 * When amountUnit is "human" and the requested amount is more than
 * AMOUNT_SCALE_SUSPICION_MULTIPLIER times the wallet's actual balance of that
 * token, we reject the call early with a structured error that explains the
 * mismatch and shows corrected examples.
 *
 * This prevents wasted retries and failed transactions caused by an agent (or
 * human) passing micro-unit values (e.g. 1_000_000 micro-STX) when the API
 * expects human units (e.g. 1 STX).
 *
 * The check is skipped (silently passes) when:
 *  - amountUnit is "base" — the caller already opted into explicit unit
 *    conversion via resolveAmountIn, so no confusion is expected.
 *  - The wallet address cannot be resolved (no active session / no mnemonic),
 *    because we cannot fetch the balance without an address.
 *  - The balance fetch itself fails — we treat network errors as non-fatal so
 *    that a temporary API outage does not block all swap traffic.
 *
 * @throws Error with code AMOUNT_UNIT_MISMATCH_SUSPECTED when suspicious.
 */
async function checkAmountScaling(
  bitflowService: BitflowService,
  tokenX: string,
  humanAmount: number,
  amountIn: string,
  amountUnit: "human" | "base"
): Promise<void> {
  // Only guard the default "human" path — "base" users have already been
  // explicit about their units.
  if (amountUnit !== "human") return;

  let walletAddress: string;
  try {
    walletAddress = await getWalletAddress();
  } catch {
    // No wallet unlocked / no mnemonic — skip the check rather than blocking.
    return;
  }

  try {
    // Look up the token's decimals from the Bitflow token list.
    // Fall back to 6 (micro-STX standard) if the token is unknown.
    // NOTE: getAvailableTokens() is inside this try/catch so that a Bitflow
    // API outage does not propagate as an uncaught error and block all swaps.
    const tokens = await bitflowService.getAvailableTokens();
    const tokenMeta = tokens.find((t) => t.id === tokenX);
    const decimals = tokenMeta?.decimals ?? 6;

    // Fetch the wallet's balance for this token.
    // STX is identified in Bitflow as "token-stx".
    const hiroApi = getHiroApi(NETWORK);
    let walletBalanceHuman: number;
    const isStx = tokenX === "token-stx";
    if (isStx) {
      const stxInfo = await hiroApi.getStxBalance(walletAddress);
      // balance is in micro-STX; convert to STX (6 decimals)
      walletBalanceHuman = Number(stxInfo.balance) / 10 ** 6;
    } else {
      const rawBalance = await hiroApi.getTokenBalance(walletAddress, tokenX);
      walletBalanceHuman = Number(rawBalance) / 10 ** decimals;
    }

    // If the wallet has no balance at all, there is nothing to compare against.
    if (walletBalanceHuman <= 0) return;

    const threshold = walletBalanceHuman * AMOUNT_SCALE_SUSPICION_MULTIPLIER;
    if (humanAmount <= threshold) return;

    // The requested amount looks like it was supplied in base units.
    // Build a helpful error with corrected examples.
    const correctedHumanAmount = (humanAmount / 10 ** decimals).toFixed(decimals > 0 ? 6 : 0);
    const baseEquivalent = Math.round(humanAmount * 10 ** decimals).toString();

    throw new AmountUnitMismatchError(
      `AMOUNT_UNIT_MISMATCH_SUSPECTED: The requested amount (${humanAmount} in human units) is ` +
      `${(humanAmount / walletBalanceHuman).toFixed(0)}x your wallet balance ` +
      `(${walletBalanceHuman.toFixed(6)} ${tokenMeta?.symbol ?? tokenX}). ` +
      `This strongly suggests you passed a base-unit value as a human-unit value. ` +
      `To fix this, either:\n` +
      `  1. Pass amountUnit="base" with amountIn="${Math.round(humanAmount)}" ` +
      `     (the SDK will convert ${Math.round(humanAmount)} base-units → ~${correctedHumanAmount} ${tokenMeta?.symbol ?? tokenX})\n` +
      `  2. Pass amountUnit="human" (default) with amountIn="${correctedHumanAmount}" ` +
      `     (interpreted directly as ${correctedHumanAmount} ${tokenMeta?.symbol ?? tokenX})\n` +
      `  3. If you really do intend to swap ${humanAmount} ${tokenMeta?.symbol ?? tokenX}, ` +
      `     first fund your wallet — it currently holds ${walletBalanceHuman.toFixed(6)} ${tokenMeta?.symbol ?? tokenX}.`,
      {
        requestedAmountHuman: humanAmount,
        requestedAmountInput: amountIn,
        walletBalanceHuman,
        tokenDecimals: decimals,
        tokenSymbol: tokenMeta?.symbol ?? tokenX,
        correctedHumanAmount: Number(correctedHumanAmount),
        correctedBaseAmount: baseEquivalent,
        suspicionMultiplier: AMOUNT_SCALE_SUSPICION_MULTIPLIER,
      }
    );
  } catch (err) {
    // Re-throw only our own typed error — for anything else (Bitflow API down,
    // balance lookup failed, network issue, unknown token, etc.) we silently
    // skip the guard rather than blocking legitimate swaps.
    if (err instanceof AmountUnitMismatchError) throw err;
    return;
  }
}

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
  // SDK Tools (No API Key Required — 500 req/min public rate limit)
  // ==========================================================================

  // Get available tokens
  server.registerTool(
    "bitflow_get_tokens",
    {
      description: `Get all available tokens for swapping on Bitflow.

Returns the list of tokens that can be swapped on Bitflow DEX.
No API key required — uses public endpoints (500 req/min).

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
No API key required — uses public endpoints (500 req/min).

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

Returns the expected output amount and best route for swapping tokens.
No API key required — uses public endpoints (500 req/min).

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token ID (e.g. 'token-stx', 'token-sbtc')"),
        tokenY: z.string().describe("Output token ID (e.g. 'token-sbtc', 'token-aeusdc')"),
        amountIn: z
          .string()
          .describe("Amount of input token. Default interpretation is human units (e.g. '100' = 100 LEO)."),
        amountUnit: z
          .enum(["human", "base"])
          .describe("Required. Amount units: 'human' (frontend-style decimal, e.g. '2' for 2 STX) or 'base' (smallest integer units, e.g. '2000000' for 2 STX)."),
      },
    },
    async ({ tokenX, tokenY, amountIn, amountUnit }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);
        const { normalizedAmountIn, amountMetadata } = await resolveAmountIn(
          bitflowService,
          tokenX,
          amountIn,
          amountUnit
        );
        await checkAmountScaling(bitflowService, tokenX, normalizedAmountIn, amountIn, amountUnit);

        const quote = await bitflowService.getSwapQuote(tokenX, tokenY, normalizedAmountIn);

        const priceImpact = quote.priceImpact;
        const highImpactWarning =
          priceImpact && priceImpact.combinedImpact > HIGH_IMPACT_THRESHOLD
            ? `High price impact detected (${priceImpact.combinedImpactPct}). Consider reducing trade size.`
            : undefined;

        return createJsonResponse({
          network: NETWORK,
          inputs: {
            tokenX,
            tokenY,
            amountIn,
            amountUnit,
            normalizedAmountIn,
          },
          amountMetadata,
          quote,
          priceImpact,
          highImpactWarning,
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

Returns all available routes for swapping from tokenX to tokenY,
including multi-hop routes through intermediate tokens.
No API key required — uses public endpoints (500 req/min).

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token ID (e.g. 'token-stx', 'token-sbtc')"),
        tokenY: z.string().describe("Output token ID (e.g. 'token-sbtc', 'token-aeusdc')"),
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
Automatically finds the best route across all Bitflow pools.
No API key required — uses public endpoints (500 req/min).
Requires an unlocked wallet with sufficient token balance.

Note: Bitflow is only available on mainnet.`,
      inputSchema: {
        tokenX: z.string().describe("Input token ID (contract address)"),
        tokenY: z.string().describe("Output token ID (contract address)"),
        amountIn: z
          .string()
          .describe("Amount of input token. Default interpretation is human units (e.g. '100' = 100 LEO)."),
        amountUnit: z
          .enum(["human", "base"])
          .describe("Required. Amount units: 'human' (frontend-style decimal, e.g. '2' for 2 STX) or 'base' (smallest integer units, e.g. '2000000' for 2 STX)."),
        slippageTolerance: z
          .number()
          .optional()
          .default(0.01)
          .describe("Slippage tolerance as decimal (default 0.01 = 1%)"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated."),
        confirmHighImpact: z
          .boolean()
          .optional()
          .default(false)
          .describe("Set true to execute swaps with price impact above 5%"),
      },
    },
    async ({ tokenX, tokenY, amountIn, amountUnit, slippageTolerance, fee, confirmHighImpact }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Bitflow is only available on mainnet",
            network: NETWORK,
          });
        }

        const bitflowService = getBitflowService(NETWORK);
        const { normalizedAmountIn, amountMetadata } = await resolveAmountIn(
          bitflowService,
          tokenX,
          amountIn,
          amountUnit
        );
        await checkAmountScaling(bitflowService, tokenX, normalizedAmountIn, amountIn, amountUnit);

        // Safety check: require explicit confirmation for high-impact swaps
        const quote = await bitflowService.getSwapQuote(tokenX, tokenY, normalizedAmountIn);
        const impact = quote.priceImpact;
        if (impact && impact.combinedImpact > HIGH_IMPACT_THRESHOLD && !confirmHighImpact) {
          return createJsonResponse({
            error: "High price impact swap requires explicit confirmation",
            message: `This swap has ${impact.combinedImpactPct} price impact (${impact.severity}). Set confirmHighImpact=true to proceed.`,
            amountMetadata,
            quote,
            threshold: `${(HIGH_IMPACT_THRESHOLD * 100).toFixed(0)}%`,
            requiredParam: "confirmHighImpact",
          });
        }

        const account = await getAccount();
        const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
        const result = await bitflowService.swap(
          account,
          tokenX,
          tokenY,
          normalizedAmountIn,
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
            amountUnit,
            normalizedAmountIn,
            slippageTolerance: slippageTolerance || 0.01,
            priceImpact: impact,
          },
          amountMetadata,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Keeper Tools
  // ==========================================================================

  // Get or create keeper contract
  server.registerTool(
    "bitflow_get_keeper_contract",
    {
      description: `Get or create a Bitflow Keeper contract for automated swaps.

Keeper contracts enable scheduled/automated token swaps.
No API key required — uses public endpoints (500 req/min).

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
No API key required — uses public endpoints (500 req/min).

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
No API key required — uses public endpoints (500 req/min).

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
No API key required — uses public endpoints (500 req/min).

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
No API key required — uses public endpoints (500 req/min).

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
