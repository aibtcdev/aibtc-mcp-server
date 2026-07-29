import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateApiClient = vi.fn();
const mockCheckSufficientBalance = vi.fn();
const mockGenerateDedupKey = vi.fn(() => "dedup-key");
const mockCheckDedupCache = vi.fn(() => null);
const mockRecordTransaction = vi.fn();
const mockExtractPaymentIdFromPaymentSignature = vi.fn(() => "pay_endpoint_123");
const mockExtractTxidFromPaymentSignature = vi.fn(() => null);
const mockPollTransactionConfirmation = vi.fn();

vi.mock("../../src/services/x402.service.js", () => ({
  createApiClient: mockCreateApiClient,
  API_URL: "https://aibtc.com",
  probeEndpoint: vi.fn(),
  formatPaymentAmount: vi.fn((amount: string, asset: string) => `${amount} ${asset}`),
  checkSufficientBalance: mockCheckSufficientBalance,
  generateDedupKey: mockGenerateDedupKey,
  checkDedupCache: mockCheckDedupCache,
  recordTransaction: mockRecordTransaction,
  NETWORK: "mainnet",
}));

vi.mock("../../src/utils/x402-recovery.js", () => ({
  extractPaymentIdFromPaymentSignature: mockExtractPaymentIdFromPaymentSignature,
  extractTxidFromPaymentSignature: mockExtractTxidFromPaymentSignature,
  pollTransactionConfirmation: mockPollTransactionConfirmation,
}));

const { registerEndpointTools } = await import("../../src/tools/endpoint.tools.js");

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

describe("execute_x402_endpoint canonical error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces canonical payment status instead of txid fallback when available", async () => {
    const request = vi.fn().mockRejectedValue({
      message: "Payment retry limit exceeded",
      config: {
        headers: {
          "payment-signature": "encoded-payment",
        },
      },
      response: {
        status: 402,
        data: { error: "still processing" },
      },
      x402PaymentStatus: {
        paymentId: "pay_endpoint_123",
        status: "queued",
        checkStatusUrl: "https://aibtc.com/api/payment-status/pay_endpoint_123",
      },
      x402PaymentDecision: {
        summary:
          "Payment pay_endpoint_123 is still queued. Keep polling the same paymentId; do not rebuild or sign a second payment.",
      },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);

    const tool = tools.get("execute_x402_endpoint");
    expect(tool).toBeDefined();

    const result = (await tool!.handler({
      method: "GET",
      url: "https://aibtc.com/api/inbox/bc1example",
      autoApprove: true,
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Canonical payment status:");
    expect(result.content[0].text).toContain("paymentId: pay_endpoint_123");
    expect(result.content[0].text).toContain("status: queued");
    expect(result.content[0].text).toContain("Guidance:");
    expect(result.content[0].text).not.toContain("Operational fallback only:");
    expect(mockPollTransactionConfirmation).not.toHaveBeenCalled();
  });

  it("falls back to txid recovery only when canonical polling data is absent", async () => {
    const request = vi.fn().mockRejectedValue({
      message: "Payment retry limit exceeded",
      config: {
        headers: {
          "payment-signature": "encoded-payment",
        },
      },
      response: {
        status: 402,
        data: { error: "still processing" },
      },
    });
    mockCreateApiClient.mockResolvedValue({ request });
    mockExtractTxidFromPaymentSignature.mockReturnValue("txid_123");
    mockPollTransactionConfirmation.mockResolvedValue({
      txid: "txid_123",
      status: "pending",
      explorer: "https://explorer.example/txid_123",
    });

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);

    const tool = tools.get("execute_x402_endpoint");
    expect(tool).toBeDefined();

    const result = (await tool!.handler({
      method: "GET",
      url: "https://aibtc.com/api/inbox/bc1example",
      autoApprove: true,
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Canonical payment status was unavailable");
    expect(result.content[0].text).toContain("txid: txid_123");
    expect(mockPollTransactionConfirmation).toHaveBeenCalledWith("txid_123", "mainnet");
  });
});

describe("execute_x402_endpoint dedup recording on failed settlement (#630)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateDedupKey.mockReturnValue("dedup-key");
    mockCheckDedupCache.mockReturnValue(null);
  });

  async function runFailing(rejection: unknown) {
    mockCreateApiClient.mockResolvedValue({
      request: vi.fn().mockRejectedValue(rejection),
    });
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    return tools.get("execute_x402_endpoint")!.handler({
      method: "GET",
      url: "https://aibtc.com/api/inbox/bc1example",
      autoApprove: true,
    });
  }

  it("records the broadcast txid when settlement fails with canonical status", async () => {
    mockExtractTxidFromPaymentSignature.mockReturnValue("txid_broadcast");

    await runFailing({
      message: "Payment retry limit exceeded",
      config: { headers: { "payment-signature": "encoded-payment" } },
      response: { status: 402, data: { error: "still processing" } },
      x402PaymentStatus: { paymentId: "pay_1", status: "queued" },
    });

    // The payment was signed and broadcast, so an identical retry must be
    // suppressed even though the HTTP call reported an error.
    expect(mockRecordTransaction).toHaveBeenCalledWith("dedup-key", "txid_broadcast");
  });

  it("records the broadcast txid on the txid-recovery path", async () => {
    mockExtractTxidFromPaymentSignature.mockReturnValue("txid_123");
    mockPollTransactionConfirmation.mockResolvedValue({
      txid: "txid_123",
      status: "pending",
      explorer: "https://explorer.example/txid_123",
    });

    await runFailing({
      message: "socket hang up",
      config: { headers: { "payment-signature": "encoded-payment" } },
    });

    expect(mockRecordTransaction).toHaveBeenCalledWith("dedup-key", "txid_123");
  });

  it("records a pending marker when the broadcast txid is not observable", async () => {
    mockExtractTxidFromPaymentSignature.mockReturnValue(null);

    await runFailing({
      message: "socket hang up",
      config: { headers: { "payment-signature": "encoded-payment" } },
    });

    // Funds still moved, so the entry must exist. The marker cannot be
    // mistaken for a chain txid.
    expect(mockRecordTransaction).toHaveBeenCalledWith("dedup-key", "pending:dedup-key");
  });

  it("does NOT record when the request failed before any payment was signed", async () => {
    mockExtractTxidFromPaymentSignature.mockReturnValue(null);

    // No payment-signature header => the interceptor never signed anything.
    // Blocking the retry here would strand the caller on a transient error.
    await runFailing({
      message: "Not Found",
      config: { headers: {} },
      response: { status: 404, data: { error: "no such endpoint" } },
    });

    expect(mockRecordTransaction).not.toHaveBeenCalled();
  });
});
