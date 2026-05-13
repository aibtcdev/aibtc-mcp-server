import { describe, it, expect } from "vitest";
import {
  buildIcpiBitcoinEquivalence,
  buildCurrencyCompetitionModel,
  buildGrandPardonersAnalysis,
  buildMoneyMeasureAnalysis,
  buildTrustCascadeModel,
  buildFeeMarketModel,
  buildAntiFractionalReserveModel,
  buildDemocraticAccountabilityModel,
  buildCompleteNashSatoshiSynthesis,
} from "../../src/services/nash-satoshi-complete-engine.js";

describe("nash-satoshi-complete-engine", () => {

  // ── GAP 1: ICPI ↔ Energy ─────────────────────────────────────────────────

  describe("buildIcpiBitcoinEquivalence", () => {
    it("has Nash ICPI basket with at least 4 commodities", () => {
      expect(buildIcpiBitcoinEquivalence().nash_icpi.length).toBeGreaterThanOrEqual(4);
    });

    it("every commodity has a Bitcoin parallel", () => {
      buildIcpiBitcoinEquivalence().nash_icpi.forEach(c => {
        expect(c.btc_parallel.length).toBeGreaterThan(5);
      });
    });

    it("DAA mechanism mentions auto-adjustment", () => {
      const daa = buildIcpiBitcoinEquivalence().daa_mechanism;
      expect(daa.auto_adjusts_for.length).toBeGreaterThanOrEqual(4);
    });

    it("miracle energy problem has Nash concern and BTC solution", () => {
      const m = buildIcpiBitcoinEquivalence().miracle_energy_problem;
      expect(m.nash_concern.length).toBeGreaterThan(10);
      expect(m.btc_solution.length).toBeGreaterThan(10);
    });

    it("annual TWh is a positive number", () => {
      expect(buildIcpiBitcoinEquivalence().bitcoin_energy_cost.annual_twh).toBeGreaterThan(0);
    });

    it("hash is 64-char hex", () => {
      expect(buildIcpiBitcoinEquivalence().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── GAP 2: Currency Competition ───────────────────────────────────────────

  describe("buildCurrencyCompetitionModel", () => {
    it("Bitcoin has highest quality score among competitors", () => {
      const r = buildCurrencyCompetitionModel();
      const btc = r.competitors.find(c => c.name.includes("Bitcoin"))!;
      r.competitors.forEach(c => {
        expect(btc.quality_score).toBeGreaterThanOrEqual(c.quality_score);
      });
    });

    it("Bitcoin adoption trend is rising", () => {
      const r = buildCurrencyCompetitionModel();
      const btc = r.competitors.find(c => c.name.includes("Bitcoin"))!;
      expect(btc.adoption_trend).toBe("rising");
    });

    it("path_to_ideal shows BTC share increasing over time", () => {
      const path = buildCurrencyCompetitionModel().path_to_ideal;
      for (let i = 1; i < path.length; i++) {
        expect(path[i].btc_share).toBeGreaterThanOrEqual(path[i - 1].btc_share);
      }
    });

    it("why_mandate_fails has at least 4 reasons", () => {
      expect(buildCurrencyCompetitionModel().why_mandate_fails.length).toBeGreaterThanOrEqual(4);
    });

    it("why_choice_works has at least 4 reasons", () => {
      expect(buildCurrencyCompetitionModel().why_choice_works.length).toBeGreaterThanOrEqual(4);
    });

    it("hash is 64-char hex", () => {
      expect(buildCurrencyCompetitionModel().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── GAP 3: Grand Pardoners ────────────────────────────────────────────────

  describe("buildGrandPardonersAnalysis", () => {
    it("has at least 5 historical pardons", () => {
      expect(buildGrandPardonersAnalysis().historical_pardons.length).toBeGreaterThanOrEqual(5);
    });

    it("Weimar Germany has near-100% debt forgiven", () => {
      const weimar = buildGrandPardonersAnalysis().historical_pardons
        .find(p => p.nation.includes("Weimar"))!;
      expect(weimar.debt_forgiven_pct).toBeGreaterThan(90);
    });

    it("mathematical extraction: 20yr loss is greater than 10yr loss", () => {
      const m = buildGrandPardonersAnalysis().mathematical_extraction;
      expect(m.example_20yr.saver_loss_pct).toBeGreaterThan(m.example_10yr.saver_loss_pct);
    });

    it("who_pays has more victims than who_benefits entries", () => {
      const r = buildGrandPardonersAnalysis();
      expect(r.who_pays.length).toBeGreaterThanOrEqual(r.who_benefits.length);
    });

    it("Satoshi quote is present", () => {
      expect(buildGrandPardonersAnalysis().bitcoin_removes_pardon.satoshi_quote.length).toBeGreaterThan(20);
    });

    it("hash is 64-char hex", () => {
      expect(buildGrandPardonersAnalysis().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── GAP 4: Money as Measure ───────────────────────────────────────────────

  describe("buildMoneyMeasureAnalysis", () => {
    it("Dollar is the only political standard among physical ones", () => {
      const standards = buildMoneyMeasureAnalysis().physical_standards;
      const political = standards.filter(s => s.political);
      expect(political).toHaveLength(1);
      expect(political[0].name).toBe("Dollar");
    });

    it("all physical standards (non-Dollar) are not political", () => {
      buildMoneyMeasureAnalysis().physical_standards
        .filter(s => s.name !== "Dollar")
        .forEach(s => expect(s.political).toBe(false));
    });

    it("historical_degradation shows 1971 as critical year", () => {
      const has1971 = buildMoneyMeasureAnalysis().historical_degradation
        .some(d => d.year === 1971);
      expect(has1971).toBe(true);
    });

    it("bitcoin_as_standard has at least 5 invariants", () => {
      expect(buildMoneyMeasureAnalysis().bitcoin_as_standard.invariants.length).toBeGreaterThanOrEqual(5);
    });

    it("contracts_enabled has long-term items", () => {
      const contracts = buildMoneyMeasureAnalysis().bitcoin_as_standard.contracts_enabled;
      expect(contracts.some(c => c.toLowerCase().includes("30-year") || c.toLowerCase().includes("pension"))).toBe(true);
    });

    it("hash is 64-char hex", () => {
      expect(buildMoneyMeasureAnalysis().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── GAP 5: Trust Cascade ──────────────────────────────────────────────────

  describe("buildTrustCascadeModel", () => {
    it("has 7 trust layers", () => {
      expect(buildTrustCascadeModel().layers).toHaveLength(7);
    });

    it("every layer has a historical breach", () => {
      buildTrustCascadeModel().layers.forEach(l => {
        expect(l.historical_breach.length).toBeGreaterThan(10);
        expect(l.bitcoin_eliminates.length).toBeGreaterThan(10);
      });
    });

    it("total cost of breaches is in the trillions", () => {
      const total = buildTrustCascadeModel().total_cost_of_breaches_usd;
      expect(total).toBeGreaterThan(1e12);
    });

    it("Bitcoin trust model has items trusted and not trusted", () => {
      const tm = buildTrustCascadeModel().bitcoin_trust_model;
      expect(tm.trust_in_what.length).toBeGreaterThan(0);
      expect(tm.trust_not_in.length).toBeGreaterThan(0);
    });

    it("Satoshi's quote is present", () => {
      expect(buildTrustCascadeModel().satoshi_insight).toContain("root problem");
    });

    it("hash is 64-char hex", () => {
      expect(buildTrustCascadeModel().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── GAP 6: Fee Market ─────────────────────────────────────────────────────

  describe("buildFeeMarketModel", () => {
    it("includes epoch 1 (genesis) and epoch 33 (final)", () => {
      const epochs = buildFeeMarketModel().halving_epochs;
      expect(epochs.some(e => e.epoch === 1)).toBe(true);
      expect(epochs.some(e => e.epoch === 33)).toBe(true);
    });

    it("inflation decreases with each epoch", () => {
      const epochs = buildFeeMarketModel().halving_epochs.filter(e => e.epoch < 33);
      for (let i = 1; i < epochs.length; i++) {
        expect(epochs[i].inflation_pct).toBeLessThanOrEqual(epochs[i - 1].inflation_pct);
      }
    });

    it("final epoch has zero inflation and zero reward", () => {
      const final = buildFeeMarketModel().halving_epochs.find(e => e.epoch === 33)!;
      expect(final.block_reward).toBe(0);
      expect(final.inflation_pct).toBe(0);
    });

    it("fee_pct increases over time in projections", () => {
      const proj = buildFeeMarketModel().fee_projections;
      for (let i = 1; i < proj.length; i++) {
        expect(proj[i].fee_pct).toBeGreaterThanOrEqual(proj[i - 1].fee_pct);
      }
    });

    it("Satoshi quote mentions 'decades' and 'fee'", () => {
      const q = buildFeeMarketModel().satoshi_insight.toLowerCase();
      expect(q).toContain("decade");
      expect(q).toContain("fee");
    });

    it("hash is 64-char hex", () => {
      expect(buildFeeMarketModel().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── GAP 7: Anti-Fractional-Reserve ───────────────────────────────────────

  describe("buildAntiFractionalReserveModel", () => {
    it("has at least 4 historical fraud cases", () => {
      expect(buildAntiFractionalReserveModel().historical_frauds.length).toBeGreaterThanOrEqual(4);
    });

    it("every fraud has an on-chain detection description", () => {
      buildAntiFractionalReserveModel().historical_frauds.forEach(f => {
        expect(f.on_chain_detection.length).toBeGreaterThan(10);
      });
    });

    it("proof-of-reserves protocol has 5 steps", () => {
      expect(buildAntiFractionalReserveModel().proof_of_reserves_protocol).toHaveLength(5);
    });

    it("bitcoin_transparency has at least 4 mechanisms", () => {
      expect(buildAntiFractionalReserveModel().bitcoin_transparency.length).toBeGreaterThanOrEqual(4);
    });

    it("how_fractional_reserve_works has at least 7 steps", () => {
      expect(buildAntiFractionalReserveModel().how_fractional_reserve_works.length).toBeGreaterThanOrEqual(7);
    });

    it("hash is 64-char hex", () => {
      expect(buildAntiFractionalReserveModel().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── GAP 8: Democratic Accountability ─────────────────────────────────────

  describe("buildDemocraticAccountabilityModel", () => {
    it("has at least 6 monetary metrics", () => {
      expect(buildDemocraticAccountabilityModel().metrics.length).toBeGreaterThanOrEqual(6);
    });

    it("Bitcoin scores higher than USD overall", () => {
      const r = buildDemocraticAccountabilityModel();
      const btc = r.currency_scores.find(c => c.currency.includes("Bitcoin"))!;
      const usd = r.currency_scores.find(c => c.currency.includes("Dollar"))!;
      expect(btc.overall).toBeGreaterThan(usd.overall);
    });

    it("citizen toolkit has at least 7 tools", () => {
      expect(buildDemocraticAccountabilityModel().citizen_toolkit.length).toBeGreaterThanOrEqual(7);
    });

    it("institutional audit includes Federal Reserve and Bitcoin Protocol", () => {
      const institutions = buildDemocraticAccountabilityModel()
        .institutional_accountability.map(i => i.institution);
      expect(institutions.some(i => i.includes("Federal Reserve"))).toBe(true);
      expect(institutions.some(i => i.includes("Bitcoin"))).toBe(true);
    });

    it("Nash's insight quote is present", () => {
      expect(buildDemocraticAccountabilityModel().nash_insight.length).toBeGreaterThan(20);
    });

    it("hash is 64-char hex", () => {
      expect(buildDemocraticAccountabilityModel().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── Complete Synthesis ────────────────────────────────────────────────────

  describe("buildCompleteNashSatoshiSynthesis", () => {
    it("has exactly 8 elements", () => {
      expect(buildCompleteNashSatoshiSynthesis().the_eight_elements).toHaveLength(8);
    });

    it("element gaps are numbered 1-8", () => {
      const gaps = buildCompleteNashSatoshiSynthesis().the_eight_elements.map(e => e.gap);
      expect(gaps).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("every element has Nash insight and Satoshi implementation", () => {
      buildCompleteNashSatoshiSynthesis().the_eight_elements.forEach(e => {
        expect(e.nash_insight.length).toBeGreaterThan(10);
        expect(e.satoshi_implementation.length).toBeGreaterThan(10);
      });
    });

    it("all statuses are valid", () => {
      buildCompleteNashSatoshiSynthesis().the_eight_elements.forEach(e => {
        expect(["complete", "in-progress", "partial"]).toContain(e.status_in_btc);
      });
    });

    it("what_changes has at least 7 items covering different stakeholders", () => {
      expect(buildCompleteNashSatoshiSynthesis().what_changes.length).toBeGreaterThanOrEqual(7);
    });

    it("diagnosis has three parts: nash, satoshi, unified", () => {
      const d = buildCompleteNashSatoshiSynthesis().the_diagnosis;
      expect(d.nash.length).toBeGreaterThan(10);
      expect(d.satoshi.length).toBeGreaterThan(10);
      expect(d.unified.length).toBeGreaterThan(10);
    });

    it("hash is 64-char hex", () => {
      expect(buildCompleteNashSatoshiSynthesis().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
