import { describe, it, expect } from "vitest";
import {
  analyzeStakeholders,
  buildReserveProof,
  buildCbdcModel,
  compareTransparency,
  modelPolicyScenarios,
  modelInclusion,
  buildFullSolution,
} from "../../src/services/policy-engine.js";

describe("policy-engine", () => {

  describe("analyzeStakeholders", () => {
    it("returns 6 stakeholders", () => {
      const list = analyzeStakeholders();
      expect(list).toHaveLength(6);
    });

    it("every stakeholder has satisfaction 0-100", () => {
      analyzeStakeholders().forEach(s => {
        expect(s.satisfaction).toBeGreaterThanOrEqual(0);
        expect(s.satisfaction).toBeLessThanOrEqual(100);
      });
    });

    it("all required fields are present", () => {
      analyzeStakeholders().forEach(s => {
        expect(s.stakeholder).toBeTruthy();
        expect(s.says_they_want).toBeTruthy();
        expect(s.actually_wants).toBeTruthy();
        expect(s.solution_gives).toBeTruthy();
        expect(s.key_insight).toBeTruthy();
      });
    });

    it("industry has highest satisfaction among regulated stakeholders", () => {
      const list = analyzeStakeholders();
      const industry = list.find(s => s.stakeholder.includes("Crypto Industry"))!;
      const warren  = list.find(s => s.stakeholder.includes("Warren"))!;
      expect(industry.satisfaction).toBeGreaterThan(warren.satisfaction);
    });
  });

  describe("buildReserveProof", () => {
    // 10 BTC * $80,000 = $800,000  +  $200,000 other = $1,000,000 claimed
    const base = {
      institution:      "Test Bank",
      claimed_reserves: 1_000_000,
      btc_held:         10,
      btc_price_usd:    80_000,
      other_assets_usd: 200_000,
    };

    it("computes on-chain value correctly", () => {
      const proof = buildReserveProof(base);
      // 10 BTC * $80,000 + $200,000 = $1,000,000
      expect(proof.on_chain_verified).toBe(1_000_000);
    });

    it("marks solvent when coverage >= 1.0", () => {
      expect(buildReserveProof(base).is_solvent).toBe(true);
    });

    it("marks insolvent when coverage < 1.0", () => {
      // 1 BTC * $80,000 + $0 = $80,000 < $1,000,000 claimed
      const insolvent = buildReserveProof({ ...base, other_assets_usd: 0, btc_held: 1 });
      expect(insolvent.is_solvent).toBe(false);
    });

    it("coverage_ratio rounds to 4 decimals", () => {
      const proof = buildReserveProof(base);
      const str = proof.coverage_ratio.toString();
      const decimals = str.includes(".") ? str.split(".")[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(4);
    });

    it("hash is 64-char hex", () => {
      expect(buildReserveProof(base).hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("public_url contains institution slug", () => {
      const proof = buildReserveProof(base);
      expect(proof.public_url).toContain("test-bank");
    });
  });

  describe("buildCbdcModel", () => {
    const params = {
      currency:         "USD",
      issuer:           "Federal Reserve",
      total_supply_usd: 20_000_000_000_000,
      btc_reserve_pct:  20,
      btc_price_usd:    80_000,
    };

    it("btc_backing_usd matches pct", () => {
      const model = buildCbdcModel(params);
      expect(model.btc_backing_usd).toBe(Math.round(20_000_000_000_000 * 0.20));
    });

    it("fiat + btc pct = 100", () => {
      const model = buildCbdcModel(params);
      expect(model.fiat_reserve_pct + model.btc_reserve_pct).toBe(100);
    });

    it("higher btc reserve lowers inflation cap", () => {
      const low  = buildCbdcModel({ ...params, btc_reserve_pct: 10 });
      const high = buildCbdcModel({ ...params, btc_reserve_pct: 50 });
      expect(high.inflation_cap).toBeLessThan(low.inflation_cap);
    });

    it("100% btc reserve yields 0% inflation cap", () => {
      const model = buildCbdcModel({ ...params, btc_reserve_pct: 100 });
      expect(model.inflation_cap).toBe(0);
    });

    it("hash is 64-char hex", () => {
      expect(buildCbdcModel(params).hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("compareTransparency", () => {
    it("blockchain score > traditional score", () => {
      const cmp = compareTransparency();
      expect(cmp.blockchain_system.score).toBeGreaterThan(cmp.traditional_banking.score);
    });

    it("improvement_factor > 1", () => {
      expect(compareTransparency().improvement_factor).toBeGreaterThan(1);
    });

    it("blockchain is real-time and auditable", () => {
      const bc = compareTransparency().blockchain_system;
      expect(bc.real_time_visible).toBe(true);
      expect(bc.auditable_by_public).toBe(true);
      expect(bc.manipulation_possible).toBe(false);
    });

    it("traditional banking has high fraud detection lag", () => {
      const t = compareTransparency().traditional_banking;
      expect(t.fraud_detection_days).toBeGreaterThan(100);
    });

    it("warren_gets is a non-empty string", () => {
      expect(compareTransparency().warren_gets.length).toBeGreaterThan(10);
    });
  });

  describe("modelPolicyScenarios", () => {
    it("returns 4 scenarios", () => {
      expect(modelPolicyScenarios()).toHaveLength(4);
    });

    it("dual-layer is the only one that passes senate", () => {
      const pass = modelPolicyScenarios().filter(s => s.passes_senate);
      expect(pass).toHaveLength(1);
      expect(pass[0].name).toContain("Dual-Layer");
    });

    it("dual-layer has highest overall score", () => {
      const scenarios = modelPolicyScenarios();
      const dual = scenarios.find(s => s.name.includes("Dual-Layer"))!;
      scenarios.forEach(s => {
        if (s !== dual) expect(dual.overall_score).toBeGreaterThanOrEqual(s.overall_score);
      });
    });

    it("all scores are 0-100", () => {
      modelPolicyScenarios().forEach(s => {
        expect(s.innovation_score).toBeGreaterThanOrEqual(0);
        expect(s.inclusion_score).toBeLessThanOrEqual(100);
        expect(s.regulator_score).toBeGreaterThanOrEqual(0);
        expect(s.overall_score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("modelInclusion", () => {
    it("returns 4 regions", () => {
      expect(modelInclusion()).toHaveLength(4);
    });

    it("all regions require no permission", () => {
      modelInclusion().forEach(r => {
        expect(r.permission_required).toBe(false);
      });
    });

    it("with_solution_pct > currently_banked_pct everywhere", () => {
      modelInclusion().forEach(r => {
        expect(r.with_solution_pct).toBeGreaterThan(r.currently_banked_pct);
      });
    });

    it("new_participants is positive for every region", () => {
      modelInclusion().forEach(r => {
        expect(r.new_participants).toBeGreaterThan(0);
      });
    });

    it("total new participants exceeds 1 billion", () => {
      const total = modelInclusion().reduce((s, r) => s + r.new_participants, 0);
      expect(total).toBeGreaterThan(1_000_000_000);
    });
  });

  describe("buildFullSolution", () => {
    it("overall_score is a number 0-100", () => {
      const sol = buildFullSolution();
      expect(sol.overall_score).toBeGreaterThanOrEqual(0);
      expect(sol.overall_score).toBeLessThanOrEqual(100);
    });

    it("contains two dual layers", () => {
      const dl = buildFullSolution().dual_layer;
      expect(dl.layer_1.name).toBeTruthy();
      expect(dl.layer_2.name).toBeTruthy();
      expect(dl.bridge).toBeTruthy();
    });

    it("stakeholders length matches standalone call", () => {
      expect(buildFullSolution().stakeholders).toHaveLength(6);
    });

    it("hash is 64-char hex", () => {
      expect(buildFullSolution().hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
