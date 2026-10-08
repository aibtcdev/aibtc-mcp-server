import { beforeEach, describe, expect, it, vi } from "vitest";

const { reserve } = vi.hoisted(() => ({ reserve: vi.fn() }));

vi.mock("../../src/services/spend-limiter.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/spend-limiter.js")>();
  return { ...actual, getSpendLimiter: () => ({ reserve, release: vi.fn() }) };
});

vi.mock("../../src/utils/fee.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils/fee.js")>();
  return {
    ...actual,
    resolveDefaultFee: async (_network: string, txType: string) =>
      txType === "sbtc_transfer" ? 3_000n : 180n,
  };
});

vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({
    getActiveAccount: () => ({
      address: "SP000000000000000000002Q6VF78",
      privateKey: "0".repeat(64),
      network: "mainnet",
    }),
  }),
}));

const { createApiClient } = await import("../../src/services/x402.service.js");

function respond402(asset: string, amount: string) {
  const paymentRequired = {
    x402Version: 2,
    resource: { url: "https://x402.test.com/paid" },
    accepts: [
      {
        scheme: "exact",
        network: "stacks:1",
        amount,
        asset,
        payTo: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
        maxTimeoutSeconds: 300,
      },
    ],
  };
  return async (config: unknown) => {
    throw {
      response: {
        status: 402,
        data: {},
        headers: {
          "payment-required": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
        },
        config,
      },
      config,
    };
  };
}

describe("x402 auto-payment metering (#713)", () => {
  beforeEach(() => {
    // Refuse at the rail: the test only needs what was booked, not a signed tx.
    reserve.mockReset().mockRejectedValue(new Error("stop at the rail"));
  });

  it("books the sBTC amount and the sender's STX fee together", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = respond402(
      "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
      "100"
    ) as never;

    await expect(client.get("/paid")).rejects.toThrow("stop at the rail");
    expect(reserve).toHaveBeenCalledWith(
      [
        { unit: "sats", amount: 100n },
        { unit: "ustx", amount: 3_000n },
      ],
      "SP000000000000000000002Q6VF78"
    );
  });

  it("books an STX payment's amount and fee in the ustx ledger", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = respond402("STX", "1000") as never;

    await expect(client.get("/paid")).rejects.toThrow("stop at the rail");
    expect(reserve).toHaveBeenCalledWith(
      [
        { unit: "ustx", amount: 1000n },
        { unit: "ustx", amount: 180n },
      ],
      "SP000000000000000000002Q6VF78"
    );
  });
});
