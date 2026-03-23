/**
 * Rune Transfer Builder
 *
 * Builds a transaction to transfer runes from one address to another.
 * Transaction structure:
 * - P2TR inputs: rune UTXOs (signed with taproot key)
 * - P2WPKH inputs: cardinal UTXOs for fees (signed with segwit key)
 * - OP_RETURN output: Runestone with edict + change pointer
 * - P2TR output: recipient receives runes (dust amount)
 * - P2TR output: rune change back to sender (if partial transfer)
 * - P2WPKH output: BTC change back to sender
 */

import * as btc from "@scure/btc-signer";
import type { Network } from "../config/networks.js";
import {
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  P2TR_OUTPUT_VBYTES,
  P2TR_INPUT_BASE_VBYTES,
  TX_OVERHEAD_VBYTES,
  DUST_THRESHOLD,
} from "../config/bitcoin-constants.js";
import { getBtcNetwork } from "./bitcoin-builder.js";
import type { UTXO } from "../services/mempool-api.js";
import { buildRunestoneScript, parseRuneId, type RuneEdict } from "./runestone-builder.js";

export interface RuneTransferOptions {
  runeId: string;
  amount: bigint;
  runeUtxos: UTXO[];
  feeUtxos: UTXO[];
  recipientAddress: string;
  feeRate: number;
  senderPubKey: Uint8Array;
  senderTaprootPubKey: Uint8Array;
  senderAddress: string;
  senderTaprootAddress: string;
  network: Network;
}

export interface RuneTransferResult {
  tx: btc.Transaction;
  fee: number;
  btcChange: number;
  vsize: number;
  taprootInputIndices: number[];
  feeInputIndices: number[];
}


const OP_RETURN_VBYTES = 50;

export function buildRuneTransfer(options: RuneTransferOptions): RuneTransferResult {
  const {
    runeId,
    amount,
    runeUtxos,
    feeUtxos,
    recipientAddress,
    feeRate,
    senderPubKey,
    senderTaprootPubKey,
    senderAddress,
    senderTaprootAddress,
    network,
  } = options;

  if (runeUtxos.length === 0) throw new Error("No rune UTXOs provided");
  if (feeUtxos.length === 0) throw new Error("No fee UTXOs provided");
  if (feeRate <= 0) throw new Error("Fee rate must be positive");
  if (amount <= 0n) throw new Error("Amount must be positive");

  const btcNetwork = getBtcNetwork(network);
  const tx = new btc.Transaction();

  const { block, txIndex } = parseRuneId(runeId);

  // Rune UTXOs (P2TR inputs)
  const taprootPayment = btc.p2tr(senderTaprootPubKey, undefined, btcNetwork);
  const taprootInputIndices: number[] = [];

  for (let i = 0; i < runeUtxos.length; i++) {
    const utxo = runeUtxos[i];
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script: taprootPayment.script, amount: BigInt(utxo.value) },
    });
    taprootInputIndices.push(i);
  }

  // Fee UTXOs (P2WPKH inputs)
  const senderP2wpkh = btc.p2wpkh(senderPubKey, btcNetwork);
  const sortedFeeUtxos = [...feeUtxos]
    .filter((u) => u.status.confirmed)
    .sort((a, b) => b.value - a.value);

  if (sortedFeeUtxos.length === 0) throw new Error("No confirmed fee UTXOs available");

  const selectedFeeUtxos: UTXO[] = [];
  let feeTotal = 0;
  const feeInputIndices: number[] = [];

  for (const utxo of sortedFeeUtxos) {
    selectedFeeUtxos.push(utxo);
    feeTotal += utxo.value;

    const estimatedVsize =
      TX_OVERHEAD_VBYTES +
      runeUtxos.length * P2TR_INPUT_BASE_VBYTES +
      selectedFeeUtxos.length * P2WPKH_INPUT_VBYTES +
      OP_RETURN_VBYTES +
      P2TR_OUTPUT_VBYTES + // recipient
      P2TR_OUTPUT_VBYTES + // rune change
      P2WPKH_OUTPUT_VBYTES; // BTC change

    if (feeTotal >= Math.ceil(estimatedVsize * feeRate) + DUST_THRESHOLD) {
      break;
    }
  }

  const feeInputStartIdx = runeUtxos.length;
  for (let i = 0; i < selectedFeeUtxos.length; i++) {
    const utxo = selectedFeeUtxos[i];
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script: senderP2wpkh.script, amount: BigInt(utxo.value) },
    });
    feeInputIndices.push(feeInputStartIdx + i);
  }

  // Outputs:
  // 0: OP_RETURN Runestone
  // 1: Recipient
  // 2: Rune change (sender taproot)
  // 3: BTC change (sender segwit)

  const edict: RuneEdict = { block, txIndex, amount, outputIndex: 1 };
  const runestoneScript = buildRunestoneScript({ edict, changeOutput: 2 });

  tx.addOutput({ script: runestoneScript, amount: 0n });
  tx.addOutputAddress(recipientAddress, BigInt(DUST_THRESHOLD), btcNetwork);

  const runeSats = runeUtxos.reduce((sum, u) => sum + u.value, 0);
  const runeChangeSats = runeSats - DUST_THRESHOLD;
  if (runeChangeSats >= DUST_THRESHOLD) {
    tx.addOutputAddress(senderTaprootAddress, BigInt(runeChangeSats), btcNetwork);
  }

  const actualOutputCount = 3 + (runeChangeSats >= DUST_THRESHOLD ? 1 : 0);
  const finalVsize =
    TX_OVERHEAD_VBYTES +
    runeUtxos.length * P2TR_INPUT_BASE_VBYTES +
    selectedFeeUtxos.length * P2WPKH_INPUT_VBYTES +
    OP_RETURN_VBYTES +
    (actualOutputCount - 1) * P2TR_OUTPUT_VBYTES +
    P2WPKH_OUTPUT_VBYTES;

  const finalFee = Math.ceil(finalVsize * feeRate);
  const btcChange = feeTotal - finalFee;

  if (btcChange < 0) {
    throw new Error(
      `Insufficient fee UTXOs: have ${feeTotal} sats, need ${finalFee} sats for fee`
    );
  }

  if (btcChange >= DUST_THRESHOLD) {
    tx.addOutputAddress(senderAddress, BigInt(btcChange), btcNetwork);
  }

  return {
    tx,
    fee: finalFee,
    btcChange: btcChange >= DUST_THRESHOLD ? btcChange : 0,
    vsize: Math.ceil(finalVsize),
    taprootInputIndices,
    feeInputIndices,
  };
}

/**
 * Sign a rune transfer transaction with mixed key types (P2TR + P2WPKH).
 */
export function signRuneTransfer(
  tx: btc.Transaction,
  taprootPrivateKey: Uint8Array,
  btcPrivateKey: Uint8Array,
  taprootInputIndices: number[],
  feeInputIndices: number[]
): { txHex: string; txid: string; vsize: number } {
  for (const idx of taprootInputIndices) {
    tx.signIdx(taprootPrivateKey, idx);
  }
  for (const idx of feeInputIndices) {
    tx.signIdx(btcPrivateKey, idx);
  }
  tx.finalize();

  return { txHex: tx.hex, txid: tx.id, vsize: tx.vsize };
}
