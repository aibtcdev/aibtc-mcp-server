/**
 * Dashboard State — shared singleton
 * Written by MCP tools, read by the dashboard server.
 */

import { PROTOCOL_GENESIS_HASH, type BitcoinCoreStatus } from "../services/bitcoin-core-rpc.js";

export interface ChainEntry {
  height:    number;
  hash:      string;
  tool:      string;
  ts:        number;
  duration_ms: number;
}

export interface ToolCall {
  name:        string;
  ts:          number;
  duration_ms: number;
  blocked:     boolean;
  session_id?: string;
}

export interface DashboardState {
  protocol: {
    name:         string;
    version:      string;
    genesis_hash: string;
    started_at:   number;
    uptime_ms:    number;
  };
  bitcoin: BitcoinCoreStatus | null;
  chain: {
    length:        number;
    valid:         boolean;
    recent:        ChainEntry[];   // last 50
  };
  tools: {
    total_calls:   number;
    blocked_calls: number;
    recent:        ToolCall[];     // last 100
    active_sessions: number;
  };
  security: {
    ipi_blocks:    number;
    score:         number;
    chain_valid:   boolean;
  };
}

// ── Singleton ─────────────────────────────────────────────────────────────────

const STARTED_AT = Date.now();

const state: DashboardState = {
  protocol: {
    name:         "aibtc-protocol",
    version:      "1.0.0",
    genesis_hash: PROTOCOL_GENESIS_HASH,
    started_at:   STARTED_AT,
    uptime_ms:    0,
  },
  bitcoin:  null,
  chain: {
    length: 0,
    valid:  true,
    recent: [],
  },
  tools: {
    total_calls:     0,
    blocked_calls:   0,
    recent:          [],
    active_sessions: 0,
  },
  security: {
    ipi_blocks:  0,
    score:       100,
    chain_valid: true,
  },
};

// ── Write helpers (called by session-guard and other subsystems) ──────────────

export function recordToolCall(
  name: string,
  duration_ms: number,
  blocked: boolean,
  sessionId?: string,
): void {
  state.tools.total_calls++;
  if (blocked) state.tools.blocked_calls++;

  const entry: ToolCall = { name, ts: Date.now(), duration_ms, blocked, session_id: sessionId };
  state.tools.recent.unshift(entry);
  if (state.tools.recent.length > 100) state.tools.recent.length = 100;

  _notify();
}

export function recordChainBlock(
  height: number,
  hash: string,
  tool: string,
  duration_ms: number,
): void {
  state.chain.length = height;
  const entry: ChainEntry = { height, hash, tool, ts: Date.now(), duration_ms };
  state.chain.recent.unshift(entry);
  if (state.chain.recent.length > 50) state.chain.recent.length = 50;
  _notify();
}

export function updateBitcoin(data: BitcoinCoreStatus): void {
  state.bitcoin = data;
  _notify();
}

export function updateSecurity(patch: Partial<DashboardState["security"]>): void {
  Object.assign(state.security, patch);
  _notify();
}

export function setActiveSessions(n: number): void {
  state.tools.active_sessions = n;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getState(): DashboardState {
  state.protocol.uptime_ms = Date.now() - STARTED_AT;
  return state;
}

// ── Change notification (listeners registered by dashboard server) ────────────

type Listener = () => void;
const _listeners: Set<Listener> = new Set();

export function onStateChange(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _notify(): void {
  for (const fn of _listeners) {
    try { fn(); } catch { /* non-fatal */ }
  }
}
