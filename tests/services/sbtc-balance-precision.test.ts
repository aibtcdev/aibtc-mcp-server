import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression test for sBTC amounts being truncated to whole coins.
 *
 * `getBalance()` and `getPegInfo()` divided by 1e8 with BigInt integer
 * division, which discards the remainder. A wallet holding 0.5 sBTC
 * (50_000_000 sats) reported `balanceBtc: "0"`, and 99_999_999 sats reported
 * "0" too. Any sub-1-sBTC position looked empty, and `balanceBtc` never
 * agreed with `balanceSats`.
 */

const mockGetTokenBalance = vi.fn();
const mockGetTokenMetadata = vi.fn();

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: vi.fn(() => ({
    getTokenBalance: (...args: unknown[]) => mockGetTokenBalance(...args),
    getTokenMetadata: (...args: unknown[]) => mockGetTokenMetadata(...args),
    getContractInfo: (...args: unknown[]) => mockGetTokenMetadata(...args),
  })),
}));

const { SbtcService } = await import("../../src/services/sbtc.service.js");

const ADDRESS = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

/** Parse a decimal BTC/sBTC string back to sats without float error. */
function toSats(decimal: string): bigint {
  const [whole, frac = ""] = decimal.split(".");
  return BigInt(whole) * 100_000_000n + BigInt(frac.padEnd(8, "0"));
}

describe("SbtcService amount precision", () => {
  let service: InstanceType<typeof SbtcService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SbtcService("mainnet");
  });

  it("does not truncate a fractional balance to zero", async () => {
    mockGetTokenBalance.mockResolvedValue("50000000"); // 0.5 sBTC
    const { balanceBtc, balanceSats, balance } = await service.getBalance(ADDRESS);

    expect(balance).toBe("50000000");
    expect(balanceSats).toBe("50000000");
    expect(balanceBtc).toBe("0.5");
    // The two fields must describe the same amount.
    expect(toSats(balanceBtc)).toBe(BigInt(balanceSats));
  });

  it("keeps the last sat below one whole coin", async () => {
    mockGetTokenBalance.mockResolvedValue("99999999"); // 0.99999999 sBTC
    const { balanceBtc } = await service.getBalance(ADDRESS);
    expect(balanceBtc).toBe("0.99999999");
  });

  it("formats whole balances without a trailing decimal point", async () => {
    mockGetTokenBalance.mockResolvedValue("200000000"); // 2 sBTC
    const { balanceBtc } = await service.getBalance(ADDRESS);
    expect(balanceBtc).toBe("2");
  });

  it("does not truncate peg supply", async () => {
    mockGetTokenMetadata.mockResolvedValue({
      total_supply: "123456789",
    } as never);
    const info = await service.getPegInfo();
    expect(info.totalSupplyBtc).toBe("1.23456789");
    expect(toSats(info.totalSupplyBtc)).toBe(BigInt(info.totalSupplySats));
  });
});
