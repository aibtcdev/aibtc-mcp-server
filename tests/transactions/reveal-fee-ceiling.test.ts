import { describe, it, expect } from "vitest";
import {
  buildCommitTransaction,
  buildRevealTransaction,
  type InscriptionData,
} from "../../src/transactions/inscription-builder.js";
import {
  buildChildCommitTransaction,
  buildChildRevealTransaction,
  computeMaxRevealFeeRate,
} from "../../src/transactions/child-inscription-builder.js";
import { deriveBitcoinKeyPair, deriveTaprootAddress } from "../../src/utils/bitcoin.js";
import type { UTXO } from "../../src/services/mempool-api.js";

// #759: the ceiling a commit reports must be the ceiling its reveal enforces,
// and both must match what the reveal builder actually accepts.
describe("computeMaxRevealFeeRate", () => {
  const MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const keyPair = deriveBitcoinKeyPair(MNEMONIC, "mainnet");
  const recipient = deriveTaprootAddress(MNEMONIC, "mainnet").address;
  const utxos: UTXO[] = [
    { txid: "0".repeat(64), vout: 0, value: 5_000_000, status: { confirmed: true, block_height: 800000 } },
  ];
  const inscription: InscriptionData = {
    contentType: "text/markdown;charset=utf-8",
    body: new TextEncoder().encode("# Story\n\n" + "news ".repeat(300)),
  };
  const parentInscriptionId = `${"b".repeat(64)}i0`;

  function plainCommit(feeRate: number) {
    return buildCommitTransaction({
      utxos,
      inscription,
      feeRate,
      senderPubKey: keyPair.publicKeyBytes,
      senderAddress: keyPair.address,
      network: "mainnet",
    });
  }

  function plainReveal(commit: ReturnType<typeof plainCommit>, feeRate: number) {
    return buildRevealTransaction({
      commitTxid: "a".repeat(64),
      commitVout: 0,
      commitAmount: commit.revealAmount,
      revealScript: commit.revealScript,
      recipientAddress: recipient,
      feeRate,
      network: "mainnet",
    });
  }

  function childCommit(feeRate: number) {
    return buildChildCommitTransaction({
      utxos,
      inscription,
      parentInscriptionId,
      feeRate,
      senderPubKey: keyPair.publicKeyBytes,
      senderAddress: keyPair.address,
      network: "mainnet",
    });
  }

  function childReveal(commit: ReturnType<typeof childCommit>, parentValue: number, feeRate: number) {
    return buildChildRevealTransaction({
      commitTxid: "a".repeat(64),
      commitVout: 0,
      commitAmount: commit.revealAmount,
      revealScript: commit.revealScript,
      parentUtxo: { txid: "b".repeat(64), vout: 0, value: parentValue },
      parentOwnerTaprootInternalPubKey: keyPair.publicKeyBytes.slice(1),
      recipientAddress: recipient,
      feeRate,
      network: "mainnet",
    });
  }

  it.each([1, 2, 3, 5, 10, 50])("is at least the commit rate (%i sat/vB)", (rate) => {
    const commit = plainCommit(rate);
    expect(computeMaxRevealFeeRate(commit.revealAmount, commit.revealScript)).toBeGreaterThanOrEqual(rate);
  });

  it("is exactly the highest rate the plain reveal builder accepts", () => {
    const commit = plainCommit(5);
    const ceiling = computeMaxRevealFeeRate(commit.revealAmount, commit.revealScript);
    expect(() => plainReveal(commit, ceiling)).not.toThrow();
    expect(() => plainReveal(commit, ceiling + 1)).toThrow(/below dust threshold/);
  });

  it("counts the parent UTXO and both dust outputs for a child reveal", () => {
    const commit = childCommit(5);
    for (const parentValue of [546, 10_000]) {
      const ceiling = computeMaxRevealFeeRate(commit.revealAmount, commit.revealScript, parentValue);
      expect(ceiling).toBeGreaterThanOrEqual(5);
      expect(() => childReveal(commit, parentValue, ceiling)).not.toThrow();
      expect(() => childReveal(commit, parentValue, ceiling + 1)).toThrow(/below dust threshold/);
    }
    // A larger parent funds a higher rate.
    expect(computeMaxRevealFeeRate(commit.revealAmount, commit.revealScript, 10_000)).toBeGreaterThan(
      computeMaxRevealFeeRate(commit.revealAmount, commit.revealScript, 546)
    );
  });
});
