/**
 * Hermetic unit tests for the TaskMarket service: the read-only API client and
 * the gated create-plan logic. No network access, no wallet, no real spend.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import {
  baseUnitsToUsdc,
  usdcToBaseUnits,
  parseMaxSpend,
  prepareCreatePlan,
  listTasks,
  getTask,
  listSubmissions,
  getMarketStats,
  TASKMARKET_NETWORK,
  TASKMARKET_USDC_ASSET,
} from "../../src/services/taskmarket.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usdc unit conversion", () => {
  it("converts base units to human USDC", () => {
    expect(baseUnitsToUsdc("2000000")).toBe("2");
    expect(baseUnitsToUsdc("500000")).toBe("0.5");
    expect(baseUnitsToUsdc("1")).toBe("0.000001");
    expect(baseUnitsToUsdc("0")).toBe("0");
    expect(baseUnitsToUsdc(null)).toBe("0");
  });

  it("converts human USDC to base units", () => {
    expect(usdcToBaseUnits("2")).toBe("2000000");
    expect(usdcToBaseUnits("0.5")).toBe("500000");
    expect(usdcToBaseUnits("0.000001")).toBe("1");
  });

  it("rejects malformed USDC amounts", () => {
    expect(() => usdcToBaseUnits("abc")).toThrow();
    expect(() => usdcToBaseUnits("1.0000001")).toThrow();
  });

  it("parses max-spend caps", () => {
    expect(parseMaxSpend("5")).toBe(5000000n);
    expect(parseMaxSpend("0.50")).toBe(500000n);
    expect(parseMaxSpend("2000000", true)).toBe(2000000n);
  });
});

describe("prepareCreatePlan — the create gate", () => {
  const base = {
    description: "Write a short research brief on Base USDC adoption for AI agents.",
    rewardUsdc: "2",
    durationHours: 24,
    tags: ["research"],
    submissionVisibility: "public" as const,
  };

  it("grants a valid plan and pins Base network + USDC asset", () => {
    const result = prepareCreatePlan(base, { confirm: "APPROVE", maxSpendUsdc: "5" });
    expect(result.granted).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.plan!.network).toBe(TASKMARKET_NETWORK);
    expect(result.plan!.asset).toBe(TASKMARKET_USDC_ASSET);
    expect(result.plan!.rewardBaseUnits).toBe("2000000");
    expect(result.plan!.rewardUsdc).toBe("2");
    expect(result.plan!.maxSpendUsdc).toBe("5");
    expect(result.plan!.durationHours).toBe(24);
    expect(result.plan!.tags).toEqual(["research"]);
    expect(new Date(result.plan!.deadlineIso).getTime()).toBeGreaterThan(Date.now());
  });

  it("REFUSES without the explicit confirmation token (no money moves)", () => {
    const result = prepareCreatePlan(base, { confirm: "", maxSpendUsdc: "5" });
    expect(result.granted).toBe(false);
    expect(result.reason).toContain("APPROVE");
    expect(result.reason).toContain("No funds were moved");
  });

  it("REFUSES a wrong confirmation token", () => {
    const result = prepareCreatePlan(base, { confirm: "yes", maxSpendUsdc: "5" });
    expect(result.granted).toBe(false);
  });

  it("REFUSES when reward exceeds max-spend cap", () => {
    const result = prepareCreatePlan(base, { confirm: "APPROVE", maxSpendUsdc: "1" });
    expect(result.granted).toBe(false);
    expect(result.reason).toContain("exceeds max-spend");
    expect(result.reason).toContain("No funds were moved");
  });

  it("REFUSES a zero reward", () => {
    const result = prepareCreatePlan(
      { ...base, rewardUsdc: "0" },
      { confirm: "APPROVE", maxSpendUsdc: "5" }
    );
    expect(result.granted).toBe(false);
    expect(result.reason).toContain("greater than 0");
  });

  it("REFUSES a too-short description (deliverables must be explicit)", () => {
    const result = prepareCreatePlan(
      { ...base, description: "short" },
      { confirm: "APPROVE", maxSpendUsdc: "5" }
    );
    expect(result.granted).toBe(false);
    expect(result.reason).toContain("at least 20 characters");
  });

  it("REFUSES an invalid reward string", () => {
    const result = prepareCreatePlan(
      { ...base, rewardUsdc: "not-a-number" },
      { confirm: "APPROVE", maxSpendUsdc: "5" }
    );
    expect(result.granted).toBe(false);
  });

  it("REFUSES an invalid max-spend", () => {
    const result = prepareCreatePlan(base, { confirm: "APPROVE", maxSpendUsdc: "oops" });
    expect(result.granted).toBe(false);
  });

  it("REFUSES a non-positive duration", () => {
    const result = prepareCreatePlan(
      { ...base, durationHours: 0 },
      { confirm: "APPROVE", maxSpendUsdc: "5" }
    );
    expect(result.granted).toBe(false);
  });

  it("REFUSES an invalid submission visibility", () => {
    const result = prepareCreatePlan(
      { ...base, submissionVisibility: "secret" as "public" },
      { confirm: "APPROVE", maxSpendUsdc: "5" }
    );
    expect(result.granted).toBe(false);
  });

  it("supports base-unit max-spend (for tool callers holding raw values)", () => {
    const result = prepareCreatePlan(base, {
      confirm: "APPROVE",
      maxSpendUsdc: "5000000",
      maxSpendBaseUnits: true,
    });
    expect(result.granted).toBe(true);
    expect(result.plan!.maxSpendBaseUnits).toBe("5000000");
  });
});

describe("TaskMarket read-only API client", () => {
  it("listTasks maps the public API response", async () => {
    const tasks = [
      {
        id: "0x1234",
        reward: "2000000",
        status: "open",
        phase: "active",
        expiryTime: "2026-08-20T00:00:00Z",
        tags: ["mcp"],
        description: "A task",
      },
    ];
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ tasks, hasMore: false, nextCursor: null }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await listTasks({ status: "open", limit: 20 });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("0x1234");
    expect(result.tasks[0].reward).toBe("2000000");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("/api/tasks?");
    expect(url).toContain("status=open");
  });

  it("getTask fetches a single task", async () => {
    const task = { id: "0xabc", status: "open", reward: "1000000", description: "hi" };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(task), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", mockFetch);
    const result = await getTask("0xabc");
    expect(result.id).toBe("0xabc");
    expect(String(mockFetch.mock.calls[0][0])).toContain("/api/tasks/0xabc");
  });

  it("listSubmissions returns an array (or the wrapped submissions field)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "sub-1", workerAddress: "0x1", submittedAt: "2026-08-01T00:00:00Z" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", mockFetch);
    const result = await listSubmissions("0xabc");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sub-1");
  });

  it("surfaces API errors instead of swallowing them", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    );
    vi.stubGlobal("fetch", mockFetch);
    await expect(getTask("0xabc")).rejects.toThrow(/TaskMarket API error 500/);
  });

  it("getMarketStats passes address query param", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completedTasks: 3, averageRating: "4.5" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", mockFetch);
    const result = await getMarketStats({ address: "0xSOME" });
    expect(result.completedTasks).toBe(3);
    expect(String(mockFetch.mock.calls[0][0])).toContain("address=0xSOME");
  });
});
