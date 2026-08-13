/**
 * Hermetic tool tests for the TaskMarket MCP tools. No network, no wallet, no
 * real spend. Mocks fetch for the read-only API and the first-party CLI for the
 * gated create path.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the first-party CLI binary so the create path is hermetic.
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  const mockExecFile = vi.fn();
  return { ...actual, execFile: mockExecFile };
});
import { execFile } from "child_process";
const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

const { registerTaskmarketTools } = await import(
  "../../src/tools/taskmarket.tools.js"
);

interface RegisteredTool {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

function createTrackingServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: vi.fn(
      (
        name: string,
        _config: { description: string; inputSchema: unknown },
        handler: RegisteredTool["handler"]
      ) => {
        tools.set(name, { handler });
      }
    ),
  };
  return { server, tools };
}

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseResult(res: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(res.content[0].text);
}

const VALID_TASK_ID = "0x" + "ab".repeat(32);

describe("taskmarket tools", () => {
  let server: ReturnType<typeof createTrackingServer>["server"];
  let tools: ReturnType<typeof createTrackingServer>["tools"];

  beforeEach(() => {
    mockExecFile.mockReset();
    const tracking = createTrackingServer();
    server = tracking.server;
    tools = tracking.tools;
    registerTaskmarketTools(server as never);
  });

  it("registers all six taskmarket tools without throwing", () => {
    expect(tools.has("taskmarket_search")).toBe(true);
    expect(tools.has("taskmarket_get")).toBe(true);
    expect(tools.has("taskmarket_submissions")).toBe(true);
    expect(tools.has("taskmarket_stats")).toBe(true);
    expect(tools.has("taskmarket_preview_create")).toBe(true);
    expect(tools.has("taskmarket_create")).toBe(true);
  });

  it("taskmarket_search returns mapped tasks from the public API", async () => {
    const task = {
      id: VALID_TASK_ID,
      reward: "2000000",
      status: "open",
      phase: "active",
      expiryTime: "2026-08-20T00:00:00Z",
      tags: ["mcp"],
      description: "A research task",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ tasks: [task], hasMore: false, nextCursor: null }))
    );
    const res = await tools.get("taskmarket_search")!.handler({
      status: "open",
      limit: 20,
    });
    const body = parseResult(res) as { success: boolean; taskCount: number; tasks: Array<{ rewardUsdc: string }> };
    expect(body.success).toBe(true);
    expect(body.taskCount).toBe(1);
    expect(body.tasks[0].rewardUsdc).toBe("2");
    vi.unstubAllGlobals();
  });

  it("taskmarket_get returns live status and link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: VALID_TASK_ID,
          status: "open",
          phase: "active",
          reward: "1000000",
          expiryTime: "2026-08-20T00:00:00Z",
          description: "task",
        })
      )
    );
    const res = await tools.get("taskmarket_get")!.handler({ taskId: VALID_TASK_ID });
    const body = parseResult(res) as { success: boolean; link: string };
    expect(body.success).toBe(true);
    expect(body.link).toContain(VALID_TASK_ID);
    vi.unstubAllGlobals();
  });

  it("taskmarket_submissions surfaces work for human review and never auto-accepts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          { id: "sub-1", workerAddress: "0x1", submittedAt: "2026-08-01T00:00:00Z" },
        ])
      )
    );
    const res = await tools.get("taskmarket_submissions")!.handler({ taskId: VALID_TASK_ID });
    const body = parseResult(res) as { success: boolean; submissionCount: number; note: string };
    expect(body.success).toBe(true);
    expect(body.submissionCount).toBe(1);
    expect(body.note).toContain("never auto-accepts");
    expect(body.note).toContain("Human review required");
    vi.unstubAllGlobals();
  });

  it("taskmarket_preview_create REFUSES without the confirmation token", async () => {
    const res = await tools.get("taskmarket_preview_create")!.handler({
      description: "Write a short research brief on Base USDC adoption for AI agents.",
      rewardUsdc: "2",
      durationHours: 24,
      confirm: "",
      maxSpendUsdc: "5",
    });
    const body = parseResult(res) as { success: boolean; granted: boolean; reason: string };
    expect(body.success).toBe(false);
    expect(body.granted).toBe(false);
    expect(body.reason).toContain("APPROVE");
    expect(body.reason).toContain("No funds were moved");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("taskmarket_preview_create REFUSES when reward exceeds max-spend", async () => {
    const res = await tools.get("taskmarket_preview_create")!.handler({
      description: "Write a short research brief on Base USDC adoption for AI agents.",
      rewardUsdc: "10",
      durationHours: 24,
      confirm: "APPROVE",
      maxSpendUsdc: "5",
    });
    const body = parseResult(res) as { success: boolean; granted: boolean; reason: string };
    expect(body.granted).toBe(false);
    expect(body.reason).toContain("exceeds max-spend");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("taskmarket_preview_create shows the exact plan on approval", async () => {
    const res = await tools.get("taskmarket_preview_create")!.handler({
      description: "Write a short research brief on Base USDC adoption for AI agents.",
      rewardUsdc: "2",
      durationHours: 24,
      tags: ["research"],
      confirm: "APPROVE",
      maxSpendUsdc: "5",
    });
    const body = parseResult(res) as {
      success: boolean;
      granted: boolean;
      plan: { network: string; rewardUsdc: string; maxSpendUsdc: string; deadlineIso: string; tags: string[] };
      cliCommand: string;
    };
    expect(body.success).toBe(true);
    expect(body.granted).toBe(true);
    expect(body.plan.network).toBe("eip155:8453");
    expect(body.plan.rewardUsdc).toBe("2");
    expect(body.plan.maxSpendUsdc).toBe("5");
    expect(body.plan.tags).toEqual(["research"]);
    expect(body.cliCommand).toContain("task create");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("taskmarket_create runs the CLI only after the gate passes and returns taskId + live status", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
        cb(null, {
          stdout: JSON.stringify({ ok: true, data: { taskId: VALID_TASK_ID } }),
          stderr: "",
        });
      }
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: VALID_TASK_ID,
          status: "open",
          phase: "active",
          reward: "2000000",
          expiryTime: "2026-08-20T00:00:00Z",
          description: "task",
        })
      )
    );
    const res = await tools.get("taskmarket_create")!.handler({
      description: "Write a short research brief on Base USDC adoption for AI agents.",
      rewardUsdc: "2",
      durationHours: 24,
      confirm: "APPROVE",
      maxSpendUsdc: "5",
    });
    const body = parseResult(res) as { success: boolean; taskId: string; liveStatus: { status: string } };
    expect(body.success).toBe(true);
    expect(body.taskId).toBe(VALID_TASK_ID);
    expect(body.liveStatus.status).toBe("open");
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const cliArgs = mockExecFile.mock.calls[0][1] as string[];
    expect(cliArgs[0]).toBe("task");
    expect(cliArgs[1]).toBe("create");
    vi.unstubAllGlobals();
  });

  it("taskmarket_create REFUSES (no CLI call) without explicit confirmation", async () => {
    const res = await tools.get("taskmarket_create")!.handler({
      description: "Write a short research brief on Base USDC adoption for AI agents.",
      rewardUsdc: "2",
      durationHours: 24,
      confirm: "nope",
      maxSpendUsdc: "5",
    });
    const body = parseResult(res) as { success: boolean; granted: boolean; reason: string };
    expect(body.success).toBe(false);
    expect(body.granted).toBe(false);
    expect(body.reason).toContain("APPROVE");
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("taskmarket_create does NOT blindly retry when the CLI fails with unknown settlement", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
        cb(new Error("settlement timed out"), { stdout: "", stderr: "" });
      }
    );
    const res = await tools.get("taskmarket_create")!.handler({
      description: "Write a short research brief on Base USDC adoption for AI agents.",
      rewardUsdc: "2",
      durationHours: 24,
      confirm: "APPROVE",
      maxSpendUsdc: "5",
    });
    const body = parseResult(res) as { success: boolean; note: string };
    expect(body.success).toBe(false);
    expect(body.note).toContain("NOT blindly retried");
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });

  it("taskmarket_create does NOT blindly retry when the CLI returns no task ID", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
        cb(null, { stdout: JSON.stringify({ ok: true }), stderr: "" });
      }
    );
    const res = await tools.get("taskmarket_create")!.handler({
      description: "Write a short research brief on Base USDC adoption for AI agents.",
      rewardUsdc: "2",
      durationHours: 24,
      confirm: "APPROVE",
      maxSpendUsdc: "5",
    });
    const body = parseResult(res) as { success: boolean; note: string };
    expect(body.success).toBe(false);
    expect(body.note).toContain("NOT retried");
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });
});
