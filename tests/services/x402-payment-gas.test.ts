import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/spend-limiter.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/spend-limiter.js")>();
  return {
    ...actual,
    getSpendLimiter: () => ({ reserve: vi.fn(async () => ({ id: "r" })), release: vi.fn() }),
  };
});

vi.mock("../../src/utils/fee.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils/fee.js")>();
  return { ...actual, resolveDefaultFee: async () => 3_000n };
});

// Throwaway key: deterministic, never funded.
vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({
    getActiveAccount: () => ({
      address: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
      privateKey: "edf9aee84d9b7abc145504dde6726c64f369d37ee34ded868fabd876c26570bc01",
      network: "mainnet",
    }),
  }),
}));

const { createApiClient, getPaymentGas } = await import("../../src/services/x402.service.js");

/** 402 on the first call, 200 once the request carries a payment-signature. */
function paidAdapter(extra?: Record<string, unknown>) {
  const paymentRequired = {
    x402Version: 2,
    resource: { url: "https://x402.test.com/paid" },
    accepts: [
      {
        scheme: "exact",
        network: "stacks:1",
        amount: "100",
        asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
        payTo: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
        maxTimeoutSeconds: 300,
        ...(extra ? { extra } : {}),
      },
    ],
  };
  return async (config: { headers?: Record<string, unknown> }) => {
    const headers = config.headers as { get?: (k: string) => unknown } & Record<string, unknown>;
    const paid = headers?.get?.("payment-signature") ?? headers?.["payment-signature"];
    if (paid) return { status: 200, statusText: "OK", data: { ok: true }, headers: {}, config };
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

describe("getPaymentGas", () => {
  it("reports a self-paid payment's fee on the paid response", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = paidAdapter() as never;
    const response = await client.get("/paid");
    expect(getPaymentGas(response.config)).toEqual({ sponsored: false, feeUstx: "3000" });
  });

  it("reports a sponsored payment with fee 0", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = paidAdapter({ sponsored: true }) as never;
    const response = await client.get("/paid");
    expect(getPaymentGas(response.config)).toEqual({ sponsored: true, feeUstx: "0" });
  });

  it("is undefined when no payment was signed", async () => {
    const client = await createApiClient("https://x402.test.com");
    client.defaults.adapter = (async (config: unknown) => ({
      status: 200, statusText: "OK", data: {}, headers: {}, config,
    })) as never;
    const response = await client.get("/free");
    expect(getPaymentGas(response.config)).toBeUndefined();
  });
});
