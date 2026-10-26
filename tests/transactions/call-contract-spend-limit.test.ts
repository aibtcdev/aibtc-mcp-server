import { describe, expect, it, vi, beforeEach } from "vitest";
import { Pc, PostConditionMode, type PostCondition } from "@stacks/transactions";
import { MAINNET_CONTRACTS, TESTNET_CONTRACTS } from "../../src/config/contracts.js";

const FEE = 3_000n;
const RESERVATION = { addr: "reservation", day: "today", spends: [] };

const { reserve, release, makeContractCall, makeSTXTokenTransfer, broadcastTransaction } = vi.hoisted(() => ({
  reserve: vi.fn(async () => RESERVATION),
  release: vi.fn(async () => {}),
  makeContractCall: vi.fn(),
  makeSTXTokenTransfer: vi.fn(),
  broadcastTransaction: vi.fn(),
}));

vi.mock("../../src/services/spend-limiter.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/spend-limiter.js")>();
  return { ...actual, getSpendLimiter: () => ({ reserve, release }) };
});

vi.mock("@stacks/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stacks/transactions")>();
  return { ...actual, makeContractCall, makeSTXTokenTransfer, broadcastTransaction };
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

vi.mock("../../src/config/sponsor.js", () => ({
  getSponsorRelayUrl: () => "https://relay.test",
  getSponsorApiKey: () => "test-key",
  isFallbackEnabled: () => true,
}));

vi.mock("../../src/utils/relay-health.js", () => ({
  isRelayHealthy: async () => false,
}));

const ADDRESS = "SP000000000000000000002Q6VF78";
const account = {
  address: ADDRESS,
  privateKey: "not-used",
  network: "testnet" as const,
};
const SBTC = TESTNET_CONTRACTS.SBTC_TOKEN as `${string}.${string}`;

beforeEach(() => {
  reserve.mockClear();
  release.mockClear();
  makeContractCall.mockReset();
  makeSTXTokenTransfer.mockReset();
  broadcastTransaction.mockReset();
});

async function call(
  postConditions: PostCondition[],
  extra: Record<string, unknown> = {}
) {
  const { callContract } = await import("../../src/transactions/builder.js");
  return callContract(account, {
    contractAddress: ADDRESS,
    contractName: "demo",
    functionName: "pay",
    functionArgs: [],
    postConditions,
    ...extra,
  });
}

describe("callContract spend metering", () => {
  it("refuses BEFORE signing when a bounded post-condition plus fee exceeds the cap", async () => {
    reserve.mockRejectedValueOnce(new Error("spend limit exceeded"));

    await expect(
      call([Pc.principal(ADDRESS).willSendLte(11_000_001).ustx()])
    ).rejects.toThrow("spend limit exceeded");

    expect(reserve).toHaveBeenCalledWith([{ unit: "ustx", amount: 11_000_001n + FEE }], ADDRESS);
    // The whole point of the rail: nothing was built, signed or broadcast.
    expect(makeContractCall).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("charges an sBTC post-condition exactly once — the legion double-bill guard", async () => {
    // legion_contribute / legion_sponsor sign this exact shape. They used to
    // also meter at the tool, which billed the sats cap twice per contribute.
    reserve.mockRejectedValueOnce(new Error("spend limit exceeded"));

    await expect(
      call([
        Pc.principal(ADDRESS)
          .willSendEq(30_000)
          .ft(MAINNET_CONTRACTS.SBTC_TOKEN as `${string}.${string}`, "sbtc-token"),
      ])
    ).rejects.toThrow("spend limit exceeded");

    expect(reserve).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledWith(
      [
        { unit: "sats", amount: 30_000n },
        { unit: "ustx", amount: FEE },
      ],
      ADDRESS
    );
  });

  it("meters only the fee when post-conditions bound nothing the rail tracks", async () => {
    // Sentinel: reaching the builder proves the rail let the call through.
    makeContractCall.mockRejectedValueOnce(new Error("reached the builder"));

    await expect(
      call([
        Pc.principal(ADDRESS)
          .willSendEq(1_000)
          .ft("SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex", "alex"),
      ])
    ).rejects.toThrow("reached the builder");

    expect(reserve).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledWith([{ unit: "ustx", amount: FEE }], ADDRESS);
  });

  it("refuses a gt/gte floor on the caller's own STX or sBTC: it has no upper bound", async () => {
    await expect(call([Pc.principal(ADDRESS).willSendGte(1).ustx()])).rejects.toThrow(
      /no upper bound/
    );
    await expect(
      call([Pc.principal(ADDRESS).willSendGt(1).ft(SBTC, "sbtc-token")])
    ).rejects.toThrow(/no upper bound/);
    expect(reserve).not.toHaveBeenCalled();
    expect(makeContractCall).not.toHaveBeenCalled();
  });

  it("allows a gte floor on someone else's assets (a payout to the caller)", async () => {
    makeContractCall.mockRejectedValueOnce(new Error("reached the builder"));
    await expect(
      call([Pc.principal(`${ADDRESS}.vault`).willSendGte(1).ft(SBTC, "sbtc-token")])
    ).rejects.toThrow("reached the builder");
  });

  it("refuses Allow mode without callerSpendCaps", async () => {
    await expect(call([], { postConditionMode: PostConditionMode.Allow })).rejects.toThrow(
      /callerSpendCaps/
    );
    expect(makeContractCall).not.toHaveBeenCalled();
  });

  it("turns Allow-mode callerSpendCaps into on-chain lte post conditions and meters them", async () => {
    makeContractCall.mockRejectedValueOnce(new Error("reached the builder"));

    await expect(
      call([], {
        postConditionMode: PostConditionMode.Allow,
        callerSpendCaps: { ustx: 2_000_000n, sats: 500n },
      })
    ).rejects.toThrow("reached the builder");

    expect(reserve).toHaveBeenCalledWith(
      expect.arrayContaining([
        { unit: "sats", amount: 500n },
        { unit: "ustx", amount: 2_000_000n + FEE },
      ]),
      ADDRESS
    );
    // Signing failed, so the booking is given back.
    expect(release).toHaveBeenCalledWith(RESERVATION);

    const signed = makeContractCall.mock.calls[0][0] as { postConditions: PostCondition[] };
    expect(signed.postConditions).toEqual([
      Pc.principal(ADDRESS).willSendLte(2_000_000n).ustx(),
      Pc.principal(ADDRESS).willSendLte(500n).ft(SBTC, "sbtc-token"),
    ]);
  });
});

describe("transferStx spend metering", () => {
  it("meters the amount plus the fee before signing", async () => {
    reserve.mockRejectedValueOnce(new Error("spend limit exceeded"));
    const { transferStx } = await import("../../src/transactions/builder.js");

    await expect(transferStx(account, ADDRESS, 1_000_000n)).rejects.toThrow(
      "spend limit exceeded"
    );
    expect(reserve).toHaveBeenCalledWith([{ unit: "ustx", amount: 1_000_000n + FEE }], ADDRESS);
    expect(makeSTXTokenTransfer).not.toHaveBeenCalled();
  });
});

describe("a failed broadcast", () => {
  async function transfer() {
    makeSTXTokenTransfer.mockResolvedValueOnce({ serialize: () => "00" });
    const { transferStx } = await import("../../src/transactions/builder.js");
    return transferStx(account, ADDRESS, 1_000n);
  }

  it("gives the booking back when the node rejects the transaction", async () => {
    broadcastTransaction.mockResolvedValueOnce({ error: "rejected", reason: "BadNonce" });
    await expect(transfer()).rejects.toThrow("BadNonce");
    expect(release).toHaveBeenCalledWith(RESERVATION);
  });

  it("keeps the booking when the broadcast call itself throws", async () => {
    // A timeout or reset leaves it unknown whether the node took it.
    broadcastTransaction.mockRejectedValueOnce(new Error("socket hang up"));
    await expect(transfer()).rejects.toThrow("socket hang up");
    expect(release).not.toHaveBeenCalled();
  });
});

describe("sponsored paths are metered", () => {
  it("sponsoredStxTransfer checks the amount before signing", async () => {
    reserve.mockRejectedValueOnce(new Error("spend limit exceeded"));
    const { sponsoredStxTransfer } = await import("../../src/transactions/sponsor-builder.js");

    await expect(
      sponsoredStxTransfer(account, ADDRESS, 5_000_000n, undefined, "testnet")
    ).rejects.toThrow("spend limit exceeded");
    expect(reserve).toHaveBeenCalledWith([{ unit: "ustx", amount: 5_000_000n }], ADDRESS);
    expect(makeSTXTokenTransfer).not.toHaveBeenCalled();
  });

  it("sponsoredContractCall meters post conditions before signing", async () => {
    reserve.mockRejectedValueOnce(new Error("spend limit exceeded"));
    const { sponsoredContractCall } = await import("../../src/transactions/sponsor-builder.js");

    await expect(
      sponsoredContractCall(
        account,
        {
          contractAddress: ADDRESS,
          contractName: "demo",
          functionName: "pay",
          functionArgs: [],
          postConditions: [Pc.principal(ADDRESS).willSendEq(40_000).ft(SBTC, "sbtc-token")],
        },
        "testnet"
      )
    ).rejects.toThrow("spend limit exceeded");
    expect(reserve).toHaveBeenCalledWith([{ unit: "sats", amount: 40_000n }], ADDRESS);
    expect(makeContractCall).not.toHaveBeenCalled();
  });

  it("sponsoredContractCall refuses Allow mode without callerSpendCaps", async () => {
    const { sponsoredContractCall } = await import("../../src/transactions/sponsor-builder.js");
    await expect(
      sponsoredContractCall(
        account,
        {
          contractAddress: ADDRESS,
          contractName: "demo",
          functionName: "pay",
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
        },
        "testnet"
      )
    ).rejects.toThrow(/callerSpendCaps/);
    expect(makeContractCall).not.toHaveBeenCalled();
  });

  it("sponsoredStxTransfer gives its booking back before the direct fallback books its own", async () => {
    const sponsoredBooking = { addr: "sponsored", day: "today", spends: [] };
    const directBooking = { addr: "direct", day: "today", spends: [] };
    reserve.mockResolvedValueOnce(sponsoredBooking).mockResolvedValueOnce(directBooking);
    makeSTXTokenTransfer
      .mockResolvedValueOnce({
        serialize: () => "00",
        auth: { spendingCondition: { nonce: 0n } },
      })
      .mockRejectedValueOnce(new Error("reached the fallback builder"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: "relay down" }), { status: 503 }))
    );
    const { sponsoredStxTransfer } = await import("../../src/transactions/sponsor-builder.js");

    try {
      await expect(
        sponsoredStxTransfer(account, ADDRESS, 5_000_000n, undefined, "testnet")
      ).rejects.toThrow("reached the fallback builder");
    } finally {
      vi.unstubAllGlobals();
    }

    expect(reserve).toHaveBeenNthCalledWith(1, [{ unit: "ustx", amount: 5_000_000n }], ADDRESS);
    expect(reserve).toHaveBeenNthCalledWith(2, [{ unit: "ustx", amount: 5_000_000n + FEE }], ADDRESS);
    // The sponsored booking is released before the fallback reserves, so the
    // amount is never held twice.
    const releasedSponsored = release.mock.calls.findIndex(([r]) => r === sponsoredBooking);
    expect(release.mock.invocationCallOrder[releasedSponsored]).toBeLessThan(
      reserve.mock.invocationCallOrder[1]
    );
    expect(release).toHaveBeenCalledWith(directBooking);
  });
});
