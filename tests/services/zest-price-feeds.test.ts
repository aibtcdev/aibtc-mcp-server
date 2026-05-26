import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must exist before vi.mock() factories are evaluated
// ---------------------------------------------------------------------------
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Stub the heavy Stacks SDK and hiro-api dependencies pulled in by defi.service
vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: () => ({}),
}));

vi.mock("../../src/lib/contracts/zest.js", () => ({
  getZestContracts: () => ({}),
  ZEST_ASSETS: {},
}));

// Real feed IDs as defined in defi.service.ts (BTC/USD, STX/USD, USDC/USD)
const REAL_FEED_IDS = [
  "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17",
  "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
] as const;

vi.mock("@stacks/transactions", () => ({
  bufferCV: (buf: Buffer) => ({ type: "buffer", buffer: buf }),
  someCV: (v: unknown) => ({ type: "some", value: v }),
  listCV: (items: unknown[]) => ({ type: "list", list: items }),
  noneCV: () => ({ type: "none" }),
}));

// Replace global fetch with our mock
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Module under test — import AFTER mocks are in place
// ---------------------------------------------------------------------------
import {
  ZestProtocolService,
  ZestPythUnavailableError,
} from "../../src/services/defi.service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeOkResponse(hex: string) {
  return {
    ok: true,
    json: async () => ({ binary: { data: [hex] } }),
  };
}

function makeErrorResponse(status: number) {
  return { ok: false, status };
}

function makeService() {
  // @ts-expect-error — "mainnet" satisfies the Network union at runtime
  return new ZestProtocolService("mainnet");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("ZestProtocolService.fetchZestPriceFeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes 3 separate Hermes fetches (not 1 batched)", async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse("aabb"))
      .mockResolvedValueOnce(makeOkResponse("ccdd"))
      .mockResolvedValueOnce(makeOkResponse("eeff"));

    const svc = makeService();
    // Access via the public borrow path that calls fetchZestPriceFeeds internally,
    // but we test the private method directly via casting to bypass TypeScript.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any).fetchZestPriceFeeds();

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const urls: string[] = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(urls[0]).toContain(REAL_FEED_IDS[0]);
    expect(urls[1]).toContain(REAL_FEED_IDS[1]);
    expect(urls[2]).toContain(REAL_FEED_IDS[2]);
    // Confirm each URL is fetched individually (not a single batch request)
    expect(new Set(urls).size).toBe(3);
  });

  it("returns cached value on second call within TTL (0 extra Hermes fetches)", async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse("aabb"))
      .mockResolvedValueOnce(makeOkResponse("ccdd"))
      .mockResolvedValueOnce(makeOkResponse("eeff"));

    const svc = makeService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetch = (svc as any).fetchZestPriceFeeds.bind(svc);

    const first = await fetch();
    const second = await fetch();

    expect(mockFetch).toHaveBeenCalledTimes(3); // not 6
    expect(second).toBe(first); // exact same object — cache hit
  });

  it("re-fetches after TTL expires", async () => {
    mockFetch
      .mockResolvedValue(makeOkResponse("aabb"));

    const svc = makeService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySvc = svc as any;

    await anySvc.fetchZestPriceFeeds();
    // Backdate the cache so it looks stale
    anySvc.vaaCache.fetchedAt = Date.now() - 120_000;
    await anySvc.fetchZestPriceFeeds();

    expect(mockFetch).toHaveBeenCalledTimes(6); // 3 + 3
  });

  it("throws ZestPythUnavailableError on Hermes 5xx", async () => {
    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(503));

    const svc = makeService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((svc as any).fetchZestPriceFeeds()).rejects.toBeInstanceOf(
      ZestPythUnavailableError
    );
  });

  it("ZestPythUnavailableError carries status and workaround hint", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(502));

    const svc = makeService();
    let err: ZestPythUnavailableError | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc as any).fetchZestPriceFeeds();
    } catch (e) {
      err = e as ZestPythUnavailableError;
    }

    expect(err).toBeInstanceOf(ZestPythUnavailableError);
    expect(err?.status).toBe(502);
    expect(err?.message).toContain("borrow-helper-v2-1-7");
  });

  it("ZestPythUnavailableError thrown when VAA data is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ binary: { data: [] } }), // empty data array
    });

    const svc = makeService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((svc as any).fetchZestPriceFeeds()).rejects.toBeInstanceOf(
      ZestPythUnavailableError
    );
  });

  it("vaaInFlight coalescing: concurrent calls share one in-flight fetch", async () => {
    let resolveFetch!: () => void;
    const slowFetch = new Promise<ReturnType<typeof makeOkResponse>>(
      (resolve) => {
        resolveFetch = () => resolve(makeOkResponse("aabb"));
      }
    );
    mockFetch.mockReturnValue(slowFetch);

    const svc = makeService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetch = (svc as any).fetchZestPriceFeeds.bind(svc);

    // Fire 3 concurrent calls before fetch resolves
    const [p1, p2, p3] = [fetch(), fetch(), fetch()];
    resolveFetch();
    await Promise.all([p1, p2, p3]);

    // Despite 3 callers, Hermes should only have been hit 3 times total (one round)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("clears vaaInFlight after error so next call retries", async () => {
    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(500))
      .mockResolvedValue(makeOkResponse("aabb"));

    const svc = makeService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySvc = svc as any;

    await expect(anySvc.fetchZestPriceFeeds()).rejects.toBeInstanceOf(
      ZestPythUnavailableError
    );
    expect(anySvc.vaaInFlight).toBeNull(); // cleared after failure

    // Second call should succeed
    await expect(anySvc.fetchZestPriceFeeds()).resolves.toBeDefined();
  });
});
