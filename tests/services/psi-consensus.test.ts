import { describe, it, expect } from "vitest";
import {
  computePsiScore,
  getPsiTier,
  getPsiVerdict,
  quickPsiScore,
} from "../../src/services/psi-consensus.js";
import type { PsiDimensions } from "../../src/services/psi-consensus.js";

// Dimension semantics: 1.0 = trustworthy/clean, 0.0 = adversarial/violated
// Ψ score = (1 − product) × 100 → low product (any dim near 0) → high Ψ → adversarial

const ALL_CLEAN: PsiDimensions    = { landauer: 1, nash: 1, cantillon: 1, godel: 1 };   // product=1 → Ψ=0
const ALL_VIOLATED: PsiDimensions = { landauer: 0, nash: 0, cantillon: 0, godel: 0 };   // product=0 → Ψ=100
const ONE_ZERO: PsiDimensions     = { landauer: 1, nash: 1, cantillon: 0, godel: 1 };   // product=0 → Ψ=100

describe("psi-consensus", () => {

  describe("computePsiScore", () => {
    it("all dims=1 (fully trustworthy) → score 0", () => {
      expect(computePsiScore(ALL_CLEAN)).toBe(0);
    });

    it("all dims=0 (fully violated) → score 100", () => {
      expect(computePsiScore(ALL_VIOLATED)).toBe(100);
    });

    it("any single dim=0 → score 100 (multiplicative gate)", () => {
      expect(computePsiScore(ONE_ZERO)).toBe(100);
    });

    it("score is always 0–100 across varied inputs", () => {
      const cases: PsiDimensions[] = [
        ALL_CLEAN, ALL_VIOLATED, ONE_ZERO,
        { landauer: 0.5, nash: 0.5, cantillon: 0.5, godel: 0.5 },
        { landauer: 0.9, nash: 0.9, cantillon: 0.9, godel: 0.9 },
        { landauer: 0.1, nash: 0.1, cantillon: 0.1, godel: 0.1 },
      ];
      cases.forEach(d => {
        const s = computePsiScore(d);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      });
    });

    it("higher all-dim product → lower score", () => {
      const low  = computePsiScore({ landauer: 0.5, nash: 0.5, cantillon: 0.5, godel: 0.5 });
      const high = computePsiScore({ landauer: 0.9, nash: 0.9, cantillon: 0.9, godel: 0.9 });
      expect(high).toBeLessThan(low);
    });
  });

  describe("getPsiTier", () => {
    it("score 0  → genesis",        () => expect(getPsiTier(0)).toBe("genesis"));
    it("score 20 → genesis",        () => expect(getPsiTier(20)).toBe("genesis"));
    it("score 21 → cooperative",    () => expect(getPsiTier(21)).toBe("cooperative"));
    it("score 40 → cooperative",    () => expect(getPsiTier(40)).toBe("cooperative"));
    it("score 41 → neutral",        () => expect(getPsiTier(41)).toBe("neutral"));
    it("score 60 → neutral",        () => expect(getPsiTier(60)).toBe("neutral"));
    it("score 61 → noncooperative", () => expect(getPsiTier(61)).toBe("noncooperative"));
    it("score 80 → noncooperative", () => expect(getPsiTier(80)).toBe("noncooperative"));
    it("score 81 → adversarial",    () => expect(getPsiTier(81)).toBe("adversarial"));
    it("score 100 → adversarial",   () => expect(getPsiTier(100)).toBe("adversarial"));
  });

  describe("getPsiVerdict", () => {
    it("genesis verdict mentions Nash equilibrium", () => {
      expect(getPsiVerdict("genesis", ALL_CLEAN).toLowerCase()).toContain("nash");
    });

    it("cooperative verdict mentions cooperative", () => {
      expect(getPsiVerdict("cooperative", ALL_CLEAN).toLowerCase()).toContain("cooperative");
    });

    it("adversarial verdict mentions access denied or Gödel", () => {
      const text = getPsiVerdict("adversarial", ALL_VIOLATED).toLowerCase();
      expect(text).toMatch(/access denied|gödel|axiom/);
    });

    it("noncooperative verdict shows Nash and Gödel percentages", () => {
      const text = getPsiVerdict("noncooperative", { landauer: 0.8, nash: 0.6, cantillon: 0.7, godel: 0.4 });
      expect(text).toMatch(/Nash.*%|Gödel.*%/);
    });
  });

  describe("quickPsiScore", () => {
    it("owner session → genesis tier (score ≤ 20)", () => {
      const score = quickPsiScore({
        address:       "ST1OWNER",
        isOwner:       true,
        sessionAgeMs:  30000,   // 30s — realistic
        callCount:     5,
        uniqueTools:   4,
      });
      expect(getPsiTier(score)).toBe("genesis");
    });

    it("high-whale session → low score (cooperative or better)", () => {
      const score = quickPsiScore({
        address:       "ST1WHALE",
        whaleBalance:  100_000_000_000n,  // 100k WHALE
        sessionAgeMs:  60000,
        callCount:     10,
        uniqueTools:   8,
      });
      expect(score).toBeLessThan(60);
    });

    it("no-whale session → high score (adversarial)", () => {
      const score = quickPsiScore({ address: "ST1NOWHAL", whaleBalance: 0n });
      expect(getPsiTier(score)).toBe("adversarial");
    });

    it("IPI detected → adversarial regardless of whale", () => {
      const score = quickPsiScore({
        address:      "ST1TEST",
        isOwner:      true,
        ipiDetected:  true,
      });
      expect(getPsiTier(score)).toBe("adversarial");
    });

    it("coordinated attack → adversarial", () => {
      const score = quickPsiScore({
        address:        "ST1ATTACKER",
        coordinatedAtk: true,
        ipiDetected:    true,
        honeypotHit:    true,
      });
      expect(getPsiTier(score)).toBe("adversarial");
    });

    it("honeypot hit → adversarial (Nash defector)", () => {
      const score = quickPsiScore({
        address:     "ST1DEFECTOR",
        honeypotHit: true,
      });
      expect(getPsiTier(score)).toBe("adversarial");
    });

    it("score stays 0–100 under extreme inputs", () => {
      const score = quickPsiScore({
        address:        "ST1X",
        callCount:      10000,
        walletCalls:    1000,
        errorRate:      1,
        velocityScore:  9999,
        ipiDetected:    true,
        coordinatedAtk: true,
        honeypotHit:    true,
        behaviorScore:  100,
        sessionAgeMs:   1,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("owner with perfect behavior → lowest possible score", () => {
      const owner  = quickPsiScore({ address: "ST1OWNER", isOwner: true, sessionAgeMs: 30000, callCount: 3, uniqueTools: 3 });
      const normal = quickPsiScore({ address: "ST1NORM",  isOwner: false, whaleBalance: 0n });
      expect(owner).toBeLessThan(normal);
    });
  });
});
