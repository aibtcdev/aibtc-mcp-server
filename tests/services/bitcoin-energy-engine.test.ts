import { describe, it, expect } from "vitest";
import {
  buildLandauerAnalysis,
  buildProofOfWorkThermodynamics,
  buildIcpiEquivalence,
  buildEnergySecurityModel,
  buildMiningEpochs,
  buildRenewableTransition,
  buildEnergyValueTheory,
  buildBitcoinEnergyComplete,
} from "../../src/services/bitcoin-energy-engine.js";

describe("bitcoin-energy-engine", () => {

  // ── Landauer ────────────────────────────────────────────────────────────────

  describe("buildLandauerAnalysis", () => {
    it("landauer_joules_per_bit is the known constant ~2.85e-21 J", () => {
      const r = buildLandauerAnalysis();
      expect(r.landauer_joules_per_bit).toBeGreaterThan(2e-21);
      expect(r.landauer_joules_per_bit).toBeLessThan(4e-21);
    });

    it("actual joules per hash is greater than theoretical minimum", () => {
      const r = buildLandauerAnalysis();
      expect(r.actual_joules_per_hash).toBeGreaterThan(r.landauer_per_btc_hash);
    });

    it("efficiency_ratio is above 1 (real ASICs consume more than minimum)", () => {
      expect(buildLandauerAnalysis().efficiency_ratio).toBeGreaterThan(1);
    });

    it("unforgeable_reason mentions second law / entropy / physics", () => {
      const text = buildLandauerAnalysis().unforgeable_reason.toLowerCase();
      expect(text).toMatch(/thermodynamic|entropy|physics|second law/);
    });

    it("hash is 64-char hex", () => {
      expect(buildLandauerAnalysis().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── Thermodynamics ──────────────────────────────────────────────────────────

  describe("buildProofOfWorkThermodynamics", () => {
    it("what_pow_really_is mentions arrow-of-time or irreversible", () => {
      const text = buildProofOfWorkThermodynamics().what_pow_really_is.toLowerCase();
      expect(text).toMatch(/arrow.of.time|irreversible/);
    });

    it("bitcoin_vs_fiat: bitcoin wins", () => {
      const r = buildProofOfWorkThermodynamics();
      expect(r.bitcoin_vs_fiat.winner.toLowerCase()).toContain("bitcoin");
    });

    it("szilard_connection mentions Maxwell or demon or entropy", () => {
      const text = buildProofOfWorkThermodynamics().szilard_connection.toLowerCase();
      expect(text).toMatch(/maxwell|demon|entropy|szilard/);
    });

    it("maxwell_demon_defeated mentions central bank", () => {
      const text = buildProofOfWorkThermodynamics().maxwell_demon_defeated.toLowerCase();
      expect(text).toContain("central bank");
    });

    it("hash is 64-char hex", () => {
      expect(buildProofOfWorkThermodynamics().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── ICPI ────────────────────────────────────────────────────────────────────

  describe("buildIcpiEquivalence", () => {
    it("has at least 4 ICPI commodities", () => {
      expect(buildIcpiEquivalence().icpi_commodities.length).toBeGreaterThanOrEqual(4);
    });

    it("each commodity has a btc_parallel and why_objective", () => {
      buildIcpiEquivalence().icpi_commodities.forEach(c => {
        expect(c.btc_parallel.length).toBeGreaterThan(5);
        expect(c.why_objective.length).toBeGreaterThan(10);
      });
    });

    it("daa_mechanism mentions 2016 blocks or difficulty", () => {
      const text = buildIcpiEquivalence().daa_mechanism.toLowerCase();
      expect(text).toMatch(/2016|difficulty/);
    });

    it("miracle_problem_solved mentions DAA or committee or math", () => {
      const text = buildIcpiEquivalence().miracle_problem_solved.toLowerCase();
      expect(text).toMatch(/daa|committee|math/);
    });

    it("hash is 64-char hex", () => {
      expect(buildIcpiEquivalence().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── Security model ──────────────────────────────────────────────────────────

  describe("buildEnergySecurityModel", () => {
    it("current TWh is > 100 (realistic Bitcoin energy estimate)", () => {
      expect(buildEnergySecurityModel().current_twh_annual).toBeGreaterThan(100);
    });

    it("attack cost is in the billions (USD) — hardware + electricity", () => {
      expect(buildEnergySecurityModel().cost_to_attack_usd).toBeGreaterThan(1e9);
    });

    it("has at least 4 comparison entries", () => {
      expect(buildEnergySecurityModel().comparison.length).toBeGreaterThanOrEqual(4);
    });

    it("comparison entries all have positive TWh", () => {
      buildEnergySecurityModel().comparison.forEach(c => {
        expect(c.twh_annual).toBeGreaterThan(0);
      });
    });

    it("hash is 64-char hex", () => {
      expect(buildEnergySecurityModel().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── Mining epochs ───────────────────────────────────────────────────────────

  describe("buildMiningEpochs", () => {
    it("has exactly 33 epochs", () => {
      expect(buildMiningEpochs()).toHaveLength(33);
    });

    it("epoch 1 starts in 2009 with 50 BTC reward", () => {
      const e1 = buildMiningEpochs()[0];
      expect(e1.epoch).toBe(1);
      expect(e1.year).toBe(2009);
      expect(e1.block_reward_btc).toBe(50);
    });

    it("epoch 33 has zero block reward and 100% fees", () => {
      const e33 = buildMiningEpochs()[32];
      expect(e33.epoch).toBe(33);
      expect(e33.block_reward_btc).toBe(0);
      expect(e33.fee_pct_of_revenue).toBe(100);
    });

    it("inflation decreases monotonically", () => {
      const epochs = buildMiningEpochs();
      for (let i = 1; i < epochs.length - 1; i++) {
        expect(epochs[i].inflation_pct).toBeLessThanOrEqual(epochs[i - 1].inflation_pct);
      }
    });

    it("final epoch year is 2009 + 32*4 = 2137", () => {
      const last = buildMiningEpochs()[32];
      expect(last.year).toBe(2009 + 32 * 4);
    });
  });

  // ── Renewable ───────────────────────────────────────────────────────────────

  describe("buildRenewableTransition", () => {
    it("current renewable pct > 40%", () => {
      expect(buildRenewableTransition().current_renewable_pct).toBeGreaterThan(40);
    });

    it("Bitcoin renewable > gold mining renewable", () => {
      const comp = buildRenewableTransition().comparison;
      const btc  = comp.find(c => c.industry.toLowerCase().includes("bitcoin"))!;
      const gold = comp.find(c => c.industry.toLowerCase().includes("gold"))!;
      expect(btc.renewable_pct).toBeGreaterThan(gold.renewable_pct);
    });

    it("why_bitcoin_goes_green has at least 4 reasons", () => {
      expect(buildRenewableTransition().why_bitcoin_goes_green.length).toBeGreaterThanOrEqual(4);
    });

    it("stranded_energy mentions curtailed or stranded", () => {
      const text = buildRenewableTransition().stranded_energy.toLowerCase();
      expect(text).toMatch(/stranded|curtailed/);
    });

    it("hash is 64-char hex", () => {
      expect(buildRenewableTransition().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── Energy-value theory ─────────────────────────────────────────────────────

  describe("buildEnergyValueTheory", () => {
    it("thesis mentions energy and objective", () => {
      const text = buildEnergyValueTheory().thesis.toLowerCase();
      expect(text).toContain("energy");
      expect(text).toMatch(/objective|universe|thermodynamic/);
    });

    it("fiat energy cost fraction is near zero", () => {
      expect(buildEnergyValueTheory().fiat_energy_cost).toContain("free");
    });

    it("nash_validation mentions ICPI or Nash", () => {
      const text = buildEnergyValueTheory().nash_validation;
      expect(text).toMatch(/Nash|ICPI/);
    });

    it("satoshi_validation mentions cost of production", () => {
      const text = buildEnergyValueTheory().satoshi_validation.toLowerCase();
      expect(text).toMatch(/cost.*production|production.*cost/);
    });

    it("hash is 64-char hex", () => {
      expect(buildEnergyValueTheory().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── Complete synthesis ──────────────────────────────────────────────────────

  describe("buildBitcoinEnergyComplete", () => {
    it("contains all 7 sections", () => {
      const r = buildBitcoinEnergyComplete();
      expect(r.landauer).toBeDefined();
      expect(r.thermodynamics).toBeDefined();
      expect(r.icpi_equivalence).toBeDefined();
      expect(r.security_model).toBeDefined();
      expect(r.mining_epochs).toHaveLength(33);
      expect(r.renewable).toBeDefined();
      expect(r.energy_value_theory).toBeDefined();
    });

    it("the_deepest_truth mentions Landauer, Nash, and Satoshi", () => {
      const text = buildBitcoinEnergyComplete().the_deepest_truth;
      expect(text).toContain("Landauer");
      expect(text).toContain("Nash");
      expect(text).toContain("Satoshi");
    });

    it("hash is 64-char hex", () => {
      expect(buildBitcoinEnergyComplete().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
