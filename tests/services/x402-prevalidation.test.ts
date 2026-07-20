import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mocks — must be declared before importing the module under test
// ============================================================================

const mockGetBalance = vi.fn();
const mockGetStxBalance = vi.fn();
const mockGetMempoolFees = vi.fn();
const mockGetActiveAccount = vi.fn();

vi.mock("../../src/services/sbtc.service.js", () => ({
  getSbtcService: () => ({ getBalance: mockGetBalance }),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({
    getStxBalance: mockGetStxBalance,
    getMempoolFees: mockGetMempoolFees,
  }),
}));

vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({
    getActiveAccount: mockGetActiveAccount,
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
  createApiClient,
  getAccount,
  selectPaymentOption,
  summarizePaymentOptions,
  resolveAssetSymbol,
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

  it("returns sBTC for contract identifier ending with .sbtc-token (no asset suffix)", () => {
    expect(detectTokenType("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token")).toBe("sBTC");
  });

  // Previously every unrecognized asset fell back to "STX", which routed a
  // USDCx-denominated 402 into the interceptor's native-STX branch and signed a
  // real STX transfer for it. Unknown assets must be refused, not guessed (#613).
  it("returns unsupported for unknown asset identifiers", () => {
    expect(detectTokenType("some-random-token")).toBe("unsupported");
    expect(detectTokenType("")).toBe("unsupported");
    expect(detectTokenType("SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx")).toBe(
      "unsupported"
    );
  });

  it("recognizes CAIP-19-style native STX references", () => {
    expect(detectTokenType("stacks:1/native")).toBe("STX");
    expect(detectTokenType("stacks:1/slip44:5773")).toBe("STX");
  });

  it("does not false-match contract names containing sbtc-token as substring", () => {
    expect(detectTokenType("SP123.not-sbtc-token-wrapper")).toBe("unsupported");
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

  // The probe reported "This endpoint costs 29 STX" while payment.asset said
  // USDCx, because the unknown asset was scaled by 1e6 and labelled STX (#613).
  it("never labels a third-party token as STX", () => {
    const formatted = formatPaymentAmount(
      "29000000",
      "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
      { tokenType: "USDCx" }
    );
    expect(formatted).not.toMatch(/STX/);
    expect(formatted).toContain("USDCx");
    // Decimals are unknown, so the raw base units must survive unscaled.
    expect(formatted).toContain("29000000");
  });

  it("falls back to the contract name when the server advertises no symbol", () => {
    expect(resolveAssetSymbol("SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx")).toBe(
      "usdcx"
    );
  });
});

// The real payment-required header served by arc0btc.com, which is the endpoint
// in #613. Order matters: USDCx is listed first, so accepts[0] selection sent
// sBTC-only wallets down the USDCx path.
const ARC_ACCEPTS = [
  {
    scheme: "exact",
    network: "stacks:1",
    amount: "29000000",
    asset: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
    payTo: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
    maxTimeoutSeconds: 3600,
    extra: { tokenType: "USDCx" },
  },
  {
    scheme: "exact",
    network: "stacks:1",
    amount: "45385",
    asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
    payTo: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
    maxTimeoutSeconds: 3600,
    extra: { tokenType: "sBTC" },
  },
  {
    scheme: "exact",
    network: "stacks:1",
    amount: "159911365",
    asset: "STX",
    payTo: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
    maxTimeoutSeconds: 3600,
    extra: { tokenType: "STX" },
  },
] as never as Parameters<typeof selectPaymentOption>[0];

describe("selectPaymentOption (#613)", () => {
  it("skips the unpayable first entry instead of picking accepts[0]", () => {
    // The old code took accepts[0] (USDCx) and, because detectTokenType fell
    // back to STX, would have signed a 29 STX native transfer for it.
    const selected = selectPaymentOption(ARC_ACCEPTS);
    expect(selected.asset).toBe(
      "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
    );
    expect(selected.amount).toBe("45385");
  });

  it("honors an explicit asset symbol", () => {
    expect(selectPaymentOption(ARC_ACCEPTS, "STX").amount).toBe("159911365");
    expect(selectPaymentOption(ARC_ACCEPTS, "sBTC").amount).toBe("45385");
    // Case-insensitive, and full contract identifiers work too.
    expect(selectPaymentOption(ARC_ACCEPTS, "sbtc").amount).toBe("45385");
    expect(
      selectPaymentOption(
        ARC_ACCEPTS,
        "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
      ).amount
    ).toBe("45385");
  });

  it("refuses an accepted-but-unsignable asset rather than substituting another", () => {
    // USDCx IS accepted by the endpoint, but this client cannot sign it. The
    // caller must get an error, never a silent swap to STX.
    expect(() => selectPaymentOption(ARC_ACCEPTS, "USDCx")).toThrow(
      /not supported/i
    );
  });

  it("errors with the accepted list when the asset is not offered at all", () => {
    expect(() => selectPaymentOption(ARC_ACCEPTS, "DOGE")).toThrow(
      /does not accept "DOGE"/
    );
    expect(() => selectPaymentOption(ARC_ACCEPTS, "DOGE")).toThrow(/sBTC/);
  });

  it("errors when no offered asset is payable", () => {
    const usdcxOnly = [ARC_ACCEPTS[0]] as typeof ARC_ACCEPTS;
    expect(() => selectPaymentOption(usdcxOnly)).toThrow(/No payable asset/i);
  });

  it("rejects non-Stacks networks", () => {
    const evmOnly = [
      { ...ARC_ACCEPTS[0], network: "eip155:1" },
    ] as typeof ARC_ACCEPTS;
    expect(() => selectPaymentOption(evmOnly)).toThrow(/No compatible Stacks/i);
  });
});

describe("summarizePaymentOptions (#613)", () => {
  it("reports every asset with a payability flag so callers can choose", () => {
    const summary = summarizePaymentOptions(ARC_ACCEPTS);
    expect(summary).toHaveLength(3);
    expect(summary.map((o) => o.symbol)).toEqual(["USDCx", "sBTC", "STX"]);
    expect(summary.map((o) => o.payable)).toEqual([false, true, true]);
    expect(summary[1].formatted).toBe("0.00045385 sBTC");
    expect(summary[2].formatted).toBe("159.911365 STX");
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
        // required = payment (1_000_000) + clamped token_transfer fee (2_500)
        expect(error.required).toBe("1002500");
        // shortfall = required - balance
        expect(error.shortfall).toBe("502500");
      }
    });

    it("passes when balance exactly equals payment + fee", async () => {
      // Exactly 1_000_000 + clamped token_transfer fee 2_500 = 1_002_500
      mockGetStxBalance.mockResolvedValue({ balance: "1002500" });

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

  // ---------- Sponsored payment checks ----------

  describe("sponsored sBTC payments", () => {
    it("passes with sufficient sBTC even when STX balance is zero", async () => {
      mockGetBalance.mockResolvedValue({ balance: "200" }); // enough sBTC
      mockGetStxBalance.mockResolvedValue({ balance: "0" }); // STX balance is explicitly zero

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc", true)
      ).resolves.toBeUndefined();

      // Should NOT call STX balance or mempool fees — relay pays gas
      expect(mockGetStxBalance).not.toHaveBeenCalled();
      expect(mockGetMempoolFees).not.toHaveBeenCalled();
    });

    it("throws when sBTC balance is insufficient even if sponsored", async () => {
      mockGetBalance.mockResolvedValue({ balance: "50" }); // have 50, need 100

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc", true)
      ).rejects.toThrow(InsufficientBalanceError);

      try {
        await checkSufficientBalance(MOCK_ACCOUNT, "100", "sbtc", true);
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as InstanceType<typeof InsufficientBalanceError>;
        expect(error.tokenType).toBe("sBTC");
        expect(error.shortfall).toBe("50");
      }
    });
  });

  describe("sponsored STX payments", () => {
    it("passes when STX covers payment amount only (no fee estimation)", async () => {
      // Need 1_000_000 payment, no fee added for sponsored
      mockGetStxBalance.mockResolvedValue({ balance: "1000000" });

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX", true)
      ).resolves.toBeUndefined();

      // Should NOT fetch mempool fees — relay pays gas
      expect(mockGetMempoolFees).not.toHaveBeenCalled();
    });

    it("throws when STX balance is below payment amount (sponsored)", async () => {
      // Need 1_000_000, have 500_000 — no fee buffer needed but still short
      mockGetStxBalance.mockResolvedValue({ balance: "500000" });

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX", true)
      ).rejects.toThrow(InsufficientBalanceError);

      try {
        await checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX", true);
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as InstanceType<typeof InsufficientBalanceError>;
        expect(error.tokenType).toBe("STX");
        // shortfall = 1_000_000 - 500_000 = 500_000 (no fee added)
        expect(error.shortfall).toBe("500000");
        expect(error.required).toBe("1000000");
      }
    });

    it("passes at exact balance boundary without fee (sponsored)", async () => {
      // Exactly 1_000_000 — would fail non-sponsored (needs +15_000 fee)
      mockGetStxBalance.mockResolvedValue({ balance: "1000000" });

      await expect(
        checkSufficientBalance(MOCK_ACCOUNT, "1000000", "STX", true)
      ).resolves.toBeUndefined();
    });
  });
});

describe("payment attempt guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    // Mock wallet manager to return test account
    mockGetActiveAccount.mockReturnValue({
      address: "SP000000000000000000002Q6VF78",
      privateKey: "0".repeat(64),
      network: "mainnet",
    });
  });

  it("creates fresh client instance per call", async () => {
    // Act: create two clients with same base URL
    const client1 = await createApiClient("https://x402.example.com");
    const client2 = await createApiClient("https://x402.example.com");

    // Assert: instances should not be the same reference (no caching)
    expect(client1).not.toBe(client2);
  });

  it("increments payment attempt counter on first 402", async () => {
    // Create a test client
    const client = await createApiClient("https://x402.test.com");

    // Mock axios adapter to return 402
    client.defaults.adapter = async (config) => {
      // First call returns 402
      throw {
        response: {
          status: 402,
          data: {
            x402Version: 2,
            resource: { url: "https://x402.test.com/test" },
            accepts: [
              {
                network: "stacks:1",
                asset: "STX",
                amount: "1000",
                payTo: "SP000000000000000000002Q6VF78",
              },
            ],
          },
          headers: {},
          config,
        },
        config,
      };
    };

    // Act & Assert: first 402 should pass through guard (not blocked)
    try {
      await client.get("/test");
      expect.fail("Should have thrown 402 error");
    } catch (error) {
      const err = error as Error;
      // Should NOT be guard error message
      expect(err.message).not.toContain("Payment retry limit exceeded");
    }
  });

  it("blocks retry after payment attempt limit reached", async () => {
    // Arrange: create a client and force the adapter to always return 402
    const client = await createApiClient("https://x402.test.com");

    client.defaults.adapter = async (config) => {
      throw {
        response: {
          status: 402,
          data: {
            x402Version: 2,
            resource: { url: "https://x402.test.com/test" },
            accepts: [
              {
                network: "stacks:1",
                asset: "STX",
                amount: "1000",
                payTo: "SP000000000000000000002Q6VF78",
              },
            ],
          },
          headers: {},
          config,
        },
        config,
      };
    };

    // Act & Assert: first 402 should not be blocked by the guard
    try {
      await client.get("/test");
      expect.fail("First request should have thrown 402 error");
    } catch (error) {
      const err = error as Error;
      // First failure should NOT be the guard error
      expect(err.message).not.toContain("Payment retry limit exceeded");
    }

    // Act & Assert: second 402 should be rejected by the guard
    await expect(client.get("/test")).rejects.toThrow(
      "Payment retry limit exceeded",
    );
  });

  it("prefers canonical paymentId polling from upstream header hints on second 402", async () => {
    const client = await createApiClient("https://aibtc.com");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        paymentId: "pay_canonical_123",
        status: "failed",
        terminalReason: "sender_nonce_stale",
        retryable: true,
        checkStatusUrl: "https://aibtc.com/api/payment-status/pay_canonical_123",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    client.defaults.adapter = async (config) => {
      throw {
        response: {
          status: 402,
          data: {
            error: "payment still pending",
          },
          headers: {
            "x-payment-id": "pay_canonical_123",
            "x-payment-status": "pending",
            "x-payment-check-url": "/api/payment-status/pay_canonical_123",
          },
          config,
        },
        config,
      };
    };

    await client.get("/test").catch(() => undefined);

    await expect(client.get("/test")).rejects.toMatchObject({
      message: expect.stringContaining("sender_nonce_stale"),
      x402PaymentStatus: expect.objectContaining({
        paymentId: "pay_canonical_123",
        status: "failed",
        terminalReason: "sender_nonce_stale",
      }),
    });

    expect(fetchSpy).toHaveBeenCalledWith("https://aibtc.com/api/payment-status/pay_canonical_123", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const logEvents = consoleSpy.mock.calls
      .map(([entry]) => {
        try {
          return JSON.parse(String(entry)) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is Record<string, unknown> => entry !== null);

    expect(logEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "payment.poll",
        service: "aibtc-mcp-server",
        tool: "createApiClient",
        paymentId: "pay_canonical_123",
        checkStatusUrl_present: true,
        compat_shim_used: false,
      }),
      expect.objectContaining({
        event: "payment.retry_decision",
        paymentId: "pay_canonical_123",
        status: "failed",
        terminalReason: "sender_nonce_stale",
        action: "rebuild_sender",
        compat_shim_used: false,
      }),
      expect.objectContaining({
        event: "payment.finalized",
        paymentId: "pay_canonical_123",
        status: "failed",
        action: "rebuild_sender",
        compat_shim_used: false,
      }),
    ]));
    expect(logEvents.find((entry) => entry.event === "payment.fallback_used")).toBeUndefined();
    consoleSpy.mockRestore();
  });
});

describe("x402 per-payment spend cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockGetActiveAccount.mockReturnValue(MOCK_ACCOUNT);
  });

  /** Adapter that always 402s with a properly encoded payment-required header */
  function make402Adapter(asset: string, amount: string) {
    return async (config: unknown) => {
      const paymentRequired = {
        x402Version: 2,
        resource: { url: "https://x402.test.com/test" },
        accepts: [
          { network: "stacks:1", asset, amount, payTo: MOCK_ACCOUNT.address },
        ],
      };
      throw {
        response: {
          status: 402,
          data: paymentRequired,
          headers: {
            "payment-required": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
          },
          config,
        },
        config,
      };
    };
  }

  it("rejects STX payments above the uSTX cap", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = make402Adapter("STX", "2000000"); // 2 STX > 1 STX default cap
    await expect(client.get("/test")).rejects.toThrow("exceeds the per-payment cap");
  });

  it("rejects sBTC payments above the sats cap", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = make402Adapter("sbtc", "20000"); // > 10k sats default cap
    await expect(client.get("/test")).rejects.toThrow("exceeds the per-payment cap");
  });

  it("does not block payments at the cap", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = make402Adapter("STX", "1000000"); // exactly 1 STX
    try {
      await client.get("/test");
      expect.fail("Should have thrown (mock account cannot sign)");
    } catch (error) {
      expect((error as Error).message).not.toContain("exceeds the per-payment cap");
    }
  });
});
