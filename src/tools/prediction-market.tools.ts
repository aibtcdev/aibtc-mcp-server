import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { uintCV, principalCV, PostConditionMode } from "@stacks/transactions";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { callContract } from "../transactions/builder.js";
import { sponsoredContractCall } from "../transactions/sponsor-builder.js";
import { getHiroApi } from "../services/hiro-api.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";
import { sponsoredSchema } from "./schemas.js";

// ============================================================================
// Constants
// ============================================================================

const MARKET_CONTRACT_ADDRESS = "SP3N5CN0PE7YRRP29X7K9XG22BT861BRS5BN8HFFA";
const MARKET_CONTRACT_NAME = "market-factory-v18-bias";
const MARKET_CONTRACT_ID = `${MARKET_CONTRACT_ADDRESS}.${MARKET_CONTRACT_NAME}`;
const STACKS_MARKET_API = "https://api.stacksmarket.app";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert uSTX (micro-STX) to STX for display purposes.
 * 1 STX = 1,000,000 uSTX
 */
function ustxToStx(ustx: string | number | bigint): string {
  const value = BigInt(ustx);
  const stx = value / 1_000_000n;
  const remainder = value % 1_000_000n;
  if (remainder === 0n) {
    return `${stx} STX`;
  }
  const decimal = remainder.toString().padStart(6, "0").replace(/0+$/, "");
  return `${stx}.${decimal} STX`;
}

/**
 * Fetch data from the Stacks Market API.
 */
async function fetchMarketApi(path: string, params?: Record<string, string | number | boolean>): Promise<unknown> {
  const url = new URL(`${STACKS_MARKET_API}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stacks Market API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Parse a Clarity uint result from the Hiro read-only API response.
 * The result is a hex-encoded Clarity value like "0x0100000000000000000000000000000064"
 * which decodes to (ok u100) or just a uint.
 */
function parseClarityUint(result: string): bigint {
  // Strip leading type byte(s) and decode as big-endian uint128
  // Clarity uint is serialized as: 0x01 + 16 bytes big-endian
  if (result.startsWith("0x")) {
    result = result.slice(2);
  }

  // Handle (ok ...) wrapping: 0x07 = ok, next byte is inner type
  if (result.startsWith("07")) {
    result = result.slice(2);
  }

  // 0x01 = uint128
  if (result.startsWith("01")) {
    const hex = result.slice(2);
    return BigInt("0x" + hex);
  }

  // Fallback: try to parse as plain uint hex
  return BigInt("0x" + result);
}

/**
 * Call a read-only function on the prediction market contract.
 */
async function callMarketReadOnly(
  functionName: string,
  functionArgs: ReturnType<typeof uintCV | typeof principalCV>[]
): Promise<{ okay: boolean; result?: string; cause?: string }> {
  const hiro = getHiroApi(NETWORK);
  const sender = MARKET_CONTRACT_ADDRESS;
  return hiro.callReadOnlyFunction(MARKET_CONTRACT_ID, functionName, functionArgs, sender);
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerPredictionMarketTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // 1. List Markets
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_list_markets",
    {
      description: `List prediction markets from Stacks Market (stacksmarket.app).

Returns a paginated list of prediction markets. Filter by status, category, or featured flag.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe("Number of markets to return (1-100, default 20)"),
        status: z
          .enum(["open", "closed", "resolved"])
          .optional()
          .describe("Filter by market status: open, closed, or resolved"),
        category: z
          .string()
          .optional()
          .describe("Filter by category (e.g. 'crypto', 'politics', 'sports')"),
        featured: z
          .boolean()
          .optional()
          .describe("If true, return only featured markets"),
      },
    },
    async ({ limit, status, category, featured }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const params: Record<string, string | number | boolean> = {};
        if (limit !== undefined) params.limit = limit;
        if (status) params.status = status;
        if (category) params.category = category;
        if (featured !== undefined) params.featured = featured;

        const data = await fetchMarketApi("/api/polls", params);

        return createJsonResponse({
          network: NETWORK,
          markets: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 2. Search Markets
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_search_markets",
    {
      description: `Search prediction markets on Stacks Market by keyword.

Performs a text search across market titles and descriptions.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        query: z.string().min(1).describe("Search keyword or phrase"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe("Number of results to return (1-100, default 20)"),
      },
    },
    async ({ query, limit }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const params: Record<string, string | number> = { search: query };
        if (limit !== undefined) params.limit = limit;

        const data = await fetchMarketApi("/api/polls", params);

        return createJsonResponse({
          network: NETWORK,
          query,
          markets: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 3. Get Market
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_get_market",
    {
      description: `Get details of a specific prediction market by its MongoDB ID.

Returns full market details including title, description, options, resolution criteria,
current prices, and trading volume.

Use prediction_market_list_markets or prediction_market_search_markets to find market IDs.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("The MongoDB _id of the market (24-character hex string from the API)"),
      },
    },
    async ({ marketId }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const data = await fetchMarketApi(`/api/polls/${marketId}`);

        return createJsonResponse({
          network: NETWORK,
          market: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 4. Quote Buy
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_quote_buy",
    {
      description: `Get a price quote for buying YES or NO shares in a prediction market.

Returns the cost in uSTX (micro-STX) to purchase the specified number of shares.
Use this to preview costs before executing a trade.

Market IDs for contract calls are epoch millisecond timestamps (uint), not MongoDB IDs.
Check the market details to find the on-chain marketId.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        side: z
          .enum(["yes", "no"])
          .describe("Which side to quote: 'yes' or 'no'"),
        shares: z
          .string()
          .describe("Number of shares to buy (as uint string, e.g. '100')"),
      },
    },
    async ({ marketId, side, shares }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const functionName = side === "yes" ? "quote-buy-yes" : "quote-buy-no";
        const result = await callMarketReadOnly(functionName, [
          uintCV(BigInt(marketId)),
          uintCV(BigInt(shares)),
        ]);

        if (!result.okay) {
          return createJsonResponse({
            error: "Contract call failed",
            cause: result.cause,
            marketId,
            side,
            shares,
          });
        }

        const costUstx = parseClarityUint(result.result!);

        return createJsonResponse({
          network: NETWORK,
          marketId,
          side,
          shares,
          costUstx: costUstx.toString(),
          costStx: ustxToStx(costUstx),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 5. Quote Sell
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_quote_sell",
    {
      description: `Get a price quote for selling YES or NO shares in a prediction market.

Returns the proceeds in uSTX (micro-STX) you would receive for selling the specified shares.
Use this to preview returns before executing a sell.

Market IDs for contract calls are epoch millisecond timestamps (uint), not MongoDB IDs.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        side: z
          .enum(["yes", "no"])
          .describe("Which side to quote: 'yes' or 'no'"),
        shares: z
          .string()
          .describe("Number of shares to sell (as uint string, e.g. '100')"),
      },
    },
    async ({ marketId, side, shares }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const functionName = side === "yes" ? "quote-sell-yes" : "quote-sell-no";
        const result = await callMarketReadOnly(functionName, [
          uintCV(BigInt(marketId)),
          uintCV(BigInt(shares)),
        ]);

        if (!result.okay) {
          return createJsonResponse({
            error: "Contract call failed",
            cause: result.cause,
            marketId,
            side,
            shares,
          });
        }

        const proceedsUstx = parseClarityUint(result.result!);

        return createJsonResponse({
          network: NETWORK,
          marketId,
          side,
          shares,
          proceedsUstx: proceedsUstx.toString(),
          proceedsStx: ustxToStx(proceedsUstx),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 6. Get Position
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_get_position",
    {
      description: `Get the YES and NO share balances for an address in a prediction market.

Returns how many YES shares and NO shares the address holds in the specified market.

Market IDs for contract calls are epoch millisecond timestamps (uint), not MongoDB IDs.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        address: z
          .string()
          .optional()
          .describe("Stacks address to check (uses wallet address if not provided)"),
      },
    },
    async ({ marketId, address }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const walletAddress = address || (await getWalletAddress());

        const [yesResult, noResult] = await Promise.all([
          callMarketReadOnly("get-yes-balance", [
            uintCV(BigInt(marketId)),
            principalCV(walletAddress),
          ]),
          callMarketReadOnly("get-no-balance", [
            uintCV(BigInt(marketId)),
            principalCV(walletAddress),
          ]),
        ]);

        const yesShares = yesResult.okay ? parseClarityUint(yesResult.result!) : 0n;
        const noShares = noResult.okay ? parseClarityUint(noResult.result!) : 0n;

        return createJsonResponse({
          network: NETWORK,
          marketId,
          address: walletAddress,
          position: {
            yesShares: yesShares.toString(),
            noShares: noShares.toString(),
            hasPosition: yesShares > 0n || noShares > 0n,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 7. Buy YES
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_buy_yes",
    {
      description: `Buy YES shares in a prediction market.

Calls buy-yes-auto on the market contract with PostConditionMode.Allow.
You will spend STX to receive YES shares. If the market resolves YES, shares are redeemable for STX.

Use prediction_market_quote_buy (side='yes') first to preview the cost.
Set maxCost higher than the quoted cost to allow for price slippage.

All amounts are in uSTX (micro-STX). 1 STX = 1,000,000 uSTX.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        shares: z
          .string()
          .describe("Number of YES shares to buy (uint string, e.g. '100')"),
        targetCap: z
          .string()
          .describe("Target market cap in uSTX (uint string). Use 0 for no cap preference."),
        maxCost: z
          .string()
          .describe("Maximum cost in uSTX you are willing to pay (slippage protection)"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. Ignored when sponsored=true."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ marketId, shares, targetCap, maxCost, fee, sponsored }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const contractCallOptions = {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "buy-yes-auto",
          functionArgs: [
            uintCV(BigInt(marketId)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(targetCap)),
            uintCV(BigInt(maxCost)),
          ],
          postConditionMode: PostConditionMode.Allow,
        };

        let result;
        if (sponsored) {
          result = await sponsoredContractCall(account, contractCallOptions, NETWORK);
        } else {
          const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
          result = await callContract(account, {
            ...contractCallOptions,
            ...(resolvedFee !== undefined && { fee: resolvedFee }),
          });
        }

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "buy_yes",
          marketId,
          shares,
          maxCostUstx: maxCost,
          maxCostStx: ustxToStx(maxCost),
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          ...(sponsored && { sponsored: true }),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 8. Buy NO
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_buy_no",
    {
      description: `Buy NO shares in a prediction market.

Calls buy-no-auto on the market contract with PostConditionMode.Allow.
You will spend STX to receive NO shares. If the market resolves NO, shares are redeemable for STX.

Use prediction_market_quote_buy (side='no') first to preview the cost.
Set maxCost higher than the quoted cost to allow for price slippage.

All amounts are in uSTX (micro-STX). 1 STX = 1,000,000 uSTX.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        shares: z
          .string()
          .describe("Number of NO shares to buy (uint string, e.g. '100')"),
        targetCap: z
          .string()
          .describe("Target market cap in uSTX (uint string). Use 0 for no cap preference."),
        maxCost: z
          .string()
          .describe("Maximum cost in uSTX you are willing to pay (slippage protection)"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. Ignored when sponsored=true."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ marketId, shares, targetCap, maxCost, fee, sponsored }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const contractCallOptions = {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "buy-no-auto",
          functionArgs: [
            uintCV(BigInt(marketId)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(targetCap)),
            uintCV(BigInt(maxCost)),
          ],
          postConditionMode: PostConditionMode.Allow,
        };

        let result;
        if (sponsored) {
          result = await sponsoredContractCall(account, contractCallOptions, NETWORK);
        } else {
          const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
          result = await callContract(account, {
            ...contractCallOptions,
            ...(resolvedFee !== undefined && { fee: resolvedFee }),
          });
        }

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "buy_no",
          marketId,
          shares,
          maxCostUstx: maxCost,
          maxCostStx: ustxToStx(maxCost),
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          ...(sponsored && { sponsored: true }),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 9. Sell YES
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_sell_yes",
    {
      description: `Sell YES shares in a prediction market.

Calls sell-yes-auto on the market contract with PostConditionMode.Allow.
You will receive STX in exchange for your YES shares.

Use prediction_market_quote_sell (side='yes') first to preview proceeds.
Set minProceeds lower than the quoted amount to allow for price slippage.

All amounts are in uSTX (micro-STX). 1 STX = 1,000,000 uSTX.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        shares: z
          .string()
          .describe("Number of YES shares to sell (uint string, e.g. '100')"),
        minProceeds: z
          .string()
          .describe("Minimum proceeds in uSTX you are willing to accept (slippage protection)"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. Ignored when sponsored=true."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ marketId, shares, minProceeds, fee, sponsored }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const contractCallOptions = {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "sell-yes-auto",
          functionArgs: [
            uintCV(BigInt(marketId)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(minProceeds)),
          ],
          postConditionMode: PostConditionMode.Allow,
        };

        let result;
        if (sponsored) {
          result = await sponsoredContractCall(account, contractCallOptions, NETWORK);
        } else {
          const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
          result = await callContract(account, {
            ...contractCallOptions,
            ...(resolvedFee !== undefined && { fee: resolvedFee }),
          });
        }

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "sell_yes",
          marketId,
          shares,
          minProceedsUstx: minProceeds,
          minProceedsStx: ustxToStx(minProceeds),
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          ...(sponsored && { sponsored: true }),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 10. Sell NO
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_sell_no",
    {
      description: `Sell NO shares in a prediction market.

Calls sell-no-auto on the market contract with PostConditionMode.Allow.
You will receive STX in exchange for your NO shares.

Use prediction_market_quote_sell (side='no') first to preview proceeds.
Set minProceeds lower than the quoted amount to allow for price slippage.

All amounts are in uSTX (micro-STX). 1 STX = 1,000,000 uSTX.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        shares: z
          .string()
          .describe("Number of NO shares to sell (uint string, e.g. '100')"),
        minProceeds: z
          .string()
          .describe("Minimum proceeds in uSTX you are willing to accept (slippage protection)"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. Ignored when sponsored=true."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ marketId, shares, minProceeds, fee, sponsored }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const contractCallOptions = {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "sell-no-auto",
          functionArgs: [
            uintCV(BigInt(marketId)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(minProceeds)),
          ],
          postConditionMode: PostConditionMode.Allow,
        };

        let result;
        if (sponsored) {
          result = await sponsoredContractCall(account, contractCallOptions, NETWORK);
        } else {
          const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
          result = await callContract(account, {
            ...contractCallOptions,
            ...(resolvedFee !== undefined && { fee: resolvedFee }),
          });
        }

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "sell_no",
          marketId,
          shares,
          minProceedsUstx: minProceeds,
          minProceedsStx: ustxToStx(minProceeds),
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          ...(sponsored && { sponsored: true }),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // 11. Redeem
  // --------------------------------------------------------------------------
  server.registerTool(
    "prediction_market_redeem",
    {
      description: `Redeem winning shares after a prediction market has resolved.

Calls redeem on the market contract with PostConditionMode.Allow.
If you hold shares on the winning side, you will receive STX proportional to your shares.

The market must be in a resolved state before redeeming.

Note: This tool is only available on mainnet.`,
      inputSchema: {
        marketId: z
          .string()
          .describe("On-chain market ID (epoch milliseconds as uint, e.g. '1700000000000')"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. Ignored when sponsored=true."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ marketId, fee, sponsored }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Prediction markets are only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const contractCallOptions = {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "redeem",
          functionArgs: [
            uintCV(BigInt(marketId)),
          ],
          postConditionMode: PostConditionMode.Allow,
        };

        let result;
        if (sponsored) {
          result = await sponsoredContractCall(account, contractCallOptions, NETWORK);
        } else {
          const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
          result = await callContract(account, {
            ...contractCallOptions,
            ...(resolvedFee !== undefined && { fee: resolvedFee }),
          });
        }

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "redeem",
          marketId,
          redeemer: account.address,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          ...(sponsored && { sponsored: true }),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
