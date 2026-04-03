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
