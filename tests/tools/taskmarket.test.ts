/**
 * Hermetic tool tests for the TaskMarket MCP tools. No network, no wallet, no
 * real spend. Mocks fetch for the read-only API.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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
    const tracking = createTrackingServer();
    server = tracking.server;
    tools = tracking.tools;
    registerTaskmarketTools(server as never);
  });

  it("registers the four read-only taskmarket tools without throwing", () => {
    expect(tools.has("taskmarket_search")).toBe(true);
    expect(tools.has("taskmarket_get")).toBe(true);
    expect(tools.has("taskmarket_submissions")).toBe(true);
    expect(tools.has("taskmarket_stats")).toBe(true);
    expect(tools.size).toBe(4);
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

  it("taskmarket_stats refuses without an address or agentId (no API call)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await tools.get("taskmarket_stats")!.handler({});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/address or an agentId/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
