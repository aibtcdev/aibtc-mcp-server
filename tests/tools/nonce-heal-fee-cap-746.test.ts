/**
 * #746 — nonce_heal's RBF bump is an STX outflow the spend limiter never saw.
 *
 * Two independent defects, tested separately because either one alone is enough
 * to drain a wallet into fees:
 *
 *   1. `feeMultiplier` had `.min(1.1)` and no `.max()`, so a model could ask
 *      for 100000 and sign a fee 100000x the original.
 *   2. The RBF path called `makeSTXTokenTransfer` + `broadcastTransaction`
 *      directly. `src/transactions/builder.ts` books amount + fee against the
 *      wallet-wide limiter on every builder path; this tool bypassed it, so a
 *      six-figure fee would never appear on the daily ledger.
 *
 * The schema test reads the registered tool input, so it fails on the parent
 * commit for the reason the issue gives. The source test pins that the limiter
 * is consulted on the RBF path.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "../../src/tools/index.js";

const SRC = readFileSync(resolve("src/tools/nonce.tools.ts"), "utf8");

/** Pull the zod schema for one tool input property out of the source. */
function inputSchema(property: string): string {
  // The property block runs from its name to the next sibling property.
  const start = SRC.indexOf(`${property}: z`);
  expect(start, `${property} must be a declared input`).toBeGreaterThan(-1);
  const rest = SRC.slice(start);
  const next = rest.slice(1).search(/\n\s{8}[a-zA-Z]+: z\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe("nonce_heal.feeMultiplier is bounded (#746)", () => {
  it("declares an upper bound", () => {
    const block = inputSchema("feeMultiplier");
    expect(block).toMatch(/\.min\(/);
    // Without a max, `feeMultiplier: 100000` on a 3000 uSTX transfer signs a
    // 300 STX fee — 6x the default daily cap, and unbooked.
    expect(block, "feeMultiplier has no .max()").toMatch(/\.max\(/);
  });

  it("the bound is small enough to stay under the default daily cap", () => {
    const block = inputSchema("feeMultiplier");
    const m = block.match(/\.max\((\d+(?:\.\d+)?)\)/);
    expect(m, "expected a literal .max(N)").not.toBeNull();
    const cap = Number(m![1]);
    // A typical token-transfer fee is a few hundred uSTX; a 10x ceiling keeps
    // even a 3000 uSTX base fee inside the 50 STX default daily cap.
    expect(cap).toBeLessThanOrEqual(10);
  });
});

describe("the RBF bump is booked against the spend limiter (#746)", () => {
  it("imports getSpendLimiter", () => {
    expect(SRC).toMatch(/import \{ getSpendLimiter \} from "\.\.\/services\/spend-limiter\.js"/);
  });

  it("reserves the new fee before signing the replacement", () => {
    const reserveAt = SRC.indexOf("limiter.reserve(");
    expect(reserveAt, "no limiter.reserve on the RBF path").toBeGreaterThan(-1);
    // The reservation must precede the signature, or a refused fee has already
    // been signed.
    const signAt = SRC.indexOf("fee: BigInt(newFee)");
    expect(signAt).toBeGreaterThan(-1);
    expect(reserveAt).toBeLessThan(signAt);
  });

  it("releases the reservation when the broadcast fails", () => {
    // Otherwise a failed bump charges the day for a fee that was never paid.
    expect(SRC).toMatch(/limiter\.release\(reservation\)/);
  });

  it("books the whole outflow: fee plus the 1 uSTX carried amount", () => {
    expect(SRC).toMatch(/BigInt\(newFee\) \+ 1n/);
  });
});
