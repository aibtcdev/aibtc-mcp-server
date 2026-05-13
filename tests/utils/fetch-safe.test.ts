import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSafe, fetchJson } from "../../src/utils/fetch-safe.js";

describe("fetchSafe", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns response on 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const res = await fetchSafe("https://example.com/api");
    expect(res.ok).toBe(true);
  });

  it("throws on non-2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );
    await expect(fetchSafe("https://example.com/api", { retries: 0 })).rejects.toThrow("HTTP 404");
  });

  it("retries on failure then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 2) return Promise.reject(new Error("network error"));
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    const res = await fetchSafe("https://example.com/api", { retries: 2 });
    expect(res.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("throws after all retries exhausted", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    await expect(fetchSafe("https://example.com/api", { retries: 1 })).rejects.toThrow("network error");
  });

  it("throws on response too large", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("data", {
        status: 200,
        headers: { "content-length": "999999999" },
      })
    );
    await expect(fetchSafe("https://example.com/api", { maxBytes: 100, retries: 0 })).rejects.toThrow("too large");
  });
});

describe("fetchJson", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("parses JSON response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const data = await fetchJson<{ value: number }>("https://example.com/api");
    expect(data.value).toBe(42);
  });
});
