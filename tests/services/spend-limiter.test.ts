import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import {
  boundedPostConditionSpends,
  getSpendLimiter,
  SpendLimitError,
} from "../../src/services/spend-limiter.js";
import { Pc } from "@stacks/transactions";

// Unique address per test so the shared singleton's session map and the daily
// state file don't bleed across tests.
const runId = Date.now();
let testId = 0;
function addr(): string {
  return `SP_SL_${runId}_${testId}`;
}

const limiter = getSpendLimiter();

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
  stateFile = path.join(os.tmpdir(), `spend-state-${runId}-${testId}.json`);
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
  it("derives only bounded STX and sBTC post conditions", () => {
    const address = "SP000000000000000000002Q6VF78";
    const spends = boundedPostConditionSpends(
      [
        Pc.principal(address).willSendLte(123).ustx(),
        Pc.principal(address).willSendGte(999).ustx(),
        Pc.principal(address)
          .willSendEq(456)
          .ft(
            "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token",
            "sbtc-token",
          ),
        Pc.principal(address)
          .willSendEq(789)
          .ft(
            "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.other-token",
            "other-token",
          ),
      ],
      address,
    );
    expect(spends).toEqual([
      { unit: "ustx", amount: 123n },
      { unit: "sats", amount: 456n },
    ]);
  });

  it("allows a spend under the default 10 STX cap", async () => {
    await expect(
      limiter.check("ustx", 5_000_000n, addr()),
    ).resolves.toBeUndefined();
  });

  it("blocks a single spend over the default 10 STX cap", async () => {
    await expect(limiter.check("ustx", 11_000_000n, addr())).rejects.toThrow(
      SpendLimitError,
    );
  });

  it("allows a sats spend under the default 50k cap, blocks over", async () => {
    await expect(
      limiter.check("sats", 40_000n, addr()),
    ).resolves.toBeUndefined();
    await expect(limiter.check("sats", 60_000n, addr())).rejects.toThrow(
      SpendLimitError,
    );
  });
});

describe("cumulative tracking", () => {
  it("blocks once recorded spends sum past the cap (drain-by-loop)", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "1000000"; // 1 STX
    process.env.SPEND_LIMIT_DAILY_USTX = "1000000";
    const a = addr();

    // Four sub-cap payments of 0.3 STX each — third is fine, fourth exceeds 1 STX.
    await limiter.check("ustx", 300_000n, a);
    await limiter.record("ustx", 300_000n, a);
    await limiter.check("ustx", 300_000n, a);
    await limiter.record("ustx", 300_000n, a);
    await limiter.check("ustx", 300_000n, a);
    await limiter.record("ustx", 300_000n, a);

    // 0.9 STX spent; a 4th 0.3 STX would hit 1.2 > 1 STX → blocked.
    await expect(limiter.check("ustx", 300_000n, a)).rejects.toThrow(
      SpendLimitError,
    );
  });

  it("ustx and sats are independent ledgers", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "1000000";
    process.env.SPEND_LIMIT_SESSION_SATS = "1000";
    const a = addr();
    await limiter.record("ustx", 1_000_000n, a); // ustx now full
    // sats ledger untouched — still allows up to its own cap.
    await expect(limiter.check("sats", 900n, a)).resolves.toBeUndefined();
    await expect(limiter.check("ustx", 1n, a)).rejects.toThrow(SpendLimitError);
  });
});

describe("session reset", () => {
  it("resetSession clears the per-session ledger", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "1000000";
    process.env.SPEND_LIMIT_DAILY_USTX = "100000000"; // high so day isn't the limiter
    const a = addr();
    await limiter.record("ustx", 1_000_000n, a);
    await expect(limiter.check("ustx", 1n, a)).rejects.toThrow(SpendLimitError);

    limiter.resetSession(a);
    await expect(limiter.check("ustx", 1n, a)).resolves.toBeUndefined();
  });

  it("daily ledger survives a session reset", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "100000000";
    process.env.SPEND_LIMIT_DAILY_USTX = "1000000"; // day is the limiter
    const a = addr();
    await limiter.record("ustx", 1_000_000n, a);
    limiter.resetSession(a);
    // Session was cleared but the day total persists → still blocked.
    await expect(limiter.check("ustx", 1n, a)).rejects.toThrow(SpendLimitError);
  });
});

describe("disable + overrides", () => {
  it("SPEND_LIMIT_ENABLED=false disables all checks", async () => {
    process.env.SPEND_LIMIT_ENABLED = "false";
    await expect(
      limiter.check("ustx", 999_000_000_000n, addr()),
    ).resolves.toBeUndefined();
  });

  it("env override raises the cap", async () => {
    process.env.SPEND_LIMIT_SESSION_USTX = "50000000"; // 50 STX
    process.env.SPEND_LIMIT_DAILY_USTX = "50000000";
    await expect(
      limiter.check("ustx", 40_000_000n, addr()),
    ).resolves.toBeUndefined();
  });

  it("invalid env override falls back to default (does not disable)", async () => {
    process.env.SPEND_LIMIT_DAILY_USTX = "not-a-number";
    // Falls back to 10 STX default → 11 STX still blocked.
    await expect(limiter.check("ustx", 11_000_000n, addr())).rejects.toThrow(
      SpendLimitError,
    );
  });

  it("zero/negative amounts are no-ops", async () => {
    await expect(limiter.check("ustx", 0n, addr())).resolves.toBeUndefined();
    await expect(limiter.record("ustx", -5n, addr())).resolves.toBeUndefined();
  });
});

describe("persistence + status", () => {
  it("records persist to the state file and status reflects remaining", async () => {
    process.env.SPEND_LIMIT_DAILY_USTX = "10000000";
    process.env.SPEND_LIMIT_SESSION_USTX = "10000000";
    const a = addr();
    await limiter.record("ustx", 4_000_000n, a);

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
      await limiter.check("sats", 2000n, a);
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
