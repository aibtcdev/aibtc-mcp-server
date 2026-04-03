import { beforeEach, describe, expect, it, vi } from "vitest";
import { X402_HEADERS } from "../../src/utils/x402-protocol.js";

const mockGetAccount = vi.fn();
const mockGetBalance = vi.fn();
const mockGetTrackedNonce = vi.fn();
const mockRecordNonceUsed = vi.fn();
const mockReconcileWithChain = vi.fn();
const mockGetAccountInfo = vi.fn();
const mockGetMempoolTransactions = vi.fn();

vi.mock("../../src/services/x402.service.js", () => ({
  getAccount: mockGetAccount,
  NETWORK: "mainnet",
}));

vi.mock("../../src/services/sbtc.service.js", () => ({
  getSbtcService: vi.fn(() => ({ getBalance: mockGetBalance })),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: vi.fn(() => ({
    getAccountInfo: mockGetAccountInfo,
    getMempoolTransactions: mockGetMempoolTransactions,
  })),
}));

vi.mock("../../src/services/nonce-tracker.js", () => ({
  getTrackedNonce: mockGetTrackedNonce,
  recordNonceUsed: mockRecordNonceUsed,
  reconcileWithChain: mockReconcileWithChain,
}));

vi.mock("../../src/config/networks.js", () => ({
  getStacksNetwork: vi.fn(() => "mainnet"),
  getExplorerTxUrl: vi.fn((txid: string) => `https://explorer.example/${txid}`),
}));

vi.mock("../../src/config/contracts.js", () => ({
  getContracts: vi.fn(() => ({ SBTC_TOKEN: "SP000.token-sbtc" })),
  parseContractId: vi.fn(() => ({ address: "SP000", name: "token-sbtc" })),
}));

vi.mock("../../src/transactions/post-conditions.js", () => ({
  createFungiblePostCondition: vi.fn(() => ({ type: "post-condition" })),
}));

vi.mock("@stacks/transactions", () => ({
  makeContractCall: vi.fn(async () => ({
    serialize: () => "deadbeef",
  })),
  uintCV: vi.fn(),
  principalCV: vi.fn(),
  noneCV: vi.fn(),
  someCV: vi.fn(),
  bufferCV: vi.fn(),
}));

const { registerInboxTools } = await import("../../src/tools/inbox.tools.js");

interface RegisteredTool {
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function createTrackingServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: vi.fn(
      (
        name: string,
        _config: { description: string; inputSchema: unknown },
        handler: RegisteredTool["handler"]
      ) => {
        tools.set(name, { handler });
      }
    ),
  };
  return { server, tools };
}

function createFetchResponse(options: {
  status: number;
  body: string;
  headers?: Record<string, string>;
}) {
  return {
    status: options.status,
    ok: options.status >= 200 && options.status < 300,
    headers: {
      get: (name: string) => options.headers?.[name] ?? null,
    },
    text: async () => options.body,
  };
}

describe("send_inbox_message x402 logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccount.mockResolvedValue({
      address: "SP000000000000000000002Q6VF78",
      privateKey: "0".repeat(64),
      network: "mainnet",
    });
    mockGetBalance.mockResolvedValue({ balance: "1000" });
    mockGetTrackedNonce.mockResolvedValue(7);
    mockReconcileWithChain.mockResolvedValue(undefined);
    mockRecordNonceUsed.mockResolvedValue(undefined);
    mockGetAccountInfo.mockResolvedValue({ nonce: 7 });
    mockGetMempoolTransactions.mockResolvedValue({ results: [] });
  });

  it("logs inbox-only synthesized status-url fallback visibility", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const paymentRequired = Buffer.from(JSON.stringify({
      x402Version: 2,
      resource: { url: "https://aibtc.com/api/inbox/bc1recipient" },
      accepts: [{
        scheme: "exact",
        network: "stacks:1",
        amount: "100",
        asset: "sbtc",
        payTo: "SP000000000000000000002Q6VF78",
        maxTimeoutSeconds: 60,
      }],
    })).toString("base64");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 402,
        body: JSON.stringify({ error: "payment required" }),
        headers: {
          [X402_HEADERS.PAYMENT_REQUIRED]: paymentRequired,
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        body: JSON.stringify({
          inbox: {
            paymentId: "pay_inbox_123",
            paymentStatus: "pending",
          },
        }),
      }))
      .mockResolvedValueOnce({
        json: async () => ({
          paymentId: "pay_inbox_123",
          status: "queued",
          checkStatusUrl: "https://aibtc.com/api/payment-status/pay_inbox_123",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerInboxTools(server as any);
    const tool = tools.get("send_inbox_message");
    expect(tool).toBeDefined();

    const result = await tool!.handler({
      recipientBtcAddress: "bc1recipient",
      recipientStxAddress: "SP000000000000000000002Q6VF78",
      content: "hello",
    }) as { content: Array<{ type: string; text: string }> };

    const payload = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(payload).toMatchObject({
      success: true,
      payment: {
        paymentId: "pay_inbox_123",
        status: "queued",
        checkStatusUrl: "https://aibtc.com/api/payment-status/pay_inbox_123",
      },
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
        event: "payment.accepted",
        tool: "send_inbox_message",
        action: "payment_submitted",
        compat_shim_used: false,
      }),
      expect.objectContaining({
        event: "payment.poll",
        paymentId: "pay_inbox_123",
        checkStatusUrl_present: true,
        compat_shim_used: true,
      }),
      expect.objectContaining({
        event: "payment.fallback_used",
        paymentId: "pay_inbox_123",
        action: "synthesized_check_status_url",
        compat_shim_used: true,
      }),
      expect.objectContaining({
        event: "payment.retry_decision",
        paymentId: "pay_inbox_123",
        status: "queued",
        action: "poll_same_payment",
        compat_shim_used: true,
      }),
    ]));
  });

  it("prefers canonical inbox checkStatusUrl hints over synthesized fallback logging", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const paymentRequired = Buffer.from(JSON.stringify({
      x402Version: 2,
      resource: { url: "https://aibtc.com/api/inbox/bc1recipient" },
      accepts: [{
        scheme: "exact",
        network: "stacks:1",
        amount: "100",
        asset: "sbtc",
        payTo: "SP000000000000000000002Q6VF78",
        maxTimeoutSeconds: 60,
      }],
    })).toString("base64");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 402,
        body: JSON.stringify({ error: "payment required" }),
        headers: {
          [X402_HEADERS.PAYMENT_REQUIRED]: paymentRequired,
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        body: JSON.stringify({
          inbox: {
            paymentId: "pay_inbox_456",
            paymentStatus: "queued_with_warning",
            checkStatusUrl: "https://canonical.example/payment-status/pay_inbox_456",
          },
        }),
      }))
      .mockResolvedValueOnce({
        json: async () => ({
          paymentId: "pay_inbox_456",
          status: "queued",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerInboxTools(server as any);
    const tool = tools.get("send_inbox_message");
    expect(tool).toBeDefined();

    const result = await tool!.handler({
      recipientBtcAddress: "bc1recipient",
      recipientStxAddress: "SP000000000000000000002Q6VF78",
      content: "hello",
    }) as { content: Array<{ type: string; text: string }> };

    const payload = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(payload).toMatchObject({
      success: true,
      payment: {
        paymentId: "pay_inbox_456",
        status: "queued",
        checkStatusUrl: "https://canonical.example/payment-status/pay_inbox_456",
      },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://canonical.example/payment-status/pay_inbox_456",
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

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
        paymentId: "pay_inbox_456",
        checkStatusUrl_present: true,
        compat_shim_used: false,
      }),
      expect.objectContaining({
        event: "payment.retry_decision",
        paymentId: "pay_inbox_456",
        status: "queued",
        action: "poll_same_payment",
        compat_shim_used: false,
      }),
    ]));
    expect(
      logEvents.find(
        (entry) =>
          entry.event === "payment.fallback_used" &&
          entry.paymentId === "pay_inbox_456"
      )
    ).toBeUndefined();
  });

  it("keeps success responses on caller-facing queued when canonical polling is unavailable", async () => {
    const paymentRequired = Buffer.from(JSON.stringify({
      x402Version: 2,
      resource: { url: "https://aibtc.com/api/inbox/bc1recipient" },
      accepts: [{
        scheme: "exact",
        network: "stacks:1",
        amount: "100",
        asset: "sbtc",
        payTo: "SP000000000000000000002Q6VF78",
        maxTimeoutSeconds: 60,
      }],
    })).toString("base64");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 402,
        body: JSON.stringify({ error: "payment required" }),
        headers: {
          [X402_HEADERS.PAYMENT_REQUIRED]: paymentRequired,
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        body: JSON.stringify({
          inbox: {
            paymentId: "pay_inbox_789",
            paymentStatus: "pending",
          },
        }),
      }))
      .mockResolvedValueOnce({
        json: async () => ({ invalid: true }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerInboxTools(server as any);
    const tool = tools.get("send_inbox_message");
    expect(tool).toBeDefined();

    const result = await tool!.handler({
      recipientBtcAddress: "bc1recipient",
      recipientStxAddress: "SP000000000000000000002Q6VF78",
      content: "hello",
    }) as { content: Array<{ type: string; text: string }> };

    const payload = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(payload).toMatchObject({
      success: true,
      payment: {
        paymentId: "pay_inbox_789",
        status: "queued",
        checkStatusUrl: "https://aibtc.com/api/payment-status/pay_inbox_789",
      },
    });
  });

  it("returns synthesized inbox checkStatusUrl only when canonical hints are absent", async () => {
    const paymentRequired = Buffer.from(JSON.stringify({
      x402Version: 2,
      resource: { url: "https://aibtc.com/api/inbox/bc1recipient" },
      accepts: [{
        scheme: "exact",
        network: "stacks:1",
        amount: "100",
        asset: "sbtc",
        payTo: "SP000000000000000000002Q6VF78",
        maxTimeoutSeconds: 60,
      }],
    })).toString("base64");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createFetchResponse({
        status: 402,
        body: JSON.stringify({ error: "payment required" }),
        headers: {
          [X402_HEADERS.PAYMENT_REQUIRED]: paymentRequired,
        },
      }))
      .mockResolvedValueOnce(createFetchResponse({
        status: 200,
        body: JSON.stringify({
          inbox: {
            paymentId: "pay_inbox_999",
            paymentStatus: "pending",
          },
        }),
      }))
      .mockResolvedValueOnce({
        json: async () => ({
          paymentId: "pay_inbox_999",
          status: "queued",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerInboxTools(server as any);
    const tool = tools.get("send_inbox_message");
    expect(tool).toBeDefined();

    const result = await tool!.handler({
      recipientBtcAddress: "bc1recipient",
      recipientStxAddress: "SP000000000000000000002Q6VF78",
      content: "hello",
    }) as { content: Array<{ type: string; text: string }> };

    const payload = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(payload).toMatchObject({
      success: true,
      payment: {
        paymentId: "pay_inbox_999",
        status: "queued",
        checkStatusUrl: "https://aibtc.com/api/payment-status/pay_inbox_999",
      },
    });
  });
});
