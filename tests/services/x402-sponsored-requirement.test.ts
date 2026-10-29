import { describe, it, expect } from "vitest";
import { isSponsoredRequirement } from "../../src/services/x402.service.js";

const FEE_PAYER = "SP3F6ZPHAR5D0YT0CTPJST7H3NBZ43A5FW226FMYP";

describe("isSponsoredRequirement", () => {
  it("is sponsored when the requirement names a fee payer", () => {
    expect(isSponsoredRequirement({ feePayer: FEE_PAYER })).toBe(true);
  });

  it("is sponsored on `sponsored: true` without a fee payer", () => {
    expect(isSponsoredRequirement({ sponsored: true })).toBe(true);
  });

  it("lets an explicit `sponsored: false` win over a fee payer", () => {
    expect(isSponsoredRequirement({ sponsored: false, feePayer: FEE_PAYER })).toBe(false);
  });

  it("ignores an empty or non-string fee payer", () => {
    expect(isSponsoredRequirement({ feePayer: "" })).toBe(false);
    expect(isSponsoredRequirement({ feePayer: 1 })).toBe(false);
  });

  it("is self-paid without either signal", () => {
    expect(isSponsoredRequirement(undefined)).toBe(false);
    expect(isSponsoredRequirement({ pricing: {} })).toBe(false);
  });
});
