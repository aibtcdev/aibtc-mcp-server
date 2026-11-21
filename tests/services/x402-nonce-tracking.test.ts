import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression test for #806: the x402 payment path bypassed the local nonce
 * tracker.
 *
 * `makeContractCall` / `makeSTXTokenTransfer` were called from
 * `x402.service.ts` without a `nonce`, so the builders fetched the raw chain
 * nonce. That ignores reservations made by other builder paths
 * (`getNextNonce`), so a regular transfer followed by an x402 payment could
 * reuse a nonce and the facilitator would reject it with
 * `sender_nonce_duplicate`.
 *
 * These tests pin the contract: both builders receive a nonce sourced from the
 * tracker, and that nonce is recorded once the payment is handed off.
 */

const mockMakeContractCall = vi.fn();
const mockMakeSTXTokenTransfer = vi.fn();
const mockGetNextNonce = vi.fn();
const mockAdvancePendingNonce = vi.fn();
const mockGetHiroApi = vi.fn();
const mockGetBalance = vi.fn();
const mockGetStxBalance = vi.fn();
const mockGetMempoolFees = vi.fn();
const mockGetActiveAccount = vi.fn();

vi.mock("@stacks/transactions", async (orig) => {
  const actual = await orig<typeof import("@stacks/transactions")>();
  return {
    ...actual,
    makeContractCall: (...args: unknown[]) => mockMakeContractCall(...args),
    makeSTXTokenTransfer: (...args: unknown[]) => mockMakeSTXTokenTransfer(...args),
  };
});

vi.mock("../../src/transactions/builder.js", () => ({
  getNextNonce: (...args: unknown[]) => mockGetNextNonce(...args),
  advancePendingNonce: (...args: unknown[]) => mockAdvancePendingNonce(...args),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: (...args: unknown[]) => mockGetHiroApi(...args),
}));

vi.mock("../../src/services/sbtc.service.js", () => ({
  getSbtcService: () => ({ getBalance: mockGetBalance }),
}));

vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({ getActiveAccount: mockGetActiveAccount }),
}));

const { createApiClient } = await import("../../src/services/x402.service.js");

const ACCOUNT = {
  address: "SP000000000000000000002Q6VF78",
  privateKey: "0".repeat(64),
  network: "mainnet" as const,
};

const PAY_TO = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";
const TRACKED_NONCE = 42n;

/** A 402 response advertising one payable option, then a plain 200. */
function paymentRequired(asset: string, amount: string) {
  return {
    x402Version: 2,
    error: "payment required",
    resource: { url: "https://example.test/paid", description: "t", mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: "stacks:1",
        asset,
        amount,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {},
      },
    ],
  };
}

describe("x402 payment nonce tracking (#806)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveAccount.mockResolvedValue(ACCOUNT);
    mockGetNextNonce.mockResolvedValue(TRACKED_NONCE);
    mockGetHiroApi.mockReturnValue({
      getStxBalance: mockGetStxBalance,
      getMempoolFees: mockGetMempoolFees,
      getNonceInfo: vi.fn().mockResolvedValue({ possible_next_nonce: 42 }),
      getTransactionStatus: vi.fn(),
    });
    mockGetStxBalance.mockResolvedValue({ balance: "1000000000" });
    mockGetBalance.mockResolvedValue({ balance: "100000000", balanceSats: "100000000" });
    mockGetMempoolFees.mockResolvedValue({
      all: { no_priority: 0, low_priority: 1000, medium_priority: 5000, high_priority: 10000 },
      token_transfer: { no_priority: 0, low_priority: 500, medium_priority: 2500, high_priority: 5000 },
      contract_call: { no_priority: 0, low_priority: 2000, medium_priority: 8000, high_priority: 15000 },
    });
    mockMakeSTXTokenTransfer.mockResolvedValue({ serialize: () => new Uint8Array([1, 2, 3]) });
    mockMakeContractCall.mockResolvedValue({ serialize: () => new Uint8Array([4, 5, 6]) });
  });

  /** Drive one 402 round trip. */
  async function payOnce(asset: string, amount: string) {
    let calls = 0;
    const client = await createApiClient("https://example.test");
    // Replace the adapter: first call 402s, retry succeeds.
    client.defaults.adapter = async (config) => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("payment required") as Error & { response: unknown };
        err.response = {
          status: 402,
          statusText: "Payment Required",
          headers: {
            "content-type": "application/json",
            // The interceptor decodes requirements from this base64 header.
            "payment-required": Buffer.from(
              JSON.stringify(paymentRequired(asset, amount))
            ).toString("base64"),
          },
          data: paymentRequired(asset, amount),
          config,
        };
        throw err;
      }
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    await client.get("/paid").catch(() => undefined);
  }

  it("passes a tracker-sourced nonce to makeSTXTokenTransfer", async () => {
    await payOnce("STX", "1000");

    expect(mockMakeSTXTokenTransfer).toHaveBeenCalledTimes(1);
    const args = mockMakeSTXTokenTransfer.mock.calls[0][0] as { nonce?: bigint };
    expect(args.nonce).toBe(TRACKED_NONCE);
  });

  it("passes a tracker-sourced nonce to makeContractCall for sBTC", async () => {
    await payOnce(
      "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
      "1000"
    );

    expect(mockMakeContractCall).toHaveBeenCalledTimes(1);
    const args = mockMakeContractCall.mock.calls[0][0] as { nonce?: bigint };
    expect(args.nonce).toBe(TRACKED_NONCE);
  });

  it("reserves the nonce from the tracker rather than re-reading the chain", async () => {
    await payOnce("STX", "1000");
    expect(mockGetNextNonce).toHaveBeenCalledWith(ACCOUNT.address, ACCOUNT.network);
  });

  it("advances the tracker once the payment tx is handed to the facilitator", async () => {
    await payOnce("STX", "1000");
    expect(mockAdvancePendingNonce).toHaveBeenCalledWith(ACCOUNT.address, TRACKED_NONCE);
  });
});
