import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { mkdirSync, writeFileSync, existsSync, utimesSync } from "fs";
import {
  withSharedStateLock,
  _stateLockTesting,
} from "../../src/services/state-lock.js";
import { getSpendLimiter } from "../../src/services/spend-limiter.js";

/**
 * The point of these tests is the CROSS-PROCESS half. A test that only calls
 * withSharedStateLock from this process would pass with no lock at all, so the
 * competing writer is simulated the way the skills engine actually creates it:
 * by making the lock directory and its owner file directly.
 */

const runId = Date.now();
let testId = 0;
let dir: string;
let stateFile: string;
let lockDir: string;

function foreignHolder(pid = 999999, token = "someoneelsestoken"): void {
  mkdirSync(lockDir, { recursive: true });
  writeFileSync(path.join(lockDir, "owner"), `${pid} ${token}`);
}

beforeEach(async () => {
  testId++;
  dir = path.join(os.tmpdir(), `aibtc-lock-${runId}-${testId}`);
  await fs.mkdir(dir, { recursive: true });
  stateFile = path.join(dir, "spend-state.json");
  lockDir = path.join(dir, "x402-guards.lock");
  // Short waits so a contention test does not take 15 real seconds.
  _stateLockTesting.set({ maxWaitMs: 300, retryMs: 20, staleMs: 10_000 });
});

afterEach(async () => {
  _stateLockTesting.reset();
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("shared state lease", () => {
  it("puts the lease where the skills engine looks for it", () => {
    // Interop is the whole point: a lock only excludes writers that agree on
    // its path. If this name ever changes, both tools silently stop excluding
    // each other while each believes it holds a lock.
    expect(_stateLockTesting.lockDirFor(stateFile)).toBe(lockDir);
    expect(path.basename(lockDir)).toBe("x402-guards.lock");
  });

  it("holds the lease for the body and releases it after", async () => {
    expect(existsSync(lockDir)).toBe(false);

    const run = await withSharedStateLock(stateFile, async () => {
      expect(existsSync(lockDir)).toBe(true);
      const owner = await fs.readFile(path.join(lockDir, "owner"), "utf8");
      // `<pid> <token>` is the format the other tool parses.
      expect(owner).toMatch(new RegExp(`^${process.pid} [0-9a-f]{24}$`));
      return "body ran";
    });

    expect(run.held).toBe(true);
    expect(run.value).toBe("body ran");
    expect(existsSync(lockDir)).toBe(false);
  });

  it("releases the lease when the body throws", async () => {
    await expect(
      withSharedStateLock(stateFile, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(existsSync(lockDir)).toBe(false);
  });

  it("waits for a foreign holder and reports it rather than stealing it", async () => {
    foreignHolder();

    const started = Date.now();
    const run = await withSharedStateLock(stateFile, async () => "ran anyway");
    const waited = Date.now() - started;

    expect(run.held).toBe(false);
    expect(run.unavailable).toContain("another writer held the lock");
    expect(run.unavailable).toContain("999999");
    // It really waited rather than giving up on the first failed mkdir.
    expect(waited).toBeGreaterThanOrEqual(250);
    // And it did NOT delete a lease it did not create.
    expect(existsSync(lockDir)).toBe(true);
    const owner = await fs.readFile(path.join(lockDir, "owner"), "utf8");
    expect(owner).toContain("someoneelsestoken");
  });

  it("reports a stale lease immediately and still does not reclaim it", async () => {
    foreignHolder();
    // Backdate the lease past the staleness window.
    const old = new Date(Date.now() - 60_000);
    utimesSync(lockDir, old, old);
    _stateLockTesting.set({ staleMs: 1_000 });

    const started = Date.now();
    const run = await withSharedStateLock(stateFile, async () => "ran anyway");

    expect(run.held).toBe(false);
    expect(run.unavailable).toContain("no heartbeat");
    expect(run.unavailable).toContain("(not running)");
    // Stale is detected up front, not after burning the full wait.
    expect(Date.now() - started).toBeLessThan(250);
    expect(existsSync(lockDir)).toBe(true);
  });

  it("acquires once the foreign holder releases", async () => {
    foreignHolder();
    setTimeout(() => {
      // The other tool finished and removed its lease.
      void fs.rm(lockDir, { recursive: true, force: true });
    }, 60);

    const run = await withSharedStateLock(stateFile, async () => "mine now");
    expect(run.held).toBe(true);
    expect(run.value).toBe("mine now");
  });

  it("serializes two concurrent bodies in this process", async () => {
    const order: string[] = [];
    const body = (name: string) => async () => {
      order.push(`${name}:enter`);
      await new Promise((r) => setTimeout(r, 30));
      order.push(`${name}:exit`);
    };

    await Promise.all([
      withSharedStateLock(stateFile, body("a")),
      withSharedStateLock(stateFile, body("b")),
    ]);

    // Whichever went first, the two must not interleave.
    expect(order).toHaveLength(4);
    expect(order[1]).toBe(`${order[0].split(":")[0]}:exit`);
  });
});

describe("spend limiter under a contended lease", () => {
  const ENV = ["SPEND_LIMIT_ENABLED", "SPEND_LIMIT_DAILY_USTX"];
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = {};
    for (const k of ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    getSpendLimiter().setStateFile(stateFile);
  });

  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("records the spend under the lease in the normal case", async () => {
    const addr = `SP_LOCK_${runId}_${testId}_ok`;
    const limiter = getSpendLimiter();
    limiter.resetSession(addr);

    await limiter.record("ustx", 1234n, addr);

    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const day = Object.keys(state[addr])[0];
    expect(state[addr][day].ustx).toBe(1234);
    // The lease is not left behind.
    expect(existsSync(lockDir)).toBe(false);
  });

  it("still records, and says so loudly, when the lease is unavailable", async () => {
    // A transaction is already broadcast by the time record() runs. Refusing to
    // write would turn it into an unrecorded spend, which is worse than the
    // race, so the write proceeds and the operator is told.
    const addr = `SP_LOCK_${runId}_${testId}_contended`;
    const limiter = getSpendLimiter();
    limiter.resetSession(addr);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });

    foreignHolder();
    await limiter.record("ustx", 4321n, addr);

    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const day = Object.keys(state[addr])[0];
    expect(state[addr][day].ustx).toBe(4321);

    expect(errors.join("\n")).toContain("WITHOUT the shared lock");
    expect(errors.join("\n")).toContain("under-count");
  });
});
