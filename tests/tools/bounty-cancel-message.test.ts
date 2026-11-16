import { describe, expect, it } from "vitest";
import { buildCancelMessage } from "../../src/tools/bounty-scanner.tools.js";

/**
 * Must match landing-page `lib/bounty/signatures.ts` buildCancelMessage
 * (landing-page#1133): the server rebuilds this string to verify the signature,
 * so any drift is a 403 on every cancel that carries a reason.
 */
describe("buildCancelMessage", () => {
  const base = { bountyId: "mw6jfizn116185057bcf", signedAt: "2026-11-16T10:00:00.000Z" };

  it("keeps the original three-field message when neither optional field is sent", () => {
    expect(buildCancelMessage(base)).toBe(
      "AIBTC Bounty Cancel | mw6jfizn116185057bcf | 2026-11-16T10:00:00.000Z"
    );
  });

  it("appends reason and rulingUrl when both are sent", () => {
    expect(
      buildCancelMessage({ ...base, reason: "no entry passed", rulingUrl: "https://gist.github.com/a/b" })
    ).toBe(
      "AIBTC Bounty Cancel | mw6jfizn116185057bcf | 2026-11-16T10:00:00.000Z | no entry passed | https://gist.github.com/a/b"
    );
  });

  it("uses an empty string for a missing rulingUrl", () => {
    expect(buildCancelMessage({ ...base, reason: "no entry passed" })).toBe(
      "AIBTC Bounty Cancel | mw6jfizn116185057bcf | 2026-11-16T10:00:00.000Z | no entry passed | "
    );
  });

  it("uses an empty string for a missing reason", () => {
    expect(buildCancelMessage({ ...base, rulingUrl: "https://gist.github.com/a/b" })).toBe(
      "AIBTC Bounty Cancel | mw6jfizn116185057bcf | 2026-11-16T10:00:00.000Z |  | https://gist.github.com/a/b"
    );
  });
});
