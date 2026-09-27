/**
 * Runes tools
 *
 * MCP tools for the Bitcoin Runes protocol — a Bitcoin-native fungible token
 * standard introduced by Casey Rodarmor.
 *
 * Read-only tools (Hiro Runes API):
 * - runes_list_etchings: List all rune etchings with pagination
 * - runes_get_etching: Get details for a specific rune by name or numeric ID
 * - runes_get_holders: Get holder list for a rune
 * - runes_get_activity: Get recent mint/transfer/burn activity for a rune
 * - runes_get_address_balances: Get all rune balances for a Bitcoin address
 * - runes_get_address_activity: Get rune activity for a Bitcoin address
 *
 * Wallet tools (Unisat API — requires UNISAT_API_KEY):
 * - get_rune_balances: Fetch rune token balances at a Bitcoin address
 * - get_rune_utxos: List UTXOs containing a specific rune (block:tx format)
 * - transfer_rune: Transfer runes via Runestone OP_RETURN encoding
 *
 * Set HIRO_API_KEY to increase Hiro rate limits.
 * Set UNISAT_API_KEY for Unisat indexer access (5 req/s free tier).
 */

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { NETWORK, getApiBaseUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getHiroApiKey } from "../utils/storage.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { MempoolApi, getMempoolAddressUrl, getMempoolTxUrl } from "../services/mempool-api.js";
import { UnisatIndexer } from "../services/unisat-indexer.js";
import { buildRuneTransfer, signRuneTransfer } from "../transactions/rune-transfer-builder.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRuneAmount(amount: string, divisibility: number, symbol: string): string {
  if (divisibility === 0) return `${amount} ${symbol}`;
  const num = BigInt(amount);
  const divisor = 10n ** BigInt(divisibility);
  const whole = num / divisor;
  const frac = num % divisor;
  const fracStr = frac.toString().padStart(divisibility, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr} ${symbol}` : `${whole} ${symbol}`;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function runesApiFetch<T>(path: string): Promise<T> {
  const apiKey = (await getHiroApiKey()) || process.env.HIRO_API_KEY || "";
  const baseUrl = getApiBaseUrl(NETWORK);
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { "x-hiro-api-key": apiKey } : {}),
  };

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hiro Runes API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerRunesTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // runes_list_etchings — List all rune etchings
  // --------------------------------------------------------------------------
  server.registerTool(
    "runes_list_etchings",
    {
      description:
        "List all Bitcoin Rune etchings (token deployments) with pagination.\n\n" +
        "Returns rune names, IDs, supply, divisibility, symbol, etching transaction, " +
        "and other metadata for each rune.\n\n" +
        "Use runes_get_etching to get full details on a specific rune.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Number of results to return (1-60, default: 20)"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Number of results to skip for pagination (default: 0)"),
      }),
    },
    async ({ limit = 20, offset = 0 }) => {
      try {
        const data = await runesApiFetch(
          `/runes/v1/etchings?limit=${limit}&offset=${offset}`
        );
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // runes_get_etching — Get a specific rune by name or ID
  // --------------------------------------------------------------------------
  server.registerTool(
    "runes_get_etching",
    {
      description:
        "Get details for a specific Bitcoin Rune by its name or numeric ID.\n\n" +
        "Returns name, ID, supply info, divisibility, symbol, etching transaction, " +
        "cenotaph status, terms (mint conditions), and turbo flag.\n\n" +
        "Rune names use spacers (e.g., 'UNCOMMONGOODS' or 'UNCOMMON•GOODS').",
      inputSchema: z.object({
        rune: z
          .string()
          .describe(
            "Rune name (e.g., 'UNCOMMONGOODS' or 'UNCOMMON•GOODS') or numeric rune ID"
          ),
      }),
    },
    async ({ rune }) => {
      try {
        const encoded = encodeURIComponent(rune);
        const data = await runesApiFetch(`/runes/v1/etchings/${encoded}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // runes_get_holders — Get holders of a rune
  // --------------------------------------------------------------------------
  server.registerTool(
    "runes_get_holders",
    {
      description:
        "Get the list of holders for a specific Bitcoin Rune.\n\n" +
        "Returns Bitcoin addresses and their rune balances, sorted by balance descending.\n\n" +
        "Supports pagination for runes with many holders.",
      inputSchema: z.object({
        rune: z
          .string()
          .describe(
            "Rune name (e.g., 'UNCOMMONGOODS' or 'UNCOMMON•GOODS') or numeric rune ID"
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Number of results to return (1-60, default: 20)"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Number of results to skip for pagination (default: 0)"),
      }),
    },
    async ({ rune, limit = 20, offset = 0 }) => {
      try {
        const encoded = encodeURIComponent(rune);
        const data = await runesApiFetch(
          `/runes/v1/etchings/${encoded}/holders?limit=${limit}&offset=${offset}`
        );
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // runes_get_activity — Get recent activity for a rune
  // --------------------------------------------------------------------------
  server.registerTool(
    "runes_get_activity",
    {
      description:
        "Get recent on-chain activity (mints, transfers, burns) for a specific Bitcoin Rune.\n\n" +
        "Returns transaction events with amounts, addresses, block heights, and timestamps.\n\n" +
        "Useful for monitoring rune distribution and trading activity.",
      inputSchema: z.object({
        rune: z
          .string()
          .describe(
            "Rune name (e.g., 'UNCOMMONGOODS' or 'UNCOMMON•GOODS') or numeric rune ID"
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Number of results to return (1-60, default: 20)"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Number of results to skip for pagination (default: 0)"),
      }),
    },
    async ({ rune, limit = 20, offset = 0 }) => {
      try {
        const encoded = encodeURIComponent(rune);
        const data = await runesApiFetch(
          `/runes/v1/etchings/${encoded}/activity?limit=${limit}&offset=${offset}`
        );
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // runes_get_address_balances — Get rune balances for a Bitcoin address
  // --------------------------------------------------------------------------
  server.registerTool(
    "runes_get_address_balances",
    {
      description:
        "Get all Bitcoin Rune balances for a Bitcoin address.\n\n" +
        "Returns each rune the address holds along with its balance, divisibility, " +
        "and symbol. Useful for checking which runes a wallet owns.\n\n" +
        "Address can be any Bitcoin address format (P2WPKH bc1q..., P2TR bc1p..., legacy 1..., etc.)",
      inputSchema: z.object({
        address: z
          .string()
          .describe("Bitcoin address to check rune balances for"),
      }),
    },
    async ({ address }) => {
      try {
        const encoded = encodeURIComponent(address);
        const data = await runesApiFetch(
          `/runes/v1/addresses/${encoded}/balances`
        );
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // runes_get_address_activity — Get rune activity for a Bitcoin address
  // --------------------------------------------------------------------------
  server.registerTool(
    "runes_get_address_activity",
    {
      description:
        "Get Bitcoin Rune transaction activity for a specific Bitcoin address.\n\n" +
        "Returns mints received, transfers sent/received, and burns associated with " +
        "this address across all runes.\n\n" +
        "Address can be any Bitcoin address format (P2WPKH bc1q..., P2TR bc1p..., legacy 1..., etc.)",
      inputSchema: z.object({
        address: z
          .string()
          .describe("Bitcoin address to query rune activity for"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Number of results to return (1-60, default: 20)"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Number of results to skip for pagination (default: 0)"),
      }),
    },
    async ({ address, limit = 20, offset = 0 }) => {
      try {
        const encoded = encodeURIComponent(address);
        const data = await runesApiFetch(
          `/runes/v1/addresses/${encoded}/activity?limit=${limit}&offset=${offset}`
        );
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // get_rune_balances — Unisat: on-chain rune balances at a Bitcoin address
  // --------------------------------------------------------------------------
  server.registerTool(
    "get_rune_balances",
    {
      description:
        "Fetch all rune token balances held at a Bitcoin address via the Unisat indexer.\n\n" +
        "Returns rune IDs, amounts, symbols, and divisibility for all runes at the address.\n\n" +
        "If no address is provided, uses the active wallet's Taproot address.\n" +
        "Set UNISAT_API_KEY for higher rate limits (5 req/s on free tier).",
      inputSchema: z.object({
        address: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to check (uses active wallet's Taproot address if omitted)"
          ),
      }),
    },
    async ({ address }) => {
      try {
        let resolvedAddress = address;

        if (!resolvedAddress) {
          const walletManager = getWalletManager();
          const sessionInfo = walletManager.getSessionInfo();
          if (!sessionInfo?.taprootAddress) {
            return createErrorResponse(
              new Error(
                "No address provided and wallet is not unlocked. " +
                  "Either provide an address or unlock your wallet first."
              )
            );
          }
          resolvedAddress = sessionInfo.taprootAddress;
        }

        const indexer = new UnisatIndexer(NETWORK);
        const balances = await indexer.getRuneBalances(resolvedAddress);

        const formattedBalances = balances.map((b) => ({
          rune: b.rune,
          runeId: b.runeid,
          spacedRune: b.spacedRune,
          amount: b.amount,
          formatted: formatRuneAmount(b.amount, b.divisibility, b.symbol),
          symbol: b.symbol,
          divisibility: b.divisibility,
        }));

        return createJsonResponse({
          address: resolvedAddress,
          network: NETWORK,
          balances: formattedBalances,
          summary: { runeCount: balances.length },
          explorerUrl: getMempoolAddressUrl(resolvedAddress, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // get_rune_utxos — Unisat: list UTXOs containing a specific rune
  // --------------------------------------------------------------------------
  server.registerTool(
    "get_rune_utxos",
    {
      description:
        "List UTXOs containing a specific rune at a Bitcoin address via the Unisat indexer.\n\n" +
        "Rune ID format: 'block:tx' (e.g., '840000:1' for UNCOMMONGOODS).\n\n" +
        "If no address is provided, uses the active wallet's Taproot address.",
      inputSchema: z.object({
        runeId: z
          .string()
          .describe("Rune ID in 'block:tx' format (e.g., '840000:1')"),
        address: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to check (uses active wallet's Taproot address if omitted)"
          ),
      }),
    },
    async ({ runeId, address }) => {
      try {
        let resolvedAddress = address;

        if (!resolvedAddress) {
          const walletManager = getWalletManager();
          const sessionInfo = walletManager.getSessionInfo();
          if (!sessionInfo?.taprootAddress) {
            return createErrorResponse(
              new Error(
                "No address provided and wallet is not unlocked. " +
                  "Either provide an address or unlock your wallet first."
              )
            );
          }
          resolvedAddress = sessionInfo.taprootAddress;
        }

        const indexer = new UnisatIndexer(NETWORK);
        const utxos = await indexer.getRuneUtxos(resolvedAddress, runeId);

        const formattedUtxos = utxos.map((u) => ({
          txid: u.txid,
          vout: u.vout,
          satoshis: u.satoshi,
          address: u.address,
          height: u.height,
          runes: u.runes.map((r) => ({
            runeId: r.runeid,
            spacedRune: r.spacedRune,
            amount: r.amount,
            formatted: formatRuneAmount(r.amount, r.divisibility, r.symbol),
            symbol: r.symbol,
          })),
        }));

        return createJsonResponse({
          address: resolvedAddress,
          network: NETWORK,
          runeId,
          utxos: formattedUtxos,
          summary: {
            utxoCount: utxos.length,
            totalSatoshis: utxos.reduce((sum, u) => sum + u.satoshi, 0),
          },
          explorerUrl: getMempoolAddressUrl(resolvedAddress, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // transfer_rune — build and broadcast a rune transfer via Runestone OP_RETURN
  // --------------------------------------------------------------------------
  server.registerTool(
    "transfer_rune",
    {
      description:
        "Transfer runes to a recipient address using Runestone OP_RETURN encoding.\n\n" +
        "Builds a Bitcoin transaction with a Runestone, sends runes to the recipient, " +
        "and returns remaining runes to the sender Taproot address.\n\n" +
        "Requires wallet to be unlocked. Amount is in smallest rune units (raw integer).\n" +
        "Uses Unisat indexer to fetch rune UTXOs (UNISAT_API_KEY recommended).",
      inputSchema: z.object({
        runeId: z
          .string()
          .describe("Rune ID in 'block:tx' format (e.g., '840000:1')"),
        amount: z
          .string()
          .describe("Amount of runes to transfer in smallest unit (integer string, e.g., '1000')"),
        toAddress: z
          .string()
          .describe("Recipient Bitcoin address"),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe(
            "Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or sat/vB number (default: medium)"
          ),
      }),
    },
    async ({ runeId, amount, toAddress, feeRate }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getAccount();

        if (!account) {
          return createErrorResponse(
            new Error("Wallet is not unlocked. Use wallet_unlock first.")
          );
        }

        if (
          !account.btcAddress ||
          !account.btcPrivateKey ||
          !account.btcPublicKey ||
          !account.taprootPrivateKey ||
          !account.taprootPublicKey ||
          !account.taprootAddress
        ) {
          return createErrorResponse(
            new Error(
              "Bitcoin and Taproot keys not available. Please unlock your wallet again."
            )
          );
        }

        const transferAmount = BigInt(amount);
        if (transferAmount <= 0n) {
          return createErrorResponse(new Error("amount must be a positive integer"));
        }

        const indexer = new UnisatIndexer(NETWORK);
        const mempoolApi = new MempoolApi(NETWORK);

        // Resolve fee rate
        let actualFeeRate: number;
        if (typeof feeRate === "string" || feeRate === undefined) {
          const fees = await mempoolApi.getFeeEstimates();
          if (!feeRate || feeRate === "medium") actualFeeRate = fees.halfHourFee;
          else if (feeRate === "fast") actualFeeRate = fees.fastestFee;
          else actualFeeRate = fees.hourFee;
        } else {
          actualFeeRate = feeRate;
        }

        const runeUtxos = await indexer.getRuneUtxos(account.taprootAddress, runeId);
        if (runeUtxos.length === 0) {
          return createErrorResponse(
            new Error(
              `No UTXOs found for rune ${runeId} at address ${account.taprootAddress}`
            )
          );
        }

        const runeUtxosFormatted = runeUtxos.map((u) => ({
          txid: u.txid,
          vout: u.vout,
          value: u.satoshi,
          status: { confirmed: true, block_height: u.height, block_hash: "", block_time: 0 },
        }));

        const cardinalUtxos = await indexer.getCardinalUtxos(account.btcAddress);
        if (cardinalUtxos.length === 0) {
          return createErrorResponse(
            new Error(
              `No cardinal UTXOs available at ${account.btcAddress} to pay fees. ` +
                `Send some BTC to your SegWit address first.`
            )
          );
        }

        const transferResult = buildRuneTransfer({
          runeId,
          amount: transferAmount,
          runeUtxos: runeUtxosFormatted,
          feeUtxos: cardinalUtxos,
          recipientAddress: toAddress,
          feeRate: actualFeeRate,
          senderPubKey: account.btcPublicKey,
          senderTaprootPubKey: account.taprootPublicKey,
          senderAddress: account.btcAddress,
          senderTaprootAddress: account.taprootAddress,
          network: NETWORK,
        });

        const signed = signRuneTransfer(
          transferResult.tx,
          account.taprootPrivateKey,
          account.btcPrivateKey,
          transferResult.taprootInputIndices,
          transferResult.feeInputIndices
        );

        const txid = await mempoolApi.broadcastTransaction(signed.txHex);

        return createJsonResponse({
          success: true,
          txid,
          explorerUrl: getMempoolTxUrl(txid, NETWORK),
          rune: { runeId, amount },
          recipient: toAddress,
          fee: { satoshis: transferResult.fee, rateUsed: `${actualFeeRate} sat/vB` },
          btcChange: { satoshis: transferResult.btcChange },
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
