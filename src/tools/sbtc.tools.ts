import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getSbtcService } from "../services/sbtc.service.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";

export function registerSbtcTools(server: McpServer): void {
  // Get sBTC balance
  server.registerTool(
    "sbtc_get_balance",
    {
      description: "Get the sBTC balance for a wallet address.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Wallet address to check. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        const sbtcService = getSbtcService(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const balance = await sbtcService.getBalance(walletAddress);

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          balance: {
            sats: balance.balanceSats,
            btc: balance.balanceBtc + " sBTC",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Transfer sBTC
  server.registerTool(
    "sbtc_transfer",
    {
      description: `Transfer sBTC tokens to a recipient address.

sBTC uses 8 decimals (same as Bitcoin).
Example: To send 0.001 sBTC, use amount "100000" (satoshis).`,
      inputSchema: {
        recipient: z.string().describe("The recipient's Stacks address"),
        amount: z.string().describe("Amount in satoshis (0.00000001 sBTC). Example: '100000' for 0.001 sBTC"),
        memo: z.string().optional().describe("Optional memo message"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated."),
      },
    },
    async ({ recipient, amount, memo, fee }) => {
      try {
        const sbtcService = getSbtcService(NETWORK);
        const account = await getAccount();
        const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
        const result = await sbtcService.transfer(account, recipient, BigInt(amount), memo, resolvedFee);

        const btcAmount = (BigInt(amount) / BigInt(100_000_000)).toString();

        return createJsonResponse({
          success: true,
          txid: result.txid,
          from: account.address,
          recipient,
          amount: btcAmount + " sBTC",
          amountSats: amount,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get sBTC deposit info
  server.registerTool(
    "sbtc_get_deposit_info",
    {
      description: "Get information about how to deposit BTC to receive sBTC.",
    },
    async () => {
      try {
        const sbtcService = getSbtcService(NETWORK);
        const depositInfo = await sbtcService.getDepositInfo();

        return createJsonResponse({
          network: NETWORK,
          ...depositInfo,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get sBTC peg info
  server.registerTool(
    "sbtc_get_peg_info",
    {
      description: "Get sBTC peg information including total supply and peg ratio.",
    },
    async () => {
      try {
        const sbtcService = getSbtcService(NETWORK);
        const pegInfo = await sbtcService.getPegInfo();

        return createJsonResponse({
          network: NETWORK,
          totalSupply: {
            sats: pegInfo.totalSupplySats,
            btc: pegInfo.totalSupplyBtc + " sBTC",
          },
          pegRatio: pegInfo.pegRatio,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

}
