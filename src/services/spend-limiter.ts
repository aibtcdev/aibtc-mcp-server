/**
 * Default-on cumulative spending limit for the wallet.
 *
 * The MCP server lets an LLM move real funds with no human click-through, so a
 * single poisoned instruction (or a malicious x402 endpoint) could otherwise
 * drain the wallet. This module is the safety rail: every outbound spend path
 * (native STX transfer, BTC L1 transfer, x402/L402 auto-payments, Lightning
 * pays) routes through it, and the limiter blocks once cumulative outflow would
 * exceed a per-session OR per-day cap.
 *
 * Two independent ledgers are tracked — micro-STX (`ustx`) and satoshis
 * (`sats`); there is no cross-asset USD normalization. Daily totals are
 * persisted to ~/.aibtc/spend-state.json (keyed by wallet address + UTC day) so
 * the cap survives process restarts; session totals live in memory and reset on
 * wallet unlock/lock/switch.
 *
 * Exceeding the cap is the intended human-in-the-loop checkpoint: it blocks and
 * surfaces the remaining budget + the env var to raise. An LLM cannot set env
 * vars mid-session, so it cannot raise its own ceiling.
 *
 * Disable entirely with SPEND_LIMIT_ENABLED=false. Override caps with
 * SPEND_LIMIT_DAILY_USTX / _SESSION_USTX / _DAILY_SATS / _SESSION_SATS.
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";

export type SpendUnit = "ustx" | "sats";

const STORAGE_DIR = path.join(os.homedir(), ".aibtc");
const DEFAULT_STATE_FILE = path.join(STORAGE_DIR, "spend-state.json");

/**
 * Parse a positive-integer env override, falling back (with a warning) on any
 * invalid value — never silently disable a cap. Mirrors parseSatsCap in
 * x402.service.ts.
 */
function parseLimit(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `[spend-limit] Invalid ${envName}="${raw}", falling back to ${fallback}`
    );
    return fallback;
  }
  return Math.floor(parsed);
}

function isEnabled(): boolean {
  return process.env.SPEND_LIMIT_ENABLED !== "false";
}

// Conservative defaults (~$30/day at the time of writing): tight enough to stop
// a drain, generous for the micro-payment use case (registry endpoints cost
// <=0.02 STX / 100 sats). Raise per wallet via env.
const DEFAULTS = {
  dailyUstx: 10_000_000, // 10 STX
  sessionUstx: 10_000_000, // 10 STX
  dailySats: 50_000, // ~$30 BTC
  sessionSats: 50_000,
} as const;

interface Caps {
  daily: number;
  session: number;
}

function capsFor(unit: SpendUnit): Caps {
  if (unit === "ustx") {
    return {
      daily: parseLimit("SPEND_LIMIT_DAILY_USTX", DEFAULTS.dailyUstx),
      session: parseLimit("SPEND_LIMIT_SESSION_USTX", DEFAULTS.sessionUstx),
    };
  }
  return {
    daily: parseLimit("SPEND_LIMIT_DAILY_SATS", DEFAULTS.dailySats),
    session: parseLimit("SPEND_LIMIT_SESSION_SATS", DEFAULTS.sessionSats),
  };
}

/** UTC day bucket, e.g. "2026-06-11". */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function unitLabel(unit: SpendUnit): string {
  return unit === "ustx" ? "uSTX" : "sats";
}

export class SpendLimitError extends Error {
  constructor(
    message: string,
    public readonly unit: SpendUnit,
    public readonly attempted: number,
    public readonly remaining: number,
    public readonly scope: "session" | "day"
  ) {
    super(message);
    this.name = "SpendLimitError";
  }
}

// Persisted shape: { [walletAddress]: { [dayKey]: { ustx, sats } } }
interface DayLedger {
  ustx: number;
  sats: number;
}
type PersistedState = Record<string, Record<string, DayLedger>>;

class SpendLimiter {
  private static instance: SpendLimiter;
  private stateFile = DEFAULT_STATE_FILE;
  // In-memory per-session totals, keyed by wallet address.
  private session: Map<string, DayLedger> = new Map();
  private writeLock: Promise<void> = Promise.resolve();

  static getInstance(): SpendLimiter {
    if (!SpendLimiter.instance) SpendLimiter.instance = new SpendLimiter();
    return SpendLimiter.instance;
  }

  /** Test seam: redirect the state file. */
  setStateFile(file: string): void {
    this.stateFile = file;
  }

  private async readState(): Promise<PersistedState> {
    try {
      const content = await fs.readFile(this.stateFile, "utf8");
      return JSON.parse(content) as PersistedState;
    } catch {
      return {};
    }
  }

  private async writeState(state: PersistedState): Promise<void> {
    const dir = path.dirname(this.stateFile);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const tmp = `${this.stateFile}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(tmp, this.stateFile);
  }

  private getSession(addr: string): DayLedger {
    let s = this.session.get(addr);
    if (!s) {
      s = { ustx: 0, sats: 0 };
      this.session.set(addr, s);
    }
    return s;
  }

  /** Reset the in-memory session ledger for a wallet (call on unlock/lock/switch). */
  resetSession(addr: string): void {
    this.session.delete(addr);
  }

  /**
   * Throw SpendLimitError if `amount` would push the session OR day total over
   * its cap. Does NOT record — call recordSpend after a successful broadcast.
   */
  async check(unit: SpendUnit, amount: bigint, addr: string): Promise<void> {
    if (!isEnabled()) return;
    if (amount <= 0n) return;
    const amt = Number(amount);
    const { daily, session } = capsFor(unit);

    const sessionSpent = this.getSession(addr)[unit];
    if (sessionSpent + amt > session) {
      const remaining = Math.max(0, session - sessionSpent);
      throw new SpendLimitError(
        this.message(unit, amt, remaining, "session", session),
        unit,
        amt,
        remaining,
        "session"
      );
    }

    const state = await this.readState();
    const daySpent = state[addr]?.[todayKey()]?.[unit] ?? 0;
    if (daySpent + amt > daily) {
      const remaining = Math.max(0, daily - daySpent);
      throw new SpendLimitError(
        this.message(unit, amt, remaining, "day", daily),
        unit,
        amt,
        remaining,
        "day"
      );
    }
  }

  /** Record a completed spend against both the session and day ledgers. */
  async record(unit: SpendUnit, amount: bigint, addr: string): Promise<void> {
    if (!isEnabled()) return;
    if (amount <= 0n) return;
    const amt = Number(amount);

    this.getSession(addr)[unit] += amt;

    // Serialize read-modify-write to avoid lost updates under concurrency.
    this.writeLock = this.writeLock.then(async () => {
      const state = await this.readState();
      const today = todayKey();
      // Prune stale days so the file does not grow unbounded.
      for (const a of Object.keys(state)) {
        for (const day of Object.keys(state[a])) {
          if (day !== today) delete state[a][day];
        }
        if (Object.keys(state[a]).length === 0) delete state[a];
      }
      if (!state[addr]) state[addr] = {};
      if (!state[addr][today]) state[addr][today] = { ustx: 0, sats: 0 };
      state[addr][today][unit] += amt;
      await this.writeState(state);
    });
    await this.writeLock;
  }

  /** Remaining session/day budget for status reporting. */
  async status(addr: string): Promise<{
    enabled: boolean;
    ustx: { sessionRemaining: number; dailyRemaining: number };
    sats: { sessionRemaining: number; dailyRemaining: number };
  }> {
    const state = await this.readState();
    const mk = (unit: SpendUnit) => {
      const { daily, session } = capsFor(unit);
      const sessionSpent = this.session.get(addr)?.[unit] ?? 0;
      const daySpent = state[addr]?.[todayKey()]?.[unit] ?? 0;
      return {
        sessionRemaining: Math.max(0, session - sessionSpent),
        dailyRemaining: Math.max(0, daily - daySpent),
      };
    };
    return { enabled: isEnabled(), ustx: mk("ustx"), sats: mk("sats") };
  }

  private message(
    unit: SpendUnit,
    attempted: number,
    remaining: number,
    scope: "session" | "day",
    cap: number
  ): string {
    const envVar =
      unit === "ustx"
        ? scope === "day"
          ? "SPEND_LIMIT_DAILY_USTX"
          : "SPEND_LIMIT_SESSION_USTX"
        : scope === "day"
          ? "SPEND_LIMIT_DAILY_SATS"
          : "SPEND_LIMIT_SESSION_SATS";
    const label = unitLabel(unit);
    return (
      `Spending limit reached: this ${attempted} ${label} transfer would exceed the ` +
      `per-${scope} cap of ${cap} ${label} (${remaining} ${label} remaining). ` +
      `This is a safety rail against draining the wallet. To allow a larger spend, ` +
      `raise ${envVar} (or set SPEND_LIMIT_ENABLED=false to disable), then retry.`
    );
  }
}

export function getSpendLimiter(): SpendLimiter {
  return SpendLimiter.getInstance();
}
