/**
 * Stacks Market prediction market tools
 *
 * MCP tools for prediction market trading on stacksmarket.app via the
 * market-factory-v18-bias contract.
 *
 * Tools:
 * - stacks_market_list          — List markets with optional filters
 * - stacks_market_search        — Keyword search across market titles/descriptions
 * - stacks_market_get           — Full details for a specific market
 * - stacks_market_quote_buy     — LMSR price quote for buying YES/NO shares
 * - stacks_market_quote_sell    — LMSR price quote for selling YES/NO shares
 * - stacks_market_buy_yes       — Buy YES shares with slippage protection
 * - stacks_market_buy_no        — Buy NO shares with slippage protection
 * - stacks_market_sell_yes      — Sell YES shares with minimum proceeds guard
 * - stacks_market_sell_no       — Sell NO shares with minimum proceeds guard
 * - stacks_market_redeem        — Redeem winning shares after market resolution
 * - stacks_market_get_position  — Check YES/NO share balances for any address
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK, getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getAccount, getWalletAddress } from "../services/x402.service.js";
import { callContract } from "../transactions/builder.js";
import {
  uintCV,
  principalCV,
  PostConditionMode,
  type ClarityValue,
  deserializeCV,
  cvToJSON,
} from "@stacks/transactions";
import { getHiroApi } from "../services/hiro-api.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STACKS_MARKET_API = "https://api.stacksmarket.app";
const MARKET_CONTRACT_ADDRESS = "SP3N5CN0PE7YRRP29X7K9XG22BT861BRS5BN8HFFA";
const MARKET_CONTRACT_NAME = "market-factory-v18-bias";
const MARKET_CONTRACT_ID = `${MARKET_CONTRACT_ADDRESS}.${MARKET_CONTRACT_NAME}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchMarketApi(
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${STACKS_MARKET_API}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(
      `Stacks Market API error (${response.status}): ${await response.text()}`
    );
  }
  return response.json();
}

async function callReadOnly(
  functionName: string,
  args: ClarityValue[]
): Promise<unknown> {
  const hiro = getHiroApi(NETWORK);
  const result = await hiro.callReadOnlyFunction(
    MARKET_CONTRACT_ID,
    functionName,
    args,
    MARKET_CONTRACT_ADDRESS
  );
  if (!result.okay) {
    throw new Error(
      `Read-only call ${functionName} failed: ${result.cause ?? "unknown error"}`
    );
  }
  if (!result.result) {
    return null;
  }
  const hex = result.result.startsWith("0x")
    ? result.result.slice(2)
    : result.result;
  const cv = deserializeCV(Buffer.from(hex, "hex"));
  return cvToJSON(cv);
}

function parseUintResult(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (
    typeof val === "object" &&
    val !== null &&
    "value" in val
  ) {
    return Number((val as { value: string | number }).value);
  }
  return Number(val);
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerStacksMarketTools(server: McpServer): void {
  // ==========================================================================
  // stacks_market_list
  // ==========================================================================

  server.registerTool(
    "stacks_market_list",
    {
      description: `List prediction markets on stacksmarket.app.

Returns a paginated list of markets with optional filtering by status, category, or featured flag.

Note: Stacks Market is only available on mainnet.`,
      inputSchema: {
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("Maximum number of markets to return (default 20)"),
        status: z
          .string()
          .optional()
          .describe(
            "Filter by market status: 'open', 'closed', 'resolved', or 'all'"
          ),
        category: z
          .string()
          .optional()
          .describe("Filter by category (e.g. 'crypto', 'sports', 'politics')"),
        featured: z
          .boolean()
          .optional()
          .describe("When true, return only featured markets"),
      },
    },
    async ({ limit, status, category, featured }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const params: Record<string, string> = {
          limit: String(limit ?? 20),
        };
        if (status) params.status = status;
        if (category) params.category = category;
        if (featured !== undefined) params.featured = String(featured);

        const data = await fetchMarketApi("/api/polls", params);
        return createJsonResponse({ network: NETWORK, markets: data });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_search
  // ==========================================================================

  server.registerTool(
    "stacks_market_search",
    {
      description: `Search prediction markets by keyword on stacksmarket.app.

Searches across market titles and descriptions.

Note: Stacks Market is only available on mainnet.`,
      inputSchema: {
        query: z.string().describe("Search keyword or phrase"),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("Maximum number of results to return (default 20)"),
      },
    },
    async ({ query, limit }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const data = await fetchMarketApi("/api/polls/search", {
          query,
          limit: String(limit ?? 20),
        });
        return createJsonResponse({ network: NETWORK, results: data });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_get
  // ==========================================================================

  server.registerTool(
    "stacks_market_get",
    {
      description: `Get full details for a specific prediction market on stacksmarket.app.

Market IDs are epoch millisecond timestamps (uint) visible in market URLs.

Note: Stacks Market is only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe(
            "Market ID (epoch ms timestamp, e.g. '1710000000000')"
          ),
      },
    },
    async ({ market_id }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const data = await fetchMarketApi(`/api/polls/${market_id}`);
        return createJsonResponse({ network: NETWORK, market: data });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_quote_buy
  // ==========================================================================

  server.registerTool(
    "stacks_market_quote_buy",
    {
      description: `Get an LMSR buy price quote for YES or NO shares on a Stacks Market prediction market.

Returns the cost in micro-STX to buy the requested number of shares.
Side: 0 = YES, 1 = NO.

Note: Stacks Market is only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp)"),
        shares: z
          .string()
          .describe("Number of shares to price (integer, smallest unit)"),
        side: z
          .number()
          .min(0)
          .max(1)
          .describe("0 = YES shares, 1 = NO shares"),
      },
    },
    async ({ market_id, shares, side }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const result = await callReadOnly("get-buy-price", [
          uintCV(BigInt(market_id)),
          uintCV(BigInt(shares)),
          uintCV(BigInt(side)),
        ]);

        const cost = parseUintResult(result);
        return createJsonResponse({
          network: NETWORK,
          market_id,
          shares,
          side: side === 0 ? "YES" : "NO",
          cost_ustx: cost,
          cost_stx: cost / 1_000_000,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_quote_sell
  // ==========================================================================

  server.registerTool(
    "stacks_market_quote_sell",
    {
      description: `Get an LMSR sell price quote for YES or NO shares on a Stacks Market prediction market.

Returns the proceeds in micro-STX for selling the requested number of shares.
Side: 0 = YES, 1 = NO.

Note: Stacks Market is only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp)"),
        shares: z
          .string()
          .describe("Number of shares to price (integer, smallest unit)"),
        side: z
          .number()
          .min(0)
          .max(1)
          .describe("0 = YES shares, 1 = NO shares"),
      },
    },
    async ({ market_id, shares, side }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const result = await callReadOnly("get-sell-price", [
          uintCV(BigInt(market_id)),
          uintCV(BigInt(shares)),
          uintCV(BigInt(side)),
        ]);

        const proceeds = parseUintResult(result);
        return createJsonResponse({
          network: NETWORK,
          market_id,
          shares,
          side: side === 0 ? "YES" : "NO",
          proceeds_ustx: proceeds,
          proceeds_stx: proceeds / 1_000_000,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_buy_yes
  // ==========================================================================

  server.registerTool(
    "stacks_market_buy_yes",
    {
      description: `Buy YES shares in a Stacks Market prediction market.

Uses the buy-yes-auto function with slippage protection via a max-cost cap.
The transaction will fail if the cost exceeds max_cost_ustx.

Requires an unlocked wallet. Only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp)"),
        shares: z
          .string()
          .describe("Number of YES shares to buy (integer, smallest unit)"),
        target_cap_ustx: z
          .string()
          .describe(
            "Target liquidity cap in micro-STX (use current market cap from stacks_market_get)"
          ),
        max_cost_ustx: z
          .string()
          .describe(
            "Maximum cost in micro-STX you are willing to pay (slippage protection)"
          ),
      },
    },
    async ({ market_id, shares, target_cap_ustx, max_cost_ustx }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const result = await callContract(account, {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "buy-yes-auto",
          functionArgs: [
            uintCV(BigInt(market_id)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(target_cap_ustx)),
            uintCV(BigInt(max_cost_ustx)),
          ],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "buy-yes",
          market_id,
          shares,
          max_cost_ustx,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_buy_no
  // ==========================================================================

  server.registerTool(
    "stacks_market_buy_no",
    {
      description: `Buy NO shares in a Stacks Market prediction market.

Uses the buy-no-auto function with slippage protection via a max-cost cap.
The transaction will fail if the cost exceeds max_cost_ustx.

Requires an unlocked wallet. Only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp)"),
        shares: z
          .string()
          .describe("Number of NO shares to buy (integer, smallest unit)"),
        target_cap_ustx: z
          .string()
          .describe(
            "Target liquidity cap in micro-STX (use current market cap from stacks_market_get)"
          ),
        max_cost_ustx: z
          .string()
          .describe(
            "Maximum cost in micro-STX you are willing to pay (slippage protection)"
          ),
      },
    },
    async ({ market_id, shares, target_cap_ustx, max_cost_ustx }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const result = await callContract(account, {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "buy-no-auto",
          functionArgs: [
            uintCV(BigInt(market_id)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(target_cap_ustx)),
            uintCV(BigInt(max_cost_ustx)),
          ],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "buy-no",
          market_id,
          shares,
          max_cost_ustx,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_sell_yes
  // ==========================================================================

  server.registerTool(
    "stacks_market_sell_yes",
    {
      description: `Sell YES shares in a Stacks Market prediction market.

Uses the sell-yes-auto function with a minimum proceeds guard.
The transaction will fail if proceeds fall below min_proceeds_ustx.

Requires an unlocked wallet. Only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp)"),
        shares: z
          .string()
          .describe("Number of YES shares to sell (integer, smallest unit)"),
        min_proceeds_ustx: z
          .string()
          .describe(
            "Minimum acceptable proceeds in micro-STX (slippage protection)"
          ),
      },
    },
    async ({ market_id, shares, min_proceeds_ustx }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const result = await callContract(account, {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "sell-yes-auto",
          functionArgs: [
            uintCV(BigInt(market_id)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(min_proceeds_ustx)),
          ],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "sell-yes",
          market_id,
          shares,
          min_proceeds_ustx,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_sell_no
  // ==========================================================================

  server.registerTool(
    "stacks_market_sell_no",
    {
      description: `Sell NO shares in a Stacks Market prediction market.

Uses the sell-no-auto function with a minimum proceeds guard.
The transaction will fail if proceeds fall below min_proceeds_ustx.

Requires an unlocked wallet. Only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp)"),
        shares: z
          .string()
          .describe("Number of NO shares to sell (integer, smallest unit)"),
        min_proceeds_ustx: z
          .string()
          .describe(
            "Minimum acceptable proceeds in micro-STX (slippage protection)"
          ),
      },
    },
    async ({ market_id, shares, min_proceeds_ustx }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const result = await callContract(account, {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "sell-no-auto",
          functionArgs: [
            uintCV(BigInt(market_id)),
            uintCV(BigInt(shares)),
            uintCV(BigInt(min_proceeds_ustx)),
          ],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "sell-no",
          market_id,
          shares,
          min_proceeds_ustx,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_redeem
  // ==========================================================================

  server.registerTool(
    "stacks_market_redeem",
    {
      description: `Redeem winning shares after a Stacks Market prediction market is resolved.

Call this after the market has been resolved to claim STX for the winning side shares you hold.

Requires an unlocked wallet. Only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp) of the resolved market"),
      },
    },
    async ({ market_id }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const account = await getAccount();
        const result = await callContract(account, {
          contractAddress: MARKET_CONTRACT_ADDRESS,
          contractName: MARKET_CONTRACT_NAME,
          functionName: "redeem",
          functionArgs: [uintCV(BigInt(market_id))],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "redeem",
          market_id,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // stacks_market_get_position
  // ==========================================================================

  server.registerTool(
    "stacks_market_get_position",
    {
      description: `Check YES and NO share balances for an address in a Stacks Market prediction market.

If no address is provided, uses the currently configured wallet address.
No wallet required when an address is explicitly supplied.

Note: Stacks Market is only available on mainnet.`,
      inputSchema: {
        market_id: z
          .string()
          .describe("Market ID (epoch ms timestamp)"),
        address: z
          .string()
          .optional()
          .describe(
            "Stacks address to check position for. Uses configured wallet if not provided."
          ),
      },
    },
    async ({ market_id, address }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stacks Market is only available on mainnet",
            network: NETWORK,
          });
        }

        const walletAddress = address || (await getWalletAddress());

        const hiro = getHiroApi(NETWORK);
        const [yesRes, noRes] = await Promise.all([
          hiro.callReadOnlyFunction(
            MARKET_CONTRACT_ID,
            "get-yes-balance",
            [uintCV(BigInt(market_id)), principalCV(walletAddress)],
            MARKET_CONTRACT_ADDRESS
          ).catch(() => ({ okay: false, result: undefined, cause: "failed" })),
          hiro.callReadOnlyFunction(
            MARKET_CONTRACT_ID,
            "get-no-balance",
            [uintCV(BigInt(market_id)), principalCV(walletAddress)],
            MARKET_CONTRACT_ADDRESS
          ).catch(() => ({ okay: false, result: undefined, cause: "failed" })),
        ]);

        let yesBalance = 0;
        let noBalance = 0;

        if (yesRes.okay && yesRes.result) {
          const hex = yesRes.result.startsWith("0x")
            ? yesRes.result.slice(2)
            : yesRes.result;
          yesBalance = parseUintResult(cvToJSON(deserializeCV(Buffer.from(hex, "hex"))));
        }

        if (noRes.okay && noRes.result) {
          const hex = noRes.result.startsWith("0x")
            ? noRes.result.slice(2)
            : noRes.result;
          noBalance = parseUintResult(cvToJSON(deserializeCV(Buffer.from(hex, "hex"))));
        }

        return createJsonResponse({
          network: NETWORK,
          market_id,
          address: walletAddress,
          position: {
            yes_shares: yesBalance,
            no_shares: noBalance,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
