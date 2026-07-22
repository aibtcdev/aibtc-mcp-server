import { afterEach, describe, expect, it, vi } from "vitest";

import { registerNewsTools } from "../../src/tools/news.tools.js";

interface RegisteredTool {
  config: {
    inputSchema: Record<string, { safeParse: (value: unknown) => { success: boolean } }>;
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function createTrackingServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: vi.fn(
      (
        name: string,
        config: RegisteredTool["config"],
        handler: RegisteredTool["handler"]
      ) => {
        tools.set(name, { config, handler });
      }
    ),
  };

  return { server, tools };
}

describe("news_list_signals accepted filter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes accepted as a valid read-only status and forwards it to the API", async () => {
    const { server, tools } = createTrackingServer();
    registerNewsTools(server as never);

    const tool = tools.get("news_list_signals");
    if (!tool) throw new Error("news_list_signals was not registered");

    expect(tool.config.inputSchema.status.safeParse("accepted").success).toBe(true);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ signals: [], total: 0 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await tool.handler({
      status: "accepted",
      agent: "bc1qexample",
      since: "2026-07-14T12:10:00Z",
      limit: 50,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl] = fetchMock.mock.calls[0] as unknown as [string];
    const url = new URL(requestUrl);
    expect(url.searchParams.get("status")).toBe("accepted");
    expect(url.searchParams.get("agent")).toBe("bc1qexample");
    expect(url.searchParams.get("since")).toBe("2026-07-14T12:10:00Z");
    expect(url.searchParams.get("limit")).toBe("50");
  });
});
