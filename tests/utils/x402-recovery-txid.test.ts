import { describe, expect, it } from "vitest";
import { makeSTXTokenTransfer } from "@stacks/transactions";
import { extractTxidFromPaymentSignature } from "../../src/utils/x402-recovery.js";
import { encodePaymentPayload } from "../../src/utils/x402-protocol.js";

// Throwaway key: deterministic, never funded.
const SENDER_KEY = "edf9aee84d9b7abc145504dde6726c64f369d37ee34ded868fabd876c26570bc01";
const RECIPIENT = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

async function signed(sponsored: boolean) {
  const tx = await makeSTXTokenTransfer({
    recipient: RECIPIENT,
    amount: 1n,
    senderKey: SENDER_KEY,
    network: "mainnet",
    nonce: 0n,
    fee: sponsored ? 0n : 3000n,
    sponsored,
  });
  const header = encodePaymentPayload({
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
  return { tx, header };
}

describe("extractTxidFromPaymentSignature", () => {
  it("returns the txid of a self-paid payment", async () => {
    const { tx, header } = await signed(false);
    expect(extractTxidFromPaymentSignature(header)).toBe(tx.txid());
  });

  it("returns null for a sponsored payment, whose txid the relay assigns when it sponsors", async () => {
    const { header } = await signed(true);
    expect(extractTxidFromPaymentSignature(header)).toBeNull();
  });
});
