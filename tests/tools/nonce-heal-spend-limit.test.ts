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
vi.mock("../../src/services/spend-limiter.js", async (orig) => ({
  ...(await orig<typeof import("../../src/services/spend-limiter.js")>()),
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
const { SpendLimitError } = await import("../../src/services/spend-limiter.js");

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

function fillGapTool() {
  let handler: Handler | undefined;
  registerNonceTools({
    registerTool: (name: string, _config: never, h: Handler) => {
      if (name === "nonce_fill_gap") handler = h;
    },
  } as never);
  return handler!;
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

  it("releases the booking when signing throws", async () => {
    mockMake.mockRejectedValue(new Error("bad key"));
    const { handler } = setup();
    await handler({ address: ADDRESS, dryRun: false, bumpHead: true, feeMultiplier: 2 });

    expect(mockReserve).toHaveBeenCalledTimes(2);
    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});

describe("nonce_heal review fixes (#747)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMake.mockResolvedValue({ tx: "signed" });
    mockBroadcast.mockResolvedValue({ txid: "ab".repeat(32) });
    mockReserve.mockResolvedValue({ id: "r1" });
    hiro.getNonceInfo.mockResolvedValue({
      last_executed_tx_nonce: 4,
      detected_missing_nonces: [5, 7],
      detected_mempool_nonces: [6],
    });
    hiro.getMempoolTransactions.mockResolvedValue({
      results: [{ nonce: 6, tx_id: "0x" + "cd".repeat(32), fee_rate: "3000", sponsored: false }],
    });
    hiro.getTransaction.mockResolvedValue({ tx_type: "token_transfer" });
  });

  it("refuses to execute for an address that is not the unlocked wallet", async () => {
    const { handler } = setup();
    const out = parse(await handler({ address: "SP2B40X3CHTFFR4KY0Q4WNYDZGJSTCJ8150PXC9HR", dryRun: false, bumpHead: true }));

    expect(out.error).toMatch(/only heals the unlocked wallet/);
    expect(hiro.getNonceInfo).not.toHaveBeenCalled();
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockMake).not.toHaveBeenCalled();
  });

  it("still previews another address in dry run", async () => {
    const { handler } = setup();
    const out = parse(await handler({ address: "SP2B40X3CHTFFR4KY0Q4WNYDZGJSTCJ8150PXC9HR", dryRun: true, bumpHead: true }));

    expect(out.dryRun).toBe(true);
    expect(out.gapsFound).toEqual([5, 7]);
    expect(mockMake).not.toHaveBeenCalled();
  });

  it.each([["0"], ["abc"], [undefined], ["1e3"]])("refuses to bump a head with fee_rate %s", async (feeRate) => {
    hiro.getNonceInfo.mockResolvedValue({ last_executed_tx_nonce: 5, detected_missing_nonces: [], detected_mempool_nonces: [6] });
    hiro.getMempoolTransactions.mockResolvedValue({
      results: [{ nonce: 6, tx_id: "0x" + "cd".repeat(32), fee_rate: feeRate, sponsored: false }],
    });
    const { handler } = setup();

    const preview = parse(await handler({ address: ADDRESS, dryRun: true, bumpHead: true }));
    expect(preview.actions).toEqual([expect.objectContaining({ type: "bump_head", status: "skipped", reason: expect.stringMatching(/not a positive integer/) })]);

    const out = parse(await handler({ address: ADDRESS, dryRun: false, bumpHead: true }));
    expect(out.actions).toEqual([expect.objectContaining({ type: "bump_head", status: "failed", error: expect.stringMatching(/not a positive integer/) })]);
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockMake).not.toHaveBeenCalled();
  });

  it("refuses a replacement fee above the absolute ceiling", async () => {
    hiro.getNonceInfo.mockResolvedValue({ last_executed_tx_nonce: 5, detected_missing_nonces: [], detected_mempool_nonces: [6] });
    hiro.getMempoolTransactions.mockResolvedValue({
      results: [{ nonce: 6, tx_id: "0x" + "cd".repeat(32), fee_rate: "400000", sponsored: false }],
    });
    const { handler } = setup();
    const out = parse(await handler({ address: ADDRESS, dryRun: false, bumpHead: true, feeMultiplier: 5 }));

    expect(out.actions[0]).toMatchObject({ type: "bump_head", status: "failed" });
    expect(out.actions[0].error).toMatch(/2000000 uSTX is above the 1000000 uSTX ceiling/);
    expect(mockMake).not.toHaveBeenCalled();
  });

  it("stops at the first spend-limit refusal and reports it", async () => {
    mockReserve.mockRejectedValue(new SpendLimitError("Daily uSTX limit reached.", "ustx", 1001, 0, "day"));
    const { handler } = setup();
    const out = parse(await handler({ address: ADDRESS, dryRun: false, bumpHead: true }));

    expect(mockReserve).toHaveBeenCalledTimes(1);
    expect(hiro.getMempoolTransactions).not.toHaveBeenCalled();
    expect(out.actions).toEqual([expect.objectContaining({ type: "fill_gap", nonce: 5, status: "failed" })]);
    expect(out.spendLimitStop).toBe("Daily uSTX limit reached.");
    expect(out.summary).toMatch(/Stopped at the spend limit/);
  });
});

describe("nonce_fill_gap spend limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMake.mockResolvedValue({ tx: "signed" });
    mockBroadcast.mockResolvedValue({ txid: "ab".repeat(32) });
    mockReserve.mockResolvedValue({ id: "r1" });
  });

  it("books 1 uSTX plus the fee before signing", async () => {
    const out = parse(await fillGapTool()({ nonce: 9 }));

    expect(out.success).toBe(true);
    expect(mockReserve).toHaveBeenCalledWith([{ unit: "ustx", amount: 1001n }], ADDRESS);
    expect(mockReserve.mock.invocationCallOrder[0]).toBeLessThan(mockMake.mock.invocationCallOrder[0]);
  });

  it("does not sign when the limiter refuses", async () => {
    mockReserve.mockRejectedValue(new SpendLimitError("Daily uSTX limit reached.", "ustx", 1001, 0, "day"));
    const res = await fillGapTool()({ nonce: 9 });

    expect(res.content[0].text).toMatch(/Daily uSTX limit reached/);
    expect(mockMake).not.toHaveBeenCalled();
  });

  it("releases the booking on an explicit rejection or a signing error", async () => {
    mockBroadcast.mockResolvedValueOnce({ error: "rejected", reason: "BadNonce" });
    await fillGapTool()({ nonce: 9 });
    mockMake.mockRejectedValueOnce(new Error("bad key"));
    await fillGapTool()({ nonce: 9 });

    expect(mockRelease).toHaveBeenCalledTimes(2);
  });
});
