import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/competition.js", () => ({
  AIBTC_CAMPAIGN_API_URL: "https://test.aibtc.com/api/competition",
}));

vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({
    getActiveWalletId: async () => "wallet-1",
    listWallets: async () => [
      { id: "wallet-1", address: "SP000000000000000000002Q6VF78" },
    ],
  }),
}));

const { registerCompetitionTools } = await import(
  "../../src/tools/competition.tools.js"
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

describe("competition tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("exposes only the read-only tools (submission and allowlist are retired)", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);

    expect([...tools.keys()].sort()).toEqual([
      "competition_list_trades",
      "competition_status",
    ]);
  });

  it("reads trade history for the active wallet", async () => {
    const body = { trades: [{ txid: "0xabc", tx_status: "success" }], next_cursor: null };
    fetchMock.mockResolvedValue(jsonResponse(body));

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const listTrades = tools.get("competition_list_trades")!;

    const result = await listTrades.handler({});
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(body);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      "https://test.aibtc.com/api/competition/trades?address=SP000000000000000000002Q6VF78"
    );
  });

  it("propagates 5xx errors as MCP error responses with status code", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "indexer offline" }, { status: 503 })
    );

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const listTrades = tools.get("competition_list_trades")!;

    const result = await listTrades.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("503");
    expect(result.content[0].text).toContain("indexer offline");
  });

  it("aborts requests that exceed the 10s timeout", async () => {
    vi.useFakeTimers();

    let abortError: Error | undefined;
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signal.addEventListener("abort", () => {
            abortError = new Error("The operation was aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        })
    );

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const listTrades = tools.get("competition_list_trades")!;

    const pending = listTrades.handler({});
    await vi.advanceTimersByTimeAsync(10_001);
    const result = await pending;

    expect(result.isError).toBe(true);
    expect(abortError).toBeDefined();
    expect(result.content[0].text.toLowerCase()).toContain("abort");
  });
});
