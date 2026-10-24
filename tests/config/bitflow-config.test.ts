import { describe, it, expect, afterEach } from "vitest";
import { BITFLOW_KEEPER_HOST, getBitflowConfig } from "../../src/config/contracts.js";

// Regression for #726: the keeper host must not default to Bitflow's test gateway.
describe("getBitflowConfig keeper host", () => {
  const saved = process.env.BITFLOW_KEEPER_API_HOST;
  const savedKey = process.env.BITFLOW_KEEPER_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.BITFLOW_KEEPER_API_HOST;
    else process.env.BITFLOW_KEEPER_API_HOST = saved;
    if (savedKey === undefined) delete process.env.BITFLOW_KEEPER_API_KEY;
    else process.env.BITFLOW_KEEPER_API_KEY = savedKey;
  });

  it("defaults to the production keeper, not the test gateway", () => {
    delete process.env.BITFLOW_KEEPER_API_HOST;
    expect(BITFLOW_KEEPER_HOST).toBe("https://keeper.bitflowapis.finance");
    expect(getBitflowConfig().keeperApiHost).toBe("https://keeper.bitflowapis.finance");
    expect(getBitflowConfig().keeperApiHost).not.toMatch(/test/);
  });

  it("BITFLOW_KEEPER_API_HOST overrides the default", () => {
    process.env.BITFLOW_KEEPER_API_HOST = "https://keeper.example.test";
    expect(getBitflowConfig().keeperApiHost).toBe("https://keeper.example.test");
  });

  it("BITFLOW_KEEPER_API_KEY is read (the name docs/TOOLS.md documents); unset stays undefined", () => {
    delete process.env.BITFLOW_KEEPER_API_KEY;
    expect(getBitflowConfig().keeperApiKey).toBeUndefined();
    process.env.BITFLOW_KEEPER_API_KEY = "k-123";
    expect(getBitflowConfig().keeperApiKey).toBe("k-123");
  });
});
