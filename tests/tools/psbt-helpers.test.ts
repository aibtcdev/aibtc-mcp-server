import { describe, expect, it } from "vitest";
import * as btc from "@scure/btc-signer";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  decodePsbtBase64,
  encodePsbtBase64,
  estimateBuyPsbtFeeSats,
  parseOutpoint,
} from "../../src/tools/psbt.helpers.js";

describe("psbt helper functions", () => {
  describe("parseOutpoint", () => {
    it("parses valid txid:vout", () => {
      const txid = "a".repeat(64);
      expect(parseOutpoint(`${txid}:3`)).toEqual({ txid, vout: 3 });
    });

    it("normalizes uppercase txid", () => {
      const outpoint = parseOutpoint(`${"AB".repeat(32)}:0`);
      expect(outpoint.txid).toBe("ab".repeat(32));
      expect(outpoint.vout).toBe(0);
    });

    it("throws on invalid format", () => {
      expect(() => parseOutpoint("not-an-outpoint")).toThrow(/Invalid outpoint format/);
      expect(() => parseOutpoint(`${"a".repeat(63)}:1`)).toThrow(/Invalid outpoint format/);
      expect(() => parseOutpoint(`${"a".repeat(64)}:-1`)).toThrow(/Invalid outpoint format/);
    });
  });

  describe("estimateBuyPsbtFeeSats", () => {
    it("estimates a positive fee", () => {
      const fee = estimateBuyPsbtFeeSats({
        feeRate: 10,
        buyerInputCount: 2,
        sellerInputVbytes: 68,
        outputCount: 3,
      });

      expect(fee).toBeGreaterThan(0);
    });

    it("throws for invalid params", () => {
      expect(() =>
        estimateBuyPsbtFeeSats({
          feeRate: 0,
          buyerInputCount: 1,
          sellerInputVbytes: 68,
          outputCount: 3,
        })
      ).toThrow(/feeRate/);

      expect(() =>
        estimateBuyPsbtFeeSats({
          feeRate: 10,
          buyerInputCount: -1,
          sellerInputVbytes: 68,
          outputCount: 3,
        })
      ).toThrow(/buyerInputCount/);
    });
  });
});

describe("PSBT base64 codec", () => {
  const privateKey = new Uint8Array(32).fill(7);
  const payment = btc.p2wpkh(secp256k1.getPublicKey(privateKey, true));

  // key: type 0xFC, identifier "abc" (length-prefixed), subtype 1
  const PROPRIETARY_KEY = [0xfc, 3, 0x61, 0x62, 0x63, 0x01];
  // key type 0xEE is not defined by BIP-174/370, so parsers treat it as unknown
  const UNKNOWN_KEY = [0xee, 0x01];

  // A 1-in/1-out PSBT whose input map carries one extra pair under `key`, as a
  // marketplace or co-signer would add. Built by splicing raw bytes so the
  // fixture does not depend on how the library constructs such fields.
  function psbtWithInputField(key: number[]): { base64: string; value: Uint8Array } {
    const tx = new btc.Transaction();
    tx.addInput({
      txid: "aa".repeat(32),
      index: 0,
      witnessUtxo: { script: payment.script, amount: 10_000n },
    });
    tx.addOutputAddress(payment.address!, 5_000n);
    const base = tx.toPSBT();

    // Walk magic, the global map and input 0's map; every length here is < 0xfd.
    let i = 5;
    const endOfMap = (): number => {
      for (;;) {
        const keyLen = base[i++];
        if (keyLen === 0) return i - 1;
        i += keyLen;
        const valueLen = base[i++];
        i += valueLen;
      }
    };
    endOfMap();
    const inputTerminator = endOfMap();

    const value = new Uint8Array([0x09, 0x08]);
    const bytes = new Uint8Array([
      ...base.slice(0, inputTerminator),
      key.length,
      ...key,
      value.length,
      ...value,
      ...base.slice(inputTerminator),
    ]);
    return { base64: Buffer.from(bytes).toString("base64"), value };
  }

  it("rejects an empty payload", () => {
    expect(() => decodePsbtBase64("")).toThrow("empty base64 payload");
  });

  it("keeps proprietary input fields through decode and encode", () => {
    const { base64, value } = psbtWithInputField(PROPRIETARY_KEY);
    const tx = decodePsbtBase64(base64);
    const proprietary = tx.getInput(0).proprietary;
    expect(proprietary).toHaveLength(1);
    expect(proprietary![0][1]).toEqual(value);
    expect(encodePsbtBase64(tx)).toBe(base64);
  });

  it("keeps proprietary input fields after signing (the psbt_sign path)", () => {
    const { base64, value } = psbtWithInputField(PROPRIETARY_KEY);
    const tx = decodePsbtBase64(base64);
    tx.signIdx(privateKey, 0);
    const signed = decodePsbtBase64(encodePsbtBase64(tx));
    expect(signed.getInput(0).partialSig).toHaveLength(1);
    expect(signed.getInput(0).proprietary![0][1]).toEqual(value);
  });

  it("keeps unknown input keys through decode and encode", () => {
    const { base64 } = psbtWithInputField(UNKNOWN_KEY);
    expect(encodePsbtBase64(decodePsbtBase64(base64))).toBe(base64);
  });
});
