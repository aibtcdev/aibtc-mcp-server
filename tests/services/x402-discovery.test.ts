import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseSummary,
  endpointsFromOpenApi,
  fetchOpenApiEndpoints,
  fetchDirectoryEntries,
  discoverOpenApiEndpoints,
  clearDiscoveryCache,
  DISCOVERY_CACHE_TTL_MS,
} from "../../src/services/x402-discovery.service.js";

const spec = {
  paths: {
    "/hashing/sha256": {
      post: {
        tags: ["Hashing"],
        summary: "(paid, standard) Compute SHA-256 hash",
        parameters: [{ name: "tokenType", in: "query", description: "Payment token type" }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: { data: { description: "Data to hash" }, encoding: {} },
                required: ["data"],
              },
            },
          },
        },
      },
    },
    "/stacks/address/{address}": {
      get: {
        tags: ["Stacks"],
        summary: "(paid, simple) Convert Stacks address",
        parameters: [
          { name: "address", in: "path", description: "Stacks address" },
          { name: "tokenType", in: "query" },
        ],
      },
    },
    "/inference/openrouter/models": {
      get: { tags: ["Inference"], summary: "(free) List available OpenRouter models" },
    },
    "/admin/registry/verify": {
      post: { tags: ["Registry Admin"], summary: "Verify an entry" },
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("parseSummary", () => {
  it("splits the pricing tier from the description", () => {
    expect(parseSummary("(paid, dynamic) Chat completion")).toEqual({
      cost: "paid (dynamic)",
      description: "Chat completion",
    });
    expect(parseSummary("(free) List models")).toEqual({ cost: "FREE", description: "List models" });
    expect(parseSummary("View API metrics dashboard (free)")).toEqual({
      cost: "FREE",
      description: "View API metrics dashboard",
    });
  });

  it("does not guess a price it cannot read", () => {
    expect(parseSummary("Check the service health").cost).toBe("see probe_x402_endpoint");
  });
});

describe("endpointsFromOpenApi", () => {
  it("maps operations, drops tokenType and admin routes, marks optional body fields", () => {
    const endpoints = endpointsFromOpenApi(spec, "x402.aibtc.com");

    expect(endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      "POST /hashing/sha256",
      "GET /stacks/address/{address}",
      "GET /inference/openrouter/models",
    ]);
    const sha = endpoints[0];
    expect(sha).toMatchObject({
      cost: "paid (standard)",
      category: "Hashing",
      source: "x402.aibtc.com",
      body: { data: "Data to hash", encoding: "encoding (optional)" },
    });
    expect(sha.params).toBeUndefined();
    expect(endpoints[1].params).toEqual({ address: "Stacks address" });
    expect(endpoints[2].cost).toBe("FREE");
  });
});

describe("live fetches", () => {
  const source = {
    source: "x402.aibtc.com",
    baseUrl: { mainnet: "https://x402.aibtc.com", testnet: "https://x402.aibtc.dev" },
  };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearDiscoveryCache();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads the spec for the configured network and caches it", async () => {
    fetchMock.mockResolvedValue(jsonResponse(spec));

    await fetchOpenApiEndpoints(source, "testnet");
    await fetchOpenApiEndpoints(source, "testnet");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://x402.aibtc.dev/openapi.json");
  });

  it("refetches once the cache expires", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => jsonResponse(spec));

    await fetchOpenApiEndpoints(source, "mainnet");
    vi.advanceTimersByTime(DISCOVERY_CACHE_TTL_MS + 1);
    await fetchOpenApiEndpoints(source, "mainnet");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(spec));

    await expect(fetchOpenApiEndpoints(source, "mainnet")).rejects.toThrow("HTTP 503");
    await expect(fetchOpenApiEndpoints(source, "mainnet")).resolves.toHaveLength(3);
  });

  it("reports a failing source as unavailable and keeps the others", async () => {
    const other = { source: "stx402.com", baseUrl: { mainnet: "https://stx402.com" } };
    fetchMock.mockImplementation(async (url: string) =>
      new URL(url).hostname === "stx402.com"
        ? new Response("down", { status: 500 })
        : jsonResponse(spec)
    );

    const result = await discoverOpenApiEndpoints([source, other], "mainnet");

    expect(result.endpoints).toHaveLength(3);
    expect(result.unavailable).toEqual([
      { source: "stx402.com", error: "GET https://stx402.com/openapi.json returned HTTP 500" },
    ]);
  });

  it("reports a host with no deployment on the network", async () => {
    const mainnetOnly = { source: "stx402.com", baseUrl: { mainnet: "https://stx402.com" } };
    const result = await discoverOpenApiEndpoints([mainnetOnly], "testnet");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.unavailable[0].error).toBe("stx402.com has no testnet deployment");
  });

  it("pages through the directory until total is reached", async () => {
    const entry = (i: number) => ({
      name: `E${i}`,
      url: `https://example.com/${i}`,
      category: "defi",
      status: i % 2 ? "verified" : "unverified",
      owner: "SP1",
    });
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      const count = offset === 0 ? 50 : 10;
      return jsonResponse({
        entries: Array.from({ length: count }, (_, i) => entry(offset + i)),
        total: 60,
      });
    });

    const entries = await fetchDirectoryEntries();

    expect(entries).toHaveLength(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://stx402.com/registry/list?limit=50&offset=50");
  });
});
