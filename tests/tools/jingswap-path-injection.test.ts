import { describe, it, expect } from "vitest";

/**
 * Regression test for #807: unvalidated `address` reached the Jingswap request
 * path.
 *
 * `jingswapGet` builds `new URL(`${JINGSWAP_API}${path}`)`, so `..` and `?`
 * inside `address` were interpreted as path/query syntax. Because the result
 * stayed on the API origin, the request still carried `x-api-key`, letting a
 * caller reach any GET route on the Jingswap backend with the key attached.
 *
 * Covered here:
 *   1. the address schema rejects traversal / query payloads
 *   2. the request builder refuses a path that escapes the API prefix
 */

// Mirror of the schema the tools now use.
const STACKS_ADDRESS = /^S[PT][0-9A-Z]{38,39}$/;

// Mirror of the guard inside jingswapFetch.
const JINGSWAP_API = "https://faktory-dao-backend.vercel.app";
function escapesApiPrefix(path: string): boolean {
  const apiOrigin = new URL(JINGSWAP_API).origin;
  const apiBasePath = new URL(JINGSWAP_API).pathname.replace(/\/$/, "");
  const url = new URL(`${JINGSWAP_API}${path}`);
  return (
    url.origin !== apiOrigin ||
    !url.pathname.startsWith(apiBasePath + "/api/")
  );
}

const VALID = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

describe("jingswap address validation (#807)", () => {
  it("accepts a real Stacks principal", () => {
    expect(STACKS_ADDRESS.test(VALID)).toBe(true);
    expect(STACKS_ADDRESS.test("ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(STACKS_ADDRESS.test("x/../../../../some/route?")).toBe(false);
    expect(STACKS_ADDRESS.test("../../admin")).toBe(false);
  });

  it("rejects query and fragment payloads", () => {
    expect(STACKS_ADDRESS.test("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7?key=leak")).toBe(false);
    expect(STACKS_ADDRESS.test("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7#x")).toBe(false);
  });

  it("rejects encoded and whitespace tricks", () => {
    expect(STACKS_ADDRESS.test("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7%2f..")).toBe(false);
    expect(STACKS_ADDRESS.test("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7 ")).toBe(false);
  });

  it("demonstrates the escape the old code allowed", () => {
    // This is what the pre-fix interpolation produced for
    // address = "x/../../../../some/route?".
    const malicious = `/api/auction/activity/x/../../../../some/route?`;
    expect(escapesApiPrefix(malicious)).toBe(true);
  });

  it("allows a normal API path", () => {
    expect(escapesApiPrefix(`/api/auction/activity/${VALID}`)).toBe(false);
    expect(escapesApiPrefix(`/api/auction/deposit/12/${VALID}`)).toBe(false);
  });
});
