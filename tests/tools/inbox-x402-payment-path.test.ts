import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReserve = vi.fn();
const mockRelease = vi.fn();
const mockCreateApiClient = vi.fn();
const mockWrapAxiosWithPayment = vi.fn();
const mockPost = vi.fn();

vi.mock("../../src/services/x402.service.js", () => ({
  getAccount: vi.fn(async () => ({
    address: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
    privateKey: "0".repeat(64),
    network: "mainnet",
  })),
  createApiClient: (...args: unknown[]) => mockCreateApiClient(...args),
  NETWORK: "mainnet",
}));

vi.mock("../../src/services/spend-limiter.js", () => ({
  getSpendLimiter: () => ({ reserve: mockReserve, release: mockRelease }),
}));

vi.mock("../../src/services/sbtc.service.js", () => ({
  getSbtcService: () => ({ getBalance: async () => ({ balance: "1000000" }) }),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({
    getStxBalance: async () => ({ balance: "10000000" }),
    getMempoolFees: async () => ({ contract_call: { medium_priority: 2500 } }),
  }),
}));

vi.mock("x402-stacks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("x402-stacks")>();
  return {
    ...actual,
    wrapAxiosWithPayment: (...args: unknown[]) => mockWrapAxiosWithPayment(...args),
  };
});

const { registerInboxX402Tools } = await import("../../src/tools/inbox-x402.tools.js");

type Handler = (args: Record<string, unknown>) => Promise<{ isError?: boolean }>;

function getHandler(): Handler {
  let handler: Handler | undefined;
  const server = {
    registerTool: (_name: string, _config: unknown, h: Handler) => {
      handler = h;
    },
  };
  registerInboxX402Tools(server as never);
  return handler!;
}

function stub402(extra?: Record<string, unknown>) {
  const paymentRequired = {
    x402Version: 2,
    resource: { url: "https://aibtc.com/api/inbox/bc1q" },
    accepts: [
      {
        scheme: "exact",
        network: "stacks:1",
        amount: "100",
        asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
        payTo: "SP3F6ZPHAR5D0YT0CTPJST7H3NBZ43A5FW226FMYP",
        maxTimeoutSeconds: 300,
        ...(extra && { extra }),
      },
    ],
  };
  const header = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 402, headers: { "payment-required": header } }))
  );
}

const ARGS = {
  recipientBtcAddress: "bc1qexample",
  recipientStxAddress: "SP3F6ZPHAR5D0YT0CTPJST7H3NBZ43A5FW226FMYP",
  content: "hi",
};

describe("send_inbox_message_direct payment path", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockReserve.mockReset().mockResolvedValue({ addr: "reservation", day: "today", spends: [] });
    mockRelease.mockReset();
    mockPost.mockReset().mockResolvedValue({ data: { ok: true }, headers: {} });
    mockCreateApiClient.mockReset().mockResolvedValue({ post: mockPost });
    mockWrapAxiosWithPayment.mockReset().mockReturnValue({ post: mockPost });
  });

  it("signs a self-paid payment through createApiClient, which clamps the fee and meters it", async () => {
    stub402();
    const result = await getHandler()(ARGS);

    expect(result.isError).toBeFalsy();
    expect(mockCreateApiClient).toHaveBeenCalledWith("https://aibtc.com/api/inbox", {
      toolName: "send_inbox_message_direct",
      asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
    });
    expect(mockWrapAxiosWithPayment).not.toHaveBeenCalled();
    expect(mockReserve).not.toHaveBeenCalled();
  });

  it("signs a sponsored payment through x402-stacks and meters the sBTC at the tool", async () => {
    stub402({ feePayer: "SP3F6ZPHAR5D0YT0CTPJST7H3NBZ43A5FW226FMYP" });
    const result = await getHandler()(ARGS);

    expect(result.isError).toBeFalsy();
    expect(mockWrapAxiosWithPayment).toHaveBeenCalledOnce();
    expect(mockCreateApiClient).not.toHaveBeenCalled();
    expect(mockReserve).toHaveBeenCalledWith(
      [{ unit: "sats", amount: 100n }],
      "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("gives the sponsored booking back when the send fails", async () => {
    stub402({ feePayer: "SP3F6ZPHAR5D0YT0CTPJST7H3NBZ43A5FW226FMYP" });
    mockPost.mockRejectedValueOnce(new Error("relay down"));
    const result = await getHandler()(ARGS);

    expect(result.isError).toBe(true);
    expect(mockRelease).toHaveBeenCalledOnce();
  });
});
