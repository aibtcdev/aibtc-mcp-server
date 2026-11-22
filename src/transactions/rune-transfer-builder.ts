/**
 * Rune Transfer Builder
 *
 * Builds a transaction to transfer runes from one address to another.
 * Transaction structure:
 * - P2TR inputs: rune UTXOs (signed with taproot key)
 * - P2WPKH inputs: cardinal UTXOs for fees (signed with segwit key)
 * - OP_RETURN output: Runestone with edict + change pointer
 * - P2TR output: recipient receives runes (dust amount)
 * - P2TR output: rune change back to sender (always present, the runestone
 *   pointer targets it)
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
import type { UTXO } from "../services/mempool-api.js";
import { buildRunestoneScript, parseRuneId, type RuneEdict } from "./runestone-builder.js";
import { getBtcNetwork } from "./bitcoin-builder.js";

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

function sameScript(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((byte, i) => byte === b[i]);
}

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
  // OP_RETURN outputs decode as an unknown script type in @scure/btc-signer, and
  // addOutput refuses unknown scripts unless this is set, so the runestone output
  // could never be added without it.
  const tx = new btc.Transaction({ allowUnknownOutputs: true });

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
      // signIdx needs the untweaked internal key to derive the tweaked key-path
      // key; without it a P2TR input cannot be signed ("No taproot scripts signed").
      tapInternalKey: senderTaprootPubKey,
    });
    taprootInputIndices.push(i);
  }

  // Fee UTXOs (P2WPKH inputs)
  const senderP2wpkh = btc.p2wpkh(senderPubKey, btcNetwork);
  const sortedFeeUtxos = [...feeUtxos]
    .filter((u) => u.status.confirmed)
    .sort((a, b) => b.value - a.value);

  if (sortedFeeUtxos.length === 0) throw new Error("No confirmed fee UTXOs available");

  // Runes that no edict allocates go to the Runestone pointer output, and they
  // must land on an output the sender controls as Taproot: sats on a P2WPKH
  // output are spendable as plain BTC, so leftover runes there are effectively
  // lost. The rune change output is therefore always built, topped up from the
  // fee inputs when the rune UTXOs are too small to keep it above dust (the
  // common single 546-sat rune UTXO leaves nothing after the recipient's dust).
  const runeSats = runeUtxos.reduce((sum, u) => sum + u.value, 0);
  const runeSatsAfterRecipient = runeSats - DUST_THRESHOLD;
  const runeChangeOutputSats = Math.max(runeSatsAfterRecipient, DUST_THRESHOLD);
  const runeChangeTopUpSats = runeChangeOutputSats - runeSatsAfterRecipient;

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

    // The fee inputs also carry the rune change output's top-up, so reserve it
    // alongside the fee and the BTC change dust.
    if (
      feeTotal >=
      Math.ceil(estimatedVsize * feeRate) + runeChangeTopUpSats + DUST_THRESHOLD
    ) {
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

  // The outputs are laid out before the Runestone is written, because its
  // pointer field has to name an output index that actually exists:
  //   0: OP_RETURN Runestone
  //   1: Recipient (rune dust)
  //   2: Rune change (sender Taproot)
  //   3: BTC change (sender SegWit, only when it is at least dust)
  // The pointer is taken from this layout instead of a hard-coded index: it must
  // target the sender's Taproot rune change output, never the SegWit BTC change
  // and never an index past the end (a missing pointer output, or runes on a
  // P2WPKH output, is how runes get burned or lost).
  type PlannedOutput =
    | { kind: "runestone" }
    | { kind: "recipient" | "rune-change" | "btc-change"; address: string; sats: number };

  const plannedOutputs: PlannedOutput[] = [
    { kind: "runestone" },
    { kind: "recipient", address: recipientAddress, sats: DUST_THRESHOLD },
    { kind: "rune-change", address: senderTaprootAddress, sats: runeChangeOutputSats },
  ];

  // Fee sizing keeps the existing reserve: actualOutputCount counts the BTC change
  // as both a Taproot and a SegWit output, so the estimate reserves about one P2TR
  // output too many. That overpay is a pre-existing bug flagged in review for a
  // separate PR; leaving it untouched keeps this change to the pointer and means no
  // path can underpay the fee.
  const actualOutputCount = 3 + (runeSatsAfterRecipient >= DUST_THRESHOLD ? 1 : 0);
  const finalVsize =
    TX_OVERHEAD_VBYTES +
    runeUtxos.length * P2TR_INPUT_BASE_VBYTES +
    selectedFeeUtxos.length * P2WPKH_INPUT_VBYTES +
    OP_RETURN_VBYTES +
    (actualOutputCount - 1) * P2TR_OUTPUT_VBYTES +
    P2WPKH_OUTPUT_VBYTES;

  const finalFee = Math.ceil(finalVsize * feeRate);
  const btcChange = feeTotal - finalFee - runeChangeTopUpSats;

  if (btcChange < 0) {
    throw new Error(
      `Insufficient fee UTXOs: have ${feeTotal} sats, need ${
        finalFee + runeChangeTopUpSats
      } sats for fee and rune change`
    );
  }

  if (btcChange >= DUST_THRESHOLD) {
    plannedOutputs.push({ kind: "btc-change", address: senderAddress, sats: btcChange });
  }

  const recipientOutputIndex = plannedOutputs.findIndex((o) => o.kind === "recipient");
  const runeChangeOutputIndex = plannedOutputs.findIndex((o) => o.kind === "rune-change");

  const edict: RuneEdict = { block, txIndex, amount, outputIndex: recipientOutputIndex };
  const runestoneScript = buildRunestoneScript({ edict, changeOutput: runeChangeOutputIndex });

  // Outputs are added in the planned order, so the transaction indexes match the
  // plan's indexes and the pointer written above names the rune change output.
  for (const output of plannedOutputs) {
    if (output.kind === "runestone") {
      tx.addOutput({ script: runestoneScript, amount: 0n });
    } else {
      tx.addOutputAddress(output.address, BigInt(output.sats), btcNetwork);
    }
  }

  const pointerOutput =
    runeChangeOutputIndex >= 0 && runeChangeOutputIndex < tx.outputsLength
      ? tx.getOutput(runeChangeOutputIndex)
      : undefined;
  if (!pointerOutput?.script || !sameScript(pointerOutput.script, taprootPayment.script)) {
    throw new Error(
      `Runestone pointer must target the sender's Taproot rune change output, but output ${runeChangeOutputIndex} is not it`
    );
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
