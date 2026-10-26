import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostConditionMode, cvToValue } from "@stacks/transactions";
import { planContractCallSpends } from "../../src/services/spend-limiter.js";

const callContract = vi.hoisted(() => vi.fn());
const ME = "SP20GPDS5RYB2DV03KG4W08EG6HD11KYPK6FQJE1";

vi.mock("../../src/transactions/builder.js", () => ({ callContract }));
vi.mock("../../src/services/x402.service.js", () => ({
  NETWORK: "mainnet",
  getAccount: vi.fn(async () => ({ address: ME, network: "mainnet" })),
}));

const { registerJingswapV2Tools, satsPerStxToRaw, rawToSatsPerStx } = await import(
  "../../src/tools/jingswap-v2.tools.js"
);

const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const V2 = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.sbtc-stx-0-jing-v2";

type Handler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function tools(): Map<string, Handler> {
  const map = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => map.set(name, handler),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerJingswapV2Tools(server as any);
  return map;
}

function body(result: { content: Array<{ text: string }> }): any {
  return JSON.parse(result.content[0].text);
}

let cycleState: Record<string, unknown>;
const requested: string[] = [];

function mockApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      const path = new URL(url).pathname;
      let data: unknown;
      if (path.endsWith("/cycle-state")) data = cycleState;
      else if (path.endsWith("/pyth-prices"))
        data = { btcUsd: { price: 80_000 }, stxUsd: { price: 0.32 } }; // 250000 STX/BTC = 400 sats/STX
      else if (path.endsWith("/pyth-vaas")) data = { btcVaaHex: "aa", stxVaaHex: "bb" };
      else throw new Error(`unexpected ${url}`);
      return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    })
  );
}

function lastCall() {
  expect(callContract).toHaveBeenCalledTimes(1);
  return callContract.mock.calls[0][1];
}

// cvToValue returns large uints as strings; normalise to bigint.
const uints = (args: any[]) => args.map((a) => BigInt(cvToValue(a)));

function plan(options: any) {
  return planContractCallSpends({ ...options, sbtcContract: SBTC }, ME);
}

beforeEach(() => {
  callContract.mockReset();
  callContract.mockResolvedValue({ txid: "0xabc" });
  requested.length = 0;
  cycleState = {
    currentCycle: 15,
    phase: 0,
    blocksElapsed: 20,
    minDeposits: { minStx: 1_000_000, minSbtc: 1_000 },
    cycleTotals: { totalStx: 5_000_000, totalSbtc: 5_000 },
  };
  mockApi();
});

describe("price conversion", () => {
  it("round-trips sats/STX and raw STX-per-BTC * 1e8", () => {
    expect(satsPerStxToRaw(400)).toBe(25_000_000_000_000n); // 250000 STX/BTC * 1e8
    expect(rawToSatsPerStx(25_000_000_000_000)).toBe(400);
    expect(() => satsPerStxToRaw(0)).toThrow();
  });
});

describe("jingswap_v2 write tools build the right calls", () => {
  it("deposit_stx: deposit-stx(amount, limit) with an exact caller STX post condition", async () => {
    const r = await tools().get("jingswap_v2_deposit_stx")!({ amount: 4.35, limitSatsPerStx: 400 });
    expect(r.isError).toBeFalsy();
    const opts = lastCall();
    expect(opts.contractName).toBe("sbtc-stx-0-jing-v2");
    expect(opts.functionName).toBe("deposit-stx");
    expect(uints(opts.functionArgs)).toEqual([4_350_000n, 25_000_000_000_000n]);
    expect(opts.postConditionMode).toBe(PostConditionMode.Deny);
    expect(plan(opts).spends).toEqual([{ unit: "ustx", amount: 4_350_000n }]);
    expect(opts.postConditions[1]).toMatchObject({ address: V2, condition: "lte", amount: "4350000" });
  });

  it("deposit_stx without a limit sets it 20% below the oracle", async () => {
    const r = await tools().get("jingswap_v2_deposit_stx")!({ amount: 10 });
    expect(body(r).limitDefaulted).toBe(true);
    const [, limit] = uints(lastCall().functionArgs);
    expect(limit).toBe(satsPerStxToRaw(320)); // 400 * 0.8
  });

  it("deposit_sbtc: exact caller sBTC post condition, 20% above oracle by default", async () => {
    await tools().get("jingswap_v2_deposit_sbtc")!({ amount: 2_000, market: "sbtc-stx-20bp-stx-premium" });
    const opts = lastCall();
    expect(opts.contractName).toBe("sbtc-stx-20-jing-v2");
    expect(uints(opts.functionArgs)).toEqual([2_000n, satsPerStxToRaw(480)]);
    expect(plan(opts).spends).toEqual([{ unit: "sats", amount: 2_000n }]);
  });

  it("deposits refuse outside the deposit phase", async () => {
    cycleState.phase = 2;
    const r = await tools().get("jingswap_v2_deposit_stx")!({ amount: 1, limitSatsPerStx: 400 });
    expect(r.isError).toBe(true);
    expect(callContract).not.toHaveBeenCalled();
  });

  it("set limits: Deny mode, no transfers", async () => {
    await tools().get("jingswap_v2_set_sbtc_limit")!({ limitSatsPerStx: 500 });
    const opts = lastCall();
    expect(opts.functionName).toBe("set-sbtc-limit");
    expect(uints(opts.functionArgs)).toEqual([satsPerStxToRaw(500)]);
    expect(opts.postConditionMode).toBe(PostConditionMode.Deny);
    expect(plan(opts).spends).toEqual([]);
  });

  it("cancels: Allow mode capped at zero caller spend", async () => {
    for (const [tool, fn] of [
      ["jingswap_v2_cancel_stx", "cancel-stx-deposit"],
      ["jingswap_v2_cancel_sbtc", "cancel-sbtc-deposit"],
    ]) {
      callContract.mockClear();
      await tools().get(tool)!({});
      const opts = lastCall();
      expect(opts.functionName).toBe(fn);
      expect(opts.callerSpendCaps).toEqual({ ustx: 0n, sats: 0n });
      expect(() => plan(opts)).not.toThrow();
    }
  });

  it("settle in deposit phase calls close-and-settle-with-refresh with the VAAs and Pyth traits", async () => {
    const r = await tools().get("jingswap_v2_close_and_settle_with_refresh")!({});
    expect(r.isError).toBeFalsy();
    const opts = lastCall();
    expect(opts.functionName).toBe("close-and-settle-with-refresh");
    const args = opts.functionArgs.map(cvToValue);
    expect(args.slice(0, 2)).toEqual(["0xaa", "0xbb"]);
    expect(args.slice(2)).toEqual([
      "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y.pyth-storage-v4",
      "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y.pyth-pnau-decoder-v3",
      "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y.wormhole-core-v4",
    ]);
    expect(plan(opts).spends).toEqual([
      { unit: "ustx", amount: 1_000n },
      { unit: "sats", amount: 0n },
    ]);
    expect(requested.some((u) => u.includes("pyth-vaas?contract=sbtc-stx-0-jing-v2"))).toBe(true);
  });

  it("settle after deposits closed calls settle-with-refresh", async () => {
    cycleState.phase = 2;
    await tools().get("jingswap_v2_close_and_settle_with_refresh")!({});
    expect(lastCall().functionName).toBe("settle-with-refresh");
  });

  it("settle refuses before 10 blocks or below minimums", async () => {
    cycleState.blocksElapsed = 5;
    expect((await tools().get("jingswap_v2_close_and_settle_with_refresh")!({})).isError).toBe(true);
    cycleState.blocksElapsed = 20;
    cycleState.cycleTotals = { totalStx: 5_000_000, totalSbtc: 0 };
    expect((await tools().get("jingswap_v2_close_and_settle_with_refresh")!({})).isError).toBe(true);
    expect(callContract).not.toHaveBeenCalled();
  });

  it("cancel_cycle: Deny mode, refuses in deposit phase", async () => {
    expect((await tools().get("jingswap_v2_cancel_cycle")!({})).isError).toBe(true);
    cycleState.phase = 2;
    await tools().get("jingswap_v2_cancel_cycle")!({});
    const opts = lastCall();
    expect(opts.functionName).toBe("cancel-cycle");
    expect(opts.postConditionMode).toBe(PostConditionMode.Deny);
  });

  it("unknown market is an error", async () => {
    const r = await tools().get("jingswap_v2_get_prices")!({ market: "nope" });
    expect(r.isError).toBe(true);
  });
});
