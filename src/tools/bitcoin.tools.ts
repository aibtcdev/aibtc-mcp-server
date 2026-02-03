/**
 * Bitcoin L1 tools
 *
 * These tools provide Bitcoin blockchain operations:
 * - get_btc_balance: Check BTC balance for an address
 * - get_btc_fees: Get current fee estimates
 * - get_btc_utxos: List UTXOs for an address
 * - transfer_btc: Send BTC to a recipient address
 *
 * Data is fetched from mempool.space API (no authentication required).
 * Transfer operations require an unlocked wallet.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";
import {
  MempoolApi,
  getMempoolAddressUrl,
  getMempoolTxUrl,
  type UTXO,
} from "../services/mempool-api.js";
import { buildAndSignBtcTransaction } from "../transactions/bitcoin-builder.js";
import { OrdinalIndexer } from "../services/ordinal-indexer.js";

/**
 * Get the Bitcoin address to use for queries.
 * Prefers the provided address, falls back to wallet's btcAddress.
 */
async function getBtcAddress(providedAddress?: string): Promise<string> {
  if (providedAddress) {
    return providedAddress;
  }

  const walletManager = getWalletManager();
  const sessionInfo = walletManager.getSessionInfo();

  if (sessionInfo?.btcAddress) {
    return sessionInfo.btcAddress;
  }

  throw new Error(
    "No Bitcoin address provided and wallet is not unlocked. " +
      "Either provide an address or unlock your wallet first."
  );
}

/**
 * Format satoshis as BTC string
 */
function formatBtc(satoshis: number): string {
  const btc = satoshis / 100_000_000;
  return btc.toFixed(8).replace(/\.?0+$/, "") + " BTC";
}

/**
 * Format a UTXO for API response
 */
function formatUtxo(utxo: UTXO) {
  return {
    txid: utxo.txid,
    vout: utxo.vout,
    value: {
      satoshis: utxo.value,
      btc: formatBtc(utxo.value),
    },
    confirmed: utxo.status.confirmed,
    blockHeight: utxo.status.block_height,
    blockTime: utxo.status.block_time
      ? new Date(utxo.status.block_time * 1000).toISOString()
      : undefined,
  };
}

/**
 * Summarize a list of UTXOs
 */
function summarizeUtxos(utxos: UTXO[]) {
  const totalValue = utxos.reduce((sum, u) => sum + u.value, 0);
  return {
    count: utxos.length,
    totalValue: {
      satoshis: totalValue,
      btc: formatBtc(totalValue),
    },
    confirmedCount: utxos.filter((u) => u.status.confirmed).length,
    unconfirmedCount: utxos.filter((u) => !u.status.confirmed).length,
  };
}

export function registerBitcoinTools(server: McpServer): void {
  // Get BTC balance
  server.registerTool(
    "get_btc_balance",
    {
      description:
        "Get the BTC balance for a Bitcoin address. " +
        "Returns both total balance (including unconfirmed) and confirmed balance.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to check (bc1... for mainnet, tb1... for testnet). " +
              "Uses wallet's Bitcoin address if not provided."
          ),
      },
    },
    async ({ address }) => {
      try {
        const btcAddress = await getBtcAddress(address);
        const api = new MempoolApi(NETWORK);
        const utxos = await api.getUtxos(btcAddress);

        // Calculate total and confirmed balances
        let totalSatoshis = 0;
        let confirmedSatoshis = 0;

        for (const utxo of utxos) {
          totalSatoshis += utxo.value;
          if (utxo.status.confirmed) {
            confirmedSatoshis += utxo.value;
          }
        }

        const unconfirmedSatoshis = totalSatoshis - confirmedSatoshis;

        return createJsonResponse({
          address: btcAddress,
          network: NETWORK,
          balance: {
            satoshis: totalSatoshis,
            btc: formatBtc(totalSatoshis),
          },
          confirmed: {
            satoshis: confirmedSatoshis,
            btc: formatBtc(confirmedSatoshis),
          },
          unconfirmed: {
            satoshis: unconfirmedSatoshis,
            btc: formatBtc(unconfirmedSatoshis),
          },
          utxoCount: utxos.length,
          explorerUrl: getMempoolAddressUrl(btcAddress, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get BTC fee estimates
  server.registerTool(
    "get_btc_fees",
    {
      description:
        "Get current Bitcoin fee estimates for different confirmation targets. " +
        "Returns fast (~10 min), medium (~30 min), and slow (~1 hour) fee rates in sat/vB.",
    },
    async () => {
      try {
        const api = new MempoolApi(NETWORK);
        const tiers = await api.getFeeTiers();
        const fullEstimates = await api.getFeeEstimates();

        return createJsonResponse({
          network: NETWORK,
          fees: {
            fast: {
              satPerVb: tiers.fast,
              target: "~10 minutes (next block)",
            },
            medium: {
              satPerVb: tiers.medium,
              target: "~30 minutes",
            },
            slow: {
              satPerVb: tiers.slow,
              target: "~1 hour",
            },
          },
          economy: {
            satPerVb: fullEstimates.economyFee,
            target: "~24 hours",
          },
          minimum: {
            satPerVb: fullEstimates.minimumFee,
            target: "minimum relay fee",
          },
          unit: "sat/vB",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get BTC UTXOs
  server.registerTool(
    "get_btc_utxos",
    {
      description:
        "List all UTXOs (Unspent Transaction Outputs) for a Bitcoin address. " +
        "Useful for debugging, transparency, and understanding transaction inputs.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to check. Uses wallet's Bitcoin address if not provided."
          ),
        confirmedOnly: z
          .boolean()
          .optional()
          .default(false)
          .describe("Only return confirmed UTXOs (default: false)"),
      },
    },
    async ({ address, confirmedOnly }) => {
      try {
        const btcAddress = await getBtcAddress(address);
        const api = new MempoolApi(NETWORK);
        let utxos = await api.getUtxos(btcAddress);

        if (confirmedOnly) {
          utxos = utxos.filter((u) => u.status.confirmed);
        }

        return createJsonResponse({
          address: btcAddress,
          network: NETWORK,
          utxos: utxos.map(formatUtxo),
          summary: summarizeUtxos(utxos),
          explorerUrl: getMempoolAddressUrl(btcAddress, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Transfer BTC
  server.registerTool(
    "transfer_btc",
    {
      description:
        "Transfer BTC to a recipient address. " +
        "Builds, signs, and broadcasts a Bitcoin transaction. " +
        "Requires an unlocked wallet with BTC balance. " +
        "By default, only uses cardinal UTXOs (safe to spend - no inscriptions). " +
        "Set includeOrdinals=true to allow spending ordinal UTXOs (advanced users only).",
      inputSchema: {
        recipient: z
          .string()
          .describe(
            "Bitcoin address to send to (bc1... for mainnet, tb1... for testnet)"
          ),
        amount: z
          .number()
          .int()
          .positive()
          .describe("Amount to send in satoshis (1 BTC = 100,000,000 satoshis)"),
        feeRate: z
          .union([
            z.enum(["fast", "medium", "slow"]),
            z.number().int().positive(),
          ])
          .optional()
          .default("medium")
          .describe(
            "Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or number in sat/vB"
          ),
        includeOrdinals: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Include ordinal UTXOs (contains inscriptions). Default: false (cardinal only). " +
            "WARNING: Setting this to true may destroy valuable inscriptions!"
          ),
      },
    },
    async ({ recipient, amount, feeRate, includeOrdinals }) => {
      try {
        // Get wallet account (requires unlocked wallet)
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();

        if (!account) {
          throw new Error(
            "Wallet is not unlocked. Use wallet_unlock first to enable transactions."
          );
        }

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Please unlock your wallet again."
          );
        }

        // Initialize API and indexer
        const api = new MempoolApi(NETWORK);

        // Fetch UTXOs - use cardinal UTXOs by default for safety
        let utxos: UTXO[];
        let testnetWarning = "";

        if (includeOrdinals) {
          // Power user mode: use all UTXOs
          utxos = await api.getUtxos(account.btcAddress);
        } else {
          // Safe mode: only use cardinal UTXOs (no inscriptions)
          // On testnet, Hiro API is not available, so fall back to all UTXOs
          if (NETWORK === "testnet") {
            utxos = await api.getUtxos(account.btcAddress);
            testnetWarning =
              " Note: Ordinal protection is not available on testnet. All UTXOs were used.";
          } else {
            const indexer = new OrdinalIndexer(NETWORK);
            utxos = await indexer.getCardinalUtxos(account.btcAddress);
          }
        }

        if (utxos.length === 0) {
          const errorMsg = includeOrdinals
            ? `No UTXOs found for address ${account.btcAddress}`
            : `No cardinal UTXOs available for address ${account.btcAddress}. ` +
              `You may have ordinal UTXOs (containing inscriptions). ` +
              `Set includeOrdinals=true to spend them (WARNING: may destroy inscriptions).`;
          throw new Error(errorMsg);
        }

        // Resolve fee rate
        let resolvedFeeRate: number;
        if (typeof feeRate === "number") {
          resolvedFeeRate = feeRate;
        } else {
          const feeTiers = await api.getFeeTiers();
          switch (feeRate) {
            case "fast":
              resolvedFeeRate = feeTiers.fast;
              break;
            case "slow":
              resolvedFeeRate = feeTiers.slow;
              break;
            case "medium":
            default:
              resolvedFeeRate = feeTiers.medium;
              break;
          }
        }

        // Build and sign the transaction
        const txResult = buildAndSignBtcTransaction(
          {
            utxos,
            recipient,
            amount,
            feeRate: resolvedFeeRate,
            senderPubKey: account.btcPublicKey,
            senderAddress: account.btcAddress,
            network: NETWORK,
          },
          account.btcPrivateKey
        );

        // Broadcast the transaction
        const txid = await api.broadcastTransaction(txResult.txHex);

        const response: Record<string, unknown> = {
          success: true,
          txid,
          explorerUrl: getMempoolTxUrl(txid, NETWORK),
          transaction: {
            recipient,
            amount: {
              satoshis: amount,
              btc: formatBtc(amount),
            },
            fee: {
              satoshis: txResult.fee,
              btc: formatBtc(txResult.fee),
              rateUsed: `${resolvedFeeRate} sat/vB`,
            },
            change: {
              satoshis: txResult.change,
              btc: formatBtc(txResult.change),
            },
            vsize: txResult.vsize,
            utxoType: includeOrdinals ? "all" : "cardinal-only",
          },
          sender: account.btcAddress,
          network: NETWORK,
        };

        if (testnetWarning) {
          response.warning = testnetWarning.trim();
        }

        return createJsonResponse(response);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get cardinal UTXOs (safe to spend)
  server.registerTool(
    "get_cardinal_utxos",
    {
      description:
        "Get cardinal UTXOs (safe to spend - no inscriptions). " +
        "Cardinal UTXOs are regular Bitcoin outputs that do not contain ordinal inscriptions. " +
        "These UTXOs can be safely used for regular Bitcoin transfers and fees. " +
        "Only available on mainnet (Hiro Ordinals API does not index testnet).",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to check. Uses wallet's Bitcoin address if not provided."
          ),
        confirmedOnly: z
          .boolean()
          .optional()
          .default(false)
          .describe("Only return confirmed UTXOs (default: false)"),
      },
    },
    async ({ address, confirmedOnly }) => {
      try {
        const btcAddress = await getBtcAddress(address);
        const indexer = new OrdinalIndexer(NETWORK);
        let utxos = await indexer.getCardinalUtxos(btcAddress);

        if (confirmedOnly) {
          utxos = utxos.filter((u) => u.status.confirmed);
        }

        const response: Record<string, unknown> = {
          address: btcAddress,
          network: NETWORK,
          type: "cardinal",
          utxos: utxos.map(formatUtxo),
          summary: summarizeUtxos(utxos),
          explorerUrl: getMempoolAddressUrl(btcAddress, NETWORK),
        };

        if (NETWORK === "testnet") {
          response.warning =
            "Ordinal indexing not available on testnet. All UTXOs shown as cardinal.";
        }

        return createJsonResponse(response);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get ordinal UTXOs (contain inscriptions)
  server.registerTool(
    "get_ordinal_utxos",
    {
      description:
        "Get ordinal UTXOs (contain inscriptions - do not spend). " +
        "Ordinal UTXOs contain Bitcoin inscriptions and should not be spent in regular transfers. " +
        "These UTXOs are valuable as they carry ordinal data (text, images, etc.). " +
        "Only available on mainnet (Hiro Ordinals API does not index testnet).",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to check. Uses wallet's Bitcoin address if not provided."
          ),
        confirmedOnly: z
          .boolean()
          .optional()
          .default(false)
          .describe("Only return confirmed UTXOs (default: false)"),
      },
    },
    async ({ address, confirmedOnly }) => {
      try {
        const btcAddress = await getBtcAddress(address);
        const indexer = new OrdinalIndexer(NETWORK);
        let utxos = await indexer.getOrdinalUtxos(btcAddress);

        if (confirmedOnly) {
          utxos = utxos.filter((u) => u.status.confirmed);
        }

        const response: Record<string, unknown> = {
          address: btcAddress,
          network: NETWORK,
          type: "ordinal",
          utxos: utxos.map(formatUtxo),
          summary: summarizeUtxos(utxos),
          explorerUrl: getMempoolAddressUrl(btcAddress, NETWORK),
        };

        if (NETWORK === "testnet") {
          response.warning =
            "Ordinal indexing not available on testnet. No inscriptions can be detected.";
        }

        return createJsonResponse(response);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get inscriptions by address
  server.registerTool(
    "get_inscriptions_by_address",
    {
      description:
        "Get all inscriptions owned by a Bitcoin address. " +
        "Returns inscription IDs, content types, and metadata. " +
        "Only available on mainnet (Hiro Ordinals API does not index testnet).",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to check. Uses wallet's Bitcoin address if not provided."
          ),
      },
    },
    async ({ address }) => {
      try {
        const btcAddress = await getBtcAddress(address);
        const indexer = new OrdinalIndexer(NETWORK);
        const inscriptions = await indexer.getInscriptionsForAddress(btcAddress);

        // Format inscriptions for response
        const formattedInscriptions = inscriptions.map((ins) => ({
          id: ins.id,
          number: ins.number,
          contentType: ins.content_type,
          contentLength: ins.content_length,
          output: ins.output,
          location: ins.location,
          offset: ins.offset,
          genesis: {
            txid: ins.genesis_tx_id,
            blockHeight: ins.genesis_block_height,
            blockHash: ins.genesis_block_hash,
            timestamp: new Date(ins.genesis_timestamp).toISOString(),
          },
        }));

        return createJsonResponse({
          address: btcAddress,
          network: NETWORK,
          inscriptions: formattedInscriptions,
          summary: {
            count: inscriptions.length,
            contentTypes: [
              ...new Set(inscriptions.map((i) => i.content_type)),
            ].sort(),
          },
          explorerUrl: getMempoolAddressUrl(btcAddress, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
