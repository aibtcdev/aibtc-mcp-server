import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mocks — must be declared before importing the module under test
// ============================================================================

const mockGetActiveAccount = vi.fn();
const mockWalletIsUnlocked = vi.fn();
const mockPayInvoice = vi.fn();
const mockGetProvider = vi.fn();
const mockBolt11Decode = vi.fn();

vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({
    getActiveAccount: mockGetActiveAccount,
    isUnlocked: mockWalletIsUnlocked,
  }),
}));

vi.mock("../../src/services/lightning-manager.js", () => ({
  getLightningManager: () => ({
    getProvider: mockGetProvider,
  }),
}));

vi.mock("../../src/services/sbtc.service.js", () => ({
  getSbtcService: () => ({ getBalance: vi.fn() }),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({
    getStxBalance: vi.fn(),
    getMempoolFees: vi.fn(),
  }),
}));

vi.mock("light-bolt11-decoder", () => ({
  decode: (invoice: string) => mockBolt11Decode(invoice),
}));

// Import after mocks are established
const { createApiClient } = await import("../../src/services/x402.service.js");
const { clearL402Cache } = await import("../../src/utils/l402-protocol.js");

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a synthetic light-bolt11-decoder result whose amount section reports
 * a given sats amount. Real invoice strings need not validate — `bolt11Decode`
 * is mocked.
 */
function bolt11Sections(amountSats: number) {
  return {
    sections: [
      {
        name: "amount",
        letters: `${amountSats}sat`,
        value: String(BigInt(amountSats) * 1000n),
      },
    ],
  };
}

/**
 * No-amount-section result, simulating an amountless BOLT-11 invoice.
 */
function bolt11NoAmount() {
  return {
    sections: [
      { name: "payment_hash", letters: "abc", value: "abc" },
    ],
  };
}

/**
 * Build an L402 challenge response object. Returns an axios-style error
 * shape that the interceptor will catch.
 */
function l402ChallengeError(config: {
  url?: string;
  method?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  invoice?: string;
  macaroon?: string;
}) {
  const invoice = config.invoice ?? "lnbc1pfakeinvoice";
  const macaroon = config.macaroon ?? "AGIAJEemVQUTEyNCR0exk7ek90Cg==";
  return {
    response: {
      status: 402,
      data: { error: "payment required" },
      headers: {
        "www-authenticate": `L402 macaroon="${macaroon}", invoice="${invoice}"`,
      },
      config,
    },
    config,
  };
}

const DEFAULT_PREIMAGE = "0".repeat(64);

// ============================================================================
// Tests
// ============================================================================

describe("L402 interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearL402Cache();
    // Default: no Stacks wallet unlocked, so the L402 path is preferred.
    mockWalletIsUnlocked.mockReturnValue(false);
    mockGetActiveAccount.mockReturnValue(null);
    // Default: Lightning provider is unlocked and pays successfully.
    mockGetProvider.mockReturnValue({ payInvoice: mockPayInvoice });
    mockPayInvoice.mockResolvedValue({
      preimage: DEFAULT_PREIMAGE,
      feesPaid: 0,
    });
    // Default: small invoice well under cap.
    mockBolt11Decode.mockReturnValue(bolt11Sections(100));
  });

  afterEach(() => {
    clearL402Cache();
  });

  it("parses macaroon + invoice from WWW-Authenticate header and pays", async () => {
    const client = await createApiClient("https://lightning.test");
    let callCount = 0;

    client.defaults.adapter = async (config) => {
      callCount += 1;
      if (callCount === 1) {
        // First call: 402 with L402 challenge.
        throw l402ChallengeError({ ...config, invoice: "lnbc1qabc" });
      }
      // Second call (after payment): expect Authorization header and return 200.
      const auth = config.headers?.["Authorization"];
      expect(auth).toBe(
        `L402 AGIAJEemVQUTEyNCR0exk7ek90Cg==:${DEFAULT_PREIMAGE}`
      );
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const response = await client.get("/protected");
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
    expect(mockPayInvoice).toHaveBeenCalledTimes(1);
    expect(mockPayInvoice).toHaveBeenCalledWith("lnbc1qabc");
  });

  it("rejects invoices whose amount exceeds L402_MAX_SATS_PER_INVOICE without paying", async () => {
    // The default cap is 10_000 sats; bolt11 reports 1_000_000 sats.
    mockBolt11Decode.mockReturnValue(bolt11Sections(1_000_000));

    const client = await createApiClient("https://lightning.test");
    client.defaults.adapter = async (config) => {
      throw l402ChallengeError(config);
    };

    await expect(client.get("/expensive")).rejects.toThrow(
      /exceeds the configured cap/
    );
    expect(mockPayInvoice).not.toHaveBeenCalled();
  });

  it("rejects amountless invoices without paying", async () => {
    mockBolt11Decode.mockReturnValue(bolt11NoAmount());

    const client = await createApiClient("https://lightning.test");
    client.defaults.adapter = async (config) => {
      throw l402ChallengeError(config);
    };

    await expect(client.get("/no-amount")).rejects.toThrow(
      /amountless invoices/
    );
    expect(mockPayInvoice).not.toHaveBeenCalled();
  });

  it("reuses cached macaroon on the second call to the same URL without paying again", async () => {
    let callCount = 0;
    const client = await createApiClient("https://lightning.test");

    client.defaults.adapter = async (config) => {
      callCount += 1;
      if (callCount === 1) {
        // Initial 402.
        throw l402ChallengeError({ ...config, invoice: "lnbc1first" });
      }
      // Subsequent calls: must carry Authorization header.
      const auth = config.headers?.["Authorization"];
      if (typeof auth !== "string" || !auth.startsWith("L402 ")) {
        throw new Error(
          `expected L402 Authorization header on call ${callCount}, got: ${String(auth)}`
        );
      }
      return {
        data: { call: callCount },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    // First call pays.
    const r1 = await client.get("/cached");
    expect(r1.status).toBe(200);
    expect(mockPayInvoice).toHaveBeenCalledTimes(1);

    // Second call: no 402, the cached header is supplied by the interceptor
    // BUT the server in this test always returns 200 if Authorization is set,
    // and 402 otherwise. Hit the URL again — the interceptor only attaches
    // Authorization in response to a 402, so simulate a stale-revalidation
    // case where the upstream still issues 402 → cached header gets used.
    callCount = 0;
    let secondCall = 0;
    client.defaults.adapter = async (config) => {
      secondCall += 1;
      if (secondCall === 1) {
        // Server signals stale auth with 402 again; interceptor should
        // attach cached macaroon and retry without paying.
        throw l402ChallengeError({ ...config, invoice: "lnbc1second" });
      }
      const auth = config.headers?.["Authorization"];
      expect(auth).toBeDefined();
      return {
        data: { ok: "cache-hit" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const r2 = await client.get("/cached");
    expect(r2.status).toBe(200);
    expect(r2.data).toEqual({ ok: "cache-hit" });
    // Still only one payInvoice call from the first request.
    expect(mockPayInvoice).toHaveBeenCalledTimes(1);
  });

  it("invalidates the cache when a cached-macaroon retry returns 401/402/403", async () => {
    // Prime the cache by completing a successful pay+retry cycle.
    let callCount = 0;
    const client = await createApiClient("https://lightning.test");
    client.defaults.adapter = async (config) => {
      callCount += 1;
      if (callCount === 1) {
        throw l402ChallengeError({ ...config, invoice: "lnbc1prime" });
      }
      return {
        data: { primed: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    await client.get("/stale");
    expect(mockPayInvoice).toHaveBeenCalledTimes(1);

    // Now: server returns 402 + L402 challenge. Interceptor should attach
    // cached header → server returns 401 (stale) → cache MUST be invalidated.
    // Subsequent retry-budget increment will block re-payment, but the cache
    // entry should be gone for the *next* fresh client request.
    let phase: "first" | "stale" | "after" = "first";
    callCount = 0;
    client.defaults.adapter = async (config) => {
      callCount += 1;
      // First call after priming — 402 again. Interceptor attaches cached
      // macaroon and retries.
      if (phase === "first" && callCount === 1) {
        phase = "stale";
        throw l402ChallengeError({ ...config, invoice: "lnbc1stale" });
      }
      if (phase === "stale") {
        // Cached header is on this request — the server rejects with 401.
        phase = "after";
        const auth = config.headers?.["Authorization"];
        expect(auth).toBeDefined();
        throw {
          response: {
            status: 401,
            data: { error: "stale macaroon" },
            headers: {},
            config,
          },
          config,
        };
      }
      throw new Error(`unexpected adapter call in phase ${phase}`);
    };

    await expect(client.get("/stale")).rejects.toMatchObject({
      response: { status: 401 },
    });

    // Verify the cache was invalidated by checking that a fresh client (new
    // attempt budget) issues a new payInvoice on the next 402 instead of
    // reusing the (now-gone) cached preimage.
    const freshClient = await createApiClient("https://lightning.test");
    let freshCallCount = 0;
    freshClient.defaults.adapter = async (config) => {
      freshCallCount += 1;
      if (freshCallCount === 1) {
        throw l402ChallengeError({ ...config, invoice: "lnbc1fresh" });
      }
      return {
        data: { fresh: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    const r = await freshClient.get("/stale");
    expect(r.status).toBe(200);
    // Total payInvoice calls so far: 1 (priming) + 1 (re-pay after invalidation) = 2.
    expect(mockPayInvoice).toHaveBeenCalledTimes(2);
  });
});
