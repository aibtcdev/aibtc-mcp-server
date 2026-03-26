/**
 * Shared Nonce Tracker
 *
 * Unified, file-backed nonce tracker that prevents client-side nonce conflicts
 * across all tx-submitting MCP tools. Replaces the separate in-memory trackers
 * in builder.ts and inbox.tools.ts.
 *
 * Design principles (issue #413):
 * - Local state is primary — no network calls on the hot path for nonce assignment
 * - Hiro is periodic reconciliation, not a real-time oracle
 * - Non-blocking — file read/write on the hot path, no network calls
 * - Records every submission — nonce + txid + timestamp for debugging
 * - Shared state file (~/.aibtc/nonce-state.json) for cross-process compatibility
 *   with CLI skills (aibtcdev/skills#240)
 *
 * @see https://github.com/aibtcdev/aibtc-mcp-server/issues/413
 */

import fs from "fs/promises";
import path from "path";
import os from "os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A record of a single submitted transaction. */
export interface PendingTxRecord {
  nonce: number;
  txid: string;
  timestamp: string; // ISO-8601
}

/** Per-address nonce state. */
export interface AddressNonceState {
  /** The highest nonce we have assigned (not yet necessarily confirmed). */
  lastUsedNonce: number;
  /** ISO-8601 timestamp of the last nonce assignment. */
  lastUpdated: string;
  /** Rolling log of recent submissions (bounded to MAX_PENDING_LOG). */
  pending: PendingTxRecord[];
}

/** On-disk file format. */
export interface NonceStateFile {
  version: number;
  addresses: Record<string, AddressNonceState>;
}

/** Snapshot returned by getHealthStatus(). */
export interface NonceHealthSnapshot {
  address: string;
  local: {
    lastUsedNonce: number;
    lastUpdated: string;
    pendingCount: number;
    isStale: boolean;
  };
  chain: {
    possibleNextNonce: number;
    lastExecutedNonce: number;
    lastMempoolNonce: number | null;
    missingNonces: number[];
    mempoolNonces: number[];
  };
  healthy: boolean;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_STORAGE_DIR = path.join(os.homedir(), ".aibtc");
const DEFAULT_NONCE_STATE_FILE = path.join(DEFAULT_STORAGE_DIR, "nonce-state.json");

/** Mutable path — overridable via _testing.setStateFilePath() for test isolation. */
let NONCE_STATE_FILE = DEFAULT_NONCE_STATE_FILE;
const CURRENT_VERSION = 1;

/**
 * How long a locally-tracked nonce is considered fresh. After this window the
 * tracker falls back to the chain value on the next getNextNonce() call.
 *
 * Set to 90 seconds (~15-30 Stacks blocks post-Nakamoto, where blocks are 3-5s).
 * Previously 10 minutes (calibrated for Bitcoin block times). The shorter window
 * ensures the tracker detects external sends and chain advances promptly.
 */
export const STALE_NONCE_MS = 90 * 1000;

/**
 * Maximum pending tx records kept per address. Older entries are evicted FIFO.
 */
const MAX_PENDING_LOG = 50;

/**
 * Maximum addresses tracked in the state file. Oldest (by lastUpdated) are
 * evicted when this limit is reached, preventing unbounded file growth.
 */
const MAX_ADDRESSES = 100;

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

/** In-memory mirror of the on-disk state. Loaded lazily on first access. */
let _memoryState: NonceStateFile | null = null;

/**
 * Serializes concurrent file writes within this process.
 * Cross-process safety is handled by atomic temp+rename writes.
 */
let _writeLock: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// File I/O (follows storage.ts patterns: atomic temp+rename, 0o600 perms)
// ---------------------------------------------------------------------------

async function readStateFile(): Promise<NonceStateFile> {
  try {
    const content = await fs.readFile(NONCE_STATE_FILE, "utf8");
    const parsed = JSON.parse(content) as NonceStateFile;
    // Basic validation
    if (parsed.version !== CURRENT_VERSION || typeof parsed.addresses !== "object") {
      return createDefaultState();
    }
    return parsed;
  } catch {
    return createDefaultState();
  }
}

/**
 * Merge on-disk state into in-memory state to prevent cross-process write
 * races from silently regressing a nonce (see PR review suggestion).
 *
 * For each address:
 * - Takes the higher lastUsedNonce (never regress)
 * - In-memory pending log is authoritative (disk entries are stale copies of
 *   our own prior writes); we only pull in disk-only addresses that another
 *   process (CLI skills) may have created.
 */
function mergeStates(disk: NonceStateFile, memory: NonceStateFile): NonceStateFile {
  const merged: NonceStateFile = { version: CURRENT_VERSION, addresses: { ...memory.addresses } };

  for (const [addr, diskEntry] of Object.entries(disk.addresses)) {
    const memEntry = merged.addresses[addr];
    if (!memEntry) {
      // Address exists on disk but not in memory — another process wrote it
      merged.addresses[addr] = diskEntry;
      continue;
    }

    // Both exist: take the higher nonce to prevent regression
    if (diskEntry.lastUsedNonce > memEntry.lastUsedNonce) {
      memEntry.lastUsedNonce = diskEntry.lastUsedNonce;
      memEntry.lastUpdated = diskEntry.lastUpdated;
    }
  }

  return merged;
}

async function writeStateFile(state: NonceStateFile): Promise<void> {
  const dir = path.dirname(NONCE_STATE_FILE);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const tempFile = `${NONCE_STATE_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.rename(tempFile, NONCE_STATE_FILE);
}

function createDefaultState(): NonceStateFile {
  return { version: CURRENT_VERSION, addresses: {} };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Load state into memory if not already loaded. */
async function ensureLoaded(): Promise<NonceStateFile> {
  if (!_memoryState) {
    _memoryState = await readStateFile();
  }
  return _memoryState;
}

/** Persist the in-memory state to disk (serialized to prevent interleaving). */
function persistToDisk(): void {
  if (!_memoryState) return;
  const stateSnapshot = _memoryState;
  _writeLock = _writeLock
    .then(() => writeStateFile(stateSnapshot))
    .catch((err) => {
      console.error("[nonce-tracker] Failed to persist nonce state:", err);
    });
}

/** Evict oldest addresses if over MAX_ADDRESSES. */
function evictOldestAddresses(state: NonceStateFile): void {
  const entries = Object.entries(state.addresses);
  if (entries.length <= MAX_ADDRESSES) return;

  // Sort by lastUpdated ascending (oldest first)
  entries.sort((a, b) => new Date(a[1].lastUpdated).getTime() - new Date(b[1].lastUpdated).getTime());

  // Keep only the newest MAX_ADDRESSES entries
  const toKeep = entries.slice(entries.length - MAX_ADDRESSES);
  state.addresses = Object.fromEntries(toKeep);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the next nonce to use for an address.
 *
 * This is the HOT PATH — no network calls. Returns the locally tracked
 * next nonce, or 0 if no state exists for the address (caller should then
 * fall back to chain query).
 *
 * @returns The next nonce to use, or `null` if no local state exists or the
 *          local state is stale (caller should query the chain).
 */
export async function getTrackedNonce(address: string): Promise<number | null> {
  const state = await ensureLoaded();
  const entry = state.addresses[address];
  if (!entry) return null;

  // Stale check
  const lastUpdated = new Date(entry.lastUpdated).getTime();
  if (Date.now() - lastUpdated > STALE_NONCE_MS) {
    return null; // Stale — caller should query chain
  }

  return entry.lastUsedNonce + 1;
}

/**
 * Record that a nonce was used for a transaction.
 *
 * Called after successful broadcast. Updates both in-memory and on-disk state.
 *
 * @param address - The sender STX address
 * @param nonce - The nonce that was used
 * @param txid - The transaction ID from broadcast
 */
export async function recordNonceUsed(
  address: string,
  nonce: number,
  txid: string
): Promise<void> {
  const state = await ensureLoaded();
  const now = new Date().toISOString();

  const existing = state.addresses[address];
  if (existing) {
    // Only advance — never regress
    if (nonce > existing.lastUsedNonce) {
      existing.lastUsedNonce = nonce;
    }
    existing.lastUpdated = now;

    // Append to pending log
    existing.pending.push({ nonce, txid, timestamp: now });
    // Trim to MAX_PENDING_LOG (FIFO)
    if (existing.pending.length > MAX_PENDING_LOG) {
      existing.pending = existing.pending.slice(-MAX_PENDING_LOG);
    }
  } else {
    state.addresses[address] = {
      lastUsedNonce: nonce,
      lastUpdated: now,
      pending: [{ nonce, txid, timestamp: now }],
    };
    evictOldestAddresses(state);
  }

  persistToDisk();
}

/**
 * Reconcile local state with chain data.
 *
 * If the chain's `possibleNextNonce` is ahead of our local state, update
 * to match (txs confirmed or external sends happened). If our local state
 * is ahead, keep it (chain is lagging behind mempool propagation).
 *
 * @param address - The STX address
 * @param chainNextNonce - The `possible_next_nonce` value from Hiro API
 */
export async function reconcileWithChain(
  address: string,
  chainNextNonce: number
): Promise<void> {
  const state = await ensureLoaded();
  const entry = state.addresses[address];

  if (!entry) {
    // No local state — initialize from chain
    state.addresses[address] = {
      lastUsedNonce: chainNextNonce - 1,
      lastUpdated: new Date().toISOString(),
      pending: [],
    };
    evictOldestAddresses(state);
    persistToDisk();
    return;
  }

  let changed = false;

  // Chain advanced past us — update (txs confirmed or external sends)
  if (chainNextNonce - 1 > entry.lastUsedNonce) {
    entry.lastUsedNonce = chainNextNonce - 1;
    entry.lastUpdated = new Date().toISOString();
    changed = true;
  }

  // Prune pending entries whose nonces are now confirmed on-chain
  const beforeLen = entry.pending.length;
  entry.pending = entry.pending.filter((p) => p.nonce >= chainNextNonce);
  if (entry.pending.length !== beforeLen) {
    changed = true;
  }

  if (changed) {
    persistToDisk();
  }
}

/**
 * Reset (clear) nonce state for an address.
 * Called on wallet unlock/lock/switch so the tracker re-syncs from chain.
 */
export async function resetTrackedNonce(address: string): Promise<void> {
  const state = await ensureLoaded();
  delete state.addresses[address];
  persistToDisk();
}

/**
 * Reset all tracked nonces (e.g., for testing or full resync).
 */
export async function resetAllTrackedNonces(): Promise<void> {
  _memoryState = createDefaultState();
  persistToDisk();
}

/**
 * Get the raw state for an address (for diagnostics/health tool).
 */
export async function getAddressState(
  address: string
): Promise<AddressNonceState | null> {
  const state = await ensureLoaded();
  return state.addresses[address] ?? null;
}

/**
 * Get the full state file (for diagnostics).
 */
export async function getFullState(): Promise<NonceStateFile> {
  return ensureLoaded();
}

/**
 * Force reload state from disk (useful after external process wrote to file).
 * Merges disk state into memory so external writes (CLI skills) are picked up
 * without losing any in-memory nonce advancements.
 */
export async function reloadFromDisk(): Promise<void> {
  const diskState = await readStateFile();
  if (_memoryState && Object.keys(_memoryState.addresses).length > 0) {
    _memoryState = mergeStates(diskState, _memoryState);
  } else {
    _memoryState = diskState;
  }
}

// ---------------------------------------------------------------------------
// Testing helpers
// ---------------------------------------------------------------------------

export const _testing = {
  STALE_NONCE_MS,
  MAX_PENDING_LOG,
  MAX_ADDRESSES,
  get NONCE_STATE_FILE() {
    return NONCE_STATE_FILE;
  },
  /** Override the state file path for test isolation. */
  setStateFilePath(filePath: string): void {
    NONCE_STATE_FILE = filePath;
  },
  /** Reset state file path to default. */
  resetStateFilePath(): void {
    NONCE_STATE_FILE = DEFAULT_NONCE_STATE_FILE;
  },
  /** Clear in-memory state without touching disk. */
  clearMemory(): void {
    _memoryState = null;
  },
  /** Get raw memory state ref for assertions. */
  getMemoryState(): NonceStateFile | null {
    return _memoryState;
  },
};
