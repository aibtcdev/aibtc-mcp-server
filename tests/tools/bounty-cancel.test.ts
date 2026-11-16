import { describe, expect, it } from "vitest";
import {
  buildBountyCancel,
  bountyCancelInputSchema,
} from "../../src/tools/bounty-scanner.tools.js";

const T = "2026-11-16T10:00:00.000Z";
const URL = "https://gist.github.com/someone/123";

describe("buildBountyCancel", () => {
  it("keeps the 3-field message and body when no reason or ruling link is given", () => {
    expect(buildBountyCancel("B", T)).toEqual({
      message: `AIBTC Bounty Cancel | B | ${T}`,
      body: {},
    });
  });

  it("treats empty strings as omitted", () => {
    expect(buildBountyCancel("B", T, "", "")).toEqual({
      message: `AIBTC Bounty Cancel | B | ${T}`,
      body: {},
    });
  });

  it("appends both fields when both are given", () => {
    expect(buildBountyCancel("B", T, "No passing entries", URL)).toEqual({
      message: `AIBTC Bounty Cancel | B | ${T} | No passing entries | ${URL}`,
      body: { reason: "No passing entries", rulingUrl: URL },
    });
  });

  it("signs an empty string for a missing ruling link", () => {
    expect(buildBountyCancel("B", T, "No passing entries")).toEqual({
      message: `AIBTC Bounty Cancel | B | ${T} | No passing entries | `,
      body: { reason: "No passing entries" },
    });
  });

  it("signs an empty string for a missing reason", () => {
    expect(buildBountyCancel("B", T, undefined, URL)).toEqual({
      message: `AIBTC Bounty Cancel | B | ${T} |  | ${URL}`,
      body: { rulingUrl: URL },
    });
  });
});

describe("bounty_cancel input schema", () => {
  const parse = (input: Record<string, unknown>) =>
    bountyCancelInputSchema.safeParse({ bounty_id: "B", ...input });

  it("accepts a cancel with neither field", () => {
    const r = parse({});
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ bounty_id: "B" });
  });

  it("trims both fields, so the signed value has no surrounding whitespace", () => {
    const r = parse({ reason: "  no entry passed\n", ruling_url: ` ${URL} ` });
    expect(r.success).toBe(true);
    expect(r.data?.reason).toBe("no entry passed");
    expect(r.data?.ruling_url).toBe(URL);
  });

  it("checks the length after trimming", () => {
    expect(parse({ reason: ` ${"a".repeat(500)} ` }).success).toBe(true);
    expect(parse({ reason: "a".repeat(501) }).success).toBe(false);
    expect(parse({ ruling_url: `https://${"a".repeat(493)}` }).success).toBe(false);
  });

  it("rejects | in either field", () => {
    expect(parse({ reason: "a | https://b" }).success).toBe(false);
    expect(parse({ ruling_url: "https://example.com/a|b" }).success).toBe(false);
  });

  it("requires ruling_url to start with https://", () => {
    expect(parse({ ruling_url: "http://example.com/r" }).success).toBe(false);
    expect(parse({ ruling_url: "ftp://example.com/r" }).success).toBe(false);
    expect(parse({ ruling_url: "example.com/r" }).success).toBe(false);
  });

  it("lets whitespace-only values through as empty, which buildBountyCancel omits", () => {
    const r = parse({ reason: "   ", ruling_url: " " });
    expect(r.success).toBe(true);
    expect(buildBountyCancel("B", T, r.data?.reason, r.data?.ruling_url).body).toEqual({});
  });
});
