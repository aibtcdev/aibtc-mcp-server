import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAINNET_CONTRACTS } from "../../src/config/contracts.js";

const mockCallContract = vi.fn();
const mockResolveDefaultFee = vi.fn();

vi.mock("../../src/transactions/builder.js", () => ({
  callContract: (...args: unknown[]) => mockCallContract(...args),
}));

vi.mock("../../src/utils/fee.js", () => ({
  resolveDefaultFee: (...args: unknown[]) => mockResolveDefaultFee(...args),
}));

vi.mock("../../src/services/hiro-api.js", () => ({
  getHiroApi: vi.fn(() => ({
    getContractInterface: vi.fn().mockResolvedValue({
      fungible_tokens: [{ name: "sbtc-token" }],
    }),
  })),
}));

const { SbtcService } = await import("../../src/services/sbtc.service.js");
const { TokensService } = await import("../../src/services/tokens.service.js");

const ACCOUNT = {
  address: "SP000000000000000000002Q6VF78",
  privateKey: "0".repeat(64),
  network: "mainnet" as const,
};
const RECIPIENT = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

describe("sBTC transfer default fee", () => {
  beforeEach(() => {
    mockCallContract.mockReset().mockResolvedValue({ txid: "0xabc", rawTx: "00" });
    mockResolveDefaultFee.mockReset().mockResolvedValue(3000n);
  });

  it("sbtc transfer uses the sbtc_transfer clamp when no fee is given", async () => {
    await new SbtcService("mainnet").transfer(ACCOUNT, RECIPIENT, 100n);
    expect(mockResolveDefaultFee).toHaveBeenCalledWith("mainnet", "sbtc_transfer");
    expect(mockCallContract.mock.calls[0][1].fee).toBe(3000n);
  });

  it("sbtc transfer keeps an explicit fee", async () => {
    await new SbtcService("mainnet").transfer(ACCOUNT, RECIPIENT, 100n, undefined, 20000n);
    expect(mockResolveDefaultFee).not.toHaveBeenCalled();
    expect(mockCallContract.mock.calls[0][1].fee).toBe(20000n);
  });

  it("transfer_token on the sBTC contract uses the sbtc_transfer clamp", async () => {
    await new TokensService("mainnet").transfer(
      ACCOUNT,
      MAINNET_CONTRACTS.SBTC_TOKEN,
      RECIPIENT,
      100n
    );
    expect(mockResolveDefaultFee).toHaveBeenCalledWith("mainnet", "sbtc_transfer");
    expect(mockCallContract.mock.calls[0][1].fee).toBe(3000n);
  });

  it("transfer_token on another token leaves the fee to callContract", async () => {
    await new TokensService("mainnet").transfer(
      ACCOUNT,
      "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex",
      RECIPIENT,
      100n
    );
    expect(mockResolveDefaultFee).not.toHaveBeenCalled();
    expect(mockCallContract.mock.calls[0][1].fee).toBeUndefined();
  });
});
