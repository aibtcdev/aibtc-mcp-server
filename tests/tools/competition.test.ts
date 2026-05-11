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

const mockGetTransactionStatus = vi.fn();
vi.mock("../../src/services/hiro-api.js", () => ({
  getTransactionStatus: mockGetTransactionStatus,
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

const VALID_TXID =
  "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

describe("competition tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // Default tx-status mock: tx is confirmed (success) so the pre-flight
    // gate passes and submission proceeds. Tests that need pending semantics
    // override this in-place.
    mockGetTransactionStatus.mockResolvedValue({
      status: "success",
      block_height: 7929497,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    mockGetTransactionStatus.mockReset();
  });

  it("submit_trade is idempotent: two calls with same txid return the same shape", async () => {
    const verifiedBody = {
      txid: VALID_TXID,
      sender: "SP000000000000000000002Q6VF78",
      tx_status: "success",
      source: "agent",
    };
    fetchMock.mockImplementation(async () => jsonResponse(verifiedBody));

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const submit = tools.get("competition_submit_trade")!;

    const first = await submit.handler({ txid: VALID_TXID });
    const second = await submit.handler({ txid: VALID_TXID });

    expect(first.isError).toBeUndefined();
    expect(second.isError).toBeUndefined();
    expect(first.content[0].text).toEqual(second.content[0].text);
    expect(JSON.parse(first.content[0].text)).toEqual(verifiedBody);

    // Both calls hit POST /trades with the normalized txid in the body.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const [url, init] = call as [string, RequestInit];
      expect(url).toBe("https://test.aibtc.com/api/competition/trades");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ txid: VALID_TXID });
    }
  });

  it("propagates 5xx errors as MCP error responses with status code", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "indexer offline" }, { status: 503 })
    );

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const submit = tools.get("competition_submit_trade")!;

    const result = await submit.handler({ txid: VALID_TXID });
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
    const submit = tools.get("competition_submit_trade")!;

    const pending = submit.handler({ txid: VALID_TXID });
    await vi.advanceTimersByTimeAsync(10_001);
    const result = await pending;

    expect(result.isError).toBe(true);
    expect(abortError).toBeDefined();
    expect(result.content[0].text.toLowerCase()).toContain("abort");
  });

  it("gates submission when the tx is still pending on Stacks", async () => {
    mockGetTransactionStatus.mockResolvedValue({ status: "pending" });

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const submit = tools.get("competition_submit_trade")!;

    const result = await submit.handler({ txid: VALID_TXID });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body).toMatchObject({
      accepted: false,
      txid: VALID_TXID,
      tx_status: "pending",
    });
    expect(body.message).toContain("pending");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards terminal-failure txs to the verifier (backend records them)", async () => {
    mockGetTransactionStatus.mockResolvedValue({
      status: "abort_by_post_condition",
    });
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        txid: VALID_TXID,
        tx_status: "abort_by_post_condition",
        source: "agent",
      })
    );

    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const submit = tools.get("competition_submit_trade")!;

    const result = await submit.handler({ txid: VALID_TXID });
    expect(result.isError).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.content[0].text).tx_status).toBe(
      "abort_by_post_condition"
    );
  });

  it("rejects malformed txids before any network call", async () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCompetitionTools(server as any);
    const submit = tools.get("competition_submit_trade")!;

    const result = await submit.handler({ txid: "not-a-real-txid" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid Stacks txid");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
