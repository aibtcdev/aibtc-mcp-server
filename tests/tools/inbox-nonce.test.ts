import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetAccountNonce = vi.fn();
const mockGetMempoolTransactions = vi.fn();

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({
    getAccountNonce: mockGetAccountNonce,
    getMempoolTransactions: mockGetMempoolTransactions,
  }),
}));

vi.mock("../../src/services/x402.service.js", () => ({
  NETWORK: "mainnet",
  getAccount: vi.fn(),
}));

const {
  reserveInboxNonce,
  isNonceConflictSettlementFailure,
  getSuggestedInboxNonce,
  clearInboxNonceCacheForTests,
} = await import("../../src/tools/inbox.tools.js");

describe("inbox nonce reservation", () => {
  beforeEach(() => {
    clearInboxNonceCacheForTests();
    mockGetAccountNonce.mockReset();
    mockGetMempoolTransactions.mockReset();
  });

  it("reserves sequential nonces from local cache to avoid reuse", () => {
    const first = reserveInboxNonce("SP123", 50, []);
    const second = reserveInboxNonce("SP123", 50, []);
    const third = reserveInboxNonce("SP123", 50, []);

    expect(first).toBe(50);
    expect(second).toBe(51);
    expect(third).toBe(52);
  });

  it("uses the next mempool nonce when mempool is ahead of account nonce", () => {
    const selected = reserveInboxNonce("SPABC", 20, [20, 21, 22]);
    expect(selected).toBe(23);
  });
});

describe("nonce-conflict detection", () => {
  it("detects conflicting nonce settlement failures", () => {
    expect(
      isNonceConflictSettlementFailure(
        500,
        { code: "unexpected_settle_error", details: "ConflictingNonceInMempool" },
        ""
      )
    ).toBe(true);
  });

  it("does not treat unrelated failures as nonce conflicts", () => {
    expect(
      isNonceConflictSettlementFailure(
        500,
        { code: "SETTLEMENT_FAILED", details: "insufficient balance" },
        ""
      )
    ).toBe(false);
  });
});

describe("getSuggestedInboxNonce", () => {
  beforeEach(() => {
    clearInboxNonceCacheForTests();
    mockGetAccountNonce.mockReset();
    mockGetMempoolTransactions.mockReset();
  });

  it("combines account + mempool nonces and local cache for successive calls", async () => {
    mockGetAccountNonce.mockResolvedValue(100);
    mockGetMempoolTransactions.mockResolvedValue({
      limit: 50,
      offset: 0,
      total: 2,
      results: [{ nonce: 100 }, { nonce: 101 }],
    });

    const first = await getSuggestedInboxNonce("SP456");
    const second = await getSuggestedInboxNonce("SP456");

    expect(first).toBe(102);
    expect(second).toBe(103);
  });
});
