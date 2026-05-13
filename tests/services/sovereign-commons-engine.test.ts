import { describe, it, expect } from "vitest";
import {
  computeGlobalCommons,
  computeSovereignProfile,
  computeEconomicRevival,
  computeEnvironmentalPlan,
  computeUniversalEmployment,
} from "../../src/services/sovereign-commons-engine.js";

describe("sovereign-commons-engine", () => {

  describe("computeGlobalCommons", () => {
    it("total value is sum of all assets' fair fees", () => {
      const c = computeGlobalCommons();
      const sum = c.atmosphere.fair_fee + c.oceans.fair_fee + c.biodiversity.fair_fee +
                  c.knowledge.fair_fee + c.spectrum.fair_fee + c.space.fair_fee;
      expect(c.total_annual_value_usd).toBeCloseTo(sum, -6);
    });
    it("per_human_dividend > 0", () => {
      const c = computeGlobalCommons();
      expect(c.per_human_dividend_usd).toBeGreaterThan(0);
    });
    it("depletion > restoration (current reality)", () => {
      const c = computeGlobalCommons();
      expect(c.current_depletion_rate).toBeGreaterThan(c.restoration_rate);
    });
    it("returns sha256 hash", () => {
      const c = computeGlobalCommons();
      expect(c.hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("computeSovereignProfile", () => {
    it("sovereignty score 0-100", () => {
      const r = computeSovereignProfile({ nation: "Jordan", population: 10e6, gdp_usd: 45e9, has_sound_money: false, resource_wealth: "medium", cultural_strength: "high", commons_use: "minimal" });
      expect(r.sovereignty_score).toBeGreaterThanOrEqual(0);
      expect(r.sovereignty_score).toBeLessThanOrEqual(100);
    });
    it("sound money boosts monetary control", () => {
      const with_sound    = computeSovereignProfile({ nation: "A", population: 1e6, gdp_usd: 1e10, has_sound_money: true,  resource_wealth: "medium", cultural_strength: "medium", commons_use: "moderate" });
      const without_sound = computeSovereignProfile({ nation: "B", population: 1e6, gdp_usd: 1e10, has_sound_money: false, resource_wealth: "medium", cultural_strength: "medium", commons_use: "moderate" });
      expect(with_sound.monetary_control).toBeGreaterThan(without_sound.monetary_control);
    });
    it("large population = larger commons dividend", () => {
      const small = computeSovereignProfile({ nation: "S", population: 1e6,  gdp_usd: 1e10, has_sound_money: true, resource_wealth: "low", cultural_strength: "low", commons_use: "minimal" });
      const large = computeSovereignProfile({ nation: "L", population: 100e6, gdp_usd: 1e10, has_sound_money: true, resource_wealth: "low", cultural_strength: "low", commons_use: "minimal" });
      expect(large.commons_dividend).toBeGreaterThan(small.commons_dividend);
    });
    it("heavy commons use means higher contribution", () => {
      const minimal = computeSovereignProfile({ nation: "M", population: 50e6, gdp_usd: 2e12, has_sound_money: false, resource_wealth: "medium", cultural_strength: "medium", commons_use: "minimal" });
      const heavy   = computeSovereignProfile({ nation: "H", population: 50e6, gdp_usd: 2e12, has_sound_money: false, resource_wealth: "medium", cultural_strength: "medium", commons_use: "heavy" });
      expect(heavy.commons_contribution).toBeGreaterThan(minimal.commons_contribution);
    });
  });

  describe("computeEconomicRevival", () => {
    it("revival GDP > current GDP", () => {
      const r = computeEconomicRevival({ economy: "Lebanon", population: 5e6, current_gdp: 20e9, has_sound_money: true, commons_dividend: 3.5e9, natural_resources: false, tech_capacity: "medium" });
      expect(r.revival_gdp_10y).toBeGreaterThan(r.current_gdp);
    });
    it("growth multiplier > 1", () => {
      const r = computeEconomicRevival({ economy: "X", population: 10e6, current_gdp: 100e9, has_sound_money: false, commons_dividend: 7e9, natural_resources: true, tech_capacity: "low" });
      expect(r.growth_multiplier).toBeGreaterThan(1);
    });
    it("high tech capacity boosts growth", () => {
      const low  = computeEconomicRevival({ economy: "L", population: 50e6, current_gdp: 1e12, has_sound_money: true, commons_dividend: 35e9, natural_resources: false, tech_capacity: "low" });
      const high = computeEconomicRevival({ economy: "H", population: 50e6, current_gdp: 1e12, has_sound_money: true, commons_dividend: 35e9, natural_resources: false, tech_capacity: "high" });
      expect(high.revival_gdp_10y).toBeGreaterThan(low.revival_gdp_10y);
    });
  });

  describe("computeEnvironmentalPlan", () => {
    it("has 6 restoration projects", () => {
      const r = computeEnvironmentalPlan(5.6e12);
      expect(r.restoration_projects.length).toBe(6);
    });
    it("target score > current score", () => {
      const r = computeEnvironmentalPlan(5.6e12);
      expect(r.target_score_50y).toBeGreaterThan(r.planet_health_score);
    });
    it("carbon reduction is significant", () => {
      const r = computeEnvironmentalPlan(5.6e12);
      expect(r.carbon_reduction_gt).toBeGreaterThan(100);
    });
    it("jobs created > 400M", () => {
      const r = computeEnvironmentalPlan(5.6e12);
      expect(r.jobs_created_global).toBeGreaterThan(400_000_000);
    });
  });

  describe("computeUniversalEmployment", () => {
    it("total new jobs > currently unemployed", () => {
      const r = computeUniversalEmployment();
      expect(r.total_new_jobs).toBeGreaterThan(r.currently_unemployed);
    });
    it("commons dividend > 0", () => {
      const r = computeUniversalEmployment();
      expect(r.commons_dividend_usd).toBeGreaterThan(0);
    });
    it("total = sum of 4 sectors", () => {
      const r = computeUniversalEmployment();
      const sum = r.new_jobs_commons + r.new_jobs_digital + r.new_jobs_care + r.new_jobs_innovation;
      expect(r.total_new_jobs).toBeCloseTo(sum, -3);
    });
  });
});
