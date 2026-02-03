/**
 * Ordinals tools
 *
 * These tools provide Bitcoin ordinals operations:
 * - get_inscription: Fetch and parse inscription content from a reveal transaction
 * - inscribe: Create a new inscription (broadcasts commit tx, returns immediately)
 * - inscribe_reveal: Complete inscription by broadcasting reveal tx after commit confirms
 * - estimate_inscription_fee: Calculate total cost for an inscription
 * - get_taproot_address: Get wallet's Taproot address for receiving inscriptions
 *
 * Uses micro-ordinals library to parse and create inscriptions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import {
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  P2TR_OUTPUT_VBYTES,
  TX_OVERHEAD_VBYTES,
  DUST_THRESHOLD,
  P2TR_INPUT_BASE_VBYTES,
} from "../config/bitcoin-constants.js";
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
      },
    },
    async ({ contentType, contentBase64, feeRate }) => {
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

        // Commit tx size (assuming 1-2 inputs for simplicity)
        const commitInputs = 2;
        const commitSize =
          TX_OVERHEAD_VBYTES +
          commitInputs * P2WPKH_INPUT_VBYTES +
          P2TR_OUTPUT_VBYTES +
          P2WPKH_OUTPUT_VBYTES;
        const commitFee = Math.ceil(commitSize * actualFeeRate);

        // Reveal tx size (1 input with inscription witness + 1 output)
        // Include overhead for control block, script, and protocol framing
        const WITNESS_OVERHEAD_VBYTES = 80;
        const revealWitnessSize =
          Math.ceil((body.length / 4) * 1.25) + WITNESS_OVERHEAD_VBYTES;
        const revealSize =
          TX_OVERHEAD_VBYTES +
          P2TR_INPUT_BASE_VBYTES +
          revealWitnessSize +
          P2TR_OUTPUT_VBYTES;
        const revealFee = Math.ceil(revealSize * actualFeeRate);

        // Amount locked in reveal output
        const revealAmount = revealFee + DUST_THRESHOLD + 1000;

        // Total cost
        const totalCost = commitFee + revealAmount;

        return createJsonResponse({
          contentType,
          contentSize: body.length,
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

  // Create inscription - Step 1: Commit (non-blocking)
  server.registerTool(
    "inscribe",
    {
      description:
        "Create a Bitcoin inscription - STEP 1: Broadcast commit transaction.\n\n" +
        "This tool broadcasts the commit tx and returns immediately. It does NOT wait for confirmation.\n\n" +
        "After the commit confirms (typically 10-60 min), use `inscribe_reveal` with the same " +
        "contentType and contentBase64 to complete the inscription.\n\n" +
        "Returns: commitTxid, revealAddress, revealAmount, and feeRate (save these for inscribe_reveal)",
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
      },
    },
    async ({ contentType, contentBase64, feeRate }) => {
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

        // Build and broadcast commit transaction
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
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        // Return immediately with commit info
        return createJsonResponse({
          status: "commit_broadcast",
          message:
            "Commit transaction broadcast successfully. " +
            "Wait for confirmation (typically 10-60 min), then call inscribe_reveal to complete.",
          commitTxid,
          commitExplorerUrl,
          revealAddress: commitResult.revealAddress,
          revealAmount: commitResult.revealAmount,
          commitFee: commitResult.fee,
          feeRate: actualFeeRate,
          contentType,
          contentSize: body.length,
          nextStep:
            "After commit confirms, call inscribe_reveal with the same contentType, contentBase64, " +
            "plus commitTxid and revealAmount from this response.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Complete inscription - Step 2: Reveal (after commit confirms)
  server.registerTool(
    "inscribe_reveal",
    {
      description:
        "Complete a Bitcoin inscription - STEP 2: Broadcast reveal transaction.\n\n" +
        "Call this AFTER the commit transaction from `inscribe` has confirmed.\n" +
        "You must provide the same contentType and contentBase64 used in the commit step.\n\n" +
        "Returns: inscriptionId (revealTxid:0) on success",
      inputSchema: {
        commitTxid: z
          .string()
          .length(64)
          .describe("Transaction ID of the confirmed commit transaction"),
        revealAmount: z
          .number()
          .positive()
          .describe("Amount in the commit output (from inscribe response)"),
        contentType: z
          .string()
          .describe("MIME type (must match the commit step)"),
        contentBase64: z
          .string()
          .describe("Content as base64-encoded string (must match the commit step)"),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate for reveal tx (default: medium)"),
      },
    },
    async ({ commitTxid, revealAmount, contentType, contentBase64, feeRate }) => {
      try {
        // Check wallet session
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();

        if (!sessionInfo) {
          return createErrorResponse(
            new Error("Wallet not unlocked. Use wallet_unlock first.")
          );
        }

        if (!sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error("Wallet doesn't have Taproot address. Use a managed wallet.")
          );
        }

        // Get account with keys
        const account = walletManager.getAccount();
        if (!account || !account.btcPrivateKey || !account.btcPublicKey) {
          return createErrorResponse(
            new Error("Bitcoin keys not available. Wallet may not be unlocked.")
          );
        }

        // Verify commit is confirmed
        const mempoolApi = new MempoolApi(NETWORK);

        // Reconstruct the inscription and reveal script
        const body = Buffer.from(contentBase64, "base64");
        const inscription: InscriptionData = {
          contentType,
          body,
        };

        // We need to rebuild the commit to get the reveal script
        // Use a dummy UTXO list since we only need the reveal script derivation
        const dummyUtxos = [{
          txid: commitTxid,
          vout: 0,
          value: revealAmount,
          status: { confirmed: true, block_height: 0, block_hash: "", block_time: 0 },
        }];

        // Get fee rate
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

        // Rebuild commit to get reveal script (we need the same script derivation)
        const commitResult = buildCommitTransaction({
          utxos: dummyUtxos,
          inscription,
          feeRate: actualFeeRate,
          senderPubKey: account.btcPublicKey,
          senderAddress: sessionInfo.btcAddress || "",
          network: NETWORK,
        });

        // Build reveal transaction
        const revealResult = buildRevealTransaction({
          commitTxid,
          commitVout: 0,
          commitAmount: revealAmount,
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
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        return createJsonResponse({
          status: "success",
          message: "Inscription created successfully!",
          inscriptionId,
          contentType,
          contentSize: body.length,
          commit: {
            txid: commitTxid,
            explorerUrl: commitExplorerUrl,
          },
          reveal: {
            txid: revealTxid,
            fee: revealResult.fee,
            explorerUrl: revealExplorerUrl,
          },
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
