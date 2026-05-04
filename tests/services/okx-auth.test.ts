/**
 * Tests for OKX HMAC signing, credential loading, and the signed
 * okxAuthGet client path.
 *
 * The HMAC vector is computed with openssl independently:
 *
 *   echo -n "2026-05-02T00:00:00.000ZGET/api/v5/dex/aggregator/quote?chainId=1" \
 *     | openssl dgst -sha256 -hmac "test-secret-abc123" -binary | base64
 *   -> JrrjK509uBLPOfB8BUNcUE0pSF5Y/1GuUKRucQR1HU8=
 *
 * Matching this exactly proves we use the canonical OKX pre-sign
 * format (timestamp + UPPER(method) + requestPath + body) and base64
 * HMAC-SHA256 — not a misordered or wrongly-encoded variant.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

// --- HMAC signing ---------------------------------------------------------

describe("signOkxRequest", () => {
  it("matches an openssl-computed HMAC-SHA256 base64 vector", async () => {
    const { signOkxRequest } = await import("../../src/services/okx/auth.js");
    const sig = signOkxRequest(
      "test-secret-abc123",
      "2026-05-02T00:00:00.000Z",
      "GET",
      "/api/v5/dex/aggregator/quote?chainId=1",
      ""
    );
    expect(sig).toBe("JrrjK509uBLPOfB8BUNcUE0pSF5Y/1GuUKRucQR1HU8=");
  });

  it("uppercases the method when building the pre-sign string", async () => {
    const { signOkxRequest } = await import("../../src/services/okx/auth.js");
    const upper = signOkxRequest("s", "2026-05-02T00:00:00.000Z", "GET", "/p", "");
    const lower = signOkxRequest("s", "2026-05-02T00:00:00.000Z", "get", "/p", "");
    expect(upper).toBe(lower);
  });

  it("includes the body in the pre-sign for POST requests", async () => {
    const { signOkxRequest } = await import("../../src/services/okx/auth.js");
    const empty = signOkxRequest("s", "t", "POST", "/p", "");
    const withBody = signOkxRequest("s", "t", "POST", "/p", "{\"x\":1}");
    expect(empty).not.toBe(withBody);
  });
});

// --- timestamp ------------------------------------------------------------

describe("okxTimestamp", () => {
  it("returns ISO 8601 UTC with millisecond precision", async () => {
    const { okxTimestamp } = await import("../../src/services/okx/auth.js");
    const fixed = new Date("2026-05-02T12:34:56.789Z");
    expect(okxTimestamp(fixed)).toBe("2026-05-02T12:34:56.789Z");
  });
});

// --- buildOkxAuthHeaders --------------------------------------------------

describe("buildOkxAuthHeaders", () => {
  it("returns all five OK-ACCESS-* headers", async () => {
    const { buildOkxAuthHeaders } = await import("../../src/services/okx/auth.js");
    const headers = buildOkxAuthHeaders(
      { apiKey: "k", secret: "s", passphrase: "p", projectId: "proj" },
      "2026-05-02T00:00:00.000Z",
      "GET",
      "/api/v5/dex/aggregator/supported/chain",
      ""
    );
    expect(headers["OK-ACCESS-KEY"]).toBe("k");
    expect(headers["OK-ACCESS-PASSPHRASE"]).toBe("p");
    expect(headers["OK-ACCESS-PROJECT"]).toBe("proj");
    expect(headers["OK-ACCESS-TIMESTAMP"]).toBe("2026-05-02T00:00:00.000Z");
    expect(headers["OK-ACCESS-SIGN"]).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

// --- getOkxCredentials (lazy loader) --------------------------------------

describe("getOkxCredentials", () => {
  it("throws OkxCredentialsMissingError listing every unset key", async () => {
    vi.doMock("../../src/services/credentials.js", () => ({
      default: {
        unlock: vi.fn().mockResolvedValue(undefined),
        isUnlocked: vi.fn().mockReturnValue(true),
        get: vi.fn().mockReturnValue(null),
      },
    }));

    const { getOkxCredentials } = await import("../../src/services/okx/auth.js");
    await expect(getOkxCredentials()).rejects.toMatchObject({
      name: "OkxCredentialsMissingError",
      missing: ["api_key", "secret", "passphrase", "project_id"],
    });
  });

  it("throws listing only the missing keys when some are set", async () => {
    vi.doMock("../../src/services/credentials.js", () => ({
      default: {
        unlock: vi.fn().mockResolvedValue(undefined),
        isUnlocked: vi.fn().mockReturnValue(true),
        get: vi.fn((service: string, key: string) => {
          if (service === "okx" && key === "api_key") return "K";
          if (service === "okx" && key === "secret") return "S";
          return null;
        }),
      },
    }));

    const { getOkxCredentials } = await import("../../src/services/okx/auth.js");
    await expect(getOkxCredentials()).rejects.toMatchObject({
      missing: ["passphrase", "project_id"],
    });
  });

  it("returns all four credentials when every key is set", async () => {
    vi.doMock("../../src/services/credentials.js", () => ({
      default: {
        unlock: vi.fn().mockResolvedValue(undefined),
        isUnlocked: vi.fn().mockReturnValue(true),
        get: vi.fn((_service: string, key: string) => {
          if (key === "api_key") return "K";
          if (key === "secret") return "S";
          if (key === "passphrase") return "P";
          if (key === "project_id") return "PROJ";
          return null;
        }),
      },
    }));

    const { getOkxCredentials } = await import("../../src/services/okx/auth.js");
    const creds = await getOkxCredentials();
    expect(creds).toEqual({
      apiKey: "K",
      secret: "S",
      passphrase: "P",
      projectId: "PROJ",
    });
  });

  it("calls unlock() once when the store starts locked", async () => {
    const unlock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../../src/services/credentials.js", () => ({
      default: {
        unlock,
        isUnlocked: vi.fn().mockReturnValue(false),
        get: vi.fn(() => "x"),
      },
    }));

    const { getOkxCredentials } = await import("../../src/services/okx/auth.js");
    await getOkxCredentials();
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it("does not require project_id when requireProjectId=false", async () => {
    vi.doMock("../../src/services/credentials.js", () => ({
      default: {
        unlock: vi.fn().mockResolvedValue(undefined),
        isUnlocked: vi.fn().mockReturnValue(true),
        get: vi.fn((_service: string, key: string) => {
          if (key === "api_key") return "K";
          if (key === "secret") return "S";
          if (key === "passphrase") return "P";
          return null;
        }),
      },
    }));

    const { getOkxCredentials } = await import("../../src/services/okx/auth.js");
    const creds = await getOkxCredentials(false);
    expect(creds).toEqual({
      apiKey: "K",
      secret: "S",
      passphrase: "P",
      projectId: undefined,
    });
  });

  it("still returns project_id when set, even with requireProjectId=false", async () => {
    vi.doMock("../../src/services/credentials.js", () => ({
      default: {
        unlock: vi.fn().mockResolvedValue(undefined),
        isUnlocked: vi.fn().mockReturnValue(true),
        get: vi.fn((_service: string, key: string) => {
          if (key === "api_key") return "K";
          if (key === "secret") return "S";
          if (key === "passphrase") return "P";
          if (key === "project_id") return "PROJ";
          return null;
        }),
      },
    }));

    const { getOkxCredentials } = await import("../../src/services/okx/auth.js");
    const creds = await getOkxCredentials(false);
    expect(creds.projectId).toBe("PROJ");
  });
});

describe("buildOkxAuthHeaders projectId handling", () => {
  it("includes OK-ACCESS-PROJECT when projectId is set", async () => {
    const { buildOkxAuthHeaders } = await import("../../src/services/okx/auth.js");
    const headers = buildOkxAuthHeaders(
      { apiKey: "k", secret: "s", passphrase: "p", projectId: "proj" },
      "2026-05-02T00:00:00.000Z",
      "GET",
      "/api/v5/dex/aggregator/supported/chain",
      ""
    );
    expect(headers["OK-ACCESS-PROJECT"]).toBe("proj");
  });

  it("omits OK-ACCESS-PROJECT when projectId is undefined", async () => {
    const { buildOkxAuthHeaders } = await import("../../src/services/okx/auth.js");
    const headers = buildOkxAuthHeaders(
      { apiKey: "k", secret: "s", passphrase: "p" },
      "2026-05-02T00:00:00.000Z",
      "GET",
      "/api/v5/account/balance?ccy=BTC",
      ""
    );
    expect("OK-ACCESS-PROJECT" in headers).toBe(false);
    // The other four headers must still be present
    expect(headers["OK-ACCESS-KEY"]).toBe("k");
    expect(headers["OK-ACCESS-SIGN"]).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(headers["OK-ACCESS-PASSPHRASE"]).toBe("p");
    expect(headers["OK-ACCESS-TIMESTAMP"]).toBe("2026-05-02T00:00:00.000Z");
  });
});

// --- okxAuthGet (signed client path) --------------------------------------

describe("okxAuthGet", () => {
  it("attaches all OK-ACCESS-* headers to the request", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "0", msg: "", data: [{ ok: true }] }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { okxAuthGet, getOkxWeb3BaseUrl } = await import(
      "../../src/services/okx/client.js"
    );
    await okxAuthGet(
      "/api/v5/dex/aggregator/supported/chain",
      undefined,
      { apiKey: "K", secret: "S", passphrase: "P", projectId: "PROJ" },
      { baseUrl: getOkxWeb3BaseUrl() }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://web3.okx.com/api/v5/dex/aggregator/supported/chain"
    );
    const headers = opts.headers as Record<string, string>;
    expect(headers["OK-ACCESS-KEY"]).toBe("K");
    expect(headers["OK-ACCESS-PASSPHRASE"]).toBe("P");
    expect(headers["OK-ACCESS-PROJECT"]).toBe("PROJ");
    expect(headers["OK-ACCESS-TIMESTAMP"]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(headers["OK-ACCESS-SIGN"]).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("includes the query string in the signed requestPath", async () => {
    let captured: { sign: string; ts: string; query: string } | null = null;
    const mockFetch = vi.fn(async (url: string, opts: RequestInit) => {
      const headers = opts.headers as Record<string, string>;
      const u = new URL(url);
      captured = { sign: headers["OK-ACCESS-SIGN"], ts: headers["OK-ACCESS-TIMESTAMP"], query: u.search };
      return jsonResponse({ code: "0", msg: "", data: [] });
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { okxAuthGet, getOkxWeb3BaseUrl } = await import(
      "../../src/services/okx/client.js"
    );
    const { signOkxRequest } = await import("../../src/services/okx/auth.js");

    await okxAuthGet(
      "/api/v5/dex/aggregator/quote",
      { chainId: "1", amount: "1000" },
      { apiKey: "K", secret: "S", passphrase: "P", projectId: "PROJ" },
      { baseUrl: getOkxWeb3BaseUrl() }
    );

    expect(captured).not.toBeNull();
    const { sign, ts, query } = captured!;
    const expected = signOkxRequest(
      "S",
      ts,
      "GET",
      `/api/v5/dex/aggregator/quote${query}`,
      ""
    );
    expect(sign).toBe(expected);
    expect(query).toContain("chainId=1");
    expect(query).toContain("amount=1000");
  });

  it("propagates OKX error codes from signed responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        { code: "50111", msg: "Invalid OK-ACCESS-KEY", data: [] },
        401
      )
    ) as unknown as typeof fetch;

    const { okxAuthGet, getOkxWeb3BaseUrl } = await import(
      "../../src/services/okx/client.js"
    );
    await expect(
      okxAuthGet(
        "/api/v5/dex/aggregator/supported/chain",
        undefined,
        { apiKey: "x", secret: "x", passphrase: "x", projectId: "x" },
        { baseUrl: getOkxWeb3BaseUrl() }
      )
    ).rejects.toMatchObject({
      name: "OkxApiError",
      code: "50111",
      status: 401,
    });
  });
});
