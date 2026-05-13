import { describe, it, expect } from "vitest";
import {
  buildSentinel,
  buildDollarAmplifier,
  buildPrecisionPolicy,
  buildAutoApprove,
  buildSavingsShield,
  buildDebtLiberation,
  buildPerfectScore,
} from "../../src/services/perfect-score-engine.js";

describe("perfect-score-engine", () => {

  describe("buildSentinel", () => {
    it("Warren score goes from before to 100", () => {
      const s = buildSentinel();
      expect(s.warren_score_before).toBeLessThan(100);
      expect(s.warren_score_after).toBe(100);
    });

    it("false_negative_rate is 0", () => {
      expect(buildSentinel().false_negative_rate).toBe(0);
    });

    it("detection is sub-second", () => {
      expect(buildSentinel().detection_latency_ms).toBeLessThan(1000);
    });

    it("vs_traditional detection is far slower than vs_sentinel", () => {
      const s = buildSentinel();
      expect(s.vs_traditional.detection_days).toBeGreaterThan(100);
      expect(s.vs_sentinel.detection_ms).toBeLessThan(1000);
    });

    it("what_it_does has at least 5 items", () => {
      expect(buildSentinel().what_it_does.length).toBeGreaterThanOrEqual(5);
    });

    it("hash is 64-char hex", () => {
      expect(buildSentinel().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildDollarAmplifier", () => {
    it("Reed score goes to 100", () => {
      const a = buildDollarAmplifier();
      expect(a.reed_score_before).toBeLessThan(100);
      expect(a.reed_score_after).toBe(100);
    });

    it("global reserve share increases", () => {
      const a = buildDollarAmplifier();
      expect(a.global_reserve_share_after).toBeGreaterThan(a.global_reserve_share_before);
    });

    it("dollar credibility score is high (>80)", () => {
      expect(buildDollarAmplifier().dollar_credibility_score).toBeGreaterThan(80);
    });

    it("why_bitcoin_helps_dollar has reasons", () => {
      expect(buildDollarAmplifier().why_bitcoin_helps_dollar.length).toBeGreaterThan(0);
    });

    it("hash is 64-char hex", () => {
      expect(buildDollarAmplifier().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildPrecisionPolicy", () => {
    it("Fed score goes to 100", () => {
      const p = buildPrecisionPolicy();
      expect(p.fed_score_before).toBeLessThan(100);
      expect(p.fed_score_after).toBe(100);
    });

    it("precision tools are more precise than blunt rates", () => {
      const p = buildPrecisionPolicy();
      expect(p.vs_precision.precision).toBeGreaterThan(p.vs_blunt_rates.precision);
    });

    it("precision tools have zero collateral damage", () => {
      expect(buildPrecisionPolicy().vs_precision.collateral_damage).toBe("zero");
    });

    it("has at least 4 new Fed tools", () => {
      expect(buildPrecisionPolicy().new_fed_tools.length).toBeGreaterThanOrEqual(4);
    });

    it("all new tools have power_level > 0", () => {
      buildPrecisionPolicy().new_fed_tools.forEach(t => {
        expect(t.power_level).toBeGreaterThan(0);
        expect(t.power_level).toBeLessThanOrEqual(100);
      });
    });

    it("hash is 64-char hex", () => {
      expect(buildPrecisionPolicy().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildAutoApprove", () => {
    it("Industry score goes to 100", () => {
      const a = buildAutoApprove();
      expect(a.industry_score_before).toBeLessThan(100);
      expect(a.industry_score_after).toBe(100);
    });

    it("new wait is dramatically shorter than current", () => {
      const a = buildAutoApprove();
      expect(a.new_wait_seconds).toBeLessThan(60);
      expect(a.current_wait_days).toBeGreaterThan(365);
    });

    it("rejection_rate is 0 for honest firms", () => {
      expect(buildAutoApprove().rejection_rate).toBe(0);
    });

    it("what_triggers_auto has steps", () => {
      expect(buildAutoApprove().what_triggers_auto.length).toBeGreaterThan(2);
    });

    it("hash is 64-char hex", () => {
      expect(buildAutoApprove().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildSavingsShield", () => {
    it("Citizens score goes to 100", () => {
      const s = buildSavingsShield();
      expect(s.citizen_score_before).toBeLessThan(100);
      expect(s.citizen_score_after).toBe(100);
    });

    it("inflation is lower with shield than without", () => {
      const s = buildSavingsShield();
      expect(s.inflation_rate_with).toBeLessThan(s.inflation_rate_now);
    });

    it("purchasing power is higher with shield after 10 years", () => {
      const s = buildSavingsShield();
      expect(s.purchasing_power_10y_with).toBeGreaterThan(s.purchasing_power_10y_now);
    });

    it("$1000 ends up worth more with shield", () => {
      const s = buildSavingsShield();
      expect(s.example_1000_usd_in_10y.with_shield).toBeGreaterThan(s.example_1000_usd_in_10y.now);
    });

    it("custom inflation rate is respected", () => {
      const s = buildSavingsShield(5.0);
      expect(s.inflation_rate_now).toBe(5.0);
    });

    it("100% BTC reserve nearly eliminates inflation", () => {
      const s = buildSavingsShield(3.5, 100);
      expect(s.inflation_rate_with).toBe(0);
    });

    it("hash is 64-char hex", () => {
      expect(buildSavingsShield().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildDebtLiberation", () => {
    it("Developing score goes to 100", () => {
      const d = buildDebtLiberation();
      expect(d.developing_score_before).toBeLessThan(100);
      expect(d.developing_score_after).toBe(100);
    });

    it("commons dividend exceeds annual debt service", () => {
      const d = buildDebtLiberation();
      expect(d.commons_dividend_usd).toBeGreaterThan(d.annual_service_usd);
    });

    it("debt_coverage_pct > 100", () => {
      expect(buildDebtLiberation().debt_coverage_pct).toBeGreaterThan(100);
    });

    it("timeline_years is reasonable (< 50)", () => {
      expect(buildDebtLiberation().timeline_years).toBeLessThan(50);
    });

    it("hash is 64-char hex", () => {
      expect(buildDebtLiberation().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildPerfectScore", () => {
    it("all 6 after scores are 100", () => {
      const r = buildPerfectScore();
      Object.values(r.scores_after).forEach(score => {
        expect(score).toBe(100);
      });
    });

    it("all before scores are below 100", () => {
      const r = buildPerfectScore();
      Object.values(r.scores_before).forEach(score => {
        expect(score).toBeLessThan(100);
      });
    });

    it("scores_before and scores_after have same keys", () => {
      const r = buildPerfectScore();
      expect(Object.keys(r.scores_before)).toEqual(Object.keys(r.scores_after));
    });

    it("contains all 6 sub-systems", () => {
      const r = buildPerfectScore();
      expect(r.sentinel).toBeDefined();
      expect(r.amplifier).toBeDefined();
      expect(r.precision).toBeDefined();
      expect(r.auto).toBeDefined();
      expect(r.shield).toBeDefined();
      expect(r.liberation).toBeDefined();
    });

    it("hash is 64-char hex", () => {
      expect(buildPerfectScore().hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("title mentions 100", () => {
      expect(buildPerfectScore().title).toContain("100");
    });
  });
});
