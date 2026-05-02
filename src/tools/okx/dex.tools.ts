/**
 * OKX DEX Aggregator MCP tools (single-chain swap routing).
 *
 * Auth: every tool here calls getOkxCredentials() inside the service layer.
 * If any of the four credentials (api_key, secret, passphrase, project_id)
 * is missing, the tool returns an OkxCredentialsMissingError describing
 * which keys to set via the existing credentials_set tool. Users do not
 * need to provision keys until the first invocation.
 *
 * IMPORTANT: okx_dex_swap_tx returns pre-built transaction data only —
 * it does NOT broadcast. The model must sign and broadcast the returned
 * tx through a wallet (EVM tools or our internal bitcoin-builder).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../../utils/index.js";
import {
  getDexAllTokens,
  getDexApproveTx,
  getDexQuote,
  getDexSupportedChains,
  getDexSwapTx,
} from "../../services/okx/index.js";

const CRED_NOTE =
  "Requires OKX API credentials (set via credentials_set with service='okx' " +
  "for keys api_key, secret, passphrase, project_id). Get keys at " +
  "https://web3.okx.com/onchainos/dev-docs/home/developer-portal.";

export function registerOkxDexTools(server: McpServer): void {
  server.registerTool(
    "okx_dex_supported_chains",
    {
      description:
        "List the chains supported by the OKX DEX aggregator (chainId, chainName, " +
        "DEX router approve address). " + CRED_NOTE,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await getDexSupportedChains();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_dex_tokens",
    {
      description:
        "List all tokens tradeable on the OKX DEX aggregator for a given chainId. " +
        "Returns each token's contract address, decimals, symbol, name, and logo. " +
        CRED_NOTE,
      inputSchema: {
        chainId: z
          .string()
          .describe("Chain id (e.g. '1' for Ethereum, '8453' for Base). " +
            "Call okx_dex_supported_chains first to enumerate."),
      },
    },
    async ({ chainId }) => {
      try {
        const data = await getDexAllTokens(chainId);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_dex_quote",
    {
      description:
        "Get an estimated swap quote across the OKX DEX aggregator's routed liquidity. " +
        "Read-only — returns expected output amount, router path, and gas estimate. " +
        "Does NOT produce a transaction; use okx_dex_swap_tx for that. " + CRED_NOTE,
      inputSchema: {
        chainId: z.string().describe("Chain id"),
        fromTokenAddress: z
          .string()
          .describe("Source token contract address (use the chain's native-token sentinel for ETH/BNB/etc.)"),
        toTokenAddress: z.string().describe("Destination token contract address"),
        amount: z
          .string()
          .describe(
            "Amount in the smallest unit of fromToken (wei for ETH, satoshi for BTC)"
          ),
        slippage: z
          .string()
          .optional()
          .describe("Decimal slippage tolerance, e.g. '0.05' for 5%"),
      },
    },
    async (params) => {
      try {
        const data = await getDexQuote(params);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_dex_swap_tx",
    {
      description:
        "Get a pre-built swap transaction from the OKX DEX aggregator. " +
        "Returns data[0].tx = { data, from, to, value, gas, gasPrice, minReceiveAmount } " +
        "which the caller MUST sign and broadcast through their own wallet. " +
        "This tool does NOT broadcast or claim the swap succeeded. " +
        "For ERC-20 sources, call okx_dex_approve_tx first if allowance is insufficient. " +
        CRED_NOTE,
      inputSchema: {
        chainId: z.string().describe("Chain id"),
        fromTokenAddress: z.string().describe("Source token contract address"),
        toTokenAddress: z.string().describe("Destination token contract address"),
        amount: z.string().describe("Amount in smallest unit of fromToken"),
        slippage: z
          .string()
          .describe("Decimal slippage tolerance, e.g. '0.05' for 5% (required for swap)"),
        userWalletAddress: z
          .string()
          .describe("Address that will execute the swap (recipient = caller by default)"),
        referrerAddress: z
          .string()
          .optional()
          .describe("Optional referrer fee address"),
      },
    },
    async (params) => {
      try {
        const data = await getDexSwapTx(params);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_dex_approve_tx",
    {
      description:
        "Get the calldata required to approve an ERC-20 token for the OKX DEX router. " +
        "Only needed for ERC-20 sources (not native ETH/BNB or BTC). " +
        "Caller signs and broadcasts the returned tx separately. " + CRED_NOTE,
      inputSchema: {
        chainId: z.string().describe("Chain id"),
        tokenContractAddress: z
          .string()
          .describe("ERC-20 token to approve"),
        approveAmount: z
          .string()
          .describe(
            "Approval amount in smallest unit. Use the max uint256 value " +
              "(2^256 - 1) for unlimited approval, or the exact swap amount for tighter scope."
          ),
      },
    },
    async (params) => {
      try {
        const data = await getDexApproveTx(params);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
