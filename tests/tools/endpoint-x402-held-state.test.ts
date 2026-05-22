import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpPaymentStatusResponse } from "@aibtc/tx-schemas/http";

const mockCreateApiClient = vi.fn();
const mockCheckSufficientBalance = vi.fn();
const mockGenerateDedupKey = vi.fn(() => "dedup-key");
const mockCheckDedupCache = vi.fn(() => null);
const mockRecordTransaction = vi.fn();
const mockResolveCanonicalPaymentStatus = vi.fn();

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
  extractPaymentIdFromPaymentSignature: vi.fn(() => null),
  extractTxidFromPaymentSignature: vi.fn(() => null),
  pollTransactionConfirmation: vi.fn(),
}));

vi.mock("../../src/utils/x402-payment-state.js", () => ({
  formatCanonicalPaymentStatus: vi.fn(),
  resolveCanonicalPaymentStatus: mockResolveCanonicalPaymentStatus,
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

interface ParsedResponse {
  endpoint: string;
  response: unknown;
  txid?: string;
  payment?: {
    paymentId: string;
    checkStatusUrl: string;
    polledAt: string;
    pollOutcome: "terminal" | "still-held" | "still-pending" | "fallback";
    status?: HttpPaymentStatusResponse["status"];
    terminalReason?: string;
    txid?: string;
    pollCount: number;
    nextStep?: string;
  };
}

function parseToolResponse(result: unknown): ParsedResponse {
  const { content } = result as { content: Array<{ type: string; text: string }> };
  return JSON.parse(content[0].text) as ParsedResponse;
}

/**
 * Drive the in-flight setTimeout-based poll backoffs to completion under
 * fake timers. The implementation uses backoffs of 2s/5s/13s; advancing
 * 30s+ in a loop with microtask flushing covers all branches.
 */
async function flushPollBackoffs(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(15_000);
  }
}

describe("execute_x402_endpoint 202 + paymentId held-state visibility (issue #487 Gap 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the body verbatim when status is 200 (no paymentId — typical success)", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: { ok: true, result: "hello" },
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "GET",
      url: "https://aibtc.com/api/free-thing",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    expect(parsed.response).toEqual({ ok: true, result: "hello" });
    expect(parsed.payment).toBeUndefined();
    expect(mockResolveCanonicalPaymentStatus).not.toHaveBeenCalled();
  });

  it("returns body verbatim on 202 without paymentId (free endpoint that uses 202)", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: { status: "queued", queueId: "q_123" },
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.com/api/queue-thing",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    expect(parsed.response).toEqual({ status: "queued", queueId: "q_123" });
    expect(parsed.payment).toBeUndefined();
    expect(mockResolveCanonicalPaymentStatus).not.toHaveBeenCalled();
  });

  it("surfaces a 'terminal' payment block when poll #1 returns settled (confirmed)", async () => {
    const body202 = {
      classifiedId: "cls_001",
      paymentId: "pay_settled_001",
      paymentStatus: "pending",
      status: "queued",
      checkStatusUrl: "https://x402-relay.aibtc.com/payment/pay_settled_001",
    };
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: body202,
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    mockResolveCanonicalPaymentStatus.mockResolvedValueOnce({
      paymentId: "pay_settled_001",
      status: "confirmed",
      txid: "0xrealtxid",
      checkStatusUrl: "https://x402-relay.aibtc.com/payment/pay_settled_001",
    } as HttpPaymentStatusResponse);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.news/api/classifieds",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    expect(parsed.response).toEqual(body202);
    expect(parsed.payment).toBeDefined();
    expect(parsed.payment!.pollOutcome).toBe("terminal");
    expect(parsed.payment!.status).toBe("confirmed");
    expect(parsed.payment!.paymentId).toBe("pay_settled_001");
    expect(parsed.payment!.checkStatusUrl).toBe(body202.checkStatusUrl);
    expect(parsed.payment!.txid).toBe("0xrealtxid");
    expect(parsed.payment!.nextStep).toBeUndefined();
    expect(parsed.payment!.pollCount).toBe(1);
    expect(mockResolveCanonicalPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it("surfaces a 'still-held' payment block with nextStep when relay reports sender_nonce_gap", async () => {
    const body202 = {
      classifiedId: "cls_002",
      paymentId: "pay_held_002",
      paymentStatus: "pending",
      status: "queued",
      checkStatusUrl: "https://x402-relay.aibtc.com/payment/pay_held_002",
    };
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: body202,
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    // All 3 polls return the same non-terminal sender-nonce-gap state.
    const heldStatus: HttpPaymentStatusResponse = {
      paymentId: "pay_held_002",
      status: "queued",
      terminalReason: "sender_nonce_gap",
      checkStatusUrl: body202.checkStatusUrl,
    };
    mockResolveCanonicalPaymentStatus.mockResolvedValue(heldStatus);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.news/api/classifieds",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    expect(parsed.response).toEqual(body202);
    expect(parsed.payment).toBeDefined();
    expect(parsed.payment!.pollOutcome).toBe("still-held");
    expect(parsed.payment!.status).toBe("queued");
    expect(parsed.payment!.terminalReason).toBe("sender_nonce_gap");
    expect(parsed.payment!.nextStep).toBeDefined();
    expect(parsed.payment!.nextStep!).toContain("nonce_health");
    expect(parsed.payment!.nextStep!).toContain("check_relay_health");
    expect(parsed.payment!.nextStep!).toContain("pay_held_002");
    // 3 polls under the 30s budget; backoffs 2s + 5s + 13s = 20s used, 4th would exceed.
    // Tightened to `toBe(3)` per biwasxyz review item 2 — the loose bound let a regression
    // that short-circuits polling pass silently. Three polls is the contract here.
    expect(parsed.payment!.pollCount).toBe(3);
    expect(mockResolveCanonicalPaymentStatus).toHaveBeenCalledTimes(3);
  });

  it("falls back gracefully when polling throws (relay unavailable / 5xx)", async () => {
    const body202 = {
      classifiedId: "cls_003",
      paymentId: "pay_unavail_003",
      paymentStatus: "pending",
      status: "queued",
      checkStatusUrl: "https://x402-relay.aibtc.com/payment/pay_unavail_003",
    };
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: body202,
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    mockResolveCanonicalPaymentStatus.mockRejectedValue(
      new Error("relay 503 service unavailable")
    );

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.news/api/classifieds",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    // Original 202 body must be intact.
    expect(parsed.response).toEqual(body202);
    expect(parsed.payment).toBeDefined();
    expect(parsed.payment!.pollOutcome).toBe("fallback");
    expect(parsed.payment!.status).toBeUndefined();
    expect(parsed.payment!.terminalReason).toBeUndefined();
    expect(parsed.payment!.paymentId).toBe("pay_unavail_003");
    expect(parsed.payment!.checkStatusUrl).toBe(body202.checkStatusUrl);
  });

  it("early-exits on terminal state reached at poll #2 of 3 (failed + sender_nonce_stale)", async () => {
    const body202 = {
      classifiedId: "cls_004",
      paymentId: "pay_p2_terminal",
      paymentStatus: "pending",
      status: "queued",
      checkStatusUrl: "https://x402-relay.aibtc.com/payment/pay_p2_terminal",
    };
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: body202,
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    const stillPending: HttpPaymentStatusResponse = {
      paymentId: "pay_p2_terminal",
      status: "queued",
      checkStatusUrl: body202.checkStatusUrl,
    };
    const terminalFail: HttpPaymentStatusResponse = {
      paymentId: "pay_p2_terminal",
      status: "failed",
      terminalReason: "sender_nonce_stale",
      retryable: true,
      checkStatusUrl: body202.checkStatusUrl,
    };
    mockResolveCanonicalPaymentStatus
      .mockResolvedValueOnce(stillPending)
      .mockResolvedValueOnce(terminalFail);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.news/api/classifieds",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    expect(parsed.payment).toBeDefined();
    expect(parsed.payment!.pollOutcome).toBe("terminal");
    expect(parsed.payment!.status).toBe("failed");
    expect(parsed.payment!.terminalReason).toBe("sender_nonce_stale");
    expect(parsed.payment!.pollCount).toBe(2);
    expect(parsed.payment!.nextStep).toBeDefined();
    expect(parsed.payment!.nextStep!).toContain("nonce_health");
    expect(mockResolveCanonicalPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it("surfaces 'still-held' for non-terminal status with non-sender-nonce terminalReason (e.g. queue_unavailable)", async () => {
    // Widened pollOutcome classification per arc review on #518: any non-terminal
    // status + populated terminalReason means the relay knows it's stuck and has
    // a reason — caller should treat as held, not still-pending.
    const body202 = {
      classifiedId: "cls_005",
      paymentId: "pay_queue_unavail",
      paymentStatus: "pending",
      status: "queued",
      checkStatusUrl: "https://x402-relay.aibtc.com/payment/pay_queue_unavail",
    };
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: body202,
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    const heldStatus: HttpPaymentStatusResponse = {
      paymentId: "pay_queue_unavail",
      status: "queued",
      terminalReason: "queue_unavailable",
      checkStatusUrl: body202.checkStatusUrl,
    };
    mockResolveCanonicalPaymentStatus.mockResolvedValue(heldStatus);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.news/api/classifieds",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    expect(parsed.payment).toBeDefined();
    expect(parsed.payment!.pollOutcome).toBe("still-held");
    expect(parsed.payment!.status).toBe("queued");
    expect(parsed.payment!.terminalReason).toBe("queue_unavailable");
  });

  it("rejects checkStatusUrl pointing at an untrusted origin (SSRF guard)", async () => {
    // SSRF guard per arc review on #518: a malicious endpoint could return a
    // `checkStatusUrl` pointing at an internal host (or any host of its choice).
    // We only accept checkStatusUrl when its origin matches the endpoint's own
    // origin OR the canonical x402 sponsor relay. Untrusted origin → no polling,
    // no payment block, the 202 body is returned verbatim.
    const body202 = {
      classifiedId: "cls_006",
      paymentId: "pay_untrusted_url",
      paymentStatus: "pending",
      status: "queued",
      checkStatusUrl: "http://internal-host.local:8080/payment/pay_untrusted_url",
    };
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: body202,
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.news/api/classifieds",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    // 202 body returned verbatim, no payment block, no polling invoked.
    expect(parsed.response).toEqual(body202);
    expect(parsed.payment).toBeUndefined();
    expect(mockResolveCanonicalPaymentStatus).not.toHaveBeenCalled();
  });

  it("surfaces 'still-pending' for non-terminal status with no terminalReason (genuine in-flight)", async () => {
    // Matrix completeness per biwasxyz review item 3: the third branch of the
    // pollOutcome classification. Non-terminal status, NO terminalReason — relay
    // does not know it's stuck. Distinct from 'still-held' (relay has a reason)
    // and 'terminal' (settled). Caller should keep polling.
    const body202 = {
      classifiedId: "cls_007",
      paymentId: "pay_genuine_pending",
      paymentStatus: "pending",
      status: "queued",
      checkStatusUrl: "https://x402-relay.aibtc.com/payment/pay_genuine_pending",
    };
    const request = vi.fn().mockResolvedValue({
      status: 202,
      data: body202,
      headers: {},
      config: { headers: {} },
    });
    mockCreateApiClient.mockResolvedValue({ request });

    // Non-terminal across all 3 polls, no terminalReason ever populated.
    const pendingStatus: HttpPaymentStatusResponse = {
      paymentId: "pay_genuine_pending",
      status: "broadcasting",
      checkStatusUrl: body202.checkStatusUrl,
    };
    mockResolveCanonicalPaymentStatus.mockResolvedValue(pendingStatus);

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerEndpointTools(server as any);
    const tool = tools.get("execute_x402_endpoint")!;

    const promise = tool.handler({
      method: "POST",
      url: "https://aibtc.news/api/classifieds",
      autoApprove: true,
    });
    await flushPollBackoffs();
    const parsed = parseToolResponse(await promise);

    expect(parsed.response).toEqual(body202);
    expect(parsed.payment).toBeDefined();
    expect(parsed.payment!.pollOutcome).toBe("still-pending");
    expect(parsed.payment!.status).toBe("broadcasting");
    expect(parsed.payment!.terminalReason).toBeUndefined();
    expect(parsed.payment!.pollCount).toBe(3);
    expect(parsed.payment!.nextStep).toBeDefined();
    expect(parsed.payment!.nextStep!).toContain("auto-poll budget exhausted");
  });
});
