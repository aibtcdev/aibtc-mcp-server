import { describe, it, expect } from "vitest";
import {
  selectPaymentOption,
  assetMatchesSelector,
  formatPaymentAmount,
  detectTokenType,
} from "../../src/services/x402.service.js";

const SBTC = "SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260QE.sbtc-token";
const USDCX = "SP120SBRRQVYYAJVVK9V3SF9RRD5TVW60HYT3DDPA.usdcx";

const accepts = [
  { network: "stacks:1", asset: "STX", amount: "29000000" },
  { network: "stacks:1", asset: SBTC, amount: "100" },
  { network: "stacks:1", asset: USDCX, amount: "29000000" },
];

describe("assetMatchesSelector", () => {
  it("matches sBTC by symbol", () => {
    expect(assetMatchesSelector(SBTC, "sBTC")).toBe(true);
    expect(assetMatchesSelector(SBTC, "SBTC")).toBe(true);
  });
  it("matches STX only against native STX", () => {
    expect(assetMatchesSelector("STX", "stx")).toBe(true);
    expect(assetMatchesSelector(USDCX, "stx")).toBe(false);
  });
  it("matches SIP-10 tokens by contract name or full id", () => {
    expect(assetMatchesSelector(USDCX, "usdcx")).toBe(true);
    expect(assetMatchesSelector(USDCX, USDCX)).toBe(true);
    expect(assetMatchesSelector(USDCX, "sbtc")).toBe(false);
  });
});

describe("selectPaymentOption", () => {
  it("defaults to first Stacks entry when no selector or preference", () => {
    expect(selectPaymentOption(accepts).asset).toBe("STX");
  });
  it("honors explicit asset selector (the #613 blocked case)", () => {
    expect(selectPaymentOption(accepts, "sBTC").asset).toBe(SBTC);
    expect(selectPaymentOption(accepts, "usdcx").asset).toBe(USDCX);
  });
  it("throws with accepted-asset list when selector matches nothing", () => {
    expect(() => selectPaymentOption(accepts, "wif")).toThrow(/not accepted/);
    expect(() => selectPaymentOption(accepts, "wif")).toThrow(/Accepted assets/);
  });
  it("prefers held assets when no explicit selector", () => {
    expect(selectPaymentOption(accepts, undefined, ["sBTC"]).asset).toBe(SBTC);
    expect(selectPaymentOption(accepts, undefined, ["sBTC", "STX"]).asset).toBe(SBTC);
  });
  it("falls back to first entry when held assets match nothing", () => {
    const sbtcOnly = [{ network: "stacks:1", asset: USDCX, amount: "1" }];
    expect(selectPaymentOption(sbtcOnly, undefined, ["sBTC", "STX"]).asset).toBe(USDCX);
  });
  it("skips non-Stacks networks and throws when none compatible", () => {
    const evm = [{ network: "eip155:8453", asset: "0xUSDC", amount: "1" }];
    expect(() => selectPaymentOption(evm)).toThrow(/No compatible Stacks/);
  });
});

describe("formatPaymentAmount (#613 bug 2 — mislabeled asset)", () => {
  it("formats native STX as STX", () => {
    expect(formatPaymentAmount("29000000", "STX")).toMatch(/STX/);
  });
  it("formats sBTC as sBTC", () => {
    expect(detectTokenType(SBTC)).toBe("sBTC");
    expect(formatPaymentAmount("100", SBTC)).toMatch(/sBTC/);
  });
  it("never labels an unknown SIP-10 token as STX", () => {
    const out = formatPaymentAmount("29000000", USDCX);
    expect(out).not.toMatch(/\bSTX\b/);
    expect(out).toContain("usdcx");
    expect(out).toContain(USDCX);
  });
});
