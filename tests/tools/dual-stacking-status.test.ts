import { beforeEach, describe, expect, it, vi } from "vitest";

// dual_stacking_status fans out 5 read-only calls. On mainnet the principal-keyed
// `is-enrolled-this-cycle` fails contract-side with RuntimeCheck(AtBlockUnavailable)
// while the other 4 succeed (#554). This test asserts the wrapper recovers per-call
// (Promise.allSettled) instead of sinking the whole response (Promise.all).

const ADDR = "SP20GPDS5RYB2DV03KG4W08EG6HD11KYPK6FQJE1";

// Clarity hex fixtures (serialized ClarityValues).
const CV_BOOL_FALSE = "04";
const CV_UINT_10000 = "0100000000000000000000000000002710"; // u10000

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
            return { okay: true, result: `0x${CV_UINT_10000}` };
          case "current-overview-data":
            return { okay: true, result: `0x${CV_UINT_10000}` };
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
      return { okay: true, result: `0x${CV_UINT_10000}` };
    });

    const res = await statusTool.handler({});
    const body = JSON.parse(res.content[0].text);
    expect(body.enrolledThisCycle).toBe(false);
    expect(body.warnings).toBeUndefined();
  });
});
