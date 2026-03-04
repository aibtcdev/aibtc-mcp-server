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
  WITNESS_OVERHEAD_VBYTES,
} from "../config/bitcoin-constants.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  InscriptionParser,
  type ParsedInscription,
} from "../services/inscription-parser.js";
import { MempoolApi, getMempoolApiUrl, getMempoolTxUrl } from "../services/mempool-api.js";
import { getWalletManager } from "../services/wallet-manager.js";
import {
  buildCommitTransaction,
  buildRevealTransaction,
  deriveRevealScript,
  type InscriptionData,
  type ParentUtxo,
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

const HIRO_ORDINALS_API_URL = "https://api.hiro.so/ordinals/v1";

/**
 * Response shape from Hiro Ordinals API for a single inscription
 */
interface HiroInscriptionDetail {
  id: string;
  number: number;
  genesis_block_height: number;
  genesis_tx_id: string;
  output: string; // "txid:vout"
  value: number;  // satoshis at current location
  address: string;
}

/**
 * Lookup a parent inscription via the Hiro Ordinals API and return its ParentUtxo.
 *
 * The parent UTXO is needed to build a parent/child reveal transaction where the
 * parent inscription is spent as input 0 and returned as output 0.
 *
 * @param inscriptionId - Inscription ID in ordinals format: "{64-hex-txid}i{index}"
 * @param network - Bitcoin network ("mainnet" or "testnet")
 * @returns ParentUtxo with txid, vout, value, and P2TR witnessUtxo script
 * @throws Error if inscription not found, not confirmed, or UTXO script unavailable
 */
async function lookupParentInscription(
  inscriptionId: string,
  network: typeof NETWORK
): Promise<ParentUtxo> {
  // Validate inscription ID format: 64 hex chars + 'i' + non-negative integer
  if (!/^[0-9a-f]{64}i\d+$/.test(inscriptionId)) {
    throw new Error(
      `Invalid inscription ID format: "${inscriptionId}". Expected {64-hex-txid}i{index} (e.g. "abc123...i0")`
    );
  }

  // Fetch inscription details from Hiro Ordinals API
  const hiroUrl = `${HIRO_ORDINALS_API_URL}/inscriptions/${inscriptionId}`;
  const hiroResponse = await fetch(hiroUrl);

  if (hiroResponse.status === 404) {
    throw new Error(`Parent inscription not found: ${inscriptionId}`);
  }

  if (!hiroResponse.ok) {
    const errorText = await hiroResponse.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to lookup parent inscription: ${hiroResponse.status} ${hiroResponse.statusText} - ${errorText}`
    );
  }

  const inscription = (await hiroResponse.json()) as HiroInscriptionDetail;

  // Confirm inscription is on-chain (has a genesis block height)
  if (!inscription.genesis_block_height || inscription.genesis_block_height <= 0) {
    throw new Error(
      `Parent inscription ${inscriptionId} is not yet confirmed. Wait for it to be mined before creating a child.`
    );
  }

  // Parse "txid:vout" from the output field
  const outputParts = inscription.output.split(":");
  if (outputParts.length !== 2) {
    throw new Error(
      `Unexpected output format from Hiro API for inscription ${inscriptionId}: "${inscription.output}"`
    );
  }
  const parentTxid = outputParts[0];
  const parentVout = parseInt(outputParts[1], 10);

  if (isNaN(parentVout)) {
    throw new Error(
      `Could not parse vout from inscription output "${inscription.output}"`
    );
  }

  // Fetch transaction details from mempool.space to get the output's scriptpubkey
  const mempoolBaseUrl = getMempoolApiUrl(network);
  const txResponse = await fetch(`${mempoolBaseUrl}/tx/${parentTxid}`);

  if (!txResponse.ok) {
    const errorText = await txResponse.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to fetch parent transaction ${parentTxid} from mempool.space: ${txResponse.status} - ${errorText}`
    );
  }

  const txData = (await txResponse.json()) as {
    vout: Array<{ scriptpubkey: string; value: number }>;
  };

  if (!txData.vout || parentVout >= txData.vout.length) {
    throw new Error(
      `Parent transaction ${parentTxid} does not have output index ${parentVout}`
    );
  }

  const outputInfo = txData.vout[parentVout];
  if (!outputInfo.scriptpubkey) {
    throw new Error(
      `Parent transaction output ${parentTxid}:${parentVout} has no scriptpubkey`
    );
  }

  return {
    txid: parentTxid,
    vout: parentVout,
    value: inscription.value,
    script: Buffer.from(outputInfo.scriptpubkey, "hex"),
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
        "Content should be provided as base64-encoded string. " +
        "Optionally provide parentInscriptionId to get an estimate that includes " +
        "the extra inputs/outputs required for a parent/child inscription.",
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
        parentInscriptionId: z
          .string()
          .optional()
          .describe(
            "Optional parent inscription ID in ordinals format: {64-hex-txid}i{index} (e.g. 'abc123...i0'). " +
            "When provided, the fee estimate accounts for the extra P2TR input and output required " +
            "to spend and return the parent UTXO in the reveal transaction."
          ),
      },
    },
    async ({ contentType, contentBase64, feeRate, parentInscriptionId }) => {
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

        const hasParent = !!parentInscriptionId;

        // Commit tx size (assuming 1-2 inputs for simplicity)
        const commitInputs = 2;
        const commitSize =
          TX_OVERHEAD_VBYTES +
          commitInputs * P2WPKH_INPUT_VBYTES +
          P2TR_OUTPUT_VBYTES +
          P2WPKH_OUTPUT_VBYTES;
        const commitFee = Math.ceil(commitSize * actualFeeRate);

        // Reveal tx size:
        // - 1 commit input (P2TR script-path) with inscription witness
        // - When parent: +1 P2TR key-path input for parent UTXO
        // - 1 output for inscription recipient
        // - When parent: +1 P2TR output to return parent value
        const revealWitnessSize =
          Math.ceil((body.length / 4) * 1.25) + WITNESS_OVERHEAD_VBYTES;
        const parentInputVbytes = hasParent ? P2TR_INPUT_BASE_VBYTES : 0;
        const parentOutputVbytes = hasParent ? P2TR_OUTPUT_VBYTES : 0;
        const revealSize =
          TX_OVERHEAD_VBYTES +
          P2TR_INPUT_BASE_VBYTES +
          parentInputVbytes +
          revealWitnessSize +
          P2TR_OUTPUT_VBYTES +
          parentOutputVbytes;
        const revealFee = Math.ceil(revealSize * actualFeeRate);

        // Amount locked in reveal output
        const revealAmount = revealFee + DUST_THRESHOLD + 1000;

        // Total cost
        const totalCost = commitFee + revealAmount;

        return createJsonResponse({
          contentType,
          contentSize: body.length,
          feeRate: actualFeeRate,
          isParentChild: hasParent,
          ...(hasParent ? { parentInscriptionId } : {}),
          fees: {
            commitFee,
            revealFee,
            revealAmount,
            totalCost,
          },
          breakdown: `Commit tx: ${commitFee} sats | Reveal amount: ${revealAmount} sats (includes ${revealFee} reveal fee) | Total: ${totalCost} sats`,
          note: hasParent
            ? "Parent/child estimate: includes extra P2TR input+output for parent UTXO. Actual fees may vary."
            : "This is an estimate. Actual fees may vary based on UTXO selection.",
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
        "Returns: commitTxid, revealAddress, revealAmount, and feeRate (save these for inscribe_reveal)\n\n" +
        "For parent/child inscriptions: provide parentInscriptionId to embed a parent tag in the " +
        "inscription envelope. The parent inscription must be confirmed on-chain.",
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
        parentInscriptionId: z
          .string()
          .optional()
          .describe(
            "Optional parent inscription ID in ordinals format: {64-hex-txid}i{index} (e.g. 'abc123...i0'). " +
            "When provided, embeds a parent tag (tag 3) in the inscription envelope to establish " +
            "a parent/child relationship. The parent must be a confirmed on-chain inscription. " +
            "Pass the same parentInscriptionId to inscribe_reveal to complete the child inscription."
          ),
      },
    },
    async ({ contentType, contentBase64, feeRate, parentInscriptionId }) => {
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

        // If a parent inscription is requested, validate it early before broadcasting
        if (parentInscriptionId) {
          // This throws descriptive errors for invalid format, not found, or not confirmed
          await lookupParentInscription(parentInscriptionId, NETWORK);
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
        // When a parent is specified: embed parent tag in envelope and inflate reveal fee estimate
        const commitResult = buildCommitTransaction({
          utxos,
          inscription,
          feeRate: actualFeeRate,
          senderPubKey: account.btcPublicKey,
          senderAddress: sessionInfo.btcAddress,
          network: NETWORK,
          ...(parentInscriptionId
            ? {
                parent: { inscriptionId: parentInscriptionId },
                hasParent: true,
              }
            : {}),
        });

        const commitSigned = signBtcTransaction(commitResult.tx, account.btcPrivateKey);
        const commitTxid = await mempoolApi.broadcastTransaction(commitSigned.txHex);
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        const isParentChild = !!parentInscriptionId;

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
          isParentChild,
          ...(isParentChild ? { parentInscriptionId } : {}),
          nextStep: isParentChild
            ? "After commit confirms, call inscribe_reveal with the same contentType, contentBase64, " +
              "parentInscriptionId, plus commitTxid and revealAmount from this response."
            : "After commit confirms, call inscribe_reveal with the same contentType, contentBase64, " +
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
        "For parent/child inscriptions: provide the same parentInscriptionId used in the commit step. " +
        "The parent UTXO will be spent as input 0 and returned as output 0, proving provenance. " +
        "The child inscription is at output index 1, so inscriptionId will be {revealTxid}i1.\n\n" +
        "Returns: inscriptionId on success",
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
        parentInscriptionId: z
          .string()
          .optional()
          .describe(
            "Optional parent inscription ID in ordinals format: {64-hex-txid}i{index} (e.g. 'abc123...i0'). " +
            "Must match the parentInscriptionId used in the inscribe (commit) step. " +
            "When provided, the parent UTXO is spent as input 0 (proving provenance) and returned " +
            "as output 0. The child inscription output index is 1, so inscriptionId = {revealTxid}i1."
          ),
      },
    },
    async ({ commitTxid, revealAmount, contentType, contentBase64, feeRate, parentInscriptionId }) => {
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

        const mempoolApi = new MempoolApi(NETWORK);

        // Lookup parent UTXO before proceeding — errors surface immediately if invalid
        let parentUtxo: ParentUtxo | undefined;
        if (parentInscriptionId) {
          parentUtxo = await lookupParentInscription(parentInscriptionId, NETWORK);
        }

        // Reconstruct the inscription and reveal script
        const body = Buffer.from(contentBase64, "base64");
        const inscription: InscriptionData = {
          contentType,
          body,
        };

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

        // Derive the reveal script deterministically from inscription + sender key
        // (same derivation used in the commit step — no dummy UTXOs needed)
        // Pass the parent so the parent tag (tag 3) is included in the envelope,
        // producing the same reveal address as the commit step.
        const p2trReveal = deriveRevealScript({
          inscription,
          senderPubKey: account.btcPublicKey,
          network: NETWORK,
          ...(parentInscriptionId ? { parent: { inscriptionId: parentInscriptionId } } : {}),
        });

        // Build reveal transaction
        // When parentUtxo is provided: parent is input 0, commit is input 1,
        // parent return is output 0, inscription is output 1 (index 1).
        const revealResult = buildRevealTransaction({
          commitTxid,
          commitVout: 0,
          commitAmount: revealAmount,
          revealScript: p2trReveal,
          recipientAddress: sessionInfo.taprootAddress,
          feeRate: actualFeeRate,
          network: NETWORK,
          contentSize: body.length,
          ...(parentUtxo ? { parentUtxo } : {}),
        });

        const revealSigned = signBtcTransaction(revealResult.tx, account.btcPrivateKey);
        const revealTxid = await mempoolApi.broadcastTransaction(revealSigned.txHex);

        // Inscription ID encodes the output index:
        // - Standard: output 0 → inscriptionId = {revealTxid}i0
        // - Parent/child: parent return is output 0, inscription is output 1 → {revealTxid}i1
        const inscriptionOutputIndex = parentUtxo ? 1 : 0;
        const inscriptionId = `${revealTxid}i${inscriptionOutputIndex}`;
        const revealExplorerUrl = getMempoolTxUrl(revealTxid, NETWORK);
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        const isParentChild = !!parentUtxo;

        return createJsonResponse({
          status: "success",
          message: "Inscription created successfully!",
          inscriptionId,
          contentType,
          contentSize: body.length,
          isParentChild,
          ...(isParentChild
            ? {
                parentInscriptionId,
                parentReturned: true,
                parentTxid: parentUtxo!.txid,
              }
            : {}),
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
          note: isParentChild
            ? "Child inscription created. Parent inscription returned to its original script. " +
              "Both will appear once the reveal transaction confirms."
            : "Inscription will appear at the recipient address once the reveal transaction confirms.",
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
