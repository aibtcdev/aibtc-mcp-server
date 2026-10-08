import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import {
  boundedPostConditionSpends,
  getSpendLimiter,
  SpendLimitError,
  totalBoundedSpends,
  type SpendUnit,
} from "../../src/services/spend-limiter.js";
import { Pc } from "@stacks/transactions";
import { MAINNET_CONTRACTS, TESTNET_CONTRACTS } from "../../src/config/contracts.js";

// Unique address per test so the shared singleton's session map and the daily
// state file don't bleed across tests.
const runId = Date.now();
let testId = 0;
function addr(): string {
  return `SP_SL_${runId}_${testId}`;
}

const limiter = getSpendLimiter();
const reserve = (unit: SpendUnit, amount: bigint, a: string) =>
  limiter.reserve([{ unit, amount }], a);

// Env vars capsFor reads at call time. Save/restore around each test.
const ENV_KEYS = [
  "SPEND_LIMIT_ENABLED",
  "SPEND_LIMIT_DAILY_USTX",
  "SPEND_LIMIT_SESSION_USTX",
  "SPEND_LIMIT_DAILY_SATS",
  "SPEND_LIMIT_SESSION_SATS",
];
let savedEnv: Record<string, string | undefined> = {};
let stateFile: string;

beforeEach(async () => {
  testId++;
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  stateFile = path.join(
    os.tmpdir(),
    `spend-state-${runId}-${testId}.json`
  );
  limiter.setStateFile(stateFile);
  limiter.resetSession(addr());
});

afterEach(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await fs.rm(stateFile, { force: true });
  await fs.rm(`${stateFile}.tmp`, { force: true });
});

describe("default caps (Conservative)", () => {
  it("allows a spend under the default 50 STX cap", async () => {
    await expect(
      reserve("ustx", 45_000_000n, addr())
    ).resolves.toBeDefined();
  });

  it("blocks a single spend over the default 50 STX cap", async () => {
    await expect(reserve("ustx", 51_000_000n, addr())).rejects.toThrow(
      SpendLimitError
    );
  });

  it("allows a sats spend under the default 50k cap, blocks over", async () => {
    await expect(reserve("sats", 40_000n, addr())).resolves.toBeDefined();
    await expect(reserve("sats", 60_000n, addr())).rejects.toThrow(
      SpendLimitError
    );
  });
});

describe("cumulative tracking", () => {
  it("blocks once recorded spends sum past the cap (drain-by-loop)", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "1000000"; // 1 STX
    process.env.SPEND_LIMIT_DAILY_USTX = "1000000";
    const a = addr();

    // Four sub-cap payments of 0.3 STX each — third is fine, fourth exceeds 1 STX.
    await reserve("ustx", 300_000n, a);
    await reserve("ustx", 300_000n, a);
    await reserve("ustx", 300_000n, a);

    // 0.9 STX spent; a 4th 0.3 STX would hit 1.2 > 1 STX → blocked.
    await expect(reserve("ustx", 300_000n, a)).rejects.toThrow(
      SpendLimitError
    );
  });

  it("ustx and sats are independent ledgers", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "1000000";
    process.env.SPEND_LIMIT_SESSION_SATS = "1000";
    const a = addr();
    await reserve("ustx", 1_000_000n, a); // ustx now full
    // sats ledger untouched — still allows up to its own cap.
    await expect(reserve("sats", 900n, a)).resolves.toBeDefined();
    await expect(reserve("ustx", 1n, a)).rejects.toThrow(SpendLimitError);
  });
});

describe("session reset", () => {
  it("resetSession clears the per-session ledger", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "1000000";
    process.env.SPEND_LIMIT_DAILY_USTX = "100000000"; // high so day isn't the limiter
    const a = addr();
    await reserve("ustx", 1_000_000n, a);
    await expect(reserve("ustx", 1n, a)).rejects.toThrow(SpendLimitError);

    limiter.resetSession(a);
    await expect(reserve("ustx", 1n, a)).resolves.toBeDefined();
  });

  it("daily ledger survives a session reset", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "100000000";
    process.env.SPEND_LIMIT_DAILY_USTX = "1000000"; // day is the limiter
    const a = addr();
    await reserve("ustx", 1_000_000n, a);
    limiter.resetSession(a);
    // Session was cleared but the day total persists → still blocked.
    await expect(reserve("ustx", 1n, a)).rejects.toThrow(SpendLimitError);
  });
});

describe("disable + overrides", () => {
  it("SPEND_LIMIT_ENABLED=false disables all checks", async () => {
    process.env.SPEND_LIMIT_ENABLED = "false";
    await expect(
      reserve("ustx", 999_000_000_000n, addr())
    ).resolves.toBeDefined();
  });

  it("env override raises the cap", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "50000000"; // 50 STX
    process.env.SPEND_LIMIT_DAILY_USTX = "50000000";
    await expect(
      reserve("ustx", 40_000_000n, addr())
    ).resolves.toBeDefined();
  });

  it("invalid env override falls back to default (does not disable)", async () => {
    process.env.SPEND_LIMIT_DAILY_USTX = "not-a-number";
    // Falls back to the 50 STX default → 51 STX still blocked.
    await expect(reserve("ustx", 51_000_000n, addr())).rejects.toThrow(
      SpendLimitError
    );
  });

  it("zero/negative amounts are no-ops", async () => {
    await expect(reserve("ustx", 0n, addr())).resolves.toBeDefined();
    await expect(reserve("ustx", -5n, addr())).resolves.toBeDefined();
  });
});

describe("persistence + status", () => {
  it("records persist to the state file and status reflects remaining", async () => {
    process.env.SPEND_LIMIT_DAILY_USTX = "10000000";
    process.env.SPEND_LIMIT_SESSION_USTX = "10000000";
    const a = addr();
    await reserve("ustx", 4_000_000n, a);

    const raw = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const today = new Date().toISOString().slice(0, 10);
    expect(raw[a][today].ustx).toBe(4_000_000);

    const status = await limiter.status(a);
    expect(status.enabled).toBe(true);
    expect(status.ustx.dailyRemaining).toBe(6_000_000);
    expect(status.ustx.sessionRemaining).toBe(6_000_000);
  });

  it("error carries scope, remaining, and unit", async () => {
    process.env.SPEND_LIMIT_SESSION_SATS = "1000";
    const a = addr();
    try {
      await reserve("sats", 2000n, a);
      throw new Error("expected SpendLimitError");
    } catch (e) {
      expect(e).toBeInstanceOf(SpendLimitError);
      const err = e as SpendLimitError;
      expect(err.unit).toBe("sats");
      expect(err.scope).toBe("session");
      expect(err.remaining).toBe(1000);
    }
  });
});

describe("reserve and release (#683)", () => {
  const today = () => new Date().toISOString().slice(0, 10);

  it("books the spend in the state file before anything is signed", async () => {
    const a = addr();
    await reserve("sats", 600n, a);
    const raw = JSON.parse(await fs.readFile(stateFile, "utf8"));
    expect(raw[a][today()].sats).toBe(600);
  });

  it("refuses a spend that a booking from another process already made room for", async () => {
    // The skills engine books into the same file before it signs. A second
    // payment must see that booking, not the total from before it.
    process.env.SPEND_LIMIT_DAILY_SATS = "1000";
    const a = addr();
    await fs.writeFile(stateFile, JSON.stringify({ [a]: { [today()]: { ustx: 0, sats: 600 } } }));
    await expect(reserve("sats", 600n, a)).rejects.toThrow(SpendLimitError);
    await expect(reserve("sats", 400n, a)).resolves.toBeDefined();
  });

  it("lets only one of two concurrent spends through when together they exceed the cap", async () => {
    process.env.SPEND_LIMIT_DAILY_SATS = "1000";
    const a = addr();
    const results = await Promise.allSettled([reserve("sats", 600n, a), reserve("sats", 600n, a)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(SpendLimitError);
  });

  it("release gives the budget back to the day and the session, once", async () => {
    process.env.SPEND_LIMIT_DAILY_SATS = "1000";
    process.env.SPEND_LIMIT_SESSION_SATS = "1000";
    const a = addr();
    await reserve("sats", 300n, a);
    const r = await reserve("sats", 700n, a);
    await expect(reserve("sats", 1n, a)).rejects.toThrow(SpendLimitError);

    await limiter.release(r);
    await limiter.release(r);

    const raw = JSON.parse(await fs.readFile(stateFile, "utf8"));
    expect(raw[a][today()].sats).toBe(300);
    const status = await limiter.status(a);
    expect(status.sats.dailyRemaining).toBe(700);
    expect(status.sats.sessionRemaining).toBe(700);
  });

  it("books into the day it gets the lease in, without pruning that day", async () => {
    // A reserve that queues across UTC midnight must not prune the new day.
    const a = addr();
    const other = `${a}_other`;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-08T23:59:59.900Z"));
      await reserve("sats", 100n, a);
      vi.setSystemTime(new Date("2026-10-09T00:00:00.100Z"));
      // Another process booked into the new day meanwhile.
      const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
      state[other] = { "2026-10-09": { ustx: 0, sats: 700 } };
      await fs.writeFile(stateFile, JSON.stringify(state));

      const r = await reserve("sats", 50n, a);
      expect(r.day).toBe("2026-10-09");
      const after = JSON.parse(await fs.readFile(stateFile, "utf8"));
      expect(after[other]["2026-10-09"].sats).toBe(700);
      expect(after[a]["2026-10-09"].sats).toBe(50);
    } finally {
      vi.useRealTimers();
    }
  });

  it("release never throws, so it cannot hide the failure being reported", async () => {
    const a = addr();
    const r = await reserve("sats", 100n, a);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });
    // The ledger write fails (read-only home, full disk).
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("EROFS"));

    await expect(limiter.release(r)).resolves.toBeUndefined();
    expect(errors.join("\n")).toContain("stays over-counted");
    vi.restoreAllMocks();
  });

  it("books a multi-unit spend whole or not at all", async () => {
    process.env.SPEND_LIMIT_DAILY_SATS = "1000";
    const a = addr();
    await expect(
      limiter.reserve([{ unit: "ustx", amount: 5000n }, { unit: "sats", amount: 2000n }], a)
    ).rejects.toThrow(SpendLimitError);
    const status = await limiter.status(a);
    expect(status.ustx.sessionRemaining).toBe(50_000_000);
    expect(status.ustx.dailyRemaining).toBe(50_000_000);
  });
});

describe("bounded post-condition spends", () => {
  const me = "SP000000000000000000002Q6VF78";
  const other = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

  it("meters eq/lt/lte STX conditions and ignores lower bounds", () => {
    expect(
      boundedPostConditionSpends(
        [
          Pc.principal(me).willSendEq(100).ustx(),
          Pc.principal(me).willSendLte(200).ustx(),
          Pc.principal(me).willSendLt(300).ustx(),
          Pc.principal(me).willSendGte(999).ustx(),
          Pc.principal(me).willSendGt(999).ustx(),
        ],
        me
      )
    ).toEqual([
      { unit: "ustx", amount: 100n },
      { unit: "ustx", amount: 200n },
      { unit: "ustx", amount: 300n },
    ]);
  });

  it("meters sBTC on both networks and ignores other fungible tokens", () => {
    expect(
      boundedPostConditionSpends(
        [
          Pc.principal(me)
            .willSendEq(456)
            .ft(MAINNET_CONTRACTS.SBTC_TOKEN as `${string}.${string}`, "sbtc-token"),
          Pc.principal(me)
            .willSendEq(789)
            .ft(TESTNET_CONTRACTS.SBTC_TOKEN as `${string}.${string}`, "sbtc-token"),
          // Not sBTC: no ledger to bill it against, so it must not be metered.
          Pc.principal(me)
            .willSendEq(1_000_000)
            .ft("SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex", "alex"),
        ],
        me
      )
    ).toEqual([
      { unit: "sats", amount: 456n },
      { unit: "sats", amount: 789n },
    ]);
  });

  it("ignores conditions on a principal that is not the caller", () => {
    expect(
      boundedPostConditionSpends([Pc.principal(other).willSendEq(500).ustx()], me)
    ).toEqual([]);
  });

  it("handles a missing post-condition list", () => {
    expect(boundedPostConditionSpends(undefined, me)).toEqual([]);
  });

  it("collapses multiple conditions into one charge per ledger", () => {
    expect(
      totalBoundedSpends(
        [
          Pc.principal(me).willSendEq(100).ustx(),
          Pc.principal(me).willSendLte(50).ustx(),
          Pc.principal(me)
            .willSendEq(7)
            .ft(MAINNET_CONTRACTS.SBTC_TOKEN as `${string}.${string}`, "sbtc-token"),
        ],
        me
      )
    ).toEqual([
      { unit: "ustx", amount: 150n },
      { unit: "sats", amount: 7n },
    ]);
  });
});
