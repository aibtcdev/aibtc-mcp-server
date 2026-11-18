/**
 * Builders that sign without broadcasting take their nonce from getNextNonce
 * (local tracker + configured API), the same source as transferStx/callContract,
 * instead of letting stacks.js fetch one from its built-in default URL.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  deserializeTransaction,
  getAddressFromPrivateKey,
  makeRandomPrivKey,
  uintCV,
} from "@stacks/transactions";

const nonceInfo = vi.hoisted(() => ({ possible_next_nonce: 5, detected_missing_nonces: [] as number[] }));

vi.mock("../../src/services/hiro-api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/hiro-api.js")>();
  return {
    ...actual,
    getHiroApi: () => ({ getNonceInfo: async () => ({ ...nonceInfo }) }),
  };
});

import { recordNonceUsed, _testing } from "../../src/services/nonce-tracker.js";
import { signStxTransfer, signContractCall, type Account } from "../../src/transactions/builder.js";

const tmpDir = path.join(os.tmpdir(), `explicit-nonce-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
_testing.setStateFilePath(path.join(tmpDir, "nonce-state.json"));

beforeAll(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
});

afterAll(async () => {
  _testing.resetStateFilePath();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

beforeEach(() => {
  _testing.clearMemory();
  nonceInfo.possible_next_nonce = 5;
});

function testAccount(): Account {
  const privateKey = makeRandomPrivKey();
  return {
    privateKey,
    address: getAddressFromPrivateKey(privateKey, "testnet"),
    network: "testnet",
  } as unknown as Account;
}

const nonceOf = (signedTx: string) =>
  Number(deserializeTransaction(signedTx).auth.spendingCondition.nonce);

describe("offline signing uses getNextNonce", () => {
  it("signStxTransfer uses the local tracker when it is ahead of the API", async () => {
    const account = testAccount();
    await recordNonceUsed(account.address, 8, "tx_8");
    const { signedTx } = await signStxTransfer(account, "ST000000000000000000002AMW42H", 1n, undefined, 1000n);
    expect(nonceOf(signedTx)).toBe(9);
  });

  it("signStxTransfer uses the API nonce when the tracker has nothing", async () => {
    const account = testAccount();
    const { signedTx } = await signStxTransfer(account, "ST000000000000000000002AMW42H", 1n, undefined, 1000n);
    expect(nonceOf(signedTx)).toBe(5);
  });

  it("signContractCall uses the same source", async () => {
    const account = testAccount();
    await recordNonceUsed(account.address, 8, "tx_8");
    const { signedTx } = await signContractCall(account, {
      contractAddress: "ST000000000000000000002AMW42H",
      contractName: "test",
      functionName: "f",
      functionArgs: [uintCV(1)],
      fee: 1000n,
    } as never);
    expect(nonceOf(signedTx)).toBe(9);
  });
});
