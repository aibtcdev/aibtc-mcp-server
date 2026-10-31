import { beforeEach, describe, expect, it, vi } from "vitest";

// #746: nonce_heal signs gap fills and an RBF bump of the chain head without
// booking them on the spend limit, and feeMultiplier had no max.

const ADDRESS = "SP20GPDS5RYB2DV03KG4W08EG6HD11KYPK6FQJE1";

const mockMake = vi.fn();
const mockBroadcast = vi.fn();
vi.mock("@stacks/transactions", async (orig) => ({
  ...(await orig<typeof import("@stacks/transactions")>()),
  makeSTXTokenTransfer: (opts: unknown) => mockMake(opts),
  broadcastTransaction: (opts: unknown) => mockBroadcast(opts),
}));

const mockReserve = vi.fn();
const mockRelease = vi.fn();
vi.mock("../../src/services/spend-limiter.js", () => ({
  getSpendLimiter: () => ({ reserve: mockReserve, release: mockRelease }),
}));

vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({
    getAccount: () => ({ address: ADDRESS, privateKey: "00".repeat(32) + "01" }),
  }),
}));

const hiro = {
  getNonceInfo: vi.fn(),
  getMempoolTransactions: vi.fn(),
  getTransaction: vi.fn(),
};
vi.mock("../../src/services/hiro-api.js", () => ({ getHiroApi: () => hiro }));

vi.mock("../../src/services/nonce-tracker.js", () => ({
  getAddressState: vi.fn(),
  reloadFromDisk: vi.fn(async () => {}),
  recordNonceUsed: vi.fn(async () => {}),
  STALE_NONCE_MS: 600_000,
}));

vi.mock("../../src/utils/fee.js", () => ({
  resolveDefaultFee: vi.fn(async () => 1000n),
}));

const { registerNonceTools } = await import("../../src/tools/nonce.tools.js");

type Handler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
}>;

function setup() {
  type Schema = { safeParse: (v: unknown) => { success: boolean } };
  const tools = new Map<string, { config: { inputSchema: { shape: Record<string, Schema> } }; handler: Handler }>();
  const server = {
    registerTool: vi.fn((name: string, config: never, handler: Handler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerNonceTools(server as never);
  return tools.get("nonce_heal")!;
}

const parse = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0].text);

describe("nonce_heal spend limit (#746)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMake.mockResolvedValue({ tx: "signed" });
    mockBroadcast.mockResolvedValue({ txid: "ab".repeat(32) });
    mockReserve.mockResolvedValue({ id: "r1" });
    // one gap at 5, chain head pending at 6 with a 3,000 uSTX fee
    hiro.getNonceInfo.mockResolvedValue({
      last_executed_tx_nonce: 4,
      detected_missing_nonces: [5],
      detected_mempool_nonces: [6],
    });
    hiro.getMempoolTransactions.mockResolvedValue({
      results: [{ nonce: 6, tx_id: "0x" + "cd".repeat(32), fee_rate: "3000", sponsored: false }],
    });
    hiro.getTransaction.mockResolvedValue({ tx_type: "token_transfer" });
  });

  it("caps feeMultiplier at 5", () => {
    const { config } = setup();
    const schema = config.inputSchema.shape.feeMultiplier;
    expect(schema.safeParse(5).success).toBe(true);
    expect(schema.safeParse(5.01).success).toBe(false);
    expect(schema.safeParse(100000).success).toBe(false);
  });

  it("books each gap fill and the RBF bump before signing", async () => {
    const { handler } = setup();
    await handler({ address: ADDRESS, dryRun: false, bumpHead: true, feeMultiplier: 2 });

    expect(mockReserve).toHaveBeenCalledTimes(2);
    expect(mockReserve.mock.calls[0]).toEqual([[{ unit: "ustx", amount: 1001n }], ADDRESS]); // gap fill: 1 + 1000 fee
    expect(mockReserve.mock.calls[1]).toEqual([[{ unit: "ustx", amount: 6001n }], ADDRESS]); // RBF: 1 + 3000 * 2
    expect(mockReserve.mock.invocationCallOrder[0]).toBeLessThan(mockMake.mock.invocationCallOrder[0]);
    expect(mockReserve.mock.invocationCallOrder[1]).toBeLessThan(mockMake.mock.invocationCallOrder[1]);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("does not sign when the limiter refuses", async () => {
    mockReserve.mockRejectedValue(new Error("Spend limit reached"));
    const { handler } = setup();
    const out = parse(await handler({ address: ADDRESS, dryRun: false, bumpHead: true, feeMultiplier: 2 }));

    expect(mockMake).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
    const statuses = out.actions.map((a: { type: string; status: string }) => `${a.type}:${a.status}`);
    expect(statuses).toEqual(["fill_gap:failed", "bump_head:failed"]);
  });

  it("releases the booking when the node explicitly rejects", async () => {
    mockBroadcast.mockResolvedValue({ error: "rejected", reason: "BadNonce" });
    const { handler } = setup();
    await handler({ address: ADDRESS, dryRun: false, bumpHead: true, feeMultiplier: 2 });

    expect(mockRelease).toHaveBeenCalledTimes(2);
  });

  it("keeps the booking when broadcast throws (outcome unknown)", async () => {
    mockBroadcast.mockRejectedValue(new Error("socket hang up"));
    const { handler } = setup();
    await handler({ address: ADDRESS, dryRun: false, bumpHead: true, feeMultiplier: 2 });

    expect(mockReserve).toHaveBeenCalledTimes(2);
    expect(mockRelease).not.toHaveBeenCalled();
  });
});
