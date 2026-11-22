import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetTokenBalance = vi.fn();
const mockGetTokenMetadata = vi.fn();

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: vi.fn(() => ({
    getTokenBalance: (...args: unknown[]) => mockGetTokenBalance(...args),
    getTokenMetadata: (...args: unknown[]) => mockGetTokenMetadata(...args),
  })),
}));

const { SbtcService } = await import("../../src/services/sbtc.service.js");
const { satsToBtc, formatSbtc } = await import("../../src/utils/formatting.js");

const ADDRESS = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

describe("sBTC decimal display", () => {
  beforeEach(() => {
    mockGetTokenBalance.mockReset();
    mockGetTokenMetadata.mockReset();
  });

  it("satsToBtc preserves up to 8 decimals and drops trailing zeros", () => {
    expect(satsToBtc("50000000")).toBe("0.5");
    expect(satsToBtc("123456789")).toBe("1.23456789");
    expect(satsToBtc("248183430062")).toBe("2481.83430062");
    expect(satsToBtc("100000000")).toBe("1");
    expect(satsToBtc("1")).toBe("0.00000001");
    expect(satsToBtc(250000000n)).toBe("2.5");
  });

  it("formatSbtc keeps the sBTC suffix", () => {
    expect(formatSbtc("50000000")).toBe("0.5 sBTC");
    expect(formatSbtc("100000000")).toBe("1 sBTC");
  });

  it("getBalance reports fractional sBTC instead of truncating to zero", async () => {
    mockGetTokenBalance.mockResolvedValue("50000000");
    const balance = await new SbtcService("mainnet").getBalance(ADDRESS);
    expect(balance.balanceSats).toBe("50000000");
    expect(balance.balanceBtc).toBe("0.5");
  });

  it("getPegInfo reports fractional total supply", async () => {
    mockGetTokenMetadata.mockResolvedValue({ total_supply: "248183430062" });
    const peg = await new SbtcService("mainnet").getPegInfo();
    expect(peg.totalSupplySats).toBe("248183430062");
    expect(peg.totalSupplyBtc).toBe("2481.83430062");
  });
});
