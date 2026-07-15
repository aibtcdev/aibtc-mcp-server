import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAccount = vi.fn();

vi.mock("../../src/services/x402.service.js", () => ({
  getAccount: mockGetAccount,
  NETWORK: "mainnet",
}));

vi.mock("../../src/services/sbtc.service.js", () => ({
  getSbtcService: vi.fn(() => ({ getBalance: vi.fn() })),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: vi.fn(() => ({
    getAccountInfo: vi.fn(),
    getMempoolTransactions: vi.fn(),
  })),
}));

vi.mock("../../src/services/nonce-tracker.js", () => ({
  getTrackedNonce: vi.fn(),
  recordNonceUsed: vi.fn(),
  reconcileWithChain: vi.fn(),
}));

// bip322Sign is real crypto over the mocked key material; stub it so the test
// asserts payload construction rather than re-testing the signer.
vi.mock("../../src/utils/bip322.js", () => ({
  bip322Sign: vi.fn(() => "mock-signature"),
}));

vi.mock("@scure/btc-signer", () => ({
  p2wpkh: vi.fn(() => ({ script: new Uint8Array([0x00]) })),
  NETWORK: {},
  TEST_NETWORK: {},
}));

const { registerNewsTools } = await import("../../src/tools/news.tools.js");

interface RegisteredTool {
  handler: (args: Record<string, unknown>) => Promise<unknown>;
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

/**
 * Registers the news tools, invokes news_editor_review_signal with `args`, and
 * returns the JSON body that would have been PATCHed to /api/signals/:id/review.
 */
async function reviewPayload(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { server, tools } = createTrackingServer();
  registerNewsTools(server as never);
  const tool = tools.get("news_editor_review_signal");
  if (!tool) throw new Error("news_editor_review_signal was not registered");

  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ id: "sig_1", status: "rejected" }),
  }));
  vi.stubGlobal("fetch", fetchMock);

  const result = (await tool.handler(args)) as { isError?: boolean };
  if (result?.isError) {
    throw new Error(
      `handler errored: ${JSON.stringify((result as Record<string, unknown>).content)}`
    );
  }
  if (fetchMock.mock.calls.length === 0) {
    throw new Error("handler did not issue a request");
  }

  const [, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    { body: string },
  ];
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe("news_editor_review_signal quality_score override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockGetAccount.mockResolvedValue({
      address: "SP000000000000000000002Q6VF78",
      btcAddress: "bc1qeditor000000000000000000000000000000",
      btcPrivateKey: new Uint8Array(32).fill(1),
      btcPublicKey: new Uint8Array(33).fill(2),
      privateKey: "0".repeat(64),
      network: "mainnet",
    });
  });

  it("forwards an editor-supplied quality_score", async () => {
    const payload = await reviewPayload({
      signal_id: "sig_1",
      status: "rejected",
      feedback: "duplicate refile",
      quality_score: 15,
    });

    expect(payload.quality_score).toBe(15);
  });

  // The #810 case: fabricated sources score 0. A truthiness guard
  // (`if (quality_score)`) drops it silently and the override becomes a no-op,
  // so this asserts the most severe correction an editor can make survives.
  it("forwards quality_score 0 rather than dropping it as falsy", async () => {
    const payload = await reviewPayload({
      signal_id: "sig_2",
      status: "rejected",
      feedback: "fabricated sources",
      quality_score: 0,
    });

    expect(payload).toHaveProperty("quality_score");
    expect(payload.quality_score).toBe(0);
  });

  it("omits quality_score entirely when not supplied", async () => {
    const payload = await reviewPayload({
      signal_id: "sig_3",
      status: "approved",
    });

    expect(payload).not.toHaveProperty("quality_score");
  });
});
