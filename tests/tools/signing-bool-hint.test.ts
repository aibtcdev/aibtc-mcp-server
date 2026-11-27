import { describe, it, expect } from "vitest";
import { ClarityType } from "@stacks/transactions";
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
