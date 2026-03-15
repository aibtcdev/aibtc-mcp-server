/**
 * Mempool Watch tools
 *
 * These tools provide read-only Bitcoin mempool monitoring:
 * - get_mempool_info: Current mempool statistics (tx count, vsize, fees)
 * - get_transaction_status: Confirmation status and details for a txid
 * - get_address_txs: Recent transaction history for a Bitcoin address
 *
 * Data is fetched from the public mempool.space API (no authentication required).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  MempoolApi,
  getMempoolTxUrl,
  getMempoolAddressUrl,
  type MempoolTx,
} from "../services/mempool-api.js";

/**
 * Format satoshis as BTC string
 */
function formatBtc(satoshis: number): string {
  const btc = satoshis / 100_000_000;
  return btc.toFixed(8).replace(/\.?0+$/, "") + " BTC";
}

/**
 * Format a MempoolTx for API response (summarized view)
 */
function formatTxSummary(tx: MempoolTx, network: typeof NETWORK) {
  const totalInput = tx.vin.reduce(
    (sum, input) => sum + (input.prevout?.value ?? 0),
    0
  );
  const totalOutput = tx.vout.reduce((sum, output) => sum + output.value, 0);

  return {
    txid: tx.txid,
    confirmed: tx.status.confirmed,
    blockHeight: tx.status.block_height,
    blockTime: tx.status.block_time
      ? new Date(tx.status.block_time * 1000).toISOString()
      : undefined,
    fee: {
      satoshis: tx.fee,
      btc: formatBtc(tx.fee),
    },
    size: {
      bytes: tx.size,
      weight: tx.weight,
      vsize: Math.ceil(tx.weight / 4),
    },
    inputs: tx.vin.length,
    outputs: tx.vout.length,
    totalOutput: {
      satoshis: totalOutput,
      btc: formatBtc(totalOutput),
    },
    explorerUrl: getMempoolTxUrl(tx.txid, network),
  };
}

export function registerMempoolTools(server: McpServer): void {
  // Get mempool info
  server.registerTool(
    "get_mempool_info",
    {
      description:
        "Get current Bitcoin mempool statistics including transaction count, " +
        "virtual size, total fees, and fee histogram. " +
        "Useful for monitoring network congestion and estimating confirmation times.",
      inputSchema: {},
    },
    async () => {
      try {
        const api = new MempoolApi(NETWORK);
        const stats = await api.getMempoolStats();

        return createJsonResponse({
          count: stats.count,
          vsize: stats.vsize,
          totalFeeSats: stats.total_fee,
          totalFeeBtc: formatBtc(stats.total_fee),
          feeHistogram: stats.fee_histogram.slice(0, 10),
          network: NETWORK,
        });
      } catch (err) {
        return createErrorResponse(
          `Failed to get mempool info: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );

  // Get transaction status
  server.registerTool(
    "get_transaction_status",
    {
      description:
        "Get confirmation status and details for a Bitcoin transaction by txid. " +
        "Returns whether the transaction is confirmed, block height, fee, size, and I/O summary. " +
        "Works for both confirmed and unconfirmed (mempool) transactions.",
      inputSchema: {
        txid: z
          .string()
          .describe("Bitcoin transaction ID (64 hex characters)"),
      },
    },
    async ({ txid }) => {
      try {
        const api = new MempoolApi(NETWORK);
        const tx = await api.getTx(txid);

        return createJsonResponse({
          ...formatTxSummary(tx, NETWORK),
          network: NETWORK,
        });
      } catch (err) {
        return createErrorResponse(
          `Failed to get transaction status: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );

  // Get address transaction history
  server.registerTool(
    "get_address_txs",
    {
      description:
        "Get recent transaction history for a Bitcoin address (last 25 transactions). " +
        "Returns a summary of each transaction including confirmation status, fee, and amounts. " +
        "Useful for monitoring address activity and verifying payment receipts.",
      inputSchema: {
        address: z.string().describe("Bitcoin address (e.g. bc1... for mainnet, tb1... for testnet)"),
      },
    },
    async ({ address }) => {
      try {
        const api = new MempoolApi(NETWORK);
        const txs = await api.getAddressTxs(address);

        return createJsonResponse({
          address,
          network: NETWORK,
          count: txs.length,
          transactions: txs.map((tx) => formatTxSummary(tx, NETWORK)),
          explorerUrl: getMempoolAddressUrl(address, NETWORK),
        });
      } catch (err) {
        return createErrorResponse(
          `Failed to get address transactions: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );
}
