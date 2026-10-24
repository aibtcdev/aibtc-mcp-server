import { describe, it, expect, vi, beforeEach } from "vitest";

// The Bitflow SDK only sends x-api-key when KEEPER_API_KEY is in its config, so the
// key from BITFLOW_KEEPER_API_KEY must reach the constructor.
const { sdkConfigs, mockConfig } = vi.hoisted(() => ({
  sdkConfigs: [] as Record<string, unknown>[],
  mockConfig: { value: {} as Record<string, unknown> },
}));

vi.mock("@bitflowlabs/core-sdk", () => ({
  BitflowSDK: class {
    constructor(config: Record<string, unknown>) {
      sdkConfigs.push(config);
    }
  },
  KeeperType: { MULTI_ACTION_V1: "MULTI_ACTION_V1" },
}));

vi.mock("../../src/config/index.js", () => ({
  getBitflowConfig: vi.fn(() => mockConfig.value),
  BITFLOW_PUBLIC_API: "https://mock-public-api.test",
}));

import { BitflowService } from "../../src/services/bitflow.service.js";

const base = {
  apiHost: "https://api.test",
  readOnlyCallApiHost: "https://ro.test",
  keeperApiHost: "https://keeper.test",
  providerAddress: "SP1M8KHCJXB3SBRQRDBCG3J3859AA1CN0AWDHN17B",
};

describe("BitflowService keeper API key", () => {
  beforeEach(() => {
    sdkConfigs.length = 0;
  });

  it("passes keeperApiKey to the SDK as KEEPER_API_KEY", () => {
    mockConfig.value = { ...base, keeperApiKey: "k-123" };
    new BitflowService("mainnet");
    expect(sdkConfigs[0]).toMatchObject({ KEEPER_API_HOST: "https://keeper.test", KEEPER_API_KEY: "k-123" });
  });

  it("omits KEEPER_API_KEY when no key is configured (SDK falls back to its own env lookup)", () => {
    mockConfig.value = { ...base };
    new BitflowService("mainnet");
    expect(sdkConfigs[0]).not.toHaveProperty("KEEPER_API_KEY");
  });
});
