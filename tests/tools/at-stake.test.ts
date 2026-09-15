import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostConditionMode } from "@stacks/transactions";

/**
 * The pure helpers — isTradeable, predictOutcome, num — are kept real; only the
 * calls that would reach mainnet are stubbed. A test that mocked the predicate
 * as well would be asserting the mock's opinion of when a market trades.
 */
const chain = vi.hoisted(() => ({
  getAtStakeAccount: vi.fn(),
  getMarket: vi.fn(),
  getPosition: vi.fn(),
  getBurnHeight: vi.fn(),
  getBid: vi.fn(),
  readMarket: vi.fn(),
  readContract: vi.fn(),
  getLegionParams: vi.fn(),
  getProposeStatus: vi.fn(),
  getProposal: vi.fn(),
  getProposalMeta: vi.fn(),
  getPhase: vi.fn(),
  getSettlement: vi.fn(),
}));

const callContract = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/at-stake.service.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/services/at-stake.service.js")
  >();
  return { ...actual, ...chain };
});

vi.mock("../../src/transactions/builder.js", () => ({ callContract }));

const { registerAtStakeTools } = await import(
  "../../src/tools/at-stake.tools.js"
);
const { registerAtStakeLegionTools } = await import(
  "../../src/tools/at-stake-legion.tools.js"
);

const ME = "SP20GPDS5RYB2DV03KG4W08EG6HD11KYPK6FQJE1";
const OTHER = "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9";

interface RegisteredTool {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

function createTrackingServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: vi.fn(
      (
        name: string,
        _config: { description: string; inputSchema: unknown },
        handler: RegisteredTool["handler"]
      ) => {
        tools.set(name, { handler });
      }
    ),
  };
  return { server, tools };
}

function marketTools() {
  const { server, tools } = createTrackingServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAtStakeTools(server as any);
  return tools;
}

function legionTools() {
  const { server, tools } = createTrackingServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAtStakeLegionTools(server as any);
  return tools;
}

function body(result: { content: Array<{ text: string }> }): any {
  return JSON.parse(result.content[0].text);
}

/** An open market with room before the close height. */
function openMarket(overrides: Record<string, unknown> = {}) {
  return {
    title: "Will El Salvador stake any of their Bitcoin...",
    opened: true,
    status: 0,
    statusLabel: "open",
    closeHeight: 994699,
    vault: 1729600,
    idleCirc: 1729600,
    bondedCirc: 1729600,
    createdAt: 966390,
    ...overrides,
  };
}

const PARAMS = {
  minPosition: 1000,
  payout: 3000,
  minVoters: 2,
  proposerCooldown: 144,
  votingThreshold: 66,
  voteDelay: 2,
  voteWindow: 30,
  concludeWindow: 12,
  globalProposeInterval: 6,
};

beforeEach(() => {
  vi.clearAllMocks();
  chain.getAtStakeAccount.mockResolvedValue({ address: ME, network: "mainnet" });
  chain.getMarket.mockResolvedValue(openMarket());
  chain.getBurnHeight.mockResolvedValue(967130);
  chain.getPosition.mockResolvedValue({ idle: 11000, bonded: 11000 });
  chain.getBid.mockResolvedValue(null);
  chain.getLegionParams.mockResolvedValue(PARAMS);
  callContract.mockResolvedValue({ txid: "0xdeadbeef" });
});

describe("at stake market tools", () => {
  it("registers the eleven market tools", () => {
    expect([...marketTools().keys()].sort()).toEqual([
      "atstake_cancel_bid",
      "atstake_get_bid",
      "atstake_market_status",
      "atstake_merge_complete_set",
      "atstake_mint_complete_set",
      "atstake_place_bid",
      "atstake_position",
      "atstake_redeem",
      "atstake_resolve_idle",
      "atstake_subject",
      "atstake_transfer_shares",
    ]);
  });

  it("reports a balanced book as flat rather than as a position", async () => {
    const result = await marketTools().get("atstake_position")!.handler({});
    expect(body(result).netExposure).toBe("flat");
    expect(body(result).mergeableSats).toBe(11000);
  });

  it("names the direction when the two sides differ", async () => {
    chain.getPosition.mockResolvedValue({ idle: 11000, bonded: 8000 });
    const result = await marketTools().get("atstake_position")!.handler({});
    expect(body(result).netExposure).toBe("long no by 3000 shares");
  });

  it("mints a complete set under a post-condition for exactly the sats spent", async () => {
    const result = await marketTools()
      .get("atstake_mint_complete_set")!
      .handler({ sats: 2000 });

    expect(result.isError).toBeUndefined();
    expect(body(result).minted).toEqual({ bonded_yes: 2000, idle_no: 2000 });
    expect(body(result).netExposure).toContain("flat");

    const [, options] = callContract.mock.calls[0];
    expect(options.functionName).toBe("mint-complete-set");
    expect(options.postConditionMode).toBe(PostConditionMode.Deny);
    expect(options.postConditions).toHaveLength(1);
    expect(options.postConditions[0].amount).toBe("2000");
  });

  it("refuses to mint once the market has resolved", async () => {
    chain.getMarket.mockResolvedValue(
      openMarket({ status: 2, statusLabel: "resolved-idle" })
    );
    const result = await marketTools()
      .get("atstake_mint_complete_set")!
      .handler({ sats: 2000 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u102");
    expect(callContract).not.toHaveBeenCalled();
  });

  it("refuses to mint once the close height has passed", async () => {
    chain.getBurnHeight.mockResolvedValue(994700);
    const result = await marketTools()
      .get("atstake_mint_complete_set")!
      .handler({ sats: 2000 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u103");
  });

  it("rejects a bid at or above par before it costs gas", async () => {
    const result = await marketTools()
      .get("atstake_place_bid")!
      .handler({ side: "no", amount: 1000, total_sats: 1200 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u133");
    expect(callContract).not.toHaveBeenCalled();
  });

  it("places a bid on the side named, not the side numbered", async () => {
    await marketTools()
      .get("atstake_place_bid")!
      .handler({ side: "yes", amount: 1000, total_sats: 680 });

    const [, options] = callContract.mock.calls[0];
    // yes is the BONDED side, u1 — not u0, which is IDLE.
    expect(options.functionArgs[0].value).toBe(1n);
  });

  it("maps the idle label to the no side", async () => {
    await marketTools()
      .get("atstake_place_bid")!
      .handler({ side: "idle", amount: 1000, total_sats: 320 });

    const [, options] = callContract.mock.calls[0];
    expect(options.functionArgs[0].value).toBe(0n);
  });

  it("refuses to merge more pairs than the caller holds", async () => {
    chain.getPosition.mockResolvedValue({ idle: 500, bonded: 11000 });
    const result = await marketTools()
      .get("atstake_merge_complete_set")!
      .handler({ sats: 1000 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("only 500 pairs can merge");
  });

  it("warns when a transfer drops the caller under the legion minimum", async () => {
    chain.getPosition.mockResolvedValue({ idle: 1500, bonded: 1500 });
    const result = await marketTools()
      .get("atstake_transfer_shares")!
      .handler({ side: "no", amount: 800, to: OTHER });

    expect(body(result).legionWeightAfter).toBe(700);
    expect(body(result).note).toContain("below the 1,000-share legion minimum");
  });

  it("refuses a self transfer", async () => {
    const result = await marketTools()
      .get("atstake_transfer_shares")!
      .handler({ side: "no", amount: 100, to: ME });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u110");
  });

  it("refuses to redeem while the market is open", async () => {
    const result = await marketTools().get("atstake_redeem")!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u108");
  });

  it("redeems the winning side and post-conditions the exact payout", async () => {
    chain.getMarket.mockResolvedValue(
      openMarket({ status: 2, statusLabel: "resolved-idle" })
    );
    chain.getPosition.mockResolvedValue({ idle: 4000, bonded: 9000 });

    const result = await marketTools().get("atstake_redeem")!.handler({});

    expect(body(result).outcome).toBe("no");
    expect(body(result).payoutSats).toBe(4000);
    const [, options] = callContract.mock.calls[0];
    expect(options.postConditions[0].amount).toBe("4000");
  });

  it("refuses resolve-idle while the window is still open", async () => {
    const result = await marketTools().get("atstake_resolve_idle")!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u104");
  });

  it("allows resolve-idle once the close height has passed", async () => {
    chain.getBurnHeight.mockResolvedValue(994700);
    const result = await marketTools().get("atstake_resolve_idle")!.handler({});

    expect(result.isError).toBeUndefined();
    expect(body(result).settledAs).toBe("idle (no)");
    const [, options] = callContract.mock.calls[0];
    expect(options.functionName).toBe("resolve-idle");
    expect(options.postConditions).toEqual([]);
  });
});

describe("at stake legion tools", () => {
  const eligible = {
    canPropose: true,
    eligible: true,
    slotOpen: true,
    cooledDown: true,
    noLiveProposal: true,
    potOk: true,
    marketTradeable: true,
    weight: 11000,
    vault: 992000,
    winsLeft: 330,
    payout: 3000,
    votable: 737600,
    nextProposeHeight: 966970,
    proposerNextHeight: 967108,
  };

  beforeEach(() => {
    chain.getProposeStatus.mockResolvedValue(eligible);
    chain.getSettlement.mockResolvedValue({
      redeemed: false,
      redeemedSats: 0,
      paidSats: 0,
      unpaidSats: 0,
      totalCredits: 0,
      won: false,
    });
    chain.readContract.mockResolvedValue({ type: "uint", value: "2" });
  });

  it("registers the eight legion tools", () => {
    expect([...legionTools().keys()].sort()).toEqual([
      "atstake_legion_claim_credit",
      "atstake_legion_conclude",
      "atstake_legion_get_proposal",
      "atstake_legion_list_proposals",
      "atstake_legion_propose",
      "atstake_legion_redeem_vault",
      "atstake_legion_status",
      "atstake_legion_vote",
    ]);
  });

  it("proposes against the legion for the side named", async () => {
    const result = await legionTools().get("atstake_legion_propose")!.handler({
      side: "no",
      title: "pox-5 has no protocol bond in any qualifying period at burn 966,964",
      description: "get-protocol-bond returns none for indices 2 through 7.",
      link: "https://gist.github.com/secret-mars/abc",
    });

    expect(result.isError).toBeUndefined();
    const [, options] = callContract.mock.calls[0];
    expect(options.contractName).toBe("elsalvador-no-legion-v2");
    // The contract takes link first, then title, then description.
    expect(options.functionArgs[0].value).toBe(
      "https://gist.github.com/secret-mars/abc"
    );
    expect(options.functionArgs[1].value).toContain("pox-5 has no protocol bond");
  });

  it("names every blocker when the caller cannot propose", async () => {
    chain.getProposeStatus.mockResolvedValue({
      ...eligible,
      canPropose: false,
      eligible: false,
      weight: 40,
      cooledDown: false,
    });

    const result = await legionTools().get("atstake_legion_propose")!.handler({
      side: "yes",
      title: "t",
      description: "d",
      link: "https://example.com",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u401");
    expect(result.content[0].text).toContain("u450");
    expect(callContract).not.toHaveBeenCalled();
  });

  it("rejects non-ascii before it aborts on chain", async () => {
    const result = await legionTools().get("atstake_legion_propose")!.handler({
      side: "no",
      title: "a dash — here",
      description: "d",
      link: "https://example.com",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("non-ASCII");
    expect(callContract).not.toHaveBeenCalled();
  });

  it("rejects a title over the contract's ascii bound", async () => {
    const result = await legionTools().get("atstake_legion_propose")!.handler({
      side: "no",
      title: "x".repeat(129),
      description: "d",
      link: "https://example.com",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("128-character limit");
  });

  const proposal = {
    proposer: OTHER,
    payout: 3000,
    createdAt: 966964,
    voteEnd: 966996,
    votableAtOpen: 1426600,
    yesWeight: 6300,
    noWeight: 0,
    voterCount: 2,
    yesVoterCount: 2,
    status: 0,
    statusLabel: "open",
    reason: "",
    paidInShares: false,
  };

  it("refuses a vote before the delay has elapsed", async () => {
    chain.getProposal.mockResolvedValue(proposal);
    chain.getPhase.mockResolvedValue("pending");

    const result = await legionTools().get("atstake_legion_vote")!.handler({
      side: "no",
      proposal_id: 1,
      support: true,
      rationale: "reproduced the read at 966,964",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u436");
  });

  it("refuses a vote from a holder under the minimum", async () => {
    chain.getProposal.mockResolvedValue(proposal);
    chain.getPhase.mockResolvedValue("voting");
    chain.getPosition.mockResolvedValue({ idle: 400, bonded: 400 });

    const result = await legionTools().get("atstake_legion_vote")!.handler({
      side: "no",
      proposal_id: 1,
      support: true,
      rationale: "reproduced the read at 966,964",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u401");
  });

  it("refuses a proposer voting on their own proposal", async () => {
    chain.getProposal.mockResolvedValue({ ...proposal, proposer: ME });
    chain.getPhase.mockResolvedValue("voting");

    const result = await legionTools().get("atstake_legion_vote")!.handler({
      side: "no",
      proposal_id: 1,
      support: true,
      rationale: "mine",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u423");
  });

  it("projects the tally the vote would produce", async () => {
    chain.getProposal.mockResolvedValue({ ...proposal, yesWeight: 3000, noWeight: 0 });
    chain.getPhase.mockResolvedValue("voting");
    chain.getPosition.mockResolvedValue({ idle: 1000, bonded: 1000 });

    const result = await legionTools().get("atstake_legion_vote")!.handler({
      side: "no",
      proposal_id: 1,
      support: false,
      rationale: "the link does not show the index it claims",
    });

    expect(body(result).tallyIfMinedNow).toMatchObject({
      yesWeight: 3000,
      noWeight: 1000,
      yesPercent: 75,
    });
  });

  it("refuses to conclude a proposal whose window has passed", async () => {
    chain.getProposal.mockResolvedValue(proposal);
    chain.getPhase.mockResolvedValue("expired");

    const result = await legionTools().get("atstake_legion_conclude")!.handler({
      side: "no",
      proposal_id: 1,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u435");
    expect(callContract).not.toHaveBeenCalled();
  });

  it("forecasts a pass paid in shares while the market trades", async () => {
    chain.getProposal.mockResolvedValue(proposal);
    chain.getPhase.mockResolvedValue("concludable");
    chain.getPosition.mockResolvedValue({ idle: 11000, bonded: 11000 });

    const result = await legionTools().get("atstake_legion_conclude")!.handler({
      side: "no",
      proposal_id: 1,
    });

    expect(body(result).expectedOutcome).toBe("passed");
    expect(body(result).expectedReason).toBe("paid-shares");
    expect(body(result).paidIn).toBe("shares");
    expect(body(result).payee).toBe(OTHER);
  });

  it("forecasts not-holding when the proposer has sold below the minimum", async () => {
    chain.getProposal.mockResolvedValue(proposal);
    chain.getPhase.mockResolvedValue("concludable");
    chain.getPosition.mockResolvedValue({ idle: 10, bonded: 10 });

    const result = await legionTools().get("atstake_legion_conclude")!.handler({
      side: "no",
      proposal_id: 1,
    });

    expect(body(result).expectedOutcome).toBe("failed");
    expect(body(result).expectedReason).toBe("not-holding");
    expect(body(result).payee).toBeNull();
  });

  it("forecasts voted-down below the weight threshold", async () => {
    chain.getProposal.mockResolvedValue({
      ...proposal,
      yesWeight: 1000,
      noWeight: 1000,
    });
    chain.getPhase.mockResolvedValue("concludable");

    const result = await legionTools().get("atstake_legion_conclude")!.handler({
      side: "no",
      proposal_id: 1,
    });

    expect(body(result).expectedReason).toBe("voted-down");
  });

  it("refuses to claim a credit before the vault is redeemed", async () => {
    chain.readContract.mockResolvedValue({ type: "uint", value: "3000" });

    const result = await legionTools()
      .get("atstake_legion_claim_credit")!
      .handler({ side: "no" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("u448");
  });

  it("caps a claim at what the pot has left", async () => {
    chain.getSettlement.mockResolvedValue({
      redeemed: true,
      redeemedSats: 1000,
      paidSats: 0,
      unpaidSats: 1000,
      totalCredits: 3000,
      won: true,
    });
    chain.readContract.mockResolvedValue({ type: "uint", value: "3000" });

    const result = await legionTools()
      .get("atstake_legion_claim_credit")!
      .handler({ side: "no" });

    expect(body(result).expectedPayoutSats).toBe(1000);
    expect(body(result).creditLeftAfter).toBe(2000);
    const [, options] = callContract.mock.calls[0];
    expect(options.postConditions[0].amount).toBe("1000");
  });
});
