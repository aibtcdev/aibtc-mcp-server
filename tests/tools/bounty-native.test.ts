import { describe, expect, it, vi, afterEach } from "vitest";
import { registerBountyScannerTools } from "../../src/tools/bounty-scanner.tools.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function createTrackingServer() {
  const tools = new Map<string, { description: string; handler: ToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: { description: string }, handler: ToolHandler) => {
      tools.set(name, { description: config.description, handler });
    }),
  };
  return { server, tools };
}

function parseResponse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]?.text ?? "{}");
}

describe("native bounty tools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers native bounty read tools alongside deprecated drx4 tools", () => {
    const { server, tools } = createTrackingServer();

    registerBountyScannerTools(server as any);

    expect(tools.get("bounty_list")?.description).toContain("DEPRECATED");
    expect(tools.has("bounty_list_native")).toBe(true);
    expect(tools.has("bounty_get_native")).toBe(true);
    expect(tools.has("bounty_submissions_native")).toBe(true);
    expect(tools.has("bounty_my_posted")).toBe(true);
    expect(tools.has("bounty_my_submissions")).toBe(true);
  });

  it("lists native bounties using aibtc.com filters", async () => {
    const { server, tools } = createTrackingServer();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bounties: [{ id: "bounty-1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    registerBountyScannerTools(server as any);

    const result = await tools.get("bounty_list_native")!.handler({
      status: "paid",
      poster: "bc1poster",
      submitter: "bc1submitter",
      tag: "mcp",
      limit: 25,
      offset: 50,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://aibtc.com/api/bounties?status=paid&poster=bc1poster&submitter=bc1submitter&tag=mcp&limit=25&offset=50"
    );
    expect(parseResponse(result)).toEqual({ bounties: [{ id: "bounty-1" }] });
  });
});
