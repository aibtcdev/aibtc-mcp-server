/**
 * Hermetic unit tests for the TaskMarket service's read-only API client.
 * No network access, no wallet, no real spend.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import {
  baseUnitsToUsdc,
  usdcToBaseUnits,
  listTasks,
  getTask,
  listSubmissions,
  getMarketStats,
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
