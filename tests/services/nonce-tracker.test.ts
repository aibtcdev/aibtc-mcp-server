import { describe, it, expect, beforeEach } from "vitest";
import {
  getTrackedNonce,
  recordNonceUsed,
  reconcileWithChain,
  resetTrackedNonce,
  resetAllTrackedNonces,
  getAddressState,
  getFullState,
  _testing,
} from "../../src/services/nonce-tracker.js";

const { STALE_NONCE_MS, MAX_PENDING_LOG, MAX_ADDRESSES } = _testing;

// Generate unique address prefix per test to avoid cross-test and cross-run
// contamination when vitest shares module singletons across test files.
const runId = Date.now();
let testId = 0;
function addr(suffix = ""): string {
  return `SP_NT_${runId}_${testId}_${suffix || "default"}`;
}

beforeEach(() => {
  testId++;
});

describe("constants", () => {
  it("should use 90-second stale timeout (Nakamoto block times)", () => {
    expect(STALE_NONCE_MS).toBe(90 * 1000);
  });

  it("should keep at most 50 pending records per address", () => {
    expect(MAX_PENDING_LOG).toBe(50);
  });

  it("should track at most 100 addresses", () => {
    expect(MAX_ADDRESSES).toBe(100);
  });
});

describe("getTrackedNonce", () => {
  it("should return null for unknown address", async () => {
    const result = await getTrackedNonce(addr());
    expect(result).toBeNull();
  });

  it("should return lastUsedNonce + 1 after recording", async () => {
    const a = addr();
    await recordNonceUsed(a, 5, "tx1");
    const result = await getTrackedNonce(a);
    expect(result).toBe(6);
  });

  it("should return null for stale entries", async () => {
    const a = addr();
    await recordNonceUsed(a, 5, "tx1");

    // Manually set lastUpdated to past the stale window
    const state = _testing.getMemoryState()!;
    state.addresses[a].lastUpdated = new Date(
      Date.now() - STALE_NONCE_MS - 1000
    ).toISOString();

    const result = await getTrackedNonce(a);
    expect(result).toBeNull();
  });
});

describe("recordNonceUsed", () => {
  it("should create entry for new address", async () => {
    const a = addr();
    await recordNonceUsed(a, 0, "tx_0");
    const entry = await getAddressState(a);
    expect(entry).not.toBeNull();
    expect(entry!.lastUsedNonce).toBe(0);
    expect(entry!.pending).toHaveLength(1);
    expect(entry!.pending[0].txid).toBe("tx_0");
  });

  it("should advance nonce on sequential calls", async () => {
    const a = addr();
    await recordNonceUsed(a, 0, "tx_0");
    await recordNonceUsed(a, 1, "tx_1");
    await recordNonceUsed(a, 2, "tx_2");

    const entry = await getAddressState(a);
    expect(entry!.lastUsedNonce).toBe(2);
    expect(entry!.pending).toHaveLength(3);
  });

  it("should not regress nonce", async () => {
    const a = addr();
    await recordNonceUsed(a, 10, "tx_10");
    await recordNonceUsed(a, 5, "tx_5");

    const entry = await getAddressState(a);
    expect(entry!.lastUsedNonce).toBe(10);
    expect(entry!.pending).toHaveLength(2);
  });

  it("should track multiple addresses independently", async () => {
    const a1 = addr("A");
    const a2 = addr("B");
    await recordNonceUsed(a1, 3, "tx_a");
    await recordNonceUsed(a2, 7, "tx_b");

    expect((await getAddressState(a1))!.lastUsedNonce).toBe(3);
    expect((await getAddressState(a2))!.lastUsedNonce).toBe(7);
  });

  it("should trim pending log to MAX_PENDING_LOG", async () => {
    const a = addr();
    for (let i = 0; i < MAX_PENDING_LOG + 20; i++) {
      await recordNonceUsed(a, i, `tx_${i}`);
    }

    const entry = await getAddressState(a);
    expect(entry!.pending.length).toBeLessThanOrEqual(MAX_PENDING_LOG);
    expect(entry!.pending[entry!.pending.length - 1].txid).toBe(
      `tx_${MAX_PENDING_LOG + 19}`
    );
  });

  it("should evict oldest addresses when exceeding MAX_ADDRESSES", async () => {
    // Use a fresh state to avoid accumulating from other tests
    await resetAllTrackedNonces();

    for (let i = 0; i < MAX_ADDRESSES; i++) {
      await recordNonceUsed(`SP_EVICT_${testId}_${i}`, 0, `tx_${i}`);
    }

    const stateBefore = await getFullState();
    expect(Object.keys(stateBefore.addresses).length).toBe(MAX_ADDRESSES);

    await recordNonceUsed(`SP_EVICT_${testId}_NEW`, 0, "tx_new");

    const stateAfter = await getFullState();
    expect(Object.keys(stateAfter.addresses).length).toBe(MAX_ADDRESSES);
    expect(stateAfter.addresses[`SP_EVICT_${testId}_NEW`]).toBeDefined();
  });
});

describe("reconcileWithChain", () => {
  it("should initialize from chain when no local state exists", async () => {
    const a = addr();
    await reconcileWithChain(a, 10);

    const entry = await getAddressState(a);
    expect(entry).not.toBeNull();
    expect(entry!.lastUsedNonce).toBe(9);
    expect(entry!.pending).toHaveLength(0);
  });

  it("should advance local state when chain is ahead", async () => {
    const a = addr();
    await recordNonceUsed(a, 5, "tx_5");
    await reconcileWithChain(a, 10);

    const entry = await getAddressState(a);
    expect(entry!.lastUsedNonce).toBe(9);
  });

  it("should keep local state when local is ahead (chain lagging)", async () => {
    const a = addr();
    await recordNonceUsed(a, 15, "tx_15");
    await reconcileWithChain(a, 10);

    const entry = await getAddressState(a);
    expect(entry!.lastUsedNonce).toBe(15);
  });

  it("should prune confirmed pending entries on chain advance", async () => {
    const a = addr();
    await recordNonceUsed(a, 5, "tx_5");
    await recordNonceUsed(a, 6, "tx_6");
    await recordNonceUsed(a, 7, "tx_7");

    await reconcileWithChain(a, 7);

    const entry = await getAddressState(a);
    expect(entry!.pending.every((p) => p.nonce >= 7)).toBe(true);
  });
});

describe("resetTrackedNonce", () => {
  it("should remove the address from state", async () => {
    const a = addr();
    await recordNonceUsed(a, 5, "tx_5");
    expect(await getAddressState(a)).not.toBeNull();

    await resetTrackedNonce(a);
    expect(await getAddressState(a)).toBeNull();
  });

  it("should be safe to call on unknown address", async () => {
    await expect(resetTrackedNonce(addr())).resolves.not.toThrow();
  });

  it("should not affect other addresses", async () => {
    const a1 = addr("X");
    const a2 = addr("Y");
    await recordNonceUsed(a1, 3, "tx_a");
    await recordNonceUsed(a2, 9, "tx_b");

    await resetTrackedNonce(a1);
    expect(await getAddressState(a1)).toBeNull();
    expect((await getAddressState(a2))!.lastUsedNonce).toBe(9);
  });
});

describe("resetAllTrackedNonces", () => {
  it("should clear all addresses", async () => {
    const a1 = addr("P");
    const a2 = addr("Q");
    await recordNonceUsed(a1, 1, "tx_1");
    await recordNonceUsed(a2, 2, "tx_2");

    await resetAllTrackedNonces();

    const state = await getFullState();
    expect(Object.keys(state.addresses)).toHaveLength(0);
  });
});

describe("error handling", () => {
  it("should handle missing state file gracefully on load", async () => {
    _testing.clearMemory();

    const result = await getTrackedNonce(addr());
    expect(result).toBeNull();
  });
});
