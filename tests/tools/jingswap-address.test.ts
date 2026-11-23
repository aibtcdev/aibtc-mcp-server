import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/x402.service.js", () => ({
  getAccount: vi.fn(),
  getWalletAddress: vi.fn(),
  NETWORK: "mainnet",
}));

vi.mock("../../src/transactions/builder.js", () => ({
  callContract: vi.fn(),
}));

const { registerJingswapTools } = await import("../../src/tools/jingswap.tools.js");

interface RegisteredTool {
  schema: { safeParse: (value: unknown) => { success: boolean } };
  handler: (args: Record<string, unknown>) => Promise<{ isError?: boolean }>;
}

function registerTools(): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: vi.fn(
      (name: string, config: { inputSchema: RegisteredTool["schema"] }, handler: RegisteredTool["handler"]) => {
        tools.set(name, { schema: config.inputSchema, handler });
      }
    ),
  };
  registerJingswapTools(server as never);
  return tools;
}

const GOOD_ADDRESS = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22";
const TRAVERSAL = "x/../../../../some/route?";

describe("jingswap address path validation (#807)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects path-traversal input in both tool schemas", () => {
    const tools = registerTools();
    const deposit = tools.get("jingswap_get_user_deposit")!;
    const activity = tools.get("jingswap_get_user_activity")!;

    expect(deposit.schema.safeParse({ cycle: 1, address: TRAVERSAL }).success).toBe(false);
    expect(activity.schema.safeParse({ address: TRAVERSAL }).success).toBe(false);
    expect(deposit.schema.safeParse({ cycle: 1, address: GOOD_ADDRESS }).success).toBe(true);
    expect(activity.schema.safeParse({ address: GOOD_ADDRESS }).success).toBe(true);
  });

  it("accepts contract principals (<address>.<contract-name>)", () => {
    const tools = registerTools();
    const deposit = tools.get("jingswap_get_user_deposit")!;
    const activity = tools.get("jingswap_get_user_activity")!;
    const principal = `${GOOD_ADDRESS}.my-vault`;

    expect(deposit.schema.safeParse({ cycle: 1, address: principal }).success).toBe(true);
    expect(activity.schema.safeParse({ address: principal }).success).toBe(true);
    expect(deposit.schema.safeParse({ cycle: 1, address: `${GOOD_ADDRESS}.` }).success).toBe(false);
    expect(activity.schema.safeParse({ address: `${GOOD_ADDRESS}..bad` }).success).toBe(false);
  });

  it("does not call the API when a caller bypasses the schema", async () => {
    const tools = registerTools();
    const activity = await tools.get("jingswap_get_user_activity")!.handler({ address: TRAVERSAL });
    const deposit = await tools.get("jingswap_get_user_deposit")!.handler({ cycle: 7, address: TRAVERSAL });

    expect(activity.isError).toBe(true);
    expect(deposit.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a valid address in the expected API path", async () => {
    const tools = registerTools();
    await tools.get("jingswap_get_user_activity")!.handler({ address: GOOD_ADDRESS });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe(`/api/auction/activity/${GOOD_ADDRESS}`);
  });
});
