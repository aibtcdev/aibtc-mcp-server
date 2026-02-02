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

      expect(tokenTransfer).toBe(8000n);
      expect(contractCall).toBe(12000n);
      expect(smartContract).toBe(20000n);
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
});
