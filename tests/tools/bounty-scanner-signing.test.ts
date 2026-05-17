import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { registerBountyScannerTools } from "../../src/tools/bounty-scanner.tools.js";

const mocks = vi.hoisted(() => ({
  getAccount: vi.fn(),
}));

vi.mock("../../src/services/x402.service.js", () => ({
  getAccount: mocks.getAccount,
}));

type ToolHandler = (input: Record<string, unknown>) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
}>;

function createTrackingServer() {
  const handlers = new Map<string, ToolHandler>();
  const server = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
  };

  return { server, handlers };
}

describe("native bounty signing", () => {
  const btcPrivateKey = new Uint8Array(32);
  btcPrivateKey[31] = 1;
  const btcPublicKey = secp256k1.getPublicKey(btcPrivateKey, true);

  beforeEach(() => {
    mocks.getAccount.mockResolvedValue({
      btcAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      btcPrivateKey,
      btcPublicKey,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("creates BIP-137 signatures for native bounty writes with legacy BTC wallets", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "native-bounty-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { server, handlers } = createTrackingServer();
    registerBountyScannerTools(server as never);
    const handler = handlers.get("bounty_create_native");
    expect(handler).toBeDefined();

    const response = await handler!({
      title: "Fix native signing",
      description: "Exercise the BIP-137 signing path",
      reward_sats: 1000,
      expires_at: "2026-06-01T00:00:00.000Z",
      tags: ["test", "signing"],
    });

    expect(fetchMock, "fetch not called — signing likely threw").toHaveBeenCalledOnce();
    expect(response.isError, "signing failed — check secp256k1 API usage").toBeUndefined();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { signature: string };
    const signature = Buffer.from(body.signature, "base64");

    expect(signature).toHaveLength(65);
    expect(signature[0]).toBeGreaterThanOrEqual(31);
    expect(signature[0]).toBeLessThanOrEqual(34);
    expect(signature.subarray(1)).not.toEqual(Buffer.alloc(64));

    const payload = JSON.parse(response.content[0].text) as { success: boolean };
    expect(payload.success).toBe(true);
  });
});
