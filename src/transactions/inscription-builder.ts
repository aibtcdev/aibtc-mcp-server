/**
 * Inscription transaction building
 *
 * Implements the commit/reveal pattern for Bitcoin inscriptions using micro-ordinals.
 * Uses @scure/btc-signer for Taproot (P2TR) transactions.
 *
 * Reference: https://github.com/paulmillr/micro-ordinals
 */

import * as btc from "@scure/btc-signer";
import { p2tr_ord_reveal, type Inscription } from "micro-ordinals";
import type { Network } from "../config/networks.js";
import {
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  P2TR_OUTPUT_VBYTES,
  TX_OVERHEAD_VBYTES,
  DUST_THRESHOLD,
  P2TR_INPUT_BASE_VBYTES,
  WITNESS_OVERHEAD_VBYTES,
} from "../config/bitcoin-constants.js";
import type { UTXO } from "../services/mempool-api.js";
import { getBtcNetwork } from "./bitcoin-builder.js";

/**
 * Estimate the virtual size (vbytes) of a reveal transaction.
 *
 * This formula is used by fee estimation, commit transaction building (to size
 * the commit output), and reveal transaction building (to compute the actual fee).
 * Centralizing it here ensures all three stay in sync.
 *
 * @param contentSize - Inscription content size in bytes
 * @param hasParent - Whether the reveal includes a parent UTXO (adds extra P2TR input + output)
 * @returns Estimated virtual size in vbytes
 */
export function estimateRevealTxVbytes(
  contentSize: number,
  hasParent: boolean
): number {
  const revealWitnessSize =
    Math.ceil((contentSize / 4) * 1.25) + WITNESS_OVERHEAD_VBYTES;
  const parentInputVbytes = hasParent ? P2TR_INPUT_BASE_VBYTES : 0;
  const parentOutputVbytes = hasParent ? P2TR_OUTPUT_VBYTES : 0;
  return (
    TX_OVERHEAD_VBYTES +
    P2TR_INPUT_BASE_VBYTES +
    parentInputVbytes +
    revealWitnessSize +
    P2TR_OUTPUT_VBYTES +
    parentOutputVbytes
  );
}

/**
 * Parent UTXO for parent/child inscription reveals.
 *
 * In a parent/child inscription, the parent UTXO must be spent as an input
 * to the reveal transaction (proving provenance) and returned as the first
 * output (so the parent remains with its owner).
 */
export interface ParentUtxo {
  /**
   * UTXO txid of the parent inscription
   */
  txid: string;
  /**
   * Output index of the parent inscription UTXO
   */
  vout: number;
  /**
   * Value of the parent UTXO in satoshis (will be returned as first output)
   */
  value: number;
  /**
   * witnessUtxo script for the parent UTXO (P2TR script of the current owner)
   */
  script: Uint8Array;
}

/**
 * Inscription data structure
 */
export interface InscriptionData {
  /**
   * Content type (MIME type, e.g., "text/plain", "image/png")
   */
  contentType: string;
  /**
   * Content body as Uint8Array
   */
  body: Uint8Array;
}

/**
 * Options for deriving the reveal script from inscription data
 */
export interface DeriveRevealScriptOptions {
  /**
   * Inscription data to encode in the script
   */
  inscription: InscriptionData;
  /**
   * Sender's public key (compressed, 33 bytes)
   */
  senderPubKey: Uint8Array;
  /**
   * Network (mainnet or testnet)
   */
  network: Network;
  /**
   * Optional parent inscription info for parent/child inscriptions.
   * When provided, the inscription envelope will include a parent tag (tag 3)
   * with the parent inscription ID in "{txid}i{vout}" format.
   */
  parent?: {
    /**
     * Parent inscription ID in ordinals format: "{txid}i{vout}" (e.g. "abc123...i0")
     */
    inscriptionId: string;
  };
}

/**
 * Options for building a commit transaction
 */
export interface BuildCommitTransactionOptions {
  /**
   * UTXOs to fund the commit transaction
   */
  utxos: UTXO[];
  /**
   * Inscription data to commit
   */
  inscription: InscriptionData;
  /**
   * Fee rate in sat/vB for the commit transaction
   */
  feeRate: number;
  /**
   * Sender's public key (compressed, 33 bytes)
   */
  senderPubKey: Uint8Array;
  /**
   * Sender's address for change output
   */
  senderAddress: string;
  /**
   * Network (mainnet or testnet)
   */
  network: Network;
  /**
   * Optional parent inscription info for parent/child inscriptions.
   * When provided, the inscription envelope will include a parent tag (tag 3)
   * and the reveal fee estimate will account for the extra parent input/output.
   */
  parent?: {
    /**
     * Parent inscription ID in ordinals format: "{txid}i{vout}" (e.g. "abc123...i0")
     */
    inscriptionId: string;
  };
}

/**
 * Result from building a commit transaction
 */
export interface BuildCommitTransactionResult {
  /**
   * Unsigned commit transaction object (ready for signing)
   */
  tx: btc.Transaction;
  /**
   * Fee paid in satoshis
   */
  fee: number;
  /**
   * Taproot reveal address (where commit tx sends funds)
   */
  revealAddress: string;
  /**
   * Amount sent to reveal address (in satoshis)
   */
  revealAmount: number;
  /**
   * Taproot P2TR output for reveal transaction
   */
  revealScript: ReturnType<typeof btc.p2tr>;
}

/**
 * Options for building a reveal transaction
 */
export interface BuildRevealTransactionOptions {
  /**
   * Commit transaction ID
   */
  commitTxid: string;
  /**
   * Output index in commit transaction (usually 0)
   */
  commitVout: number;
  /**
   * Amount in the commit output (satoshis)
   */
  commitAmount: number;
  /**
   * Taproot P2TR output from commit transaction
   */
  revealScript: ReturnType<typeof btc.p2tr>;
  /**
   * Recipient address for the inscription (Taproot address to receive)
   */
  recipientAddress: string;
  /**
   * Fee rate in sat/vB for the reveal transaction
   */
  feeRate: number;
  /**
   * Network (mainnet or testnet)
   */
  network: Network;
  /**
   * Inscription content size in bytes (used for accurate witness size estimation)
   */
  contentSize: number;
  /**
   * Optional parent UTXO for parent/child inscriptions.
   * When provided:
   * - Parent UTXO is added as input 0 (commit input becomes input 1)
   * - Parent value is returned as output 0 (inscription output becomes output 1)
   * - Fee estimate includes the extra P2TR input and P2TR output
   */
  parentUtxo?: ParentUtxo;
}

/**
 * Result from building a reveal transaction
 */
export interface BuildRevealTransactionResult {
  /**
   * Unsigned reveal transaction object (ready for signing)
   */
  tx: btc.Transaction;
  /**
   * Fee paid in satoshis
   */
  fee: number;
  /**
   * Amount sent to recipient (in satoshis)
   */
  outputAmount: number;
  /**
   * True when a parent UTXO was added as input 0 and its value returned as output 0.
   */
  parentReturned?: boolean;
}

/**
 * Derive the Taproot P2TR reveal script from inscription data and sender public key.
 *
 * This is the deterministic portion of the commit/reveal setup: given the same
 * inscription content and sender key, it always produces the same reveal address.
 * Both `buildCommitTransaction` and the `inscribe_reveal` tool call this to obtain
 * the reveal script without coupling through a full commit transaction build.
 *
 * @param options - Inscription data, sender public key, and network
 * @returns Taproot P2TR output ready for use in the reveal transaction
 * @throws Error if the reveal address cannot be generated
 */
export function deriveRevealScript(
  options: DeriveRevealScriptOptions
): ReturnType<typeof btc.p2tr> {
  const { inscription, senderPubKey, network, parent } = options;

  const btcNetwork = getBtcNetwork(network);
  // Note: The micro-ordinals type definition for Tags.parent is incorrectly typed as
  // P.Coder<string, Uint8Array> (the coder object), but at runtime it expects a string
  // (the inscription ID). The cast below works around this type definition bug.
  // See: https://github.com/paulmillr/micro-ordinals — TagCoders.parent.encode(to['parent'])
  const inscriptionData: Inscription = {
    tags: {
      contentType: inscription.contentType,
      ...(parent ? { parent: parent.inscriptionId as unknown as import("micro-ordinals").Tags["parent"] } : {}),
    },
    body: inscription.body,
  };

  // Convert compressed pubkey (33 bytes) to x-only pubkey (32 bytes) for Taproot
  const xOnlyPubkey = senderPubKey.slice(1);

  const revealScriptData = p2tr_ord_reveal(xOnlyPubkey, [inscriptionData]);

  // Create P2TR output for script-path spending
  const p2trReveal = btc.p2tr(xOnlyPubkey, revealScriptData, btcNetwork, true);

  if (!p2trReveal.address) {
    throw new Error("Failed to generate reveal address");
  }

  return p2trReveal;
}

/**
 * Build a commit transaction for an inscription
 *
 * The commit transaction sends funds to a Taproot address derived from the
 * inscription reveal script. This locks the funds until the reveal transaction
 * is broadcast.
 *
 * @param options - Commit transaction building options
 * @returns Unsigned commit transaction and reveal script
 * @throws Error if insufficient funds or invalid parameters
 *
 * @example
 * ```typescript
 * const inscription = {
 *   contentType: "text/plain",
 *   body: new TextEncoder().encode("Hello, Ordinals!"),
 * };
 *
 * const result = buildCommitTransaction({
 *   utxos: [...],
 *   inscription,
 *   feeRate: 10,
 *   senderPubKey: pubKeyBytes,
 *   senderAddress: "bc1q...",
 *   network: "mainnet",
 * });
 * ```
 */
export function buildCommitTransaction(
  options: BuildCommitTransactionOptions
): BuildCommitTransactionResult {
  const {
    utxos,
    inscription,
    feeRate,
    senderPubKey,
    senderAddress,
    network,
    parent,
  } = options;

  // Validate inputs
  if (utxos.length === 0) {
    throw new Error("No UTXOs provided");
  }
  if (feeRate <= 0) {
    throw new Error("Fee rate must be positive");
  }
  if (!inscription.contentType) {
    throw new Error("Content type is required");
  }
  if (!inscription.body || inscription.body.length === 0) {
    throw new Error("Content body is required");
  }
  if (senderPubKey.length !== 33) {
    throw new Error("Sender public key must be 33 bytes (compressed)");
  }

  // Sort UTXOs by value descending for better coin selection
  const sortedUtxos = [...utxos]
    .filter((utxo) => utxo.status.confirmed)
    .sort((a, b) => b.value - a.value);

  if (sortedUtxos.length === 0) {
    throw new Error("No confirmed UTXOs available");
  }

  // Derive the reveal script deterministically from inscription + sender key.
  // Pass the parent inscription ID so the envelope includes the parent tag (tag 3).
  const p2trReveal = deriveRevealScript({ inscription, senderPubKey, network, parent });
  const btcNetwork = getBtcNetwork(network);

  // Estimate reveal transaction size to determine commit amount.
  const revealTxSize = estimateRevealTxVbytes(inscription.body.length, !!parent);
  const revealFee = Math.ceil(revealTxSize * feeRate);

  // Amount to send to reveal address (must cover reveal fee + dust for output)
  const revealAmount = revealFee + DUST_THRESHOLD + 1000; // Extra padding for reveal output

  // Calculate total available
  const totalAvailable = sortedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

  // Estimate commit transaction size with change output
  const estimatedVsize =
    TX_OVERHEAD_VBYTES +
    sortedUtxos.length * P2WPKH_INPUT_VBYTES +
    P2TR_OUTPUT_VBYTES + // Reveal output
    P2WPKH_OUTPUT_VBYTES; // Change output

  const estimatedFee = Math.ceil(estimatedVsize * feeRate);

  // Check if we have enough funds
  const requiredTotal = revealAmount + estimatedFee;
  if (totalAvailable < requiredTotal) {
    throw new Error(
      `Insufficient funds: have ${totalAvailable} sats, need ${requiredTotal} sats (${revealAmount} reveal + ${estimatedFee} commit fee)`
    );
  }

  // Select UTXOs using simple accumulator
  let selectedTotal = 0;
  const selectedUtxos: UTXO[] = [];

  for (const utxo of sortedUtxos) {
    selectedUtxos.push(utxo);
    selectedTotal += utxo.value;

    if (selectedTotal >= requiredTotal) {
      break;
    }
  }

  // Final calculation
  const finalVsize =
    TX_OVERHEAD_VBYTES +
    selectedUtxos.length * P2WPKH_INPUT_VBYTES +
    P2TR_OUTPUT_VBYTES +
    P2WPKH_OUTPUT_VBYTES;

  const finalFee = Math.ceil(finalVsize * feeRate);
  const changeAmount = selectedTotal - revealAmount - finalFee;

  // Verify we still have enough
  if (selectedTotal < revealAmount + finalFee) {
    throw new Error(
      `Insufficient funds after UTXO selection: have ${selectedTotal} sats, need ${revealAmount + finalFee} sats`
    );
  }

  // Check if change is above dust
  if (changeAmount < DUST_THRESHOLD) {
    throw new Error(
      `Change amount ${changeAmount} is below dust threshold (${DUST_THRESHOLD} sats). Need more UTXOs or lower fee rate.`
    );
  }

  // Build the commit transaction
  const tx = new btc.Transaction();

  // Create sender's P2WPKH script for inputs
  const senderP2wpkh = btc.p2wpkh(senderPubKey, btcNetwork);

  // Add inputs
  for (const utxo of selectedUtxos) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: senderP2wpkh.script,
        amount: BigInt(utxo.value),
      },
    });
  }

  // Add reveal output (Taproot address from reveal script)
  tx.addOutputAddress(p2trReveal.address, BigInt(revealAmount), btcNetwork);

  // Add change output
  tx.addOutputAddress(senderAddress, BigInt(changeAmount), btcNetwork);

  return {
    tx,
    fee: finalFee,
    revealAddress: p2trReveal.address,
    revealAmount,
    revealScript: p2trReveal,
  };
}

/**
 * Build a reveal transaction for an inscription
 *
 * The reveal transaction spends the commit output and includes the inscription
 * data in the witness. This creates the inscription on-chain.
 *
 * @param options - Reveal transaction building options
 * @returns Unsigned reveal transaction
 * @throws Error if invalid parameters
 *
 * @example
 * ```typescript
 * const result = buildRevealTransaction({
 *   commitTxid: "abc123...",
 *   commitVout: 0,
 *   commitAmount: 10000,
 *   revealScript: revealScriptFromCommit,
 *   recipientAddress: "bc1p...",
 *   feeRate: 10,
 *   network: "mainnet",
 * });
 * ```
 */
export function buildRevealTransaction(
  options: BuildRevealTransactionOptions
): BuildRevealTransactionResult {
  const {
    commitTxid,
    commitVout,
    commitAmount,
    revealScript,
    recipientAddress,
    feeRate,
    network,
    contentSize,
    parentUtxo,
  } = options;

  // Validate inputs
  if (!commitTxid || commitTxid.length !== 64) {
    throw new Error("Invalid commit transaction ID");
  }
  if (commitVout < 0) {
    throw new Error("Invalid commit output index");
  }
  if (commitAmount <= 0) {
    throw new Error("Commit amount must be positive");
  }
  if (feeRate <= 0) {
    throw new Error("Fee rate must be positive");
  }
  if (contentSize <= 0) {
    throw new Error("Content size must be positive");
  }

  // Estimate reveal transaction size using the shared formula.
  const revealTxSize = estimateRevealTxVbytes(contentSize, !!parentUtxo);
  const revealFee = Math.ceil(revealTxSize * feeRate);

  // The commit output covers the inscription output dust plus the reveal fee.
  // The parent UTXO value flows through net-zero (input == return output).
  const outputAmount = commitAmount - revealFee;

  if (outputAmount < DUST_THRESHOLD) {
    throw new Error(
      `Output amount ${outputAmount} is below dust threshold (${DUST_THRESHOLD} sats)`
    );
  }

  // Build the reveal transaction
  const btcNetwork = getBtcNetwork(network);
  const tx = new btc.Transaction({ allowUnknownOutputs: true, allowUnknownInputs: true });

  if (parentUtxo) {
    // Parent/child reveal transaction structure:
    //   Input 0:  parent UTXO (P2TR key-path spend — proves provenance)
    //   Input 1:  commit output (P2TR script-path spend — reveals inscription)
    //   Output 0: parent value returned to original script (net-zero for parent owner)
    //   Output 1: inscription sent to recipient

    // Input 0: parent UTXO
    tx.addInput({
      txid: parentUtxo.txid,
      index: parentUtxo.vout,
      witnessUtxo: {
        script: parentUtxo.script,
        amount: BigInt(parentUtxo.value),
      },
    });

    // Input 1: commit output (Taproot script-path spend with inscription witness)
    tx.addInput({
      txid: commitTxid,
      index: commitVout,
      witnessUtxo: {
        script: revealScript.script,
        amount: BigInt(commitAmount),
      },
      tapLeafScript: revealScript.tapLeafScript,
    });

    // Output 0: return parent value to the same script (owner keeps the parent inscription)
    tx.addOutput({
      script: parentUtxo.script,
      amount: BigInt(parentUtxo.value),
    });

    // Output 1: inscription to recipient
    tx.addOutputAddress(recipientAddress, BigInt(outputAmount), btcNetwork);

    return {
      tx,
      fee: revealFee,
      outputAmount,
      parentReturned: true,
    };
  }

  // Standard (non-parent) reveal transaction:
  //   Input 0:  commit output (P2TR script-path spend)
  //   Output 0: inscription sent to recipient
  tx.addInput({
    txid: commitTxid,
    index: commitVout,
    witnessUtxo: {
      script: revealScript.script,
      amount: BigInt(commitAmount),
    },
    tapLeafScript: revealScript.tapLeafScript,
  });

  tx.addOutputAddress(recipientAddress, BigInt(outputAmount), btcNetwork);

  return {
    tx,
    fee: revealFee,
    outputAmount,
  };
}
