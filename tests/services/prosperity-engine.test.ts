import { describe, it, expect } from "vitest";
import {
  computeCantillon,
  computeMonetaryHealth,
  computeResourceTax,
  computeTransitionPath,
  computeProsperityIndex,
} from "../../src/services/prosperity-engine.js";

describe("prosperity-engine", () => {

  describe("computeCantillon", () => {
    it("distributes to banks first, poor last", () => {
      const r = computeCantillon(1_000_000, "USD");
      expect(r.reaches_banks).toBeGreaterThan(r.reaches_poor);
      expect(r.reaches_banks + r.reaches_corps + r.reaches_middle + r.reaches_poor).toBeCloseTo(100, 0);
    });
    it("wealth_gap_factor > 1 always", () => {
      const r = computeCantillon(500_000);
      expect(r.wealth_gap_factor).toBeGreaterThan(1);
    });
    it("real_value_poor is less than nominal share", () => {
      const r = computeCantillon(1_000_000);
      const nominal = 1_000_000 * r.reaches_poor / 100;
      expect(r.real_value_poor).toBeLessThan(nominal);
    });
    it("returns sha256 hash", () => {
      const r = computeCantillon(1_000_000);
      expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("computeMonetaryHealth", () => {
    it("Bitcoin scores highest", () => {
      const btc = computeMonetaryHealth({ currency: "BTC", inflation_rate: 0, supply_growth: 0, debt_to_gdp: 0, is_fixed_supply: true });
      const usd = computeMonetaryHealth({ currency: "USD", inflation_rate: 3.5, supply_growth: 7, debt_to_gdp: 120 });
      expect(btc.score).toBeGreaterThan(usd.score);
    });
    it("score is 0-100", () => {
      const r = computeMonetaryHealth({ currency: "LBP", inflation_rate: 200, supply_growth: 300, debt_to_gdp: 500 });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
    it("purchasing_power_loss computes correctly for 0% inflation", () => {
      const r = computeMonetaryHealth({ currency: "X", inflation_rate: 0, supply_growth: 0, debt_to_gdp: 0, is_fixed_supply: true });
      expect(r.purchasing_power_loss_10y).toBeCloseTo(0, 1);
    });
    it("cantillon_gap grows with supply", () => {
      const low  = computeMonetaryHealth({ currency: "A", inflation_rate: 2, supply_growth: 2,  debt_to_gdp: 50 });
      const high = computeMonetaryHealth({ currency: "B", inflation_rate: 2, supply_growth: 20, debt_to_gdp: 50 });
      expect(high.cantillon_gap).toBeGreaterThan(low.cantillon_gap);
    });
  });

  describe("computeResourceTax", () => {
    it("proposed_fee is less than annual_value", () => {
      const r = computeResourceTax({ resource: "urban land", current_user: "developers", annual_value_usd: 1_000_000_000, workers_in_region: 500_000 });
      expect(r.proposed_fee).toBeLessThan(r.annual_value);
    });
    it("public_revenue is less than proposed_fee (after collection cost)", () => {
      const r = computeResourceTax({ resource: "spectrum", current_user: "telcos", annual_value_usd: 500_000_000, workers_in_region: 100_000 });
      expect(r.public_revenue).toBeLessThan(r.proposed_fee);
    });
  });

  describe("computeTransitionPath", () => {
    it("total_years = sum of 3 phases", () => {
      const r = computeTransitionPath({ country: "Jordan", population: 10_000_000, gdp_usd: 45_000_000_000, debt_usd: 40_000_000_000 });
      expect(r.total_years).toBe(r.phase_1.duration_years + r.phase_2.duration_years + r.phase_3.duration_years);
    });
    it("high debt extends phase 2", () => {
      const low  = computeTransitionPath({ country: "A", population: 1e6, gdp_usd: 1e12, debt_usd: 0.5e12 });
      const high = computeTransitionPath({ country: "B", population: 1e6, gdp_usd: 1e12, debt_usd: 1.5e12 });
      expect(high.phase_2.duration_years).toBeGreaterThan(low.phase_2.duration_years);
    });
    it("phase 1 loses nobody", () => {
      const r = computeTransitionPath({ country: "X", population: 5e6, gdp_usd: 1e11, debt_usd: 5e10 });
      expect(r.phase_1.who_loses.toLowerCase()).toContain("none");
    });
  });

  describe("computeProsperityIndex", () => {
    it("score is 0-100", () => {
      const r = computeProsperityIndex({
        economy: "Test", inflation_rate: 5, supply_growth: 8, debt_to_gdp: 90,
        banked_population_pct: 60, gini_coefficient: 0.4, production_tax_rate: 30,
        transparency_score: 50, is_bitcoin_legal: false,
      });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
    it("Bitcoin legal raises score", () => {
      const base = { economy: "T", inflation_rate: 3, supply_growth: 5, debt_to_gdp: 60, banked_population_pct: 70, gini_coefficient: 0.35, production_tax_rate: 25, transparency_score: 65 };
      const with_btc    = computeProsperityIndex({ ...base, is_bitcoin_legal: true  });
      const without_btc = computeProsperityIndex({ ...base, is_bitcoin_legal: false });
      expect(with_btc.score).toBeGreaterThan(without_btc.score);
    });
    it("identifies bottleneck", () => {
      const r = computeProsperityIndex({
        economy: "X", inflation_rate: 0.5, supply_growth: 1, debt_to_gdp: 10,
        banked_population_pct: 5, gini_coefficient: 0.3, production_tax_rate: 15,
        transparency_score: 80, is_bitcoin_legal: true,
      });
      expect(r.bottleneck).toBe("financial access");
    });
    it("tier matches score", () => {
      const excellent = computeProsperityIndex({
        economy: "Ideal", inflation_rate: 0, supply_growth: 0, debt_to_gdp: 0,
        banked_population_pct: 100, gini_coefficient: 0.2, production_tax_rate: 5,
        transparency_score: 95, is_bitcoin_legal: true,
      });
      expect(["good", "excellent"]).toContain(excellent.tier);
    });
  });
});
