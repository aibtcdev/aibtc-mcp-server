import { describe, it, expect } from "vitest";
import { paymentIdMemo } from "../../src/services/x402.service.js";

describe("paymentIdMemo", () => {
  it("cuts a 36-char UUID to its first 34 bytes", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(paymentIdMemo({ payment_id: id })).toBe(id.slice(0, 34));
  });

  it("keeps a payment_id that fits", () => {
    expect(paymentIdMemo({ payment_id: "pay_abc" })).toBe("pay_abc");
  });

  it("never splits a multi-byte character", () => {
    const memo = paymentIdMemo({ payment_id: "a".repeat(33) + "é" });
    expect(memo).toBe("a".repeat(33));
    expect(Buffer.byteLength(memo!, "utf8")).toBeLessThanOrEqual(34);
  });

  it("returns undefined without a string payment_id", () => {
    expect(paymentIdMemo(undefined)).toBeUndefined();
    expect(paymentIdMemo({})).toBeUndefined();
    expect(paymentIdMemo({ payment_id: "" })).toBeUndefined();
    expect(paymentIdMemo({ payment_id: 42 })).toBeUndefined();
  });
});
