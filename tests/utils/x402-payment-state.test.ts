import { describe, it, expect, vi } from "vitest";
import {
  classifyCanonicalPaymentStatus,
  extractCanonicalPaymentHints,
  resolveCanonicalPaymentStatus,
} from "../../src/utils/x402-payment-state.js";
import { extractPaymentIdFromPaymentSignature } from "../../src/utils/x402-recovery.js";
import {
  buildPaymentIdentifierExtension,
  encodePaymentPayload,
} from "../../src/utils/x402-protocol.js";

describe("classifyCanonicalPaymentStatus", () => {
  it("keeps queued payments on the same paymentId without rebuild", () => {
    const decision = classifyCanonicalPaymentStatus({
      paymentId: "pay_queued",
      status: "queued",
      checkStatusUrl: "https://relay.example/payment/pay_queued",
    });

    expect(decision.action).toBe("poll_same_payment");
    expect(decision.shouldReusePaymentId).toBe(true);
    expect(decision.shouldRebuild).toBe(false);
  });

  it("routes sender nonce failures to rebuild guidance", () => {
    const decision = classifyCanonicalPaymentStatus({
      paymentId: "pay_sender",
      status: "failed",
      terminalReason: "sender_nonce_stale",
      retryable: true,
    });

    expect(decision.action).toBe("rebuild_sender");
    expect(decision.shouldRebuild).toBe(true);
    expect(decision.retryable).toBe(true);
  });

  it("keeps relay and sponsor failures in bounded retry or stop buckets", () => {
    const decision = classifyCanonicalPaymentStatus({
      paymentId: "pay_relay",
      status: "failed",
      terminalReason: "sponsor_failure",
      retryable: true,
    });

    expect(decision.action).toBe("retry_bounded");
    expect(decision.shouldRebuild).toBe(false);
    expect(decision.retryable).toBe(true);
  });

  it("stops polling replaced identities", () => {
    const decision = classifyCanonicalPaymentStatus({
      paymentId: "pay_replaced",
      status: "replaced",
      terminalReason: "superseded",
    });

    expect(decision.action).toBe("stop_replaced");
    expect(decision.shouldStopPollingOldPaymentId).toBe(true);
  });

  it("treats not_found as an expired or gone identity", () => {
    const decision = classifyCanonicalPaymentStatus({
      paymentId: "pay_missing",
      status: "not_found",
      terminalReason: "unknown_payment_identity",
      retryable: false,
    });

    expect(decision.action).toBe("restart_payment");
    expect(decision.shouldStopPollingOldPaymentId).toBe(true);
  });
});

describe("resolveCanonicalPaymentStatus", () => {
  it("extracts canonical checkStatusUrl hints from inbox payloads without inventing inbox-specific URLs", () => {
    const hints = extractCanonicalPaymentHints({
      payload: {
        inbox: {
          paymentId: "pay_canonical_hint",
          paymentStatus: "queued_with_warning",
          checkStatusUrl: "/payment/pay_canonical_hint",
        },
      },
      baseUrl: "https://relay.example/api/inbox/bc1example",
    });

    expect(hints).toMatchObject({
      paymentId: "pay_canonical_hint",
      status: "queued",
      checkStatusUrl: "https://relay.example/payment/pay_canonical_hint",
    });
  });

  it("accepts canonical poll data directly from the payload", async () => {
    const status = await resolveCanonicalPaymentStatus({
      payload: {
        paymentId: "pay_direct",
        status: "mempool",
        checkStatusUrl: "https://relay.example/payment/pay_direct",
      },
    });

    expect(status?.paymentId).toBe("pay_direct");
    expect(status?.status).toBe("mempool");
  });

  it("polls the canonical checkStatusUrl when only paymentId data is embedded", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        paymentId: "pay_polled",
        status: "failed",
        terminalReason: "sender_nonce_gap",
        retryable: true,
      }),
    });

    const onPoll = vi.fn();
    const status = await resolveCanonicalPaymentStatus({
      payload: {
        inbox: {
          paymentId: "pay_polled",
          paymentStatus: "pending",
        },
      },
      fallbackCheckStatusUrl: "https://relay.example/payment/pay_polled",
      fetchImpl: fetchImpl as typeof fetch,
      onPoll,
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/payment/pay_polled", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    expect(onPoll).toHaveBeenCalledWith({
      paymentId: "pay_polled",
      checkStatusUrl: "https://relay.example/payment/pay_polled",
      source: "compat_fallback",
    });
    expect(status?.paymentId).toBe("pay_polled");
    expect(status?.status).toBe("failed");
    expect(status?.terminalReason).toBe("sender_nonce_gap");
  });

  it("prefers canonical checkStatusUrl hints over compat fallback synthesis", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        paymentId: "pay_canonical",
        status: "queued",
        checkStatusUrl: "https://relay.example/payment/pay_canonical",
      }),
    });

    const onPoll = vi.fn();
    const status = await resolveCanonicalPaymentStatus({
      payload: {
        inbox: {
          paymentId: "pay_canonical",
          paymentStatus: "queued_with_warning",
          checkStatusUrl: "/payment/pay_canonical",
        },
      },
      baseUrl: "https://relay.example/api/inbox/bc1example",
      fallbackCheckStatusUrl: "https://compat.example/payment/pay_canonical",
      fetchImpl: fetchImpl as typeof fetch,
      onPoll,
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/payment/pay_canonical", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    expect(fetchImpl).not.toHaveBeenCalledWith("https://compat.example/payment/pay_canonical", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    expect(onPoll).toHaveBeenCalledWith({
      paymentId: "pay_canonical",
      checkStatusUrl: "https://relay.example/payment/pay_canonical",
      source: "canonical_hint",
    });
    expect(status?.paymentId).toBe("pay_canonical");
    expect(status?.status).toBe("queued");
  });

  it("normalizes relative canonical poll URLs from upstream headers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        paymentId: "pay_header",
        status: "replaced",
        terminalReason: "superseded",
      }),
    });

    const onPoll = vi.fn();
    const status = await resolveCanonicalPaymentStatus({
      responseHeaders: {
        "x-payment-id": "pay_header",
        "x-payment-status": "pending",
        "x-payment-check-url": "/api/payment-status/pay_header",
      },
      baseUrl: "https://aibtc.com/api/inbox/bc1example",
      fetchImpl: fetchImpl as typeof fetch,
      onPoll,
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://aibtc.com/api/payment-status/pay_header", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    expect(onPoll).toHaveBeenCalledWith({
      paymentId: "pay_header",
      checkStatusUrl: "https://aibtc.com/api/payment-status/pay_header",
      source: "canonical_hint",
    });
    expect(status?.paymentId).toBe("pay_header");
    expect(status?.status).toBe("replaced");
  });

  it("does not synthesize inbox-specific fallback polling for generic endpoints", async () => {
    const fetchImpl = vi.fn();
    const onPoll = vi.fn();

    const status = await resolveCanonicalPaymentStatus({
      payload: {
        paymentId: "pay_generic",
        paymentStatus: "pending",
      },
      fetchImpl: fetchImpl as typeof fetch,
      onPoll,
    });

    expect(status).toMatchObject({
      paymentId: "pay_generic",
      status: "queued",
    });
    expect(status?.checkStatusUrl).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onPoll).not.toHaveBeenCalled();
  });
});

describe("extractPaymentIdFromPaymentSignature", () => {
  it("extracts the relay-owned paymentId from the signed payload", () => {
    const encoded = encodePaymentPayload({
      x402Version: 2,
      accepted: {
        scheme: "exact",
        network: "stacks:1",
        amount: "100",
        asset: "sbtc",
        payTo: "SP000000000000000000002Q6VF78",
        maxTimeoutSeconds: 60,
      },
      payload: {
        transaction: "0x1234",
      },
      extensions: buildPaymentIdentifierExtension("pay_test_123"),
    });

    expect(extractPaymentIdFromPaymentSignature(encoded)).toBe("pay_test_123");
  });
});
