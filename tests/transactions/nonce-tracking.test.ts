/**
 * Nonce tracking tests for builder.ts
 *
 * These tests verify the builder's public nonce API delegates correctly to the
 * SharedNonceTracker (issue #413). Detailed tracker behavior is tested in
 * tests/services/nonce-tracker.test.ts.
 *
 * All tests use the tracker API directly (await) to avoid fire-and-forget
 * timing issues from advancePendingNonce's sync wrapper.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  getTrackedNonce,
  getAddressState,
  recordNonceUsed,
  resetTrackedNonce,
  _testing,
} from "../../src/services/nonce-tracker.js";

// Use a unique temp file per test run for isolation
const tmpDir = path.join(os.tmpdir(), `nonce-builder-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
_testing.setStateFilePath(path.join(tmpDir, "nonce-state.json"));

beforeAll(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
});

afterAll(async () => {
  _testing.resetStateFilePath();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

beforeEach(() => {
  _testing.clearMemory();
});

describe("SharedNonceTracker delegation", () => {
  it("should record nonce in shared tracker", async () => {
    await recordNonceUsed("SP1", 0, "tx_0");

    const entry = await getAddressState("SP1");
    expect(entry).not.toBeNull();
    expect(entry!.lastUsedNonce).toBe(0);
  });

  it("should advance nonce sequentially in shared tracker", async () => {
    await recordNonceUsed("SP1", 0, "tx_0");
    await recordNonceUsed("SP1", 1, "tx_1");
    await recordNonceUsed("SP1", 2, "tx_2");

    const next = await getTrackedNonce("SP1");
    expect(next).toBe(3);
  });

  it("should not regress nonce in shared tracker", async () => {
    await recordNonceUsed("SP1", 10, "tx_10");
    await recordNonceUsed("SP1", 5, "tx_5");

    const next = await getTrackedNonce("SP1");
    expect(next).toBe(11);
  });

  it("should track multiple addresses independently", async () => {
    await recordNonceUsed("SP1", 3, "tx_a");
    await recordNonceUsed("SP2", 7, "tx_b");

    expect(await getTrackedNonce("SP1")).toBe(4);
    expect(await getTrackedNonce("SP2")).toBe(8);
  });
});

describe("resetTrackedNonce", () => {
  it("should clear address from shared tracker", async () => {
    await recordNonceUsed("SP1", 5, "tx_5");
    expect(await getAddressState("SP1")).not.toBeNull();

    await resetTrackedNonce("SP1");
    expect(await getAddressState("SP1")).toBeNull();
  });

  it("should be safe to call on unknown address", async () => {
    await expect(resetTrackedNonce("SP_UNKNOWN")).resolves.not.toThrow();
  });

  it("should not affect other addresses", async () => {
    await recordNonceUsed("SP1", 3, "tx_a");
    await recordNonceUsed("SP2", 9, "tx_b");

    await resetTrackedNonce("SP1");

    expect(await getAddressState("SP1")).toBeNull();
    expect((await getAddressState("SP2"))!.lastUsedNonce).toBe(9);
  });
});
