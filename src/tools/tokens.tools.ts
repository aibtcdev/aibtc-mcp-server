import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getTokensService } from "../services/tokens.service.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";

export function registerTokenTools(server: McpServer): void {
  // Get token balance
  server.registerTool(
    "get_token_balance",
    {
      description: `Get the balance of any SIP-010 token for a wallet address.

Supports well-known tokens by symbol: sBTC, USDCx, ALEX, DIKO
Or use the full contract ID: address.contract-name`,
      inputSchema: {
        token: z.string().describe("Token symbol (e.g., 'USDCx', 'sBTC') or contract ID"),
        address: z
          .string()
          .optional()
          .describe("Wallet address to check. Uses configured wallet if not provided."),
      },
    },
    async ({ token, address }) => {
      try {
        const tokensService = getTokensService(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const balance = await tokensService.getBalance(token, walletAddress);

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          token: {
            contractId: balance.contractId,
            symbol: balance.symbol,
            name: balance.name,
            decimals: balance.decimals,
          },
          balance: {
            raw: balance.balance,
            formatted: balance.formattedBalance,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Transfer token
  server.registerTool(
    "transfer_token",
    {
      description: `Transfer any SIP-010 token to a recipient address.

Supports well-known tokens by symbol: sBTC, USDCx, ALEX, DIKO
Or use the full contract ID.`,
      inputSchema: {
        token: z.string().describe("Token symbol (e.g., 'USDCx') or contract ID"),
        recipient: z.string().describe("The recipient's Stacks address"),
        amount: z.string().describe("Amount in smallest unit (depends on token decimals)"),
        memo: z.string().optional().describe("Optional memo message (max 34 bytes)"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated."),
      },
    },
    async ({ token, recipient, amount, memo, fee }) => {
      try {
        const tokensService = getTokensService(NETWORK);
        const account = await getAccount();
        const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
        const result = await tokensService.transfer(account, token, recipient, BigInt(amount), memo, resolvedFee);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          from: account.address,
          recipient,
          token,
          amount,
          memo: memo || null,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get token info
  server.registerTool(
    "get_token_info",
    {
      description: "Get metadata for a SIP-010 token (name, symbol, decimals, supply).",
      inputSchema: {
        token: z.string().describe("Token symbol or contract ID"),
      },
    },
    async ({ token }) => {
      try {
        const tokensService = getTokensService(NETWORK);
        const info = await tokensService.getTokenInfo(token);

        if (!info) {
          return createJsonResponse({
            error: "Token metadata not found",
            token,
          });
        }

        return createJsonResponse({
          network: NETWORK,
          ...info,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // List user tokens
  server.registerTool(
    "list_user_tokens",
    {
      description: "List all fungible tokens owned by an address.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Wallet address to check. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        const tokensService = getTokensService(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const tokens = await tokensService.getUserTokens(walletAddress);

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          tokenCount: tokens.length,
          tokens: tokens.map((t) => ({
            contractId: t.asset_identifier,
            balance: t.balance,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get token holders
  server.registerTool(
    "get_token_holders",
    {
      description: "Get the top holders of a SIP-010 token.",
      inputSchema: {
        token: z.string().describe("Token symbol or contract ID"),
        limit: z.number().optional().default(20).describe("Maximum number of holders to return"),
        offset: z.number().optional().default(0).describe("Offset for pagination"),
      },
    },
    async ({ token, limit, offset }) => {
      try {
        const tokensService = getTokensService(NETWORK);
        const result = await tokensService.getTokenHolders(token, { limit, offset });

        return createJsonResponse({
          token,
          network: NETWORK,
          total: result.total,
          holders: result.results,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
