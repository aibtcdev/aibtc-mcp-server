import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// sBTC amounts are held as integer satoshis (8 decimals), but the human-facing
// `balanceBtc` / `totalSupplyBtc` fields are produced with an integer division:
//
//   const balanceBtc = (BigInt(balance) / BigInt(100_000_000)).toString();
//
// Integer division truncates, so every balance below 1 sBTC reports as "0" and
// every fractional part is silently dropped. A wallet holding 0.5 sBTC is told
// it holds 0; a 1.23456789 sBTC balance is reported as 1.
// ---------------------------------------------------------------------------

const mockGetTokenBalance = vi.fn();
const mockGetTokenMetadata = vi.fn();

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: vi.fn(() => ({
    getTokenBalance: (...args: unknown[]) => mockGetTokenBalance(...args),
    getTokenMetadata: (...args: unknown[]) => mockGetTokenMetadata(...args),
    getContractInterface: vi.fn().mockResolvedValue({
      fungible_tokens: [{ name: "sbtc-token" }],
    }),
  })),
}));

const { SbtcService } = await import("../../src/services/sbtc.service.js");

describe("sBTC balance display keeps the fractional part", () => {
  it("reports a sub-1-sBTC balance instead of truncating it to 0", async () => {
    // 0.5 sBTC == 50_000_000 sats
    mockGetTokenBalance.mockResolvedValue(50_000_000n);
    const info = await new SbtcService("mainnet").getBalance(
      "SP000000000000000000002Q6VF78"
    );

    expect(info.balanceSats).toBe(50_000_000n);
    expect(info.balanceBtc).not.toBe("0");
    expect(Number(info.balanceBtc)).toBeCloseTo(0.5, 8);
  });

  it("keeps all 8 decimals of an odd balance", async () => {
    // 1.23456789 sBTC
    mockGetTokenBalance.mockResolvedValue(123_456_789n);
    const info = await new SbtcService("mainnet").getBalance(
      "SP000000000000000000002Q6VF78"
    );

    expect(Number(info.balanceBtc)).toBeCloseTo(1.23456789, 8);
  });

  it("keeps the full precision of total peg supply", async () => {
    // 2481.83430062 sBTC
    mockGetTokenMetadata.mockResolvedValue({ total_supply: "248183430062" });
    const info = await new SbtcService("mainnet").getPegInfo();

    expect(info.totalSupplySats).toBe("248183430062");
    expect(Number(info.totalSupplyBtc)).toBeCloseTo(2481.83430062, 8);
  });

  it("still reports exact whole amounts without a trailing decimal", async () => {
    mockGetTokenBalance.mockResolvedValue(100_000_000n);
    const info = await new SbtcService("mainnet").getBalance(
      "SP000000000000000000002Q6VF78"
    );

    expect(info.balanceBtc).toBe("1");
  });
});
