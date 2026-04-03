import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { emitPaymentLog } from "../../src/utils/x402-payment-logging.js";

describe("emitPaymentLog", () => {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleSpy.mockClear();
    delete process.env.DEPLOY_SHA;
  });

  afterEach(() => {
    delete process.env.DEPLOY_SHA;
  });

  it("emits structured shared payment logs with rollout fields", () => {
    process.env.DEPLOY_SHA = "abc123";

    emitPaymentLog("payment.retry_decision", {
      tool: "send_inbox_message",
      paymentId: "pay_test_123",
      status: "failed",
      terminalReason: "sender_nonce_stale",
      action: "rebuild_sender",
      checkStatusUrl: "https://aibtc.com/api/payment-status/pay_test_123",
      compatShimUsed: true,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(consoleSpy.mock.calls[0]?.[0])) as Record<string, unknown>;

    expect(payload).toMatchObject({
      event: "payment.retry_decision",
      service: "aibtc-mcp-server",
      tool: "send_inbox_message",
      paymentId: "pay_test_123",
      status: "failed",
      terminalReason: "sender_nonce_stale",
      action: "rebuild_sender",
      checkStatusUrl_present: true,
      compat_shim_used: true,
      repo_version: expect.any(String),
      deploy_sha: "abc123",
    });
  });
});
