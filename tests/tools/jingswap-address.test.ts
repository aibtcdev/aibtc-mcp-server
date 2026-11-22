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
const CONTRACT = `${GOOD}.pillar-wallet`;
const MAINNET_MULTISIG = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const TESTNET_MULTISIG = "SN20GPDS5RYB2DV03KG4W08EG6HD11KYPJ891HMS"; // c32address(21, hash160 of GOOD): version 21 = TestnetMultiSig

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

  it("accepts contract principals and SN/SM multisig addresses", () => {
    const tools = register();
    const activity = tools.get("jingswap_get_user_activity")!;
    for (const ok of [CONTRACT, TESTNET_MULTISIG, MAINNET_MULTISIG, `${TESTNET_MULTISIG}.my_vault-2`]) {
      expect(activity.schema.safeParse({ address: ok }).success, ok).toBe(true);
    }
    for (const bad of [`${GOOD}.`, `${GOOD}.1abc`, `${GOOD}.a/b`, `${GOOD}.a?b`, `${GOOD}..x`, "SX" + GOOD.slice(2)]) {
      expect(activity.schema.safeParse({ address: bad }).success, bad).toBe(false);
    }
  });

  it("does not call SM addresses contracts in the validation message", () => {
    const tools = register();
    const res = tools.get("jingswap_get_user_activity")!.schema.safeParse({ address: "nope" }) as unknown as {
      error: { issues: { message: string }[] };
    };
    const msg = res.error.issues[0].message;
    expect(msg).toContain("SN");
    expect(msg).not.toMatch(/SM… contract/);
  });

  it("puts a contract principal in one path segment", async () => {
    const tools = register();
    await tools.get("jingswap_get_user_activity")!.handler({ address: CONTRACT });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe(`/api/auction/activity/${CONTRACT}`);
  });

  for (const bypass of [TRAVERSAL, ".", "..", "", `${GOOD}/../x`, `${GOOD}#frag`]) {
    it(`refuses ${JSON.stringify(bypass)} in both handlers even if the schema is bypassed`, async () => {
      const tools = register();
      const a = await tools.get("jingswap_get_user_activity")!.handler({ address: bypass });
      const d = await tools.get("jingswap_get_user_deposit")!.handler({ cycle: 7, address: bypass });
      expect(a.isError).toBe(true);
      expect(d.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }
});
