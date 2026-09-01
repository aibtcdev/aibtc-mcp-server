import { describe, expect, it, vi, beforeEach } from "vitest";
import { Pc, type PostCondition } from "@stacks/transactions";
import { MAINNET_CONTRACTS } from "../../src/config/contracts.js";

const { check, record, makeContractCall } = vi.hoisted(() => ({
  check: vi.fn(async () => {}),
  record: vi.fn(async () => {}),
  makeContractCall: vi.fn(),
}));

vi.mock("../../src/services/spend-limiter.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/spend-limiter.js")>();
  return { ...actual, getSpendLimiter: () => ({ check, record }) };
});

vi.mock("@stacks/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stacks/transactions")>();
  return { ...actual, makeContractCall };
});

const ADDRESS = "SP000000000000000000002Q6VF78";
const account = {
  address: ADDRESS,
  privateKey: "not-used",
  network: "testnet" as const,
};

beforeEach(() => {
  check.mockClear();
  record.mockClear();
  makeContractCall.mockClear();
});

async function call(postConditions: PostCondition[]) {
  const { callContract } = await import("../../src/transactions/builder.js");
  return callContract(account, {
    contractAddress: ADDRESS,
    contractName: "demo",
    functionName: "pay",
    functionArgs: [],
    postConditions,
  });
}

describe("callContract spend metering", () => {
  it("refuses BEFORE signing when a bounded post-condition exceeds the cap", async () => {
    check.mockRejectedValueOnce(new Error("spend limit exceeded"));

    await expect(
      call([Pc.principal(ADDRESS).willSendLte(11_000_001).ustx()])
    ).rejects.toThrow("spend limit exceeded");

    expect(check).toHaveBeenCalledWith("ustx", 11_000_001n, ADDRESS);
    // The whole point of the rail: nothing was built, signed or broadcast.
    expect(makeContractCall).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("charges an sBTC post-condition exactly once — the legion double-bill guard", async () => {
    // legion_contribute / legion_sponsor sign this exact shape. They used to
    // also meter at the tool, which billed the sats cap twice per contribute.
    check.mockRejectedValueOnce(new Error("spend limit exceeded"));

    await expect(
      call([
        Pc.principal(ADDRESS)
          .willSendEq(30_000)
          .ft(MAINNET_CONTRACTS.SBTC_TOKEN as `${string}.${string}`, "sbtc-token"),
      ])
    ).rejects.toThrow("spend limit exceeded");

    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith("sats", 30_000n, ADDRESS);
  });

  it("does not meter a call whose post-conditions bound nothing the rail tracks", async () => {
    // Sentinel: reaching the builder proves the rail let the call through
    // rather than blocking it.
    makeContractCall.mockRejectedValueOnce(new Error("reached the builder"));

    // Lower bound (a floor, not a cap) plus a non-sBTC token: neither is a
    // spend ceiling this rail can price, so the call proceeds unmetered.
    await expect(
      call([
        Pc.principal(ADDRESS).willSendGte(500).ustx(),
        Pc.principal(ADDRESS)
          .willSendEq(1_000)
          .ft("SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex", "alex"),
      ])
    ).rejects.toThrow("reached the builder");

    expect(check).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
