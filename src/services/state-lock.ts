/**
 * Cross-process lock for the shared `~/.aibtc` state files.
 *
 * `spend-state.json` has TWO writers: this server, and the aibtc skills engine's
 * direct x402 payment path (aibtcdev/skills#423), which reads and writes the
 * same file in the same shape so one wallet has one daily cap no matter which
 * tool spends from it. Sharing the file is the point; sharing it without a lock
 * is a lost update:
 *
 *   1. this server reads the day total and sees 100
 *   2. the other tool takes its lock, reads 100, writes 150, releases
 *   3. this server writes 130 from the copy it read in step 1
 *
 * The other tool's 50 is gone and the daily cap now UNDER-counts, which is the
 * direction that lets a wallet spend past the cap it was supposed to share. An
 * in-process promise chain cannot fix this: the other writer is another process.
 *
 * THE PROTOCOL HERE IS NOT OURS TO CHANGE UNILATERALLY. It is byte-compatible
 * with `x402-guards.ts` in the skills engine so the two tools' leases are
 * interchangeable — same lock directory name, same `owner` file format, same
 * mtime heartbeat, same staleness window. A lock only excludes writers that
 * agree on where it lives, so "x402-guards.lock" is deliberately kept even
 * though nothing here is x402: renaming it on this side would silently return
 * both tools to the race above while each believed it held a lock.
 *
 * A STALE LEASE IS NEVER RECLAIMED AUTOMATICALLY. Deleting a lock this process
 * did not create needs an atomic "remove only if unchanged since I looked",
 * which the filesystem does not offer; guessing wrong there is precisely the
 * concurrent write the lock exists to prevent. A dead holder is reported with
 * its pid and left for an operator, who can see whether it is really dead.
 */

import os from "os";
import path from "path";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "fs";
import { randomBytes } from "crypto";

/** No heartbeat for this long means the holder is probably dead. */
const LOCK_STALE_MS = 60_000;
/** A live holder refreshes its lease this often. */
const LOCK_HEARTBEAT_MS = 10_000;
/** Gap between acquisition attempts. */
const LOCK_RETRY_MS = 250;

/** Mutable so tests do not have to wait real seconds. */
const timing = {
  maxWaitMs: 15_000,
  staleMs: LOCK_STALE_MS,
  heartbeatMs: LOCK_HEARTBEAT_MS,
  retryMs: LOCK_RETRY_MS,
};

/** Test seam. Not part of the public contract. */
export const _stateLockTesting = {
  set(overrides: Partial<typeof timing>): void {
    Object.assign(timing, overrides);
  },
  reset(): void {
    timing.maxWaitMs = 15_000;
    timing.staleMs = LOCK_STALE_MS;
    timing.heartbeatMs = LOCK_HEARTBEAT_MS;
    timing.retryMs = LOCK_RETRY_MS;
  },
  lockDirFor,
};

/**
 * The lease guarding a state file, derived from its directory so a test that
 * redirects the state file redirects the lock with it.
 */
function lockDirFor(stateFile: string): string {
  return path.join(path.dirname(stateFile), "x402-guards.lock");
}

function tryLock(dir: string, token: string): boolean {
  try {
    mkdirSync(path.dirname(dir), { recursive: true, mode: 0o700 });
    // mkdir of an existing directory throws: that is the atomic test-and-set.
    mkdirSync(dir);
  } catch {
    return false;
  }
  try {
    writeFileSync(path.join(dir, "owner"), `${process.pid} ${token}`, {
      mode: 0o600,
    });
    return true;
  } catch {
    // We created the directory but could not claim it. Remove it rather than
    // strand an ownerless lease that every writer would wait on.
    rmSync(dir, { recursive: true, force: true });
    return false;
  }
}

function lockIsStale(dir: string): boolean {
  try {
    return Date.now() - statSync(dir).mtimeMs > timing.staleMs;
  } catch {
    // Gone between the failed mkdir and this stat: not stale, just released.
    return false;
  }
}

/** Touch the lease so a slow-but-live holder is never mistaken for a dead one. */
function heartbeat(dir: string): void {
  try {
    const now = new Date();
    utimesSync(dir, now, now);
  } catch {
    // If the directory is gone we no longer hold it; the owner check on
    // release handles that case.
  }
}

function ownedBy(dir: string, token: string): boolean {
  try {
    return readFileSync(path.join(dir, "owner"), "utf8").endsWith(` ${token}`);
  } catch {
    return false;
  }
}

function describeHolder(dir: string): string {
  try {
    const [pid] = readFileSync(path.join(dir, "owner"), "utf8").split(" ");
    let alive = true;
    try {
      process.kill(Number(pid), 0);
    } catch {
      alive = false;
    }
    return `owner pid ${pid}${alive ? "" : " (not running)"}`;
  } catch {
    return "owner unknown";
  }
}

/**
 * Release a lease this process created. The owner check guards the one way the
 * directory could be someone else's by now: an operator removed our lock by
 * hand and another writer took the path meanwhile.
 */
function release(dir: string, token: string): void {
  try {
    if (ownedBy(dir, token)) rmSync(dir, { recursive: true, force: true });
  } catch {
    // Already gone; nothing to release.
  }
}

/** Leases held right now, so a signal can drop them instead of stranding them. */
const heldLocks = new Map<string, string>();
let exitHooksInstalled = false;

function installExitHooks(): void {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  const releaseAll = () => {
    for (const [dir, token] of heldLocks) release(dir, token);
    heldLocks.clear();
  };
  process.once("exit", releaseAll);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.once(signal, () => {
      releaseAll();
      // Leave shutdown to any other handler (e.g. yield-hunter's graceful
      // stop); only exit ourselves when we displaced the default behaviour.
      if (process.listenerCount(signal) === 0) {
        process.exit(128 + os.constants.signals[signal]);
      }
    });
  }
}

/** Why the lease could not be taken, for the caller to log. */
type Unavailable = { reason: string };

async function acquire(dir: string, token: string): Promise<Unavailable | null> {
  const deadline = Date.now() + timing.maxWaitMs;
  for (;;) {
    if (tryLock(dir, token)) return null;
    if (lockIsStale(dir)) {
      return {
        reason:
          `the lock at ${dir} has had no heartbeat for over ${Math.round(timing.staleMs / 1000)}s ` +
          `(${describeHolder(dir)}). If that process is dead, remove the directory; do not remove ` +
          `it while a write may still be in progress.`,
      };
    }
    if (Date.now() >= deadline) {
      return {
        reason:
          `another writer held the lock at ${dir} for the whole ` +
          `${Math.round(timing.maxWaitMs / 1000)}s wait (${describeHolder(dir)}).`,
      };
    }
    await new Promise((r) => setTimeout(r, timing.retryMs));
  }
}

export interface LockedRun<T> {
  /** False when the body ran WITHOUT the lease. */
  held: boolean;
  /** Set when `held` is false: why the lease could not be taken. */
  unavailable?: string;
  value: T;
}

/**
 * Run `fn` under the shared lease for `stateFile`.
 *
 * `fn` RUNS EITHER WAY. This guards a read-modify-write that records something
 * which has ALREADY HAPPENED on chain, so refusing to run it would turn a
 * broadcast transaction into an unrecorded one — strictly worse than the race
 * it is trying to avoid. The caller is told which case it got and is expected
 * to say so loudly rather than let an under-count pass silently.
 *
 * That is the deliberate difference from the skills engine, which takes this
 * same lease and DOES refuse: there the lock guards a payment not yet signed,
 * so refusing costs nothing but a retry. Authorising a future spend and
 * recording a past one fail in opposite directions.
 */
export async function withSharedStateLock<T>(
  stateFile: string,
  fn: () => Promise<T>
): Promise<LockedRun<T>> {
  const dir = lockDirFor(stateFile);
  const token = randomBytes(12).toString("hex");
  const unavailable = await acquire(dir, token);

  if (unavailable) {
    return { held: false, unavailable: unavailable.reason, value: await fn() };
  }

  installExitHooks();
  heldLocks.set(dir, token);
  const beat = setInterval(() => heartbeat(dir), timing.heartbeatMs);
  // Never keep the process alive for a heartbeat.
  beat.unref?.();
  try {
    return { held: true, value: await fn() };
  } finally {
    clearInterval(beat);
    heldLocks.delete(dir);
    release(dir, token);
  }
}
