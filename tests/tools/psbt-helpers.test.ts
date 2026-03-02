import { describe, expect, it } from "vitest";
import { estimateBuyPsbtFeeSats, parseOutpoint } from "../../src/tools/psbt.helpers.js";

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
