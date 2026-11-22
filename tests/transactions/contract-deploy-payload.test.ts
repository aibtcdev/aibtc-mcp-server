import { describe, it, expect } from "vitest";
import { AuthType, makeContractDeploy, PayloadType, randomPrivateKey } from "@stacks/transactions";
import { makeContractDeployForEpoch } from "../../src/transactions/contract-deploy.js";

describe("contract deploy payload", () => {
  const base = {
    contractName: "probe",
    codeBody: "(define-read-only (f) u1)",
    senderKey: randomPrivateKey(),
    network: "mainnet" as const,
    nonce: 0n,
    fee: 1000n,
  };

  it("stacks.js default is a versioned deploy", async () => {
    const tx = await makeContractDeploy(base);
    expect(tx.payload.payloadType).toBe(PayloadType.VersionedSmartContract);
  });

  it("emits the plain SmartContract payload", async () => {
    const tx = await makeContractDeployForEpoch(base);
    expect(tx.payload.payloadType).toBe(PayloadType.SmartContract);
  });

  it("keeps sponsored auth", async () => {
    const tx = await makeContractDeployForEpoch({ ...base, sponsored: true, fee: 0n });
    expect(tx.payload.payloadType).toBe(PayloadType.SmartContract);
    expect(tx.auth.authType).toBe(AuthType.Sponsored);
  });
});
