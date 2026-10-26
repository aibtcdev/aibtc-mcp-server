import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostConditionMode, cvToJSON, Cl, serializeCV } from "@stacks/transactions";
import { planContractCallSpends } from "../../src/services/spend-limiter.js";

const ME = "SP1W9E9R5Q9X5ATX2SRYK46QK8BFEPF67M01G92M5";
const ACCT = "SP2Z94F6QX847PMXTPJJ2ZCCN79JZDW3PJ4E6ZABY.aibtc-acct-SP3TB-5ZP2H-SP1W9-G92M5";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";

const callContract = vi.hoisted(() => vi.fn());
const hiro = vi.hoisted(() => ({ getContractInterface: vi.fn(), callReadOnlyFunction: vi.fn() }));

vi.mock("../../src/transactions/builder.js", () => ({ callContract }));
vi.mock("../../src/services/x402.service.js", () => ({
  getAccount: vi.fn(async () => ({ address: ME, network: "mainnet", privateKey: "00" })),
}));
vi.mock("../../src/services/hiro-api.js", () => ({ getHiroApi: () => hiro }));
vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({ getActiveAccount: () => null }),
}));

const { registerAgentAccountTools } = await import("../../src/tools/agent-account.tools.js");

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

function tools() {
  const map = new Map<string, Handler>();
  const server = { registerTool: (name: string, _c: unknown, h: Handler) => map.set(name, h) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAgentAccountTools(server as any);
  return map;
}

function lastCall() {
  return callContract.mock.calls.at(-1)![1];
}

// What the spending limit books for the call the tool built.
function metered() {
  return planContractCallSpends({ ...lastCall(), sbtcContract: SBTC }, ME).spends;
}

describe("agent account tools", () => {
  beforeEach(() => {
    callContract.mockReset().mockResolvedValue({ txid: "ab".repeat(32), rawTx: "" });
    hiro.getContractInterface.mockReset().mockResolvedValue({ fungible_tokens: [{ name: "sbtc-token" }] });
  });

  it("registers 14 operate tools and no deploy tool", () => {
    const t = tools();
    expect(t.size).toBe(14);
    expect(t.has("agent_account_deploy")).toBe(false);
  });

  it("deposit_stx pins the caller's exact outflow and meters it", async () => {
    await tools().get("agent_account_deposit_stx")!({ accountContract: ACCT, amount: "1000" });
    const opts = lastCall();
    expect(opts.functionName).toBe("deposit-stx");
    expect(opts.postConditionMode).toBe(PostConditionMode.Deny);
    expect(opts.postConditions).toEqual([
      { type: "stx-postcondition", address: ME, condition: "eq", amount: "1000" },
    ]);
    expect(metered()).toEqual([{ unit: "ustx", amount: 1000n }]);
  });

  it("deposit_ft resolves the asset name and meters sBTC", async () => {
    await tools().get("agent_account_deposit_ft")!({ accountContract: ACCT, token: SBTC, amount: "500" });
    const opts = lastCall();
    expect(opts.postConditionMode).toBe(PostConditionMode.Deny);
    expect(opts.postConditions[0]).toMatchObject({
      type: "ft-postcondition",
      address: ME,
      condition: "eq",
      asset: `${SBTC}::sbtc-token`,
      amount: "500",
    });
    expect(metered()).toEqual([{ unit: "sats", amount: 500n }]);
  });

  it("withdrawals bound the account's outflow, not the caller's", async () => {
    const t = tools();
    await t.get("agent_account_withdraw_stx")!({ accountContract: ACCT, amount: "7" });
    expect(lastCall().postConditions).toEqual([
      { type: "stx-postcondition", address: ACCT, condition: "eq", amount: "7" },
    ]);
    expect(metered()).toEqual([]);

    await t.get("agent_account_withdraw_ft")!({ accountContract: ACCT, token: SBTC, amount: "9" });
    expect(lastCall().postConditions[0]).toMatchObject({ address: ACCT, condition: "eq", amount: "9" });
    expect(lastCall().postConditionMode).toBe(PostConditionMode.Deny);
  });

  it("buy/sell run in Allow mode with the caller capped at zero", async () => {
    for (const name of ["agent_account_buy_dao_token", "agent_account_sell_dao_token"]) {
      await tools().get(name)!({
        accountContract: ACCT,
        swapAdapter: "SP000000000000000000002Q6VF78.adapter",
        daoToken: "SP000000000000000000002Q6VF78.dao-token",
        amount: "100",
        minReceive: "90",
      });
      const opts = lastCall();
      expect(opts.postConditionMode).toBe(PostConditionMode.Allow);
      expect(opts.callerSpendCaps).toEqual({ ustx: 0n, sats: 0n });
      const { postConditions } = planContractCallSpends({ ...opts, sbtcContract: SBTC }, ME);
      expect(postConditions.map((p: any) => [p.address, p.condition, p.amount])).toEqual([
        [ME, "lte", "0"],
        [ME, "lte", "0"],
      ]);
      expect(cvToJSON(opts.functionArgs[3]).type).toBe("(optional uint)");
    }
  });

  it("create_action_proposal encodes the hex parameters", async () => {
    await tools().get("agent_account_create_action_proposal")!({
      accountContract: ACCT,
      votingContract: "SP000000000000000000002Q6VF78.voting",
      action: "SP000000000000000000002Q6VF78.action",
      parameters: "0xdeadbeef",
      memo: "hi",
    });
    const args = lastCall().functionArgs;
    expect(serializeCV(args[2])).toBe(serializeCV(Cl.buffer(Buffer.from("deadbeef", "hex"))));
    expect(serializeCV(args[3])).toBe(serializeCV(Cl.some(Cl.stringAscii("hi"))));
  });

  it("get_config surfaces a failed read instead of returning null", async () => {
    hiro.callReadOnlyFunction.mockResolvedValueOnce({ okay: true, result: serializeCV(Cl.tuple({ owner: Cl.principal(ME) })) });
    hiro.callReadOnlyFunction.mockResolvedValueOnce({ okay: false, cause: "NoSuchContract" });
    const res = await tools().get("agent_account_get_config")!({ accountContract: ACCT });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/get-agent-permissions failed: NoSuchContract/);
  });
});
