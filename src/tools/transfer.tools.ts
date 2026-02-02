import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { transferStx, broadcastSignedTransaction } from "../transactions/builder.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";

export function registerTransferTools(server: McpServer): void {
  // Transfer STX
  server.registerTool(
    "transfer_stx",
    {
      description: `Transfer STX tokens to a recipient address. Signs and broadcasts the transaction.

Example: To send 2 STX, use amount "2000000" (micro-STX).
1 STX = 1,000,000 micro-STX`,
      inputSchema: {
        recipient: z.string().describe("The recipient's Stacks address (starts with SP or ST)"),
        amount: z
          .string()
          .describe("Amount in micro-STX (1 STX = 1,000,000 micro-STX). Example: '2000000' for 2 STX"),
        memo: z.string().optional().describe("Optional memo message to include with the transfer"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated."),
      },
    },
    async ({ recipient, amount, memo, fee }) => {
      try {
        const account = await getAccount();
        const resolvedFee = await resolveFee(fee, NETWORK, "token_transfer");
        const result = await transferStx(account, recipient, BigInt(amount), memo, resolvedFee);

        const stxAmount = (BigInt(amount) / BigInt(1000000)).toString();

        return createJsonResponse({
          success: true,
          txid: result.txid,
          from: account.address,
          recipient,
          amount: stxAmount + " STX",
          amountMicroStx: amount,
          memo: memo || null,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Broadcast pre-signed transaction
  server.registerTool(
    "broadcast_transaction",
    {
      description: "Broadcast a pre-signed Stacks transaction to the network.",
      inputSchema: {
        signedTx: z.string().describe("The signed transaction as a hex string"),
      },
    },
    async ({ signedTx }) => {
      try {
        const result = await broadcastSignedTransaction(signedTx, NETWORK);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
