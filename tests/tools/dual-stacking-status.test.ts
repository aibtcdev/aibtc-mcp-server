import { beforeEach, describe, expect, it, vi } from "vitest";

// dual_stacking_status fans out 5 read-only calls. On mainnet the principal-keyed
// `is-enrolled-this-cycle` fails contract-side with RuntimeCheck(AtBlockUnavailable)
// while the other 4 succeed (#554). This test asserts the wrapper recovers per-call
// (Promise.allSettled) instead of sinking the whole response (Promise.all).

const ADDR = "SP20GPDS5RYB2DV03KG4W08EG6HD11KYPK6FQJE1";

// Clarity hex fixtures (serialized ClarityValues), captured from mainnet
// `/v2/contracts/call-read` responses.
const CV_BOOL_FALSE = "04";
const CV_UINT_10000 = "0100000000000000000000000000002710"; // u10000

// (tuple (MAX_APR u5000000) (MIN_APR u500000) (MULTIPLIER u10))
const CV_APR_TUPLE =
  "0c00000003074d41585f41505201000000000000000000000000004c4b40074d494e5f415052010000000000000000000000000007a1200a4d554c5449504c494552010000000000000000000000000000000a";
// (tuple (cycle-id u7) (snapshot-index u13) (snapshots-per-cycle u14))
const CV_OVERVIEW_TUPLE =
  "0c00000003086379636c652d696401000000000000000000000000000000070e736e617073686f742d696e646578010000000000000000000000000000000d13736e617073686f74732d7065722d6379636c65010000000000000000000000000000000e";

const mockCallReadOnly = vi.fn();
vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({ callReadOnlyFunction: mockCallReadOnly }),
}));

vi.mock("../../src/services/x402.service.js", () => ({
  getWalletAddress: async () => ADDR,
  getAccount: () => ({ address: ADDR }),
  NETWORK: "mainnet",
}));

const { registerDualStackingTools } = await import(
  "../../src/tools/dual-stacking.tools.js"
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
      (name: string, _c: unknown, handler: RegisteredTool["handler"]) => {
        tools.set(name, { handler });
      }
    ),
  };
  return { server, tools };
}

describe("dual_stacking_status resilience (#554)", () => {
  let statusTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();
    // Fail only is-enrolled-this-cycle (okay:false → wrapper throws), succeed rest.
    mockCallReadOnly.mockImplementation(
      async (_contractId: string, fn: string) => {
        switch (fn) {
          case "is-enrolled-this-cycle":
            return { okay: false, cause: "RuntimeCheck(AtBlockUnavailable)" };
          case "is-enrolled-in-next-cycle":
            return { okay: true, result: `0x${CV_BOOL_FALSE}` };
          case "get-minimum-enrollment-amount":
            return { okay: true, result: `0x${CV_UINT_10000}` };
          case "get-apr-data":
            return { okay: true, result: `0x${CV_APR_TUPLE}` };
          case "current-overview-data":
            return { okay: true, result: `0x${CV_OVERVIEW_TUPLE}` };
          default:
            throw new Error(`unexpected fn ${fn}`);
        }
      }
    );
    const { server, tools } = createTrackingServer();
    registerDualStackingTools(server as never);
    statusTool = tools.get("dual_stacking_status")!;
  });

  it("returns the 4 working reads plus a warning when is-enrolled-this-cycle fails", async () => {
    const res = await statusTool.handler({});
    expect(res.isError).toBeFalsy();
    const body = JSON.parse(res.content[0].text);

    // The failing principal-keyed read is null (unknown), not a misleading false.
    expect(body.enrolledThisCycle).toBeNull();
    // The other reads still populate.
    expect(body.enrolledNextCycle).toBe(false);
    expect(body.minimumEnrollmentSats).toBe(10000);
    // A warning cites the specific failing function.
    expect(Array.isArray(body.warnings)).toBe(true);
    expect(body.warnings.join(" ")).toMatch(/is-enrolled-this-cycle/);
    expect(body.warnings.join(" ")).toMatch(/AtBlockUnavailable/);
  });

  it("omits the warnings array entirely when all reads succeed", async () => {
    mockCallReadOnly.mockImplementation(async (_c: string, fn: string) => {
      if (fn === "is-enrolled-this-cycle" || fn === "is-enrolled-in-next-cycle")
        return { okay: true, result: `0x${CV_BOOL_FALSE}` };
      if (fn === "get-apr-data")
        return { okay: true, result: `0x${CV_APR_TUPLE}` };
      if (fn === "current-overview-data")
        return { okay: true, result: `0x${CV_OVERVIEW_TUPLE}` };
      return { okay: true, result: `0x${CV_UINT_10000}` };
    });

    const res = await statusTool.handler({});
    const body = JSON.parse(res.content[0].text);
    expect(body.enrolledThisCycle).toBe(false);
    expect(body.warnings).toBeUndefined();
  });
});

// cvToJSON nests tuple fields under `.value`, keyed by the on-wire Clarity name.
// Reading them off the top-level object returned `undefined` for every field,
// which the old `?? 0` fallbacks turned into a confident-looking 0% APR (#611).
describe("dual_stacking_status tuple decoding (#611)", () => {
  let statusTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallReadOnly.mockImplementation(async (_c: string, fn: string) => {
      switch (fn) {
        case "is-enrolled-this-cycle":
        case "is-enrolled-in-next-cycle":
          return { okay: true, result: `0x${CV_BOOL_FALSE}` };
        case "get-minimum-enrollment-amount":
          return { okay: true, result: `0x${CV_UINT_10000}` };
        case "get-apr-data":
          return { okay: true, result: `0x${CV_APR_TUPLE}` };
        case "current-overview-data":
          return { okay: true, result: `0x${CV_OVERVIEW_TUPLE}` };
        default:
          throw new Error(`unexpected fn ${fn}`);
      }
    });
    const { server, tools } = createTrackingServer();
    registerDualStackingTools(server as never);
    statusTool = tools.get("dual_stacking_status")!;
  });

  it("decodes the APR tuple from its uppercase on-wire keys", async () => {
    const body = JSON.parse((await statusTool.handler({})).content[0].text);
    // Raw u500000 / u5000000 scaled down by the 1e6 APR divisor.
    expect(body.apr.minApr).toBe(0.5);
    expect(body.apr.maxApr).toBe(5);
    expect(body.apr.multiplier).toBe(10);
    expect(body.warnings).toBeUndefined();
  });

  it("decodes the cycle overview tuple", async () => {
    const body = JSON.parse((await statusTool.handler({})).content[0].text);
    expect(body.cycleOverview).toEqual({
      currentCycleId: 7,
      snapshotIndex: 13,
      snapshotsPerCycle: 14,
    });
  });

  it("reports undecodable tuple fields as null plus a warning, never as 0", async () => {
    // A tuple whose keys don't match what the wrapper expects — the exact shape
    // that previously produced a silent, authoritative-looking 0.
    // (tuple (WRONG_KEY u1))
    const CV_WRONG_TUPLE =
      "0c0000000109" + "57524f4e475f4b45590100000000000000000000000000000001";
    mockCallReadOnly.mockImplementation(async (_c: string, fn: string) => {
      if (fn === "get-apr-data")
        return { okay: true, result: `0x${CV_WRONG_TUPLE}` };
      if (fn === "current-overview-data")
        return { okay: true, result: `0x${CV_OVERVIEW_TUPLE}` };
      if (fn === "get-minimum-enrollment-amount")
        return { okay: true, result: `0x${CV_UINT_10000}` };
      return { okay: true, result: `0x${CV_BOOL_FALSE}` };
    });

    const body = JSON.parse((await statusTool.handler({})).content[0].text);
    expect(body.apr.minApr).toBeNull();
    expect(body.apr.maxApr).toBeNull();
    expect(body.warnings.join(" ")).toMatch(/get-apr-data/);
    expect(body.warnings.join(" ")).toMatch(/MIN_APR/);
  });
});

describe("dual_stacking_get_rewards optional decoding (#611)", () => {
  let rewardsTool: RegisteredTool;

  // (some u45385) — the contract returns `(optional uint)`, so the payload sits
  // one envelope deeper than a bare uint.
  const CV_SOME_45385 = "0a010000000000000000000000000000b149";
  const CV_NONE = "09";

  function mount() {
    const { server, tools } = createTrackingServer();
    registerDualStackingTools(server as never);
    rewardsTool = tools.get("dual_stacking_get_rewards")!;
  }

  beforeEach(() => vi.clearAllMocks());

  it("unwraps (some uint) instead of yielding NaN", async () => {
    mockCallReadOnly.mockResolvedValue({ okay: true, result: `0x${CV_SOME_45385}` });
    mount();
    const body = JSON.parse((await rewardsTool.handler({ cycle: 7 })).content[0].text);
    expect(body.rewardSats).toBe(45385);
    expect(body.rewardBtc).toBeCloseTo(0.00045385, 10);
  });

  it("reports none as null rather than a zero reward", async () => {
    mockCallReadOnly.mockResolvedValue({ okay: true, result: `0x${CV_NONE}` });
    mount();
    const body = JSON.parse((await rewardsTool.handler({ cycle: 7 })).content[0].text);
    expect(body.rewardSats).toBeNull();
    expect(body.rewardBtc).toBeNull();
  });
});
