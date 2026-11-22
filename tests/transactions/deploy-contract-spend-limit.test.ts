import { describe, expect, it, vi, beforeEach } from "vitest";

const FEE = 250_000n;
const RESERVATION = { addr: "reservation", day: "today", spends: [] };

const { reserve, release, makeContractDeploy, broadcastTransaction } = vi.hoisted(() => ({
  reserve: vi.fn(async () => RESERVATION),
  release: vi.fn(async () => {}),
  makeContractDeploy: vi.fn(),
  broadcastTransaction: vi.fn(),
}));

vi.mock("../../src/services/spend-limiter.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/spend-limiter.js")>();
  return { ...actual, getSpendLimiter: () => ({ reserve, release }) };
});

vi.mock("@stacks/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stacks/transactions")>();
  return { ...actual, makeContractDeploy, broadcastTransaction };
});

vi.mock("../../src/utils/fee.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils/fee.js")>();
  return { ...actual, resolveDefaultFee: async () => FEE };
});

vi.mock("../../src/services/hiro-api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/hiro-api.js")>();
  return {
    ...actual,
    getHiroApi: () => ({ getNonceInfo: async () => ({ possible_next_nonce: 0 }) }),
  };
});

const ADDRESS = "SP000000000000000000002Q6VF78";
const account = { address: ADDRESS, privateKey: "not-used", network: "testnet" as const };
const OPTIONS = { contractName: "demo", codeBody: "(define-read-only (hi) (ok u1))" };

async function deploy(extra: Record<string, unknown> = {}) {
  const { deployContract } = await import("../../src/transactions/builder.js");
  return deployContract(account, { ...OPTIONS, ...extra });
}

beforeEach(() => {
  reserve.mockClear();
  release.mockClear();
  makeContractDeploy.mockReset();
  broadcastTransaction.mockReset();
});

describe("deployContract spend metering", () => {
  it("refuses BEFORE signing when the fee exceeds the cap", async () => {
    reserve.mockRejectedValueOnce(new Error("spend limit exceeded"));

    await expect(deploy()).rejects.toThrow("spend limit exceeded");

    expect(reserve).toHaveBeenCalledWith([{ unit: "ustx", amount: FEE }], ADDRESS);
    expect(makeContractDeploy).not.toHaveBeenCalled();
    expect(broadcastTransaction).not.toHaveBeenCalled();
  });

  it("books an explicit fee as given", async () => {
    makeContractDeploy.mockRejectedValueOnce(new Error("reached the builder"));

    await expect(deploy({ fee: 123_456n })).rejects.toThrow("reached the builder");

    expect(reserve).toHaveBeenCalledWith([{ unit: "ustx", amount: 123_456n }], ADDRESS);
  });

  it("releases the booking when the build fails", async () => {
    makeContractDeploy.mockRejectedValueOnce(new Error("build failed"));

    await expect(deploy()).rejects.toThrow("build failed");

    expect(release).toHaveBeenCalledWith(RESERVATION);
    expect(broadcastTransaction).not.toHaveBeenCalled();
  });

  it("releases the booking when the node explicitly rejects the transaction", async () => {
    makeContractDeploy.mockResolvedValueOnce({ serialize: () => "00" });
    broadcastTransaction.mockResolvedValueOnce({ error: "rejected", reason: "BadNonce" });

    await expect(deploy()).rejects.toThrow(/Broadcast failed: rejected - BadNonce/);

    expect(release).toHaveBeenCalledWith(RESERVATION);
  });

  it("keeps the booking when broadcast throws (outcome unknown)", async () => {
    makeContractDeploy.mockResolvedValueOnce({ serialize: () => "00" });
    broadcastTransaction.mockRejectedValueOnce(new Error("socket hang up"));

    await expect(deploy()).rejects.toThrow("socket hang up");

    expect(release).not.toHaveBeenCalled();
  });

  it("keeps the booking on success", async () => {
    makeContractDeploy.mockResolvedValueOnce({ serialize: () => "00" });
    broadcastTransaction.mockResolvedValueOnce({ txid: "ab".repeat(32) });

    const result = await deploy();

    expect(result.txid).toBe("ab".repeat(32));
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });
});
