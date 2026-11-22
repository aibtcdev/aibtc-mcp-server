import { describe, it, expect } from "vitest";
import { AuthType, makeContractDeploy, PayloadType, randomPrivateKey } from "@stacks/transactions";
import { makeUnversionedContractDeploy } from "../../src/transactions/builder.js";

// SIP-046 (Epoch 4.1) makes the VersionedSmartContract payload (0x06) invalid.
// https://github.com/stacksgov/sips/blob/main/sips/sip-046/sip-046-epoch-41.md
describe("contract deploy payload", () => {
  const base = {
    contractName: "probe",
    codeBody: "(define-read-only (f) u1)",
    senderKey: randomPrivateKey(),
    network: "mainnet" as const,
    nonce: 0n,
    fee: 1000n,
  };

  it("stacks.js default is a versioned deploy (the case this guards against)", async () => {
    const tx = await makeContractDeploy(base);
    expect(tx.payload.payloadType).toBe(PayloadType.VersionedSmartContract);
  });

  it("makeUnversionedContractDeploy emits the plain SmartContract payload", async () => {
    const tx = await makeUnversionedContractDeploy(base);
    expect(tx.payload.payloadType).toBe(PayloadType.SmartContract);
  });

  it("keeps sponsorship and the other options", async () => {
    const tx = await makeUnversionedContractDeploy({ ...base, sponsored: true, fee: 0n });
    expect(tx.payload.payloadType).toBe(PayloadType.SmartContract);
    expect(tx.auth.authType).toBe(AuthType.Sponsored);
  });
});
