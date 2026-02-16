import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mocks — must be declared before importing the module under test
// ============================================================================

const mockGetBalance = vi.fn();
const mockGetStxBalance = vi.fn();
const mockGetMempoolFees = vi.fn();

vi.mock("../../src/services/sbtc.service.js", () => ({
  getSbtcService: () => ({ getBalance: mockGetBalance }),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({
    getStxBalance: mockGetStxBalance,
    getMempoolFees: mockGetMempoolFees,
  }),
}));

// Import after mocks are established
const {
  checkSufficientBalance,
  generateDedupKey,
  checkDedupCache,
  recordTransaction,
  detectTokenType,
  formatPaymentAmount,
} = await import("../../src/services/x402.service.js");

const { InsufficientBalanceError } = await import("../../src/utils/errors.js");

// ============================================================================
// Helpers
// ============================================================================

const MOCK_ACCOUNT = {
  address: "SP000000000000000000002Q6VF78",
  privateKey: "0".repeat(64),
  network: "mainnet" as const,
};

/** Standard mempool fee response used across tests */
const standardFees = {
  all: { no_priority: 0, low_priority: 1000, medium_priority: 5000, high_priority: 10000 },
  token_transfer: { no_priority: 0, low_priority: 500, medium_priority: 2500, high_priority: 5000 },
  contract_call: { no_priority: 0, low_priority: 2000, medium_priority: 8000, high_priority: 15000 },
  smart_contract: { no_priority: 0, low_priority: 5000, medium_priority: 20000, high_priority: 50000 },
};

// ============================================================================
// Tests
// ============================================================================

describe("detectTokenType", () => {
  it("returns STX for plain stx identifiers", () => {
    expect(detectTokenType("STX")).toBe("STX");
    expect(detectTokenType("stx")).toBe("STX");
  });

  it("returns sBTC for exact sbtc token name", () => {
    expect(detectTokenType("sbtc")).toBe("sBTC");
    expect(detectTokenType("sBTC")).toBe("sBTC");
  });

  it("returns sBTC for full contract identifier ending with ::token-sbtc", () => {
    expect(detectTokenType("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::token-sbtc")).toBe("sBTC");
  });

  it("returns STX for unknown asset identifiers", () => {
    expect(detectTokenType("some-random-token")).toBe("STX");
    expect(detectTokenType("")).toBe("STX");
  });
});

describe("formatPaymentAmount", () => {
  it("formats STX amounts from micro-STX", () => {
    expect(formatPaymentAmount("1000000", "STX")).toBe("1 STX");
    expect(formatPaymentAmount("1500000", "STX")).toBe("1.5 STX");
  });

  it("formats sBTC amounts from sats", () => {
    expect(formatPaymentAmount("100", "sbtc")).toBe("0.000001 sBTC");
    expect(formatPaymentAmount("100000000", "sbtc")).toBe("1 sBTC");
  });
});

describe("generateDedupKey", () => {
  it("produces consistent keys for identical inputs", () => {
    const key1 = generateDedupKey("POST", "https://example.com/api", { q: "test" }, { body: "data" });
    const key2 = generateDedupKey("POST", "https://example.com/api", { q: "test" }, { body: "data" });
    expect(key1).toBe(key2);
  });

  it("produces different keys when method differs", () => {
    const key1 = generateDedupKey("GET", "https://example.com/api");
    const key2 = generateDedupKey("POST", "https://example.com/api");
    expect(key1).not.toBe(key2);
  });

  it("produces different keys when url differs", () => {
    const key1 = generateDedupKey("GET", "https://example.com/a");
    const key2 = generateDedupKey("GET", "https://example.com/b");
    expect(key1).not.toBe(key2);
  });

  it("produces different keys when params differ", () => {
    const key1 = generateDedupKey("GET", "https://example.com", { q: "a" });
    const key2 = generateDedupKey("GET", "https://example.com", { q: "b" });
    expect(key1).not.toBe(key2);
  });

  it("produces different keys when body data differs", () => {
    const key1 = generateDedupKey("POST", "https://example.com", undefined, { x: 1 });
    const key2 = generateDedupKey("POST", "https://example.com", undefined, { x: 2 });
    expect(key1).not.toBe(key2);
  });

  it("returns a 64-char hex string (SHA-256)", () => {
    const key = generateDedupKey("GET", "https://example.com");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("checkDedupCache / recordTransaction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for unknown keys", () => {
    expect(checkDedupCache("nonexistent-key")).toBeNull();
  });

  it("returns txid for recently recorded transactions", () => {
    const key = "test-key-1";
    recordTransaction(key, "0xabc123");
    expect(checkDedupCache(key)).toBe("0xabc123");
  });

  it("returns null after 60 second TTL expires", () => {
    const key = "test-key-ttl";
    recordTransaction(key, "0xexpired");

    // Still valid at 59 seconds
    vi.advanceTimersByTime(59_000);
    expect(checkDedupCache(key)).toBe("0xexpired");

    // Expired at 61 seconds
    vi.advanceTimersByTime(2_000);
    expect(checkDedupCache(key)).toBeNull();
  });

  it("overwrites previous entry for the same key", () => {
    const key = "test-key-overwrite";
    recordTransaction(key, "0xfirst");
    recordTransaction(key, "0xsecond");
    expect(checkDedupCache(key)).toBe("0xsecond");
  });
});

describe("checkSufficientBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMempoolFees.mockResolvedValue(standardFees);
  });

  // ---------- STX balance checks ----------

  describe("STX payments", () => {
    it("passes when STX balance covers payment + fee", async () => {
      // Need 1_000_000 payment + 15_000 fee = 1_015_000
      mockGetStxBalance.mockResolvedValue({ balance: "2000000" });

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX")
      ).resolves.toBeUndefined();
    });

    it("throws InsufficientBalanceError when STX balance is too low", async () => {
      // Need 1_000_000 payment + 15_000 fee = 1_015_000, have 500_000
      mockGetStxBalance.mockResolvedValue({ balance: "500000" });

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX")
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it("includes correct shortfall in error details", async () => {
      mockGetStxBalance.mockResolvedValue({ balance: "500000" });

      try {
        await checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as InstanceType<typeof InsufficientBalanceError>;
        expect(error.tokenType).toBe("STX");
        expect(error.balance).toBe("500000");
        // required = payment (1_000_000) + high_priority fee (15_000)
        expect(error.required).toBe("1015000");
        // shortfall = required - balance
        expect(error.shortfall).toBe("515000");
      }
    });

    it("passes when balance exactly equals payment + fee", async () => {
      // Exactly 1_000_000 + 15_000 = 1_015_000
      mockGetStxBalance.mockResolvedValue({ balance: "1015000" });

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX")
      ).resolves.toBeUndefined();
    });
  });

  // ---------- sBTC balance checks ----------

  describe("sBTC payments", () => {
    it("passes when sBTC balance is sufficient and STX covers gas", async () => {
      mockGetBalance.mockResolvedValue({ balance: "200" }); // 200 sats, need 100
      mockGetStxBalance.mockResolvedValue({ balance: "100000" }); // plenty for gas

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc")
      ).resolves.toBeUndefined();
    });

    it("throws when sBTC balance is insufficient", async () => {
      mockGetBalance.mockResolvedValue({ balance: "50" }); // have 50, need 100

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc")
      ).rejects.toThrow(InsufficientBalanceError);

      try {
        await checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as InstanceType<typeof InsufficientBalanceError>;
        expect(error.tokenType).toBe("sBTC");
        expect(error.shortfall).toBe("50");
      }
    });

    it("throws when sBTC balance is sufficient but STX for gas is insufficient", async () => {
      mockGetBalance.mockResolvedValue({ balance: "200" }); // sBTC is fine
      mockGetStxBalance.mockResolvedValue({ balance: "100" }); // only 100 uSTX, need 15_000

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc")
      ).rejects.toThrow(InsufficientBalanceError);

      try {
        await checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as InstanceType<typeof InsufficientBalanceError>;
        expect(error.tokenType).toBe("STX");
        expect(error.message).toContain("sBTC transfer fee");
      }
    });

    it("detects sBTC via full contract identifier", async () => {
      mockGetBalance.mockResolvedValue({ balance: "200" });
      mockGetStxBalance.mockResolvedValue({ balance: "100000" });

      await expect(
        checkSufficientBalance(
          MOCK_ACCOUNT,
          "100",
          "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::token-sbtc"
        )
      ).resolves.toBeUndefined();

      // Verify it called sBTC service, not just STX balance
      expect(mockGetBalance).toHaveBeenCalledWith(MOCK_ACCOUNT.address);
    });
  });
});
