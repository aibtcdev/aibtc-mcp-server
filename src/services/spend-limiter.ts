/**
 * Default-on cumulative spending limit for the wallet.
 *
 * The MCP server lets an LLM move real funds with no human click-through, so a
 * single poisoned instruction (or a malicious x402 endpoint) could otherwise
 * drain the wallet. This module is the safety rail: every outbound spend path
 * (native STX transfer, BTC L1 transfer, x402/L402 auto-payments, Lightning
 * pays, and contract calls carrying a bounded caller-owned post condition)
 * routes through it, and the limiter blocks once cumulative outflow would
 * exceed a per-session OR per-day cap.
 *
 * Two independent ledgers are tracked — micro-STX (`ustx`) and satoshis
 * (`sats`); there is no cross-asset USD normalization. Daily totals are
 * persisted to ~/.aibtc/spend-state.json (keyed by wallet address + UTC day) so
 * the cap survives process restarts; session totals live in memory and reset on
 * wallet unlock/lock/switch.
 *
 * Exceeding the cap is the intended human-in-the-loop checkpoint: it blocks and
 * surfaces the remaining budget. Raising the cap is the user's call, made in
 * the MCP client config; the message tells the agent to ask, never how to
 * switch the rail off.
 *
 * Disable entirely with SPEND_LIMIT_ENABLED=false. Override caps with
 * SPEND_LIMIT_DAILY_USTX / _SESSION_USTX / _DAILY_SATS / _SESSION_SATS.
 */
import { Pc, PostConditionMode, type PostCondition } from "@stacks/transactions";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { withSharedStateLock } from "./state-lock.js";
import { MAINNET_CONTRACTS, TESTNET_CONTRACTS } from "../config/contracts.js";

export type SpendUnit = "ustx" | "sats";

/** Asset ids this rail can meter. Any other FT has no ledger to bill. */
const SBTC_ASSETS = new Set([
  `${MAINNET_CONTRACTS.SBTC_TOKEN}::sbtc-token`,
  `${TESTNET_CONTRACTS.SBTC_TOKEN}::sbtc-token`,
]);

/**
 * Read spend ceilings out of a contract call's post conditions.
 *
 * A post condition already says "at most N of asset A leaves principal P", in
 * native units, enforced by the chain — which is exactly the bound this rail
 * wants, without taking a price-oracle dependency inside a safety rail.
 *
 * Only conditions that BOUND THE SPEND FROM ABOVE count: `eq`, `lt` and `lte`.
 * A `gt`/`gte` condition is a floor, not a cap, so metering it would invent a
 * ceiling that does not exist. Conditions on another principal are somebody
 * else's funds, and an FT that is not sBTC has no ledger here — both are
 * skipped rather than guessed at.
 *
 * `lt` is metered at its face value (one micro-unit above the true ceiling).
 * Over-metering by one is the safe direction for a cap.
 */
export function boundedPostConditionSpends(
  postConditions: PostCondition[] | undefined,
  accountAddress: string
): Array<{ unit: SpendUnit; amount: bigint }> {
  const spends: Array<{ unit: SpendUnit; amount: bigint }> = [];

  for (const condition of postConditions ?? []) {
    const pc = condition as unknown as {
      type?: string;
      address?: string;
      condition?: string;
      amount?: string | number | bigint;
      asset?: string;
    };

    if (pc.address !== accountAddress) continue;
    if (pc.condition !== "eq" && pc.condition !== "lt" && pc.condition !== "lte") continue;
    if (pc.amount === undefined) continue;

    const amount = BigInt(pc.amount);
    if (amount < 0n) continue;

    if (pc.type === "stx-postcondition") {
      spends.push({ unit: "ustx", amount });
    } else if (
      pc.type === "ft-postcondition" &&
      pc.asset !== undefined &&
      SBTC_ASSETS.has(pc.asset)
    ) {
      spends.push({ unit: "sats", amount });
    }
  }

  return spends;
}

/**
 * Collapse per-unit so one contract call is metered once per ledger, not once
 * per post condition.
 */
export function totalBoundedSpends(
  postConditions: PostCondition[] | undefined,
  accountAddress: string
): Array<{ unit: SpendUnit; amount: bigint }> {
  const totals = new Map<SpendUnit, bigint>();
  for (const { unit, amount } of boundedPostConditionSpends(postConditions, accountAddress)) {
    totals.set(unit, (totals.get(unit) ?? 0n) + amount);
  }
  return [...totals].map(([unit, amount]) => ({ unit, amount }));
}

/**
 * Ceilings a contract call in post-condition mode Allow declares for the
 * caller's own STX and sBTC. Allow lets the contract move assets that no post
 * condition names, so the caller's outflow is only bounded if the call itself
 * says so: callContract turns these into chain-enforced `lte` post conditions
 * on the caller and meters them.
 */
export interface CallerSpendCaps {
  ustx: bigint;
  sats: bigint;
}

/**
 * Work out what a contract call may spend, and the post conditions that make
 * the chain enforce it. Throws when the call's caller-owned STX/sBTC outflow
 * has no upper bound, because the rail could not meter it:
 * - Deny mode with a `gt`/`gte` condition on the caller's STX or sBTC (a floor
 *   that permits any larger amount);
 * - Allow mode without `callerSpendCaps`.
 */
export function planContractCallSpends(
  options: {
    postConditionMode?: PostConditionMode;
    postConditions?: PostCondition[];
    callerSpendCaps?: CallerSpendCaps;
    sbtcContract: `${string}.${string}`;
  },
  accountAddress: string
): { postConditions: PostCondition[]; spends: Array<{ unit: SpendUnit; amount: bigint }> } {
  const postConditions = [...(options.postConditions ?? [])];

  for (const condition of postConditions) {
    const pc = condition as unknown as { type?: string; address?: string; condition?: string; asset?: string };
    if (pc.address !== accountAddress) continue;
    if (pc.condition !== "gt" && pc.condition !== "gte") continue;
    const metered =
      pc.type === "stx-postcondition" ||
      (pc.type === "ft-postcondition" && pc.asset !== undefined && SBTC_ASSETS.has(pc.asset));
    if (metered) {
      throw new Error(
        `A "${pc.condition}" post condition on this wallet's own ${pc.type === "stx-postcondition" ? "STX" : "sBTC"} ` +
          "sets no upper bound, so the spending limit cannot meter it. Use eq, lt or lte."
      );
    }
  }

  const allow = options.postConditionMode === PostConditionMode.Allow;
  if (allow) {
    if (!options.callerSpendCaps) {
      throw new Error(
        "Post condition mode Allow lets the contract move any asset this wallet holds, " +
          "so the call must declare the most STX and sBTC it may spend (callerSpendCaps)."
      );
    }
    const { ustx, sats } = options.callerSpendCaps;
    const caller = Pc.principal(accountAddress);
    postConditions.push(
      caller.willSendLte(ustx).ustx(),
      caller.willSendLte(sats).ft(options.sbtcContract, "sbtc-token")
    );
  }

  return { postConditions, spends: totalBoundedSpends(postConditions, accountAddress) };
}

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

// Defaults: tight enough to stop a drain, generous for the micro-payment use
// case (x402 endpoints cost <=0.02 STX / 100 sats). Raise per wallet via env.
const DEFAULTS = {
  dailyUstx: 50_000_000, // 50 STX
  sessionUstx: 50_000_000, // 50 STX
  dailySats: 50_000,
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

/** What `reserve()` booked, for `release()` to give back. */
export interface SpendReservation {
  addr: string;
  day: string;
  spends: Array<{ unit: SpendUnit; amount: number }>;
}

/**
 * Drop every day but `today`, for every wallet, so the file does not grow
 * unbounded. Runs only under the lease: it walks EVERY address, so an
 * unlocked write could lose another wallet's day too.
 */
function pruneOtherDays(state: PersistedState, today: string): void {
  for (const a of Object.keys(state)) {
    for (const day of Object.keys(state[a])) {
      if (day !== today) delete state[a][day];
    }
    if (Object.keys(state[a]).length === 0) delete state[a];
  }
}

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
   * Book `spends` against the session and day ledgers, or throw
   * SpendLimitError if any of them would push a total over its cap. Call this
   * BEFORE signing, and `release()` the result if the spend then fails before
   * it leaves this process.
   *
   * The cap check and the booking are one step under the shared file lease.
   * A separate check and record let two processes both pass the check against
   * the same day total and then both spend (#683). Booked here, a second
   * process sees this spend in the total before it signs. A process that dies
   * between reserve and broadcast leaves the spend booked: over-counting is
   * the safe direction, and the skills engine does the same.
   *
   * All units are checked before any is booked, so a contract call moving STX
   * and sBTC is booked whole or not at all.
   */
  async reserve(
    spends: Array<{ unit: SpendUnit; amount: bigint }>,
    addr: string
  ): Promise<SpendReservation> {
    const booked = spends
      .filter((s) => s.amount > 0n)
      .map((s) => ({ unit: s.unit, amount: Number(s.amount) }));
    if (!isEnabled() || booked.length === 0) return { addr, day: todayKey(), spends: [] };

    const totals: DayLedger = { ustx: 0, sats: 0 };
    for (const { unit, amount } of booked) totals[unit] += amount;

    const run = await this.serialized(() =>
      withSharedStateLock(this.stateFile, async () => {
        // Read the day under the lease: waiting for it can cross UTC midnight,
        // and pruning against a stale day would delete the new one.
        const day = todayKey();
        const session = this.getSession(addr);
        const state = await this.readState();
        for (const unit of ["ustx", "sats"] as const) {
          const amt = totals[unit];
          if (amt === 0) continue;
          const { daily, session: sessionCap } = capsFor(unit);
          if (session[unit] + amt > sessionCap) {
            const remaining = Math.max(0, sessionCap - session[unit]);
            throw new SpendLimitError(
              this.message(unit, amt, remaining, "session", sessionCap),
              unit,
              amt,
              remaining,
              "session"
            );
          }
          const daySpent = state[addr]?.[day]?.[unit] ?? 0;
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

        pruneOtherDays(state, day);
        if (!state[addr]) state[addr] = {};
        if (!state[addr][day]) state[addr][day] = { ustx: 0, sats: 0 };
        for (const unit of ["ustx", "sats"] as const) {
          state[addr][day][unit] += totals[unit];
        }
        await this.writeState(state);
        session.ustx += totals.ustx;
        session.sats += totals.sats;
        return day;
      })
    );

    if (!run.held) {
      throw new Error(
        `Spend refused: could not take the spending-limit lock, so the daily cap cannot be ` +
          `checked safely: ${run.unavailable}`
      );
    }
    return { addr, day: run.value, spends: booked };
  }

  /**
   * Give back a reservation whose spend never left this process (signing or
   * broadcast failed, or a fallback path books its own). Without the lease
   * the day ledger is left as is: an unlocked write could drop another
   * process's booking, while skipping only over-counts.
   *
   * Idempotent: a reservation is given back at most once, so a caller that
   * releases before a fallback and again when that fallback throws does not
   * subtract twice.
   *
   * Never throws. Callers release on their way to rethrowing the real failure
   * or into a fallback; a ledger write error here must not replace either.
   * Failing to give budget back only over-counts.
   */
  async release(reservation: SpendReservation): Promise<void> {
    if (reservation.spends.length === 0) return;
    const { addr, day } = reservation;
    const totals: DayLedger = { ustx: 0, sats: 0 };
    for (const { unit, amount } of reservation.spends) totals[unit] += amount;
    reservation.spends = [];

    let run;
    try {
      run = await this.serialized(() =>
        withSharedStateLock(this.stateFile, async () => {
          const state = await this.readState();
          const ledger = state[addr]?.[day];
          if (ledger) {
            ledger.ustx = Math.max(0, ledger.ustx - totals.ustx);
            ledger.sats = Math.max(0, ledger.sats - totals.sats);
            await this.writeState(state);
          }
          const session = this.getSession(addr);
          session.ustx = Math.max(0, session.ustx - totals.ustx);
          session.sats = Math.max(0, session.sats - totals.sats);
        })
      );
    } catch (error) {
      console.error(
        `[spend-limit] Could not release ${totals.ustx} uSTX / ${totals.sats} sats for ${addr}: ` +
          `${error instanceof Error ? error.message : String(error)}. The day total stays ` +
          `over-counted by that amount.`
      );
      return;
    }

    if (!run.held) {
      console.error(
        `[spend-limit] Could not release ${totals.ustx} uSTX / ${totals.sats} sats for ${addr}: ` +
          `${run.unavailable} The day total stays over-counted by that amount.`
      );
    }
  }

  /**
   * Serialize ledger updates inside this process. The file lease excludes the
   * OTHER process (the skills engine's direct x402 path shares
   * spend-state.json so one wallet has one daily cap); this chain keeps two
   * calls in this process from interleaving their read-modify-writes.
   */
  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeLock.then(fn);
    // A failed update must not poison the chain for every later one.
    this.writeLock = run.then(
      () => {},
      () => {}
    );
    return run;
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
      `Spending limit reached: this ${attempted} ${label} spend would exceed the ` +
      `per-${scope} cap of ${cap} ${label} (${remaining} ${label} remaining). ` +
      `This is a safety rail against draining the wallet. Do not try to work around it: ` +
      `ask the user whether to proceed. Only the user can raise the cap, by setting ` +
      `${envVar} in this MCP server's config and restarting it.`
    );
  }
}

export function getSpendLimiter(): SpendLimiter {
  return SpendLimiter.getInstance();
}
