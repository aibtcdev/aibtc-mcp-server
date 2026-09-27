/**
 * Child inscription tools
 *
 * Parent-child inscriptions per the Ordinals provenance spec.
 * The owner of a parent inscription creates child inscriptions,
 * establishing on-chain provenance.
 *
 * Tools:
 * - estimate_child_inscription_fee: Calculate cost for a child inscription
 * - inscribe_child: Step 1 - Broadcast commit tx for child inscription
 * - inscribe_child_reveal: Step 2 - Broadcast reveal tx after commit confirms
 */

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import {
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  P2TR_OUTPUT_VBYTES,
  P2TR_INPUT_BASE_VBYTES,
  TX_OVERHEAD_VBYTES,
  DUST_THRESHOLD,
  WITNESS_OVERHEAD_VBYTES,
} from "../config/bitcoin-constants.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import { getWalletManager } from "../services/wallet-manager.js";
import type { InscriptionData } from "../transactions/inscription-builder.js";
import { signBtcTransaction } from "../transactions/bitcoin-builder.js";
import {
  buildChildCommitTransaction,
  buildChildRevealTransaction,
  deriveChildRevealScript,
  lookupParentInscription,
} from "../transactions/child-inscription-builder.js";

export function registerChildInscriptionTools(server: McpServer): void {
  // Estimate child inscription fee
  server.registerTool(
    "estimate_child_inscription_fee",
    {
      description:
        "Calculate the total cost (in satoshis) for creating a child inscription. " +
        "Accounts for the extra parent UTXO input and parent return output in the reveal transaction. " +
        "Content should be provided as base64-encoded string.",
      inputSchema: z.object({
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
          .describe(
            "Fee rate in sat/vB (optional, defaults to current medium fee)"
          ),
      }),
    },
    async ({ contentType, contentBase64, feeRate }) => {
      try {
        const body = Buffer.from(contentBase64, "base64");

        let actualFeeRate = feeRate;
        if (!actualFeeRate) {
          const mempoolApi = new MempoolApi(NETWORK);
          const fees = await mempoolApi.getFeeEstimates();
          actualFeeRate = fees.halfHourFee;
        }

        // Commit tx size (assuming 1-2 inputs)
        const commitInputs = 2;
        const commitSize =
          TX_OVERHEAD_VBYTES +
          commitInputs * P2WPKH_INPUT_VBYTES +
          P2TR_OUTPUT_VBYTES +
          P2WPKH_OUTPUT_VBYTES;
        const commitFee = Math.ceil(commitSize * actualFeeRate);

        // Reveal tx size: 2 inputs (commit + parent), 2 outputs (parent return + child)
        const revealWitnessSize =
          Math.ceil((body.length / 4) * 1.25) + WITNESS_OVERHEAD_VBYTES;
        const revealSize =
          TX_OVERHEAD_VBYTES +
          P2TR_INPUT_BASE_VBYTES + // commit input (script-path)
          P2TR_INPUT_BASE_VBYTES + // parent input (key-path)
          revealWitnessSize +
          P2TR_OUTPUT_VBYTES * 2; // parent return + child output
        const revealFee = Math.ceil(revealSize * actualFeeRate);

        // Amount locked in reveal output
        const revealAmount = revealFee + DUST_THRESHOLD * 2 + 1000;

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
          note: "This is an estimate. Actual fees may vary based on UTXO selection. Includes extra cost for parent UTXO input and parent return output.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Create child inscription - Step 1: Commit
  server.registerTool(
    "inscribe_child",
    {
      description:
        "Create a child inscription - STEP 1: Broadcast commit transaction.\n\n" +
        "Creates a child inscription linked to a parent, establishing on-chain provenance " +
        "per the Ordinals provenance spec. You must own the parent inscription.\n\n" +
        "This broadcasts the commit tx and returns immediately. After it confirms " +
        "(typically 10-60 min), use `inscribe_child_reveal` to complete.\n\n" +
        "Returns: commitTxid, revealAddress, revealAmount, parentInscriptionId, feeRate",
      inputSchema: z.object({
        contentType: z
          .string()
          .describe(
            "MIME type (e.g., 'text/plain', 'image/png', 'text/html')"
          ),
        contentBase64: z
          .string()
          .describe("Content as base64-encoded string"),
        parentInscriptionId: z
          .string()
          .describe(
            "Parent inscription ID (e.g., 'abc123...i0'). You must own this inscription."
          ),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe(
            "Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or number in sat/vB (default: medium)"
          ),
      }),
    },
    async ({ contentType, contentBase64, parentInscriptionId, feeRate }) => {
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
            new Error(
              "Wallet doesn't have Bitcoin addresses. Use a managed wallet."
            )
          );
        }

        const account = walletManager.getAccount();
        if (
          !account ||
          !account.btcPrivateKey ||
          !account.btcPublicKey ||
          !account.taprootPrivateKey ||
          !account.taprootPublicKey
        ) {
          return createErrorResponse(
            new Error(
              "Bitcoin and Taproot keys not available. Wallet may not be unlocked."
            )
          );
        }

        // Look up parent inscription and validate ownership
        const parentInfo = await lookupParentInscription(parentInscriptionId);

        if (parentInfo.address !== sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              `Parent inscription is owned by ${parentInfo.address}, but your Taproot address is ${sessionInfo.taprootAddress}. You must own the parent inscription.`
            )
          );
        }

        // Decode content
        const body = Buffer.from(contentBase64, "base64");
        const inscription: InscriptionData = { contentType, body };

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
          actualFeeRate =
            feeRate || (await mempoolApi.getFeeEstimates()).halfHourFee;
        }

        // Get UTXOs for funding (from BIP84 address)
        const utxos = await mempoolApi.getUtxos(sessionInfo.btcAddress);
        if (utxos.length === 0) {
          return createErrorResponse(
            new Error(
              `No UTXOs available for address ${sessionInfo.btcAddress}. Send some BTC first.`
            )
          );
        }

        // Build and broadcast commit transaction
        const commitResult = buildChildCommitTransaction({
          utxos,
          inscription,
          parentInscriptionId,
          feeRate: actualFeeRate,
          senderPubKey: account.btcPublicKey,
          senderAddress: sessionInfo.btcAddress,
          network: NETWORK,
        });

        const commitSigned = signBtcTransaction(
          commitResult.tx,
          account.btcPrivateKey
        );
        const commitTxid = await mempoolApi.broadcastTransaction(
          commitSigned.txHex
        );
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        return createJsonResponse({
          status: "commit_broadcast",
          message:
            "Child inscription commit transaction broadcast successfully. " +
            "Wait for confirmation (typically 10-60 min), then call inscribe_child_reveal to complete.",
          commitTxid,
          commitExplorerUrl,
          revealAddress: commitResult.revealAddress,
          revealAmount: commitResult.revealAmount,
          commitFee: commitResult.fee,
          feeRate: actualFeeRate,
          parentInscriptionId,
          parentUtxo: {
            txid: parentInfo.txid,
            vout: parentInfo.vout,
            value: parentInfo.value,
          },
          contentType,
          contentSize: body.length,
          nextStep:
            "After commit confirms, call inscribe_child_reveal with the same contentType, contentBase64, " +
            "parentInscriptionId, plus commitTxid and revealAmount from this response.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Complete child inscription - Step 2: Reveal
  server.registerTool(
    "inscribe_child_reveal",
    {
      description:
        "Complete a child inscription - STEP 2: Broadcast reveal transaction.\n\n" +
        "Call this AFTER the commit transaction from `inscribe_child` has confirmed.\n" +
        "You must provide the same contentType, contentBase64, and parentInscriptionId " +
        "used in the commit step.\n\n" +
        "The reveal tx spends both the commit output and the parent inscription UTXO, " +
        "returning the parent to your address and creating the child inscription.\n\n" +
        "Returns: inscriptionId ({revealTxid}i0), parentInscriptionId on success",
      inputSchema: z.object({
        commitTxid: z
          .string()
          .length(64)
          .describe(
            "Transaction ID of the confirmed commit transaction (from inscribe_child)"
          ),
        revealAmount: z
          .number()
          .positive()
          .describe(
            "Amount in the commit output (from inscribe_child response)"
          ),
        contentType: z
          .string()
          .describe("MIME type (must match the commit step)"),
        contentBase64: z
          .string()
          .describe(
            "Content as base64-encoded string (must match the commit step)"
          ),
        parentInscriptionId: z
          .string()
          .describe(
            "Parent inscription ID (must match the commit step)"
          ),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate for reveal tx (default: medium)"),
      }),
    },
    async ({
      commitTxid,
      revealAmount,
      contentType,
      contentBase64,
      parentInscriptionId,
      feeRate,
    }) => {
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
            new Error(
              "Wallet doesn't have Taproot address. Use a managed wallet."
            )
          );
        }

        const account = walletManager.getAccount();
        if (
          !account ||
          !account.btcPrivateKey ||
          !account.btcPublicKey ||
          !account.taprootPrivateKey ||
          !account.taprootPublicKey
        ) {
          return createErrorResponse(
            new Error(
              "Bitcoin and Taproot keys not available. Wallet may not be unlocked."
            )
          );
        }

        // Look up parent inscription fresh (may have moved since commit)
        const parentInfo = await lookupParentInscription(parentInscriptionId);

        if (parentInfo.address !== sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              `Parent inscription is no longer owned by your wallet. Current owner: ${parentInfo.address}`
            )
          );
        }

        // Reconstruct the inscription and child reveal script
        const body = Buffer.from(contentBase64, "base64");
        const inscription: InscriptionData = { contentType, body };

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
          actualFeeRate =
            feeRate || (await mempoolApi.getFeeEstimates()).halfHourFee;
        }

        // Derive the child reveal script deterministically
        const p2trReveal = deriveChildRevealScript({
          inscription,
          parentInscriptionId,
          senderPubKey: account.btcPublicKey,
          network: NETWORK,
        });

        // Build child reveal transaction
        const revealResult = buildChildRevealTransaction({
          commitTxid,
          commitVout: 0,
          commitAmount: revealAmount,
          revealScript: p2trReveal,
          parentUtxo: {
            txid: parentInfo.txid,
            vout: parentInfo.vout,
            value: parentInfo.value,
          },
          parentOwnerTaprootInternalPubKey: account.taprootPublicKey,
          recipientAddress: sessionInfo.taprootAddress,
          feeRate: actualFeeRate,
          network: NETWORK,
        });

        // Sign both inputs:
        // Input[0] (commit output): script-path → btcPrivateKey
        // Input[1] (parent UTXO): key-path → taprootPrivateKey
        // @scure/btc-signer matches keys to inputs automatically
        revealResult.tx.sign(account.btcPrivateKey);
        revealResult.tx.sign(account.taprootPrivateKey);
        revealResult.tx.finalize();

        const revealTxHex = revealResult.tx.hex;
        const revealTxid = await mempoolApi.broadcastTransaction(revealTxHex);

        const inscriptionId = `${revealTxid}i0`;
        const revealExplorerUrl = getMempoolTxUrl(revealTxid, NETWORK);
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        return createJsonResponse({
          status: "success",
          message: "Child inscription created successfully!",
          inscriptionId,
          parentInscriptionId,
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
          note: "Child inscription will appear at the recipient address once the reveal transaction confirms. The parent inscription has been returned to your address.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
