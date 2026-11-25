import { beforeEach, describe, expect, it, vi } from "vitest";
import { uintCV } from "@stacks/transactions";

const getAccount = vi.hoisted(() => vi.fn());
const callContract = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/x402.service.js", () => ({
  getAccount,
  NETWORK: "mainnet",
}));

vi.mock("../../src/transactions/builder.js", () => ({
  callContract,
}));

const { registerJingswapTools } = await import(
  "../../src/tools/jingswap.tools.js"
);

const CALLER = "SP20GPDS5RYB2DV03KG4W08EG6HD11KYPK6FQJE1";

interface RegisteredTool {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

function getJingswapTools() {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerJingswapTools(server as any);
  return tools;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAccount.mockResolvedValue({ address: CALLER, network: "mainnet" });
  callContract.mockResolvedValue({ txid: "0xabc123" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true, data: { phase: 0 } }),
      text: async () => JSON.stringify({ success: true, data: { phase: 0 } }),
    }))
  );
});

describe("jingswap_deposit_stx decimal conversion (#821)", () => {
  it("deposits exact micro-STX for IEEE-754 boundary floats (2.01, 1.005, 10, 0.000001)", async () => {
    const depositStx = getJingswapTools().get("jingswap_deposit_stx")!;
    const cases: Array<[number, bigint]> = [
      [2.01, 2_010_000n],
      [2.03, 2_030_000n],
      [2.05, 2_050_000n],
      [1.005, 1_005_000n],
      [10, 10_000_000n],
      [0.000001, 1n],
    ];

    for (const [amount, expectedMicro] of cases) {
      callContract.mockClear();
      const res = await depositStx.handler({ amount, market: "sbtc-stx" });
      expect(res.isError).toBeUndefined();
      expect(callContract).toHaveBeenCalledTimes(1);
      const callOpts = callContract.mock.calls[0][1];
      expect(callOpts.functionArgs).toEqual([uintCV(expectedMicro)]);
      expect(BigInt(callOpts.postConditions[0].amount)).toBe(expectedMicro);
    }
  });

  it("deposits exact micro-USDCx on sbtc-usdcx market for 2.01 USDCx", async () => {
    const depositStx = getJingswapTools().get("jingswap_deposit_stx")!;
    const res = await depositStx.handler({ amount: 2.01, market: "sbtc-usdcx" });
    expect(res.isError).toBeUndefined();
    expect(callContract).toHaveBeenCalledTimes(1);
    const callOpts = callContract.mock.calls[0][1];
    expect(callOpts.functionArgs).toEqual([uintCV(2_010_000n)]);
    expect(BigInt(callOpts.postConditions[0].amount)).toBe(2_010_000n);
  });
});
