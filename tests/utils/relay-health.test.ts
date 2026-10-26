import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../../src/config/sponsor.js", () => ({
  getSponsorRelayUrl: () => "https://relay.example.com",
  getSponsorApiKey: () => undefined,
}));

vi.mock("../../src/config/networks.js", () => ({}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({
    getNonceInfo: vi.fn(),
    getMempoolTransactions: vi.fn(),
  }),
}));

import { isRelayHealthy, checkRelayHealth, formatRelayHealthStatus } from "../../src/utils/relay-health.js";
import type { RelayHealthStatus } from "../../src/utils/relay-health.js";

describe("isRelayHealthy", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when status is ok and no pool state", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(true);
  });

  it("returns false when status is not ok", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "degraded" }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(false);
  });

  it("returns false when HTTP response is not ok", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });

    expect(await isRelayHealthy("mainnet")).toBe(false);
  });

  it("returns false when circuit breaker is open", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        nonce: {
          circuitBreakerOpen: true,
          poolStatus: "ok",
          effectiveCapacity: 20,
          conflictsDetected: 0,
        },
      }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(false);
  });

  it("returns false when pool status is critical", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        nonce: {
          circuitBreakerOpen: false,
          poolStatus: "critical",
          effectiveCapacity: 20,
          conflictsDetected: 0,
        },
      }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(false);
  });

  it("returns false when effective capacity is below threshold", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        nonce: {
          circuitBreakerOpen: false,
          poolStatus: "ok",
          effectiveCapacity: 3,
          conflictsDetected: 0,
        },
      }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(false);
  });

  it("returns false when conflicts detected exceed threshold", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        nonce: {
          circuitBreakerOpen: false,
          poolStatus: "ok",
          effectiveCapacity: 20,
          conflictsDetected: 47,
        },
      }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(false);
  });

  it("ignores missing capacity and conflict fields (older relays)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        nonce: {
          circuitBreakerOpen: false,
          poolStatus: "ok",
        },
      }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(true);
  });

  it("returns true when pool state is healthy", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        nonce: {
          circuitBreakerOpen: false,
          poolStatus: "ok",
          effectiveCapacity: 20,
        },
      }),
    });

    expect(await isRelayHealthy("mainnet")).toBe(true);
  });

  it("returns false on fetch error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));

    expect(await isRelayHealthy("mainnet")).toBe(false);
  });
});

describe("formatRelayHealthStatus", () => {
  it("includes pool state in formatted output", () => {
    const status: RelayHealthStatus = {
      healthy: false,
      network: "mainnet",
      version: "1.26.1",
      poolState: {
        poolAvailable: 20,
        poolReserved: 0,
        conflictsDetected: 47,
        circuitBreakerOpen: true,
        effectiveCapacity: 1,
        poolStatus: "critical",
        lastConflictAt: "2026-03-28T17:53:50.250Z",
        recommendation: null,
      },
      issues: [
        "Relay circuit breaker is open — sends will fail",
        "Relay nonce pool is critical",
      ],
    };

    const output = formatRelayHealthStatus(status);
    expect(output).toContain("UNHEALTHY");
    expect(output).toContain("Pool status: critical");
    expect(output).toContain("Circuit breaker: OPEN");
    expect(output).toContain("Effective capacity: 1");
    expect(output).toContain("Conflicts detected: 47");
    expect(output).toContain("2026-03-28T17:53:50.250Z");
  });

  it("omits pool state section when not present", () => {
    const status: RelayHealthStatus = {
      healthy: true,
      network: "mainnet",
    };

    const output = formatRelayHealthStatus(status);
    expect(output).toContain("HEALTHY");
    expect(output).not.toContain("Pool State");
  });
});
