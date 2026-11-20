import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { registerJingswapTools } = await import("../../src/tools/jingswap.tools.js");

interface Registered {
  schema: { safeParse: (v: unknown) => { success: boolean } };
  handler: (args: Record<string, unknown>) => Promise<{ isError?: boolean }>;
}

function register() {
  const tools = new Map<string, Registered>();
  const server = {
    registerTool: vi.fn((name: string, config: { inputSchema: Registered["schema"] }, handler: Registered["handler"]) => {
      tools.set(name, { schema: config.inputSchema, handler });
    }),
  };
  registerJingswapTools(server as never);
  return tools;
}

const GOOD = "SP20GPDS5RYB2DV03KG4W08EG6HD11KYPK6FQJE1";
const TRAVERSAL = "x/../../../../some/route?";

describe("jingswap address inputs (aibtcdev/aibtc-mcp-server#807)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a non-address in the input schema of both tools", () => {
    const tools = register();
    const deposit = tools.get("jingswap_get_user_deposit")!;
    const activity = tools.get("jingswap_get_user_activity")!;
    expect(deposit.schema.safeParse({ cycle: 1, address: TRAVERSAL }).success).toBe(false);
    expect(activity.schema.safeParse({ address: TRAVERSAL }).success).toBe(false);
    expect(activity.schema.safeParse({ address: "SP123/../x" }).success).toBe(false);
    expect(deposit.schema.safeParse({ cycle: 1, address: GOOD }).success).toBe(true);
    expect(activity.schema.safeParse({ address: GOOD }).success).toBe(true);
  });

  it("keeps the request on the activity path even if the schema is bypassed", async () => {
    const tools = register();
    await tools.get("jingswap_get_user_activity")!.handler({ address: TRAVERSAL });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname.startsWith("/api/auction/activity/")).toBe(true);
    expect(url.search).toBe("");
  });

  it("keeps the request on the deposit path even if the schema is bypassed", async () => {
    const tools = register();
    await tools.get("jingswap_get_user_deposit")!.handler({ cycle: 7, address: TRAVERSAL });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname.startsWith("/api/auction/deposit/7/")).toBe(true);
    expect(url.search).toBe("");
  });
});
