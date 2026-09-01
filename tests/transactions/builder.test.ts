import { describe, expect, it, vi } from "vitest";
import { Pc } from "@stacks/transactions";

const { check, makeContractCall } = vi.hoisted(() => ({
  check: vi.fn(async () => {
    throw new Error("spend limit exceeded");
  }),
  makeContractCall: vi.fn(),
}));

vi.mock("../../src/services/spend-limiter.js", () => ({
  boundedPostConditionSpends: (
    conditions: unknown[] | undefined,
    address: string,
  ) =>
    (conditions ?? []).flatMap((condition: any) =>
      condition.address === address &&
      (condition.condition === "eq" || condition.condition === "lte") &&
      condition.type === "stx-postcondition"
        ? [{ unit: "ustx", amount: BigInt(condition.amount) }]
        : [],
    ),
  getSpendLimiter: () => ({ check, record: vi.fn() }),
}));

vi.mock("@stacks/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stacks/transactions")>();
  return { ...actual, makeContractCall };
});

describe("callContract spend limiter", () => {
  it("refuses before signing when a bounded post-condition exceeds the cap", async () => {
    const { callContract } = await import("../../src/transactions/builder.js");
    const address = "SP000000000000000000002Q6VF78";
    await expect(
      callContract(
        { address, privateKey: "not-used", network: "testnet" },
        {
          contractAddress: address,
          contractName: "demo",
          functionName: "pay",
          functionArgs: [],
          postConditions: [
            Pc.principal(address).willSendLte(11_000_001).ustx(),
          ],
        },
      ),
    ).rejects.toThrow("spend limit exceeded");
    expect(check).toHaveBeenCalledOnce();
    expect(makeContractCall).not.toHaveBeenCalled();
  });
});
