import { describe, it, expect } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { p2tr, p2wpkh, NETWORK as BTC_MAINNET } from "@scure/btc-signer";
import { buildRuneTransfer, signRuneTransfer } from "../../src/transactions/rune-transfer-builder.js";
import { DUST_THRESHOLD } from "../../src/config/bitcoin-constants.js";
import type { UTXO } from "../../src/services/mempool-api.js";

const bytes = (fill: number) => new Uint8Array(32).fill(fill);
const taprootPrivateKey = bytes(3);
const segwitPrivateKey = bytes(7);

const taprootPubKey = secp256k1.getPublicKey(taprootPrivateKey, true).slice(1);
const segwitPubKey = secp256k1.getPublicKey(segwitPrivateKey, true);
const recipientPubKey = secp256k1.getPublicKey(bytes(9), true).slice(1);

const senderTaprootAddress = p2tr(taprootPubKey, undefined, BTC_MAINNET).address!;
const senderSegwitAddress = p2wpkh(segwitPubKey, BTC_MAINNET).address!;
const recipientAddress = p2tr(recipientPubKey, undefined, BTC_MAINNET).address!;

function utxo(value: number, vout: number): UTXO {
  return {
    txid: "11".repeat(32),
    vout,
    value,
    status: { confirmed: true, block_height: 800_000, block_hash: "", block_time: 0 },
  };
}

/** Decode an OP_RETURN OP_13 output into the LEB128 integer sequence of its runestone. */
function runestoneIntegers(script: Uint8Array): number[] {
  expect(script[0]).toBe(0x6a); // OP_RETURN
  expect(script[1]).toBe(0x5d); // OP_PUSHNUM_13
  const payloadLength = script[2];
  const payload = script.slice(3, 3 + payloadLength);

  const integers: number[] = [];
  let value = 0n;
  let shift = 0n;
  for (const byte of payload) {
    value |= BigInt(byte & 0x7f) << shift;
    if (byte & 0x80) {
      shift += 7n;
    } else {
      integers.push(Number(value));
      value = 0n;
      shift = 0n;
    }
  }
  return integers;
}

function transfer(runeSats: number, feeSats: number) {
  return buildRuneTransfer({
    runeId: "840000:1",
    amount: 10n,
    runeUtxos: [utxo(runeSats, 0)],
    feeUtxos: [utxo(feeSats, 1)],
    recipientAddress,
    feeRate: 2,
    senderPubKey: segwitPubKey,
    senderTaprootPubKey: taprootPubKey,
    senderAddress: senderSegwitAddress,
    senderTaprootAddress,
    network: "mainnet",
  });
}

describe("buildRuneTransfer", () => {
  it("builds a transaction that carries the runestone at output 0", () => {
    // A runestone lives in an OP_RETURN output, which @scure/btc-signer only
    // accepts on a Transaction built with allowUnknownOutputs.
    const result = transfer(DUST_THRESHOLD, 10_000);

    expect(result.tx.outputsLength).toBeGreaterThanOrEqual(2);
    expect(Array.from(result.tx.getOutput(0).script!.slice(0, 2))).toEqual([0x6a, 0x5d]);
  });

  it("encodes the pointer field, then one Body tag followed by the edict", () => {
    // Runes message: tag 22 (Pointer) and its value, then tag 0 (Body) once,
    // then the four edict integers (rune id block, rune id tx index, amount,
    // output). The Body tag ends the field list — anything after it is read as
    // edict integers — so a pointer written after it makes ord decipher a
    // cenotaph, which burns every rune in the transaction.
    const result = transfer(DUST_THRESHOLD, 10_000);
    const integers = runestoneIntegers(result.tx.getOutput(0).script!);

    expect(integers).toEqual([22, 2, 0, 840_000, 1, 10, 1]);
  });

  it("points the change at an output that exists", () => {
    const result = transfer(DUST_THRESHOLD, 10_000);
    const integers = runestoneIntegers(result.tx.getOutput(0).script!);
    const pointer = integers[1]; // tag 22, then its value

    // An out-of-range pointer is another cenotaph trigger.
    expect(pointer).toBeLessThan(result.tx.outputsLength);
  });

  it("signs the mixed taproot and segwit inputs", () => {
    // A P2TR input needs its untweaked internal key (tapInternalKey), or
    // signIdx cannot derive the tweaked key and throws "No taproot scripts signed".
    const result = transfer(DUST_THRESHOLD, 10_000);

    const signed = signRuneTransfer(
      result.tx,
      taprootPrivateKey,
      segwitPrivateKey,
      result.taprootInputIndices,
      result.feeInputIndices
    );

    expect(signed.txHex).toMatch(/^[0-9a-f]+$/);
    expect(signed.txid).toHaveLength(64);
  });
});
