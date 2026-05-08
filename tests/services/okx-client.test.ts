/**
 * Tests for the OKX REST client.
 *
 * Verifies envelope unwrapping, error code propagation, base URL switching,
 * and that public market endpoints are called without auth headers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_BASE_URL_ENV = process.env.OKX_BASE_URL;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.OKX_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_BASE_URL_ENV === undefined) delete process.env.OKX_BASE_URL;
  else process.env.OKX_BASE_URL = ORIGINAL_BASE_URL_ENV;
});

describe("getOkxBaseUrl", () => {
  it("defaults to https://www.okx.com when env var is unset", async () => {
    const { getOkxBaseUrl } = await import("../../src/services/okx/client.js");
    expect(getOkxBaseUrl()).toBe("https://www.okx.com");
  });

  it("respects OKX_BASE_URL env var (US-restricted users)", async () => {
    process.env.OKX_BASE_URL = "https://us.okx.com";
    const { getOkxBaseUrl } = await import("../../src/services/okx/client.js");
    expect(getOkxBaseUrl()).toBe("https://us.okx.com");
  });

  it("strips a trailing slash from the env var", async () => {
    process.env.OKX_BASE_URL = "https://www.okx.com/";
    const { getOkxBaseUrl } = await import("../../src/services/okx/client.js");
    expect(getOkxBaseUrl()).toBe("https://www.okx.com");
  });
});

describe("okxGet", () => {
  it("unwraps the data array on success", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [{ instId: "BTC-USDT", last: "100" }] }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { okxGet } = await import("../../src/services/okx/client.js");
    const data = await okxGet<{ instId: string; last: string }>(
      "/api/v5/market/ticker",
      { instId: "BTC-USDT" }
    );

    expect(data).toEqual([{ instId: "BTC-USDT", last: "100" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("does not send auth headers for public endpoints", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [] }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { okxGet } = await import("../../src/services/okx/client.js");
    await okxGet("/api/v5/market/tickers", { instType: "SPOT" });

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["OK-ACCESS-KEY"]).toBeUndefined();
    expect(headers["OK-ACCESS-SIGN"]).toBeUndefined();
    expect(headers["OK-ACCESS-PASSPHRASE"]).toBeUndefined();
  });

  it("throws OkxApiError when code is non-zero", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "51001", msg: "Instrument ID does not exist", data: [] })) as unknown as typeof fetch;

    const { okxGet } = await import("../../src/services/okx/client.js");
    await expect(okxGet("/api/v5/market/ticker", { instId: "BAD" })).rejects.toMatchObject({
      name: "OkxApiError",
      code: "51001",
      message: "Instrument ID does not exist",
    });
  });

  it("throws OkxApiError on non-2xx HTTP status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "50103", msg: "OK-ACCESS-KEY can not be empty", data: [] }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    ) as unknown as typeof fetch;

    const { okxGet } = await import("../../src/services/okx/client.js");
    await expect(okxGet("/api/v5/dex/aggregator/quote", { chainId: 1 })).rejects.toMatchObject({
      name: "OkxApiError",
      code: "50103",
      status: 401,
    });
  });

  it("throws OkxApiError when response is not JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("<html>500 error</html>", {
        status: 500,
        headers: { "content-type": "text/html" },
      })
    ) as unknown as typeof fetch;

    const { okxGet } = await import("../../src/services/okx/client.js");
    await expect(okxGet("/api/v5/market/ticker", { instId: "BTC-USDT" })).rejects.toMatchObject({
      name: "OkxApiError",
      status: 500,
    });
  });

  it("omits undefined and empty params from the query string", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [] }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { okxGet } = await import("../../src/services/okx/client.js");
    await okxGet("/api/v5/market/tickers", {
      instType: "SPOT",
      uly: undefined,
      instFamily: "",
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("https://www.okx.com/api/v5/market/tickers?instType=SPOT");
  });

  it("uses the configured base URL", async () => {
    process.env.OKX_BASE_URL = "https://us.okx.com";
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [] }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { okxGet } = await import("../../src/services/okx/client.js");
    await okxGet("/api/v5/market/ticker", { instId: "BTC-USDT" });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url.startsWith("https://us.okx.com/")).toBe(true);
  });
});

describe("market helpers", () => {
  it("getTicker returns the first element from the data array", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [{ instId: "BTC-USDT", last: "100" }] })) as unknown as typeof fetch;

    const { getTicker } = await import("../../src/services/okx/market.js");
    const ticker = await getTicker("BTC-USDT");
    expect(ticker?.instId).toBe("BTC-USDT");
    expect(ticker?.last).toBe("100");
  });

  it("getTicker returns undefined for empty data", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [] })) as unknown as typeof fetch;

    const { getTicker } = await import("../../src/services/okx/market.js");
    expect(await getTicker("UNKNOWN")).toBeUndefined();
  });

  it("getCandles passes the bar parameter to the query string", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [["1700000000000", "100", "110", "90", "105", "1000"]] }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { getCandles } = await import("../../src/services/okx/market.js");
    await getCandles("BTC-USDT", "4H", 50);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("bar=4H");
    expect(url).toContain("limit=50");
    expect(url).toContain("instId=BTC-USDT");
  });
});
