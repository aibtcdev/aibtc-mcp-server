import { describe, it, expect } from "vitest";
import {
  buildTimeline,
  diffContractShape,
  predictOutcome,
  proposeBlockers,
  normalizeOrdinalsLink,
  contentUrlFromLink,
  type LegionParams,
  type ProposeStatus,
  type StoryRecord,
} from "../../src/services/legion.service.js";
import {
  LEGION_ERAS,
  LEGION_NETWORK,
  LIVE_ERA,
  LEGION_ERRORS,
  networkOfContract,
  resolveEra,
} from "../../src/config/legion.js";

/**
 * Mirrors mainnet `aibtc-news-gov` get-params at deploy. These are the values
 * the contract actually returns; the tools read them live, but the derived
 * views below must agree with the contract's own arithmetic, so the tests pin
 * them.
 */
const PARAMS: LegionParams = {
  votingThreshold: 66,
  minVoters: 1,
  membersToActivate: 21,
  yesMultiple: 20,
  minWeightToAct: 10_000,
  minJoinSats: 10_000,
  payoutBps: 5,
  voteDelay: 2,
  voteWindow: 30,
  concludeWindow: 12,
  globalProposeInterval: 18,
};

/** An OPEN story that clears every gate: 100% yes, 1 voter, yes >= 20x payout. */
function story(overrides: Partial<StoryRecord> = {}): StoryRecord {
  return {
    proposer: "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9",
    lockedWeight: 50_000,
    payout: 1_000,
    createdAt: 100,
    voteEnd: 132, // createdAt + voteDelay + voteWindow
    totalWeightAtOpen: 500_000,
    yesWeight: 25_000, // >= payout * yesMultiple (20_000)
    noWeight: 0,
    voterCount: 1,
    status: 0,
    reason: "",
    ...overrides,
  };
}

function proposeStatus(overrides: Partial<ProposeStatus> = {}): ProposeStatus {
  return {
    canPropose: true,
    eligible: true,
    slotOpen: true,
    noLiveProposal: true,
    poolOk: true,
    membersOk: true,
    memberCount: 21,
    membersToActivate: 21,
    nextProposeHeight: 0,
    lockOnPropose: 50_000,
    payout: 1_000,
    freeWeight: 50_000,
    ...overrides,
  };
}

const POOL = 10_000_000;
/** Inside the conclude window: voteEnd (132) <= h < voteEnd + concludeWindow (144). */
const CONCLUDABLE_HEIGHT = 135;

describe("legion config", () => {
  it("is pinned to mainnet", () => {
    expect(LEGION_NETWORK).toBe("mainnet");
    expect(LIVE_ERA.gov).toBe(
      "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.aibtc-news-gov"
    );
    expect(LIVE_ERA.treasury).toBe(
      "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.aibtc-news-treasury"
    );
  });

  it("pairs each gov with a treasury under the same deployer", () => {
    // Gov calls `.aibtc-news-treasury`, which resolves against gov's own
    // deployer — a split pair would point at a contract gov cannot reach.
    for (const era of LEGION_ERAS) {
      expect(era.treasury.split(".")[0]).toBe(era.gov.split(".")[0]);
    }
  });

  it("keeps every era on the live era's chain", () => {
    for (const era of LEGION_ERAS) {
      expect(networkOfContract(era.gov)).toBe(LEGION_NETWORK);
    }
  });

  it("resolves an unknown era to an error, never a silent fallback", () => {
    expect(resolveEra(undefined)).toBe(LIVE_ERA);
    expect(resolveEra(LIVE_ERA.version)).toBe(LIVE_ERA);
    // Reading a retired testnet id would answer about a different proposal.
    expect(() => resolveEra(6)).toThrow(/No legion era v6/);
  });

  it("explains the activation error the mainnet contract added", () => {
    expect(LEGION_ERRORS[441]).toMatch(/not activated/i);
  });

  it("carries no veto error codes — this era has no veto", () => {
    expect(LEGION_ERRORS[424]).toBeUndefined();
    expect(LEGION_ERRORS[425]).toBeUndefined();
  });
});

describe("buildTimeline", () => {
  it("opens conclude the moment voting closes", () => {
    const t = buildTimeline(story(), PARAMS, CONCLUDABLE_HEIGHT, "burn");
    expect(t.votingOpensAt).toBe(102); // createdAt + voteDelay
    expect(t.voteEnd).toBe(132);
    expect(t.concludeOpensAt).toBe(132); // no veto window in between
    expect(t.concludeDeadline).toBe(144); // voteEnd + concludeWindow
  });

  it("counts down to the next boundary and stops after the last one", () => {
    expect(
      buildTimeline(story(), PARAMS, 101, "burn").blocksUntilNextTransition
    ).toBe(1); // votingOpensAt 102
    expect(
      buildTimeline(story(), PARAMS, 135, "burn").blocksUntilNextTransition
    ).toBe(9); // concludeDeadline 144
    expect(
      buildTimeline(story(), PARAMS, 200, "burn").blocksUntilNextTransition
    ).toBeNull();
  });
});

describe("predictOutcome", () => {
  it("pays a story that clears voters, threshold and yes weight", () => {
    const p = predictOutcome(story(), PARAMS, POOL, CONCLUDABLE_HEIGHT);
    expect(p.outcome).toBe("passed");
    expect(p.reason).toBe("paid");
    expect(p.payout).toBe(1_000);
    expect(p.settled).toBe(false);
  });

  it("fails with no-voters when nobody voted", () => {
    const p = predictOutcome(
      story({ voterCount: 0, yesWeight: 0, noWeight: 0 }),
      PARAMS,
      POOL,
      CONCLUDABLE_HEIGHT
    );
    expect(p.outcome).toBe("failed");
    expect(p.reason).toBe("no-voters");
    expect(p.payout).toBe(0);
  });

  it("fails with voted-down below the yes threshold", () => {
    // 50% yes, under votingThreshold 66.
    const p = predictOutcome(
      story({ yesWeight: 50_000, noWeight: 50_000, voterCount: 2 }),
      PARAMS,
      POOL,
      CONCLUDABLE_HEIGHT
    );
    expect(p.outcome).toBe("failed");
    expect(p.reason).toBe("voted-down");
    expect(p.yesPct).toBe(50);
    expect(p.thresholdMet).toBe(false);
  });

  it("fails with yes-short when approved but under yesMultiple x payout", () => {
    // 100% yes, but 15_000 < payout 1_000 * yesMultiple 20 = 20_000.
    const p = predictOutcome(
      story({ yesWeight: 15_000 }),
      PARAMS,
      POOL,
      CONCLUDABLE_HEIGHT
    );
    expect(p.outcome).toBe("failed");
    expect(p.reason).toBe("yes-short");
    expect(p.thresholdMet).toBe(true); // approved...
    expect(p.yesMet).toBe(false); // ...but by too little weight
    expect(p.yesWeightRequired).toBe(20_000);
  });

  it("checks threshold before yes weight, matching the contract's order", () => {
    // Both gates fail; the contract tests threshold first, so the reported
    // reason must be voted-down rather than yes-short.
    const p = predictOutcome(
      story({ yesWeight: 100, noWeight: 900, voterCount: 2 }),
      PARAMS,
      POOL,
      CONCLUDABLE_HEIGHT
    );
    expect(p.reason).toBe("voted-down");
  });

  it("fails with pool-short when the treasury cannot cover the payout", () => {
    const p = predictOutcome(story(), PARAMS, 999, CONCLUDABLE_HEIGHT);
    expect(p.outcome).toBe("failed");
    expect(p.reason).toBe("pool-short");
  });

  it("expires once the conclude window has closed", () => {
    const p = predictOutcome(story(), PARAMS, POOL, 144);
    expect(p.outcome).toBe("expired");
    expect(p.payout).toBe(0);
  });

  it("reports the recorded result for a settled story instead of forecasting", () => {
    // A PASSED story is necessarily past its conclude window; forecasting it
    // would call every settled piece "expired".
    const passed = predictOutcome(
      story({ status: 1, reason: "paid" }),
      PARAMS,
      POOL,
      99_999
    );
    expect(passed.settled).toBe(true);
    expect(passed.outcome).toBe("passed");
    expect(passed.payout).toBe(1_000);

    const failed = predictOutcome(
      story({ status: 2, reason: "yes-short" }),
      PARAMS,
      POOL,
      99_999
    );
    expect(failed.settled).toBe(true);
    expect(failed.outcome).toBe("failed");
    expect(failed.payout).toBe(0);
  });

  it("never fails a story for turnout alone — there is no quorum", () => {
    // One voter with a sliver of a huge total weight still passes.
    const p = predictOutcome(
      story({ totalWeightAtOpen: 100_000_000, yesWeight: 20_000 }),
      PARAMS,
      POOL,
      CONCLUDABLE_HEIGHT
    );
    expect(p.outcome).toBe("passed");
  });
});

describe("proposeBlockers", () => {
  it("is empty when every precondition holds", () => {
    expect(proposeBlockers(proposeStatus(), PARAMS.minWeightToAct)).toEqual([]);
  });

  it("names the activation gate first and says weight cannot clear it", () => {
    const blockers = proposeBlockers(
      proposeStatus({ canPropose: false, membersOk: false, memberCount: 1 }),
      PARAMS.minWeightToAct
    );
    expect(blockers[0]).toMatch(/not activated/);
    expect(blockers[0]).toMatch(/1\/21/);
    expect(blockers[0]).toMatch(/u441/);
    expect(blockers[0]).toMatch(/alone/);
  });

  it("names each remaining gate", () => {
    const blockers = proposeBlockers(
      proposeStatus({
        canPropose: false,
        eligible: false,
        noLiveProposal: false,
        slotOpen: false,
        poolOk: false,
        nextProposeHeight: 500,
      }),
      PARAMS.minWeightToAct
    );
    expect(blockers.join(" ")).toMatch(/minWeightToAct \(10000\)/);
    expect(blockers.join(" ")).toMatch(/already have a live proposal/);
    expect(blockers.join(" ")).toMatch(/height 500/);
    expect(blockers.join(" ")).toMatch(/pool is empty/);
  });
});

describe("diffContractShape", () => {
  /** Shaped like a Hiro contract interface's `functions` array. */
  const fn = (name: string, argCount: number) => ({
    name,
    args: Array.from({ length: argCount }, (_, i) => ({ name: `a${i}` })),
  });

  it("accepts a contract that satisfies every requirement", () => {
    const iface = [fn("vote", 3), fn("conclude", 1), fn("get-params", 0)];
    expect(diffContractShape(iface, { vote: 3, conclude: 1 })).toEqual([]);
  });

  it("tolerates extra functions the tools do not call", () => {
    const iface = [fn("conclude", 1), fn("veto", 1), fn("some-future-view", 2)];
    expect(diffContractShape(iface, { conclude: 1 })).toEqual([]);
  });

  it("reports a renamed or absent function", () => {
    // The exact failure mode of the mainnet migration: quote-draw -> quote-payout.
    const iface = [fn("quote-draw", 0)];
    expect(diffContractShape(iface, { "quote-payout": 0 })).toEqual([
      'missing "quote-payout"',
    ]);
  });

  it("reports an arity change, which a name check alone would miss", () => {
    // v6 added the rationale argument to vote; calling the old 2-arg form
    // broadcasts and reverts after paying gas.
    const iface = [fn("vote", 2)];
    expect(diffContractShape(iface, { vote: 3 })).toEqual([
      '"vote" takes 2 args, expected 3',
    ]);
  });

  it("reports every problem at once rather than the first", () => {
    const problems = diffContractShape([fn("vote", 2)], {
      vote: 3,
      conclude: 1,
      contribute: 1,
    });
    expect(problems).toHaveLength(3);
  });
});

describe("ordinals links", () => {
  const id = "a".repeat(64) + "i0";

  it("expands a bare inscription id to the viewer url", () => {
    expect(normalizeOrdinalsLink(id)).toBe(
      `https://ordinals.com/inscription/${id}`
    );
  });

  it("passes a full url through unchanged", () => {
    const url = `https://ordinals.com/inscription/${id}`;
    expect(normalizeOrdinalsLink(url)).toBe(url);
  });

  it("rejects anything that is neither", () => {
    expect(() => normalizeOrdinalsLink("not-an-inscription")).toThrow();
  });

  it("derives the raw-content url a voter reads the piece from", () => {
    expect(contentUrlFromLink(`https://ordinals.com/inscription/${id}`)).toBe(
      `https://ordinals.com/content/${id}`
    );
    expect(contentUrlFromLink("https://example.com/story")).toBeNull();
  });
});
