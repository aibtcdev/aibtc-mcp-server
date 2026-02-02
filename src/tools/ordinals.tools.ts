/**
 * Ordinals tools
 *
 * These tools provide Bitcoin ordinals operations:
 * - get_inscription: Fetch and parse inscription content from a reveal transaction
 * - inscribe: Create a new inscription using commit/reveal pattern
 * - estimate_inscription_fee: Calculate total cost for an inscription
 * - get_taproot_address: Get wallet's Taproot address for receiving inscriptions
 *
 * Uses micro-ordinals library to parse and create inscriptions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  InscriptionParser,
  type ParsedInscription,
} from "../services/inscription-parser.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import { getWalletManager } from "../services/wallet-manager.js";
import {
  buildCommitTransaction,
  buildRevealTransaction,
  type InscriptionData,
} from "../transactions/inscription-builder.js";
import { signBtcTransaction } from "../transactions/bitcoin-builder.js";

/**
 * Format inscription data for display
 */
function formatInscription(inscription: ParsedInscription, index: number) {
  return {
    index,
    contentType: inscription.contentType || "unknown",
    size: inscription.body.length,
    bodyBase64: inscription.bodyBase64,
    bodyText:
      inscription.bodyText && inscription.bodyText.length <= 1000
        ? inscription.bodyText
        : inscription.bodyText
          ? `${inscription.bodyText.slice(0, 1000)}... (truncated)`
          : undefined,
    cursed: inscription.cursed || false,
    metadata: {
      pointer: inscription.pointer?.toString(),
      metaprotocol: inscription.metaprotocol,
      contentEncoding: inscription.contentEncoding,
      rune: inscription.rune?.toString(),
      note: inscription.note,
      hasMetadata: !!inscription.metadata,
    },
  };
}

export function registerOrdinalsTools(server: McpServer): void {
  // Get Taproot address for receiving inscriptions
  server.registerTool(
    "get_taproot_address",
    {
      description:
        "Get the wallet's Taproot (P2TR) address for receiving inscriptions. " +
        "This address follows BIP86 derivation (m/86'/0'/0'/0/0) and uses bc1p... (mainnet) or tb1p... (testnet) prefix.",
    },
    async () => {
      try {
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();

        if (!sessionInfo?.taprootAddress) {
          return createErrorResponse(
            new Error(
              "Wallet not unlocked or doesn't have a Taproot address. Use wallet_unlock first."
            )
          );
        }

        return createJsonResponse({
          address: sessionInfo.taprootAddress,
          network: NETWORK,
          purpose: "receive_inscriptions",
          derivationPath: NETWORK === "mainnet" ? "m/86'/0'/0'/0/0" : "m/86'/1'/0'/0/0",
          note: "Use this address to receive inscriptions created by the inscribe tool",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Estimate inscription fee
  server.registerTool(
    "estimate_inscription_fee",
    {
      description:
        "Calculate the total cost (in satoshis) for creating an inscription. " +
        "Returns breakdown of commit fee, reveal fee, and total cost. " +
        "Content should be provided as base64-encoded string.",
      inputSchema: {
        contentType: z
          .string()
          .describe("MIME type (e.g., 'text/plain', 'image/png')"),
        contentBase64: z
          .string()
          .describe("Content as base64-encoded string"),
        feeRate: z
          .number()
          .positive()
          .optional()
          .describe("Fee rate in sat/vB (optional, defaults to current medium fee)"),
        compress: z
          .boolean()
          .optional()
          .describe("Use Brotli compression (default: true)"),
      },
    },
    async ({ contentType, contentBase64, feeRate, compress }) => {
      try {
        // Decode base64 content
        const body = Buffer.from(contentBase64, "base64");

        // Get current fee estimate if not provided
        let actualFeeRate = feeRate;
        if (!actualFeeRate) {
          const mempoolApi = new MempoolApi(NETWORK);
          const fees = await mempoolApi.getFeeEstimates();
          actualFeeRate = fees.halfHourFee;
        }

        // Estimate sizes
        const DUST_THRESHOLD = 546;
        const TX_OVERHEAD = 10.5;
        const P2WPKH_INPUT = 68;
        const P2WPKH_OUTPUT = 31;
        const P2TR_OUTPUT = 43;

        // Commit tx size (assuming 1-2 inputs for simplicity)
        const commitInputs = 2;
        const commitOutputs = 2; // reveal output + change
        const commitSize =
          TX_OVERHEAD + commitInputs * P2WPKH_INPUT + P2TR_OUTPUT + P2WPKH_OUTPUT;
        const commitFee = Math.ceil(commitSize * actualFeeRate);

        // Reveal tx size (1 input with inscription witness + 1 output)
        const revealInputSize = 57.5;
        const revealWitnessSize = Math.ceil(body.length / 4); // Witness at 1/4 weight
        const revealSize = TX_OVERHEAD + revealInputSize + revealWitnessSize + P2TR_OUTPUT;
        const revealFee = Math.ceil(revealSize * actualFeeRate);

        // Amount locked in reveal output
        const revealAmount = revealFee + DUST_THRESHOLD + 1000;

        // Total cost
        const totalCost = commitFee + revealAmount;

        return createJsonResponse({
          contentType,
          contentSize: body.length,
          compressed: compress !== false,
          feeRate: actualFeeRate,
          fees: {
            commitFee,
            revealFee,
            revealAmount,
            totalCost,
          },
          breakdown: `Commit tx: ${commitFee} sats | Reveal amount: ${revealAmount} sats (includes ${revealFee} reveal fee) | Total: ${totalCost} sats`,
          note: "This is an estimate. Actual fees may vary based on UTXO selection.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Create inscription (commit/reveal pattern)
  server.registerTool(
    "inscribe",
    {
      description:
        "Create a Bitcoin inscription using the commit/reveal pattern. " +
        "This is a TWO-STEP process:\n" +
        "1. Commit transaction: Locks funds to a Taproot address\n" +
        "2. Reveal transaction: Spends from commit and inscribes data on-chain\n\n" +
        "The tool handles both steps automatically:\n" +
        "- Builds and broadcasts commit tx\n" +
        "- Waits for commit confirmation (~10 min)\n" +
        "- Builds and broadcasts reveal tx\n" +
        "- Returns inscription ID (reveal txid:0)\n\n" +
        "Content should be base64-encoded. Brotli compression is enabled by default to save fees.",
      inputSchema: {
        contentType: z
          .string()
          .describe("MIME type (e.g., 'text/plain', 'image/png', 'text/html')"),
        contentBase64: z
          .string()
          .describe("Content as base64-encoded string"),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or number in sat/vB (default: medium)"),
        compress: z
          .boolean()
          .optional()
          .describe("Use Brotli compression to reduce size and fees (default: true)"),
      },
    },
    async ({ contentType, contentBase64, feeRate, compress }) => {
      try {
        // Check wallet session
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();

        if (!sessionInfo) {
          return createErrorResponse(
            new Error("Wallet not unlocked. Use wallet_unlock first.")
          );
        }

        if (!sessionInfo.btcAddress || !sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error("Wallet doesn't have Bitcoin addresses. Use a managed wallet.")
          );
        }

        // Get account with keys
        const account = walletManager.getAccount();
        if (!account || !account.btcPrivateKey || !account.btcPublicKey) {
          return createErrorResponse(
            new Error("Bitcoin keys not available. Wallet may not be unlocked.")
          );
        }

        // Decode content
        const body = Buffer.from(contentBase64, "base64");
        const inscription: InscriptionData = {
          contentType,
          body,
          compress: compress !== false,
        };

        // Get fee rate
        const mempoolApi = new MempoolApi(NETWORK);
        let actualFeeRate: number;

        if (typeof feeRate === "string") {
          const fees = await mempoolApi.getFeeEstimates();
          switch (feeRate) {
            case "fast":
              actualFeeRate = fees.fastestFee;
              break;
            case "slow":
              actualFeeRate = fees.hourFee;
              break;
            default:
              actualFeeRate = fees.halfHourFee;
          }
        } else {
          actualFeeRate = feeRate || (await mempoolApi.getFeeEstimates()).halfHourFee;
        }

        // Get UTXOs for funding
        const utxos = await mempoolApi.getUtxos(sessionInfo.btcAddress);
        if (utxos.length === 0) {
          return createErrorResponse(
            new Error(
              `No UTXOs available for address ${sessionInfo.btcAddress}. Send some BTC first.`
            )
          );
        }

        // STEP 1: Build and broadcast commit transaction
        const commitResult = buildCommitTransaction({
          utxos,
          inscription,
          feeRate: actualFeeRate,
          senderPubKey: account.btcPublicKey,
          senderAddress: sessionInfo.btcAddress,
          network: NETWORK,
        });

        const commitSigned = signBtcTransaction(commitResult.tx, account.btcPrivateKey);
        const commitTxid = await mempoolApi.broadcastTransaction(commitSigned.txHex);

        // STEP 2: Wait for commit confirmation
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        // Poll for confirmation (max 30 minutes)
        const maxPollTime = 30 * 60 * 1000; // 30 minutes
        const pollInterval = 10 * 1000; // 10 seconds
        const startTime = Date.now();
        let commitConfirmed = false;

        while (Date.now() - startTime < maxPollTime) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          try {
            const commitUtxos = await mempoolApi.getUtxos(commitResult.revealAddress);
            const commitUtxo = commitUtxos.find(
              (u) => u.txid === commitTxid && u.vout === 0
            );

            if (commitUtxo?.status.confirmed) {
              commitConfirmed = true;
              break;
            }
          } catch {
            // Continue polling
          }
        }

        if (!commitConfirmed) {
          return createJsonResponse({
            status: "commit_pending",
            message:
              "Commit transaction broadcast but not confirmed yet. " +
              "The reveal transaction will need to be broadcast manually once confirmed.",
            commitTxid,
            commitExplorerUrl,
            revealAddress: commitResult.revealAddress,
            note: "Check the explorer URL and wait for confirmation, then use a separate tool to broadcast the reveal transaction.",
          });
        }

        // STEP 3: Build and broadcast reveal transaction
        const revealResult = buildRevealTransaction({
          commitTxid,
          commitVout: 0,
          commitAmount: commitResult.revealAmount,
          revealScript: commitResult.revealScript,
          recipientAddress: sessionInfo.taprootAddress,
          feeRate: actualFeeRate,
          network: NETWORK,
        });

        const revealSigned = signBtcTransaction(revealResult.tx, account.btcPrivateKey);
        const revealTxid = await mempoolApi.broadcastTransaction(revealSigned.txHex);

        // Inscription ID is reveal txid + output index (always 0 for first inscription)
        const inscriptionId = `${revealTxid}i0`;
        const revealExplorerUrl = getMempoolTxUrl(revealTxid, NETWORK);

        return createJsonResponse({
          status: "success",
          message: "Inscription created successfully!",
          inscriptionId,
          contentType,
          contentSize: body.length,
          compressed: compress !== false,
          commit: {
            txid: commitTxid,
            fee: commitResult.fee,
            explorerUrl: commitExplorerUrl,
          },
          reveal: {
            txid: revealTxid,
            fee: revealResult.fee,
            explorerUrl: revealExplorerUrl,
          },
          totalCost: commitResult.fee + commitResult.revealAmount,
          recipientAddress: sessionInfo.taprootAddress,
          note: "Inscription will appear at the recipient address once the reveal transaction confirms.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get inscription from transaction
  server.registerTool(
    "get_inscription",
    {
      description:
        "Get inscription content from a Bitcoin reveal transaction. " +
        "Fetches the transaction from mempool.space and parses inscription data from the witness. " +
        "Returns content type, body (as base64 and text if applicable), and metadata tags.",
      inputSchema: {
        txid: z
          .string()
          .length(64)
          .describe(
            "Transaction ID of the reveal transaction containing the inscription"
          ),
      },
    },
    async ({ txid }) => {
      try {
        const parser = new InscriptionParser(NETWORK);
        const inscriptions = await parser.getInscriptionsFromTx(txid);

        if (!inscriptions || inscriptions.length === 0) {
          return createJsonResponse({
            txid,
            network: NETWORK,
            explorerUrl: getMempoolTxUrl(txid, NETWORK),
            found: false,
            message: "No inscriptions found in this transaction",
          });
        }

        return createJsonResponse({
          txid,
          network: NETWORK,
          explorerUrl: getMempoolTxUrl(txid, NETWORK),
          found: true,
          count: inscriptions.length,
          inscriptions: inscriptions.map((ins, idx) =>
            formatInscription(ins, idx)
          ),
        });
      } catch (error) {
        if (error instanceof Error) {
          return createErrorResponse(
            `Failed to get inscription: ${error.message}`
          );
        }
        return createErrorResponse(
          `Failed to get inscription: ${String(error)}`
        );
      }
    }
  );
}
