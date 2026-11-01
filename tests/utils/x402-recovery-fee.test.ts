import { describe, expect, it } from "vitest";
import { makeSTXTokenTransfer } from "@stacks/transactions";
import { extractFeeFromPaymentSignature } from "../../src/utils/x402-recovery.js";
import { encodePaymentPayload } from "../../src/utils/x402-protocol.js";

// Throwaway key: deterministic, never funded.
const SENDER_KEY = "edf9aee84d9b7abc145504dde6726c64f369d37ee34ded868fabd876c26570bc01";
const RECIPIENT = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

async function header(sponsored: boolean): Promise<string> {
  const tx = await makeSTXTokenTransfer({
    recipient: RECIPIENT,
    amount: 1n,
    senderKey: SENDER_KEY,
    network: "mainnet",
    nonce: 0n,
    fee: sponsored ? 0n : 3000n,
    sponsored,
  });
  return encodePaymentPayload({
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "stacks:1",
      amount: "1",
      asset: "STX",
      payTo: RECIPIENT,
      maxTimeoutSeconds: 300,
    },
    payload: { transaction: tx.serialize() },
  });
}

describe("extractFeeFromPaymentSignature", () => {
  it("reports a sponsored payment with fee 0", async () => {
    expect(extractFeeFromPaymentSignature(await header(true))).toEqual({ sponsored: true, feeUstx: "0" });
  });

  it("reports a self-paid payment with its own fee", async () => {
    expect(extractFeeFromPaymentSignature(await header(false))).toEqual({ sponsored: false, feeUstx: "3000" });
  });

  it("returns null for a header that is not a payment payload", () => {
    expect(extractFeeFromPaymentSignature("not-base64-json")).toBeNull();
  });
});
