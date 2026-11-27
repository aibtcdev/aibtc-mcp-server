import { describe, it, expect } from "vitest";
import { ClarityType, cvToString } from "@stacks/transactions";
import { jsonToClarityValue } from "../../src/tools/signing.tools.js";

// SIP-018 sign/hash take a JSON message; a { type: "bool" } hint must not
// coerce strings or numbers via truthiness ("false" was hashed as true).
describe("jsonToClarityValue bool type hint", () => {
  it("keeps real booleans", () => {
    expect(jsonToClarityValue({ type: "bool", value: true }).type).toBe(ClarityType.BoolTrue);
    expect(jsonToClarityValue({ type: "bool", value: false }).type).toBe(ClarityType.BoolFalse);
  });

  it.each(["false", "true", 0, 1, ""])("rejects a non-boolean value (%j)", (value) => {
    expect(() => jsonToClarityValue({ type: "bool", value })).toThrow(
      "bool type requires a boolean value"
    );
  });
});

// buff hints must not be silently truncated: Buffer.from("12zz", "hex") is 0x12.
describe("jsonToClarityValue buff type hint", () => {
  it("accepts 0x, 0X and raw hex", () => {
    for (const v of ["0xabcd", "0XABCD", "abcd"]) {
      expect(cvToString(jsonToClarityValue({ type: "buff", value: v }))).toBe("0xabcd");
    }
  });

  it.each(["0x12zz", "0x123", "zz", "0x1"])("rejects invalid hex (%j)", (value) => {
    expect(() => jsonToClarityValue({ type: "buff", value })).toThrow("Invalid hex for buff value");
  });
});
