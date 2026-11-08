/**
 * Parent-child inscription transaction building
 *
 * Implements the commit/reveal pattern for child inscriptions per the
 * Ordinals provenance spec (https://docs.ordinals.com/inscriptions/provenance.html).
 *
 * The owner of a parent inscription creates child inscriptions, establishing
 * on-chain provenance. Uses micro-ordinals parent tag (tag 3) support.
 */

import * as btc from "@scure/btc-signer";
import { p2tr_ord_reveal } from "micro-ordinals";
import type { Network } from "../config/networks.js";
import {
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  P2TR_OUTPUT_VBYTES,
  P2TR_INPUT_BASE_VBYTES,
  TX_OVERHEAD_VBYTES,
  DUST_THRESHOLD,
  WITNESS_OVERHEAD_VBYTES,
  RBF_SEQUENCE,
} from "../config/bitcoin-constants.js";
import type { UTXO } from "../services/mempool-api.js";
import { getBtcNetwork } from "./bitcoin-builder.js";
import {
  estimateRevealVsize,
  revealWitnessVsize,
  type InscriptionData,
} from "./inscription-builder.js";

/**
 * Parent inscription info from Xverse API lookup
 */
export interface ParentInscriptionInfo {
  txid: string;
  vout: number;
  value: number;
  address: string;
  output: string;
}

/**
 * Options for deriving a child reveal script
 */
export interface DeriveChildRevealScriptOptions {
  inscription: InscriptionData;
  parentInscriptionId: string;
  senderPubKey: Uint8Array;
  network: Network;
}

/**
 * Options for building a child commit transaction
 */
export interface BuildChildCommitTransactionOptions {
  utxos: UTXO[];
  inscription: InscriptionData;
  parentInscriptionId: string;
  feeRate: number;
  senderPubKey: Uint8Array;
  senderAddress: string;
  network: Network;
}

/**
 * Result from building a child commit transaction
 */
export interface BuildChildCommitTransactionResult {
  tx: btc.Transaction;
  fee: number;
  revealAddress: string;
  revealAmount: number;
  revealScript: ReturnType<typeof btc.p2tr>;
}

/**
 * Options for building a child reveal transaction
 */
export interface BuildChildRevealTransactionOptions {
  commitTxid: string;
  commitVout: number;
  commitAmount: number;
  revealScript: ReturnType<typeof btc.p2tr>;
  parentUtxo: { txid: string; vout: number; value: number };
  parentOwnerTaprootInternalPubKey: Uint8Array;
  recipientAddress: string;
  feeRate: number;
  network: Network;
}

/**
 * Result from building a child reveal transaction
 */
export interface BuildChildRevealTransactionResult {
  tx: btc.Transaction;
  fee: number;
  outputAmount: number;
}

/**
 * Derive the Taproot P2TR reveal script for a child inscription.
 *
 * Same as deriveRevealScript but includes the parent inscription ID tag,
 * establishing provenance per the Ordinals spec.
 */
export function deriveChildRevealScript(
  options: DeriveChildRevealScriptOptions
): ReturnType<typeof btc.p2tr> {
  const { inscription, parentInscriptionId, senderPubKey, network } = options;

  const btcNetwork = getBtcNetwork(network);
  // micro-ordinals handles parent tag encoding (tag 3) including txid byte
  // reversal and index serialization. At runtime, TagCoders.parent.encode()
  // accepts a string inscription ID, but the TS types resolve parent to
  // Coder<string, Uint8Array> due to UnwrapCoder not unwrapping asymmetric coders.
  const inscriptionData = {
    tags: {
      contentType: inscription.contentType,
      parent: parentInscriptionId as any,
    },
    body: inscription.body,
  };

  // Convert compressed pubkey (33 bytes) to x-only pubkey (32 bytes) for Taproot
  const xOnlyPubkey = senderPubKey.slice(1);

  const revealScriptData = p2tr_ord_reveal(xOnlyPubkey, [inscriptionData]);

  // Create P2TR output for script-path spending
  const p2trReveal = btc.p2tr(xOnlyPubkey, revealScriptData, btcNetwork, true);

  if (!p2trReveal.address) {
    throw new Error("Failed to generate child reveal address");
  }

  return p2trReveal;
}

/**
 * Build a commit transaction for a child inscription.
 *
 * Same logic as buildCommitTransaction but accounts for the extra input
 * (parent UTXO) and extra output (parent return) in the reveal tx fee estimate.
 */
export function buildChildCommitTransaction(
  options: BuildChildCommitTransactionOptions
): BuildChildCommitTransactionResult {
  const {
    utxos,
    inscription,
    parentInscriptionId,
    feeRate,
    senderPubKey,
    senderAddress,
    network,
  } = options;

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

  // Derive the child reveal script
  const p2trReveal = deriveChildRevealScript({
    inscription,
    parentInscriptionId,
    senderPubKey,
    network,
  });
  const btcNetwork = getBtcNetwork(network);

  // Estimate reveal tx size: 2 inputs, 2 outputs
  // Input[0]: commit output (Taproot script-path with inscription witness)
  // Input[1]: parent UTXO (Taproot key-path: P2TR_INPUT_BASE_VBYTES)
  // Output[0]: parent return (P2TR: P2TR_OUTPUT_VBYTES)
  // Output[1]: child inscription recipient (P2TR: P2TR_OUTPUT_VBYTES)
  const revealInputSize = P2TR_INPUT_BASE_VBYTES; // commit input
  const parentInputSize = P2TR_INPUT_BASE_VBYTES; // parent key-path input
  const revealWitnessSize =
    Math.ceil((inscription.body.length / 4) * 1.25) + WITNESS_OVERHEAD_VBYTES;
  const revealTxSize =
    TX_OVERHEAD_VBYTES +
    revealInputSize +
    parentInputSize +
    revealWitnessSize +
    P2TR_OUTPUT_VBYTES * 2; // parent return + child output
  const revealFee = Math.ceil(revealTxSize * feeRate);

  // Amount to send to reveal address must cover reveal fee + dust for both outputs
  const revealAmount = revealFee + DUST_THRESHOLD * 2 + 1000;

  // Calculate total available
  const totalAvailable = sortedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

  // Estimate commit transaction size with change output
  const estimatedVsize =
    TX_OVERHEAD_VBYTES +
    sortedUtxos.length * P2WPKH_INPUT_VBYTES +
    P2TR_OUTPUT_VBYTES + // Reveal output
    P2WPKH_OUTPUT_VBYTES; // Change output

  const estimatedFee = Math.ceil(estimatedVsize * feeRate);

  const requiredTotal = revealAmount + estimatedFee;
  if (totalAvailable < requiredTotal) {
    throw new Error(
      `Insufficient funds: have ${totalAvailable} sats, need ${requiredTotal} sats (${revealAmount} reveal + ${estimatedFee} commit fee)`
    );
  }

  // Select UTXOs
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

  if (selectedTotal < revealAmount + finalFee) {
    throw new Error(
      `Insufficient funds after UTXO selection: have ${selectedTotal} sats, need ${revealAmount + finalFee} sats`
    );
  }

  if (changeAmount < DUST_THRESHOLD) {
    throw new Error(
      `Change amount ${changeAmount} is below dust threshold (${DUST_THRESHOLD} sats). Need more UTXOs or lower fee rate.`
    );
  }

  // Build the commit transaction
  const tx = new btc.Transaction();
  const senderP2wpkh = btc.p2wpkh(senderPubKey, btcNetwork);

  for (const utxo of selectedUtxos) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      sequence: RBF_SEQUENCE,
      witnessUtxo: {
        script: senderP2wpkh.script,
        amount: BigInt(utxo.value),
      },
    });
  }

  // Reveal output (Taproot address from child reveal script)
  tx.addOutputAddress(p2trReveal.address, BigInt(revealAmount), btcNetwork);

  // Change output
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
 * Estimated vsize of the reveal transaction buildChildRevealTransaction builds:
 * the commit input (script path, inscription witness) + the parent input (key
 * path) + 2 P2TR outputs (parent return, child). Independent of the fee rate.
 */
export function estimateChildRevealVsize(revealScript: ReturnType<typeof btc.p2tr>): number {
  return (
    TX_OVERHEAD_VBYTES +
    P2TR_INPUT_BASE_VBYTES * 2 +
    revealWitnessVsize(revealScript) +
    P2TR_OUTPUT_VBYTES * 2
  );
}

/**
 * Build a child reveal transaction.
 *
 * 2 inputs, 2 outputs:
 *   Input[0]: Commit output (P2TR script-path spend with inscription witness)
 *   Input[1]: Parent UTXO (P2TR key-path spend)
 *   Output[0]: Parent return → owner's P2TR address (546 sats dust)
 *   Output[1]: Child inscription → recipient P2TR address (remaining sats)
 */
export function buildChildRevealTransaction(
  options: BuildChildRevealTransactionOptions
): BuildChildRevealTransactionResult {
  const {
    commitTxid,
    commitVout,
    commitAmount,
    revealScript,
    parentUtxo,
    parentOwnerTaprootInternalPubKey,
    recipientAddress,
    feeRate,
    network,
  } = options;

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

  const revealFee = Math.ceil(estimateChildRevealVsize(revealScript) * feeRate);

  // Total available from commit output + parent UTXO value
  const totalInput = commitAmount + parentUtxo.value;
  const parentReturnAmount = DUST_THRESHOLD; // 546 sats back to parent owner
  const childOutputAmount = totalInput - revealFee - parentReturnAmount;

  if (childOutputAmount < DUST_THRESHOLD) {
    throw new Error(
      `Child output amount ${childOutputAmount} is below dust threshold (${DUST_THRESHOLD} sats)`
    );
  }

  // Build the reveal transaction
  const btcNetwork = getBtcNetwork(network);
  const tx = new btc.Transaction({
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
  });

  // Input[0]: Commit output (script-path spend with inscription witness)
  tx.addInput({
    txid: commitTxid,
    index: commitVout,
    sequence: RBF_SEQUENCE,
    witnessUtxo: {
      script: revealScript.script,
      amount: BigInt(commitAmount),
    },
    tapLeafScript: revealScript.tapLeafScript,
  });

  // Input[1]: Parent UTXO (key-path spend)
  const parentP2tr = btc.p2tr(
    parentOwnerTaprootInternalPubKey,
    undefined,
    btcNetwork
  );
  tx.addInput({
    txid: parentUtxo.txid,
    index: parentUtxo.vout,
    sequence: RBF_SEQUENCE,
    witnessUtxo: {
      script: parentP2tr.script,
      amount: BigInt(parentUtxo.value),
    },
    tapInternalKey: parentOwnerTaprootInternalPubKey,
  });

  // Output[0]: Parent return → owner's P2TR address (dust)
  tx.addOutputAddress(
    parentP2tr.address!,
    BigInt(parentReturnAmount),
    btcNetwork
  );

  // Output[1]: Child inscription → recipient P2TR address
  tx.addOutputAddress(recipientAddress, BigInt(childOutputAmount), btcNetwork);

  return {
    tx,
    fee: revealFee,
    outputAmount: childOutputAmount,
  };
}

/**
 * Look up a parent inscription's current UTXO location via Xverse API.
 *
 * @param inscriptionId - Inscription ID (e.g., "abc123...i0")
 * @returns Parent inscription UTXO info
 */
export async function lookupParentInscription(
  inscriptionId: string
): Promise<ParentInscriptionInfo> {
  const url = `https://api-3.xverse.app/v1/ordinals/inscriptions/${inscriptionId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to look up inscription ${inscriptionId}: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    tx_id?: string;
    value?: number;
    address?: string;
    output?: string;
  };

  if (!data.tx_id || !data.output || data.value === undefined || !data.address) {
    throw new Error(
      `Inscription ${inscriptionId} not found or missing UTXO data`
    );
  }

  // Xverse returns output as "txid:vout" — parse vout from it
  const outputParts = data.output.split(":");
  const vout = parseInt(outputParts[1], 10);

  return {
    txid: data.tx_id,
    vout,
    value: data.value,
    address: data.address,
    output: data.output,
  };
}

/**
 * The highest whole fee rate (sat/vB) a reveal can pay from revealAmount and
 * still leave its outputs at dust or above. For a child reveal the parent
 * UTXO also funds the transaction, and the parent return output takes its own
 * dust. Computed from the reveal script's size, not from a fee rate, so the
 * commit and the reveal always agree on it. Can be 0 when nothing is payable.
 */
export function computeMaxRevealFeeRate(
  revealAmount: number,
  revealScript: ReturnType<typeof btc.p2tr>,
  parentValue?: number
): number {
  if (parentValue === undefined) {
    return Math.floor((revealAmount - DUST_THRESHOLD) / estimateRevealVsize(revealScript));
  }
  const spendable = revealAmount + parentValue - DUST_THRESHOLD * 2;
  return Math.floor(spendable / estimateChildRevealVsize(revealScript));
}
