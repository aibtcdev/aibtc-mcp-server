import { describe, it, expect } from "vitest";
import {
  getAxioms,
  scoreCurrencyByName,
  compareAllCurrencies,
  buildNashEquilibriumGame,
  buildGenesisUrElement,
  buildNashSatoshiReport,
  projectInflationSchedule,
} from "../../src/services/nash-ideal-money-engine.js";

describe("nash-ideal-money-engine", () => {

  describe("getAxioms", () => {
    it("returns exactly 5 axioms", () => {
      expect(getAxioms()).toHaveLength(5);
    });

    it("axioms are numbered 1-5", () => {
      const ids = getAxioms().map(a => a.id);
      expect(ids).toEqual([1, 2, 3, 4, 5]);
    });

    it("every axiom has name, description, and nash_quote", () => {
      getAxioms().forEach(a => {
        expect(a.name.length).toBeGreaterThan(3);
        expect(a.description.length).toBeGreaterThan(10);
        expect(a.nash_quote.length).toBeGreaterThan(10);
      });
    });
  });

  describe("scoreCurrencyByName — Bitcoin", () => {
    it("BTC scores 100/100 total", () => {
      const r = scoreCurrencyByName("BTC")!;
      expect(r).not.toBeNull();
      expect(r.total_score).toBe(100);
    });

    it("BTC is_ideal = true", () => {
      expect(scoreCurrencyByName("BTC")!.is_ideal).toBe(true);
    });

    it("BTC has zero critical failures", () => {
      expect(scoreCurrencyByName("BTC")!.critical_fail).toHaveLength(0);
    });

    it("BTC scores 100 on every axiom", () => {
      scoreCurrencyByName("BTC")!.axiom_scores.forEach(a => {
        expect(a.score).toBe(100);
        expect(a.passes).toBe(true);
      });
    });
  });

  describe("scoreCurrencyByName — USD", () => {
    it("USD is not ideal money", () => {
      const r = scoreCurrencyByName("USD")!;
      expect(r.is_ideal).toBe(false);
    });

    it("USD has critical failures", () => {
      expect(scoreCurrencyByName("USD")!.critical_fail.length).toBeGreaterThan(0);
    });

    it("USD score is below BTC score", () => {
      const btc = scoreCurrencyByName("BTC")!;
      const usd = scoreCurrencyByName("USD")!;
      expect(btc.total_score).toBeGreaterThan(usd.total_score);
    });
  });

  describe("scoreCurrencyByName — ETH", () => {
    it("ETH is not fully ideal (governance risk)", () => {
      const r = scoreCurrencyByName("ETH")!;
      expect(r.is_ideal).toBe(false);
    });

    it("ETH scores higher than USD", () => {
      const eth = scoreCurrencyByName("ETH")!;
      const usd = scoreCurrencyByName("USD")!;
      expect(eth.total_score).toBeGreaterThan(usd.total_score);
    });
  });

  describe("scoreCurrencyByName — unknown", () => {
    it("returns null for unknown currency", () => {
      expect(scoreCurrencyByName("FAKECOIN")).toBeNull();
    });
  });

  describe("compareAllCurrencies", () => {
    it("BTC is the winner", () => {
      expect(compareAllCurrencies().winner).toContain("Bitcoin");
    });

    it("currencies are sorted descending by score", () => {
      const { currencies } = compareAllCurrencies();
      for (let i = 1; i < currencies.length; i++) {
        expect(currencies[i - 1].total_score).toBeGreaterThanOrEqual(currencies[i].total_score);
      }
    });

    it("all scores are 0-100", () => {
      compareAllCurrencies().currencies.forEach(c => {
        expect(c.total_score).toBeGreaterThanOrEqual(0);
        expect(c.total_score).toBeLessThanOrEqual(100);
      });
    });

    it("only Bitcoin achieves is_ideal", () => {
      const ideal = compareAllCurrencies().currencies.filter(c => c.is_ideal);
      expect(ideal).toHaveLength(1);
      expect(ideal[0].currency).toContain("Bitcoin");
    });

    it("hash is 64-char hex", () => {
      expect(compareAllCurrencies().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildNashEquilibriumGame", () => {
    it("has players array", () => {
      expect(buildNashEquilibriumGame().players.length).toBeGreaterThan(0);
    });

    it("dominant strategy mentions Bitcoin", () => {
      expect(buildNashEquilibriumGame().dominant_strategy.toLowerCase()).toContain("bitcoin");
    });

    it("why_bitcoin_wins has at least 4 reasons", () => {
      expect(buildNashEquilibriumGame().why_bitcoin_wins.length).toBeGreaterThanOrEqual(4);
    });

    it("hash is 64-char hex", () => {
      expect(buildNashEquilibriumGame().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildGenesisUrElement", () => {
    it("mentions prev_hash or prior block", () => {
      const g = buildGenesisUrElement();
      const text = (g.bitcoin_realization + g.implication).toLowerCase();
      expect(text).toMatch(/prev_hash|prior block|genesis/);
    });

    it("satoshi_quote references the Times headline", () => {
      expect(buildGenesisUrElement().satoshi_quote).toContain("Times");
    });

    it("hash is 64-char hex", () => {
      expect(buildGenesisUrElement().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("buildNashSatoshiReport", () => {
    it("has 6 parallel dimensions", () => {
      expect(buildNashSatoshiReport().parallels).toHaveLength(6);
    });

    it("every parallel has nash_position and satoshi_action", () => {
      buildNashSatoshiReport().parallels.forEach(p => {
        expect(p.nash_position.length).toBeGreaterThan(10);
        expect(p.satoshi_action.length).toBeGreaterThan(10);
        expect(p.date_or_ref.length).toBeGreaterThan(5);
      });
    });

    it("verdict mentions truth or correct", () => {
      const verdict = buildNashSatoshiReport().verdict.toLowerCase();
      expect(verdict).toMatch(/truth|correct|design/);
    });

    it("hash is 64-char hex", () => {
      expect(buildNashSatoshiReport().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("projectInflationSchedule", () => {
    it("BTC inflation converges toward zero", () => {
      const schedule = projectInflationSchedule("BTC", 20);
      const first = schedule[0].inflation;
      const last  = schedule[schedule.length - 1].inflation;
      expect(last).toBeLessThan(first);
    });

    it("BTC inflation is positive at start", () => {
      expect(projectInflationSchedule("BTC", 20)[0].inflation).toBeGreaterThan(0);
    });

    it("USD inflation stays above 1% throughout 20 years", () => {
      const schedule = projectInflationSchedule("USD", 20);
      schedule.forEach(s => {
        expect(s.inflation).toBeGreaterThan(1);
      });
    });

    it("returns years+1 data points (inclusive of year 0)", () => {
      const schedule = projectInflationSchedule("BTC", 10);
      expect(schedule).toHaveLength(11);
    });

    it("years are sequential", () => {
      const schedule = projectInflationSchedule("EUR", 5);
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].year).toBe(schedule[i - 1].year + 1);
      }
    });

    it("BTC halving is visible — inflation drops every 4 years", () => {
      const schedule = projectInflationSchedule("BTC", 20);
      // After 4 years, inflation should be roughly half
      const y0 = schedule[0].inflation;
      const y4 = schedule[4].inflation;
      expect(y4).toBeLessThan(y0 * 0.6);
    });
  });
});
