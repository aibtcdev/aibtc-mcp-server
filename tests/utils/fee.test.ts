import { describe, it, expect, vi, beforeEach } from "vitest";
import { isFeePreset, resolveFee } from "../../src/utils/fee.js";

// Mock the hiro-api module
vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: vi.fn(() => ({
    getMempoolFees: vi.fn().mockResolvedValue({
      all: {
        no_priority: 1000,
        low_priority: 2000,
        medium_priority: 5000,
        high_priority: 10000,
      },
      token_transfer: {
        no_priority: 800,
        low_priority: 1500,
        medium_priority: 4000,
        high_priority: 8000,
      },
      contract_call: {
        no_priority: 1200,
        low_priority: 2500,
        medium_priority: 6000,
        high_priority: 12000,
      },
      smart_contract: {
        no_priority: 2000,
        low_priority: 4000,
        medium_priority: 10000,
        high_priority: 20000,
      },
    }),
  })),
}));

describe("fee utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isFeePreset", () => {
    it("should return true for 'low'", () => {
      expect(isFeePreset("low")).toBe(true);
    });

    it("should return true for 'medium'", () => {
      expect(isFeePreset("medium")).toBe(true);
    });

    it("should return true for 'high'", () => {
      expect(isFeePreset("high")).toBe(true);
    });

    it("should handle case-insensitive presets", () => {
      expect(isFeePreset("LOW")).toBe(true);
      expect(isFeePreset("Medium")).toBe(true);
      expect(isFeePreset("HIGH")).toBe(true);
    });

    it("should return false for numeric strings", () => {
      expect(isFeePreset("100000")).toBe(false);
    });

    it("should return false for invalid strings", () => {
      expect(isFeePreset("fast")).toBe(false);
      expect(isFeePreset("slow")).toBe(false);
      expect(isFeePreset("")).toBe(false);
    });
  });

  describe("resolveFee", () => {
    it("should return undefined when fee is undefined", async () => {
      const result = await resolveFee(undefined, "mainnet");
      expect(result).toBeUndefined();
    });

    it("should return undefined when fee is empty string", async () => {
      const result = await resolveFee("", "mainnet");
      expect(result).toBeUndefined();
    });

    it("should parse numeric string to bigint", async () => {
      const result = await resolveFee("100000", "mainnet");
      expect(result).toBe(100000n);
    });

    it("should handle large numeric values", async () => {
      const result = await resolveFee("999999999999", "mainnet");
      expect(result).toBe(999999999999n);
    });

    it("should trim whitespace from numeric strings", async () => {
      const result = await resolveFee("  100000  ", "mainnet");
      expect(result).toBe(100000n);
    });

    it("should resolve 'low' preset from mempool", async () => {
      const result = await resolveFee("low", "mainnet");
      expect(result).toBe(2000n); // low_priority from mock
    });

    it("should resolve 'medium' preset from mempool", async () => {
      const result = await resolveFee("medium", "mainnet");
      expect(result).toBe(5000n); // medium_priority from mock
    });

    it("should resolve 'high' preset from mempool", async () => {
      const result = await resolveFee("high", "mainnet");
      expect(result).toBe(10000n); // high_priority from mock
    });

    it("should handle case-insensitive presets", async () => {
      const resultLow = await resolveFee("LOW", "mainnet");
      const resultMedium = await resolveFee("MEDIUM", "mainnet");
      const resultHigh = await resolveFee("HIGH", "mainnet");

      expect(resultLow).toBe(2000n);
      expect(resultMedium).toBe(5000n);
      expect(resultHigh).toBe(10000n);
    });

    it("should use transaction-specific fees when txType is provided", async () => {
      const tokenTransfer = await resolveFee("high", "mainnet", "token_transfer");
      const contractCall = await resolveFee("high", "mainnet", "contract_call");
      const smartContract = await resolveFee("high", "mainnet", "smart_contract");

      // Note: These values are now clamped to their ceilings
      expect(tokenTransfer).toBe(3000n); // Clamped from 8000 to ceiling
      expect(contractCall).toBe(12000n); // Within range (3000-100000)
      expect(smartContract).toBe(20000n); // Within range (10000-100000)
    });

    it("should throw error for invalid numeric strings", async () => {
      await expect(resolveFee("abc", "mainnet")).rejects.toThrow(
        'Invalid fee value "abc"'
      );
    });

    it("should throw error for negative numbers", async () => {
      await expect(resolveFee("-500", "mainnet")).rejects.toThrow(
        'Invalid fee value "-500"'
      );
    });

    it("should throw error for decimal numbers", async () => {
      await expect(resolveFee("100.5", "mainnet")).rejects.toThrow(
        'Invalid fee value "100.5"'
      );
    });

    it("should throw error for numbers with invalid characters", async () => {
      await expect(resolveFee("100,000", "mainnet")).rejects.toThrow(
        'Invalid fee value "100,000"'
      );
    });
  });

  describe("fee clamping", () => {
    // Mock extreme values to test clamping
    const mockExtremeFees = {
      all: {
        no_priority: 100,
        low_priority: 50, // Below floor (180)
        medium_priority: 5000,
        high_priority: 200000, // Above ceiling (100000)
      },
      token_transfer: {
        no_priority: 100,
        low_priority: 50, // Below floor (180)
        medium_priority: 1000,
        high_priority: 10000, // Above ceiling (3000)
      },
      contract_call: {
        no_priority: 1000,
        low_priority: 1000, // Below floor (3000)
        medium_priority: 50000,
        high_priority: 200000, // Above ceiling (100000)
      },
      smart_contract: {
        no_priority: 5000,
        low_priority: 5000, // Below floor (10000)
        medium_priority: 50000,
        high_priority: 150000, // Above ceiling (100000)
      },
    };

    beforeEach(async () => {
      // Override the mock to return extreme values
      const { getHiroApi } = await import("../../src/services/hiro-api.js");
      vi.mocked(getHiroApi).mockReturnValue({
        getMempoolFees: vi.fn().mockResolvedValue(mockExtremeFees),
      } as any);
    });

    describe("floor clamping", () => {
      it("should clamp token_transfer low fee to floor (180)", async () => {
        const result = await resolveFee("low", "mainnet", "token_transfer");
        expect(result).toBe(180n); // Clamped from 50
      });

      it("should clamp contract_call low fee to floor (3000)", async () => {
        const result = await resolveFee("low", "mainnet", "contract_call");
        expect(result).toBe(3000n); // Clamped from 1000
      });

      it("should clamp smart_contract low fee to floor (10000)", async () => {
        const result = await resolveFee("low", "mainnet", "smart_contract");
        expect(result).toBe(10000n); // Clamped from 5000
      });

      it("should clamp 'all' low fee to floor (180)", async () => {
        const result = await resolveFee("low", "mainnet", "all");
        expect(result).toBe(180n); // Clamped from 50
      });
    });

    describe("ceiling clamping", () => {
      it("should clamp token_transfer high fee to ceiling (3000)", async () => {
        const result = await resolveFee("high", "mainnet", "token_transfer");
        expect(result).toBe(3000n); // Clamped from 10000
      });

      it("should clamp contract_call high fee to ceiling (100000)", async () => {
        const result = await resolveFee("high", "mainnet", "contract_call");
        expect(result).toBe(100000n); // Clamped from 200000
      });

      it("should clamp smart_contract high fee to ceiling (100000)", async () => {
        const result = await resolveFee("high", "mainnet", "smart_contract");
        expect(result).toBe(100000n); // Clamped from 150000
      });

      it("should clamp 'all' high fee to ceiling (100000)", async () => {
        const result = await resolveFee("high", "mainnet", "all");
        expect(result).toBe(100000n); // Clamped from 200000
      });
    });

    describe("within-range (no clamping)", () => {
      it("should not clamp token_transfer medium fee when within range", async () => {
        const result = await resolveFee("medium", "mainnet", "token_transfer");
        expect(result).toBe(1000n); // Not clamped (180 <= 1000 <= 3000)
      });

      it("should not clamp contract_call medium fee when within range", async () => {
        const result = await resolveFee("medium", "mainnet", "contract_call");
        expect(result).toBe(50000n); // Not clamped (3000 <= 50000 <= 100000)
      });

      it("should not clamp smart_contract medium fee when within range", async () => {
        const result = await resolveFee("medium", "mainnet", "smart_contract");
        expect(result).toBe(50000n); // Not clamped (10000 <= 50000 <= 100000)
      });

      it("should not clamp 'all' medium fee when within range", async () => {
        const result = await resolveFee("medium", "mainnet", "all");
        expect(result).toBe(5000n); // Not clamped (180 <= 5000 <= 100000)
      });
    });

    describe("numeric string fees (user-specified)", () => {
      it("should NOT clamp numeric string fees below floor", async () => {
        const result = await resolveFee("1", "mainnet", "token_transfer");
        expect(result).toBe(1n); // User-specified, not clamped
      });

      it("should NOT clamp numeric string fees above ceiling", async () => {
        const result = await resolveFee("9999999999", "mainnet", "token_transfer");
        expect(result).toBe(9999999999n); // User-specified, not clamped
      });

      it("should pass through exact user values", async () => {
        const result = await resolveFee("42069", "mainnet");
        expect(result).toBe(42069n);
      });
    });

    describe("txType range differences", () => {
      it("should use widest range (180-100000) for txType='all'", async () => {
        const lowResult = await resolveFee("low", "mainnet", "all");
        const highResult = await resolveFee("high", "mainnet", "all");

        expect(lowResult).toBe(180n); // Floor of 'all'
        expect(highResult).toBe(100000n); // Ceiling of 'all'
      });

      it("should use narrower range (180-3000) for token_transfer", async () => {
        const lowResult = await resolveFee("low", "mainnet", "token_transfer");
        const highResult = await resolveFee("high", "mainnet", "token_transfer");

        expect(lowResult).toBe(180n); // Floor of token_transfer
        expect(highResult).toBe(3000n); // Ceiling of token_transfer (narrower than 'all')
      });
    });
  });
});
