import { describe, it, expect } from "vitest";
import * as btc from "@scure/btc-signer";
import {
  deriveRevealScript,
  buildCommitTransaction,
  buildRevealTransaction,
  type InscriptionData,
} from "../../src/transactions/inscription-builder.js";
import {
  deriveBitcoinKeyPair,
  deriveTaprootAddress,
} from "../../src/utils/bitcoin.js";
import type { UTXO } from "../../src/services/mempool-api.js";

describe("inscription-builder", () => {
  const TEST_MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  const testKeyPair = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");
  const testPubKey = testKeyPair.publicKeyBytes;
  const testTaprootAddress = deriveTaprootAddress(TEST_MNEMONIC, "mainnet").address;

  const MOCK_TXID = "0".repeat(64);

  const TEST_INSCRIPTION: InscriptionData = {
    contentType: "text/plain",
    body: new TextEncoder().encode("Hello, Ordinals!"),
  };

  function createMockUtxo(
    txid: string,
    vout: number,
    value: number,
    confirmed = true
  ): UTXO {
    return {
      txid,
      vout,
      value,
      status: {
        confirmed,
        block_height: confirmed ? 800000 : undefined,
      },
    };
  }

  function buildTestCommit(value = 500000) {
    return buildCommitTransaction({
      utxos: [createMockUtxo(MOCK_TXID, 0, value)],
      inscription: TEST_INSCRIPTION,
      feeRate: 10,
      senderPubKey: testPubKey,
      senderAddress: testKeyPair.address,
      network: "mainnet",
    });
  }

  function buildTestReveal(commitResult: ReturnType<typeof buildTestCommit>, txid = "a".repeat(64)) {
    return buildRevealTransaction({
      commitTxid: txid,
      commitVout: 0,
      commitAmount: commitResult.revealAmount,
      revealScript: commitResult.revealScript,
      recipientAddress: testTaprootAddress,
      feeRate: 10,
      network: "mainnet",
      contentSize: TEST_INSCRIPTION.body.length,
    });
  }

  describe("deriveRevealScript", () => {
    it("should return P2TR output with address, script, and tapLeafScript", () => {
      const result = deriveRevealScript({
        inscription: TEST_INSCRIPTION,
        senderPubKey: testPubKey,
        network: "mainnet",
      });

      expect(result.address).toMatch(/^bc1p/);
      expect(result.script).toBeInstanceOf(Uint8Array);
      expect(result.script!.byteLength).toBeGreaterThan(0);
      expect(result.tapLeafScript).toBeDefined();
      expect(result.tapLeafScript!.length).toBeGreaterThan(0);
    });

    it("should be deterministic for the same inputs", () => {
      const options = {
        inscription: TEST_INSCRIPTION,
        senderPubKey: testPubKey,
        network: "mainnet" as const,
      };

      const result1 = deriveRevealScript(options);
      const result2 = deriveRevealScript(options);

      expect(result1.address).toBe(result2.address);
    });

    it("should produce different address for different inscription content", () => {
      const result1 = deriveRevealScript({
        inscription: TEST_INSCRIPTION,
        senderPubKey: testPubKey,
        network: "mainnet",
      });

      const result2 = deriveRevealScript({
        inscription: {
          contentType: "text/plain",
          body: new TextEncoder().encode("Different content"),
        },
        senderPubKey: testPubKey,
        network: "mainnet",
      });

      expect(result1.address).not.toBe(result2.address);
    });

    it("should produce different address for different content types", () => {
      const result1 = deriveRevealScript({
        inscription: TEST_INSCRIPTION,
        senderPubKey: testPubKey,
        network: "mainnet",
      });

      const result2 = deriveRevealScript({
        inscription: {
          contentType: "application/json",
          body: TEST_INSCRIPTION.body,
        },
        senderPubKey: testPubKey,
        network: "mainnet",
      });

      expect(result1.address).not.toBe(result2.address);
    });

    it("should produce testnet address starting with tb1p for testnet network", () => {
      const testnetKeyPair = deriveBitcoinKeyPair(TEST_MNEMONIC, "testnet");

      const result = deriveRevealScript({
        inscription: TEST_INSCRIPTION,
        senderPubKey: testnetKeyPair.publicKeyBytes,
        network: "testnet",
      });

      expect(result.address).toMatch(/^tb1p/);
    });

    it("should produce different addresses for mainnet vs testnet", () => {
      const mainnetResult = deriveRevealScript({
        inscription: TEST_INSCRIPTION,
        senderPubKey: testPubKey,
        network: "mainnet",
      });

      const testnetKeyPair = deriveBitcoinKeyPair(TEST_MNEMONIC, "testnet");
      const testnetResult = deriveRevealScript({
        inscription: TEST_INSCRIPTION,
        senderPubKey: testnetKeyPair.publicKeyBytes,
        network: "testnet",
      });

      expect(mainnetResult.address).not.toBe(testnetResult.address);
    });
  });

  describe("buildRevealTransaction", () => {
    it("should produce a transaction that can be signed and finalized without throwing", () => {
      // Regression test for the tapLeafScript fix.
      // Before the fix, finalize() threw "No inputs signed" because tapLeafScript
      // was spread (...revealScript.tapLeafScript) instead of assigned directly.
      const commitResult = buildTestCommit();
      const revealResult = buildTestReveal(commitResult);

      expect(revealResult.tx).toBeInstanceOf(btc.Transaction);

      revealResult.tx.sign(testKeyPair.privateKey);
      expect(() => revealResult.tx.finalize()).not.toThrow();
    });

    it("should produce correct fee and output amount that sum to commit amount", () => {
      const commitResult = buildTestCommit();
      const revealResult = buildTestReveal(commitResult);

      expect(revealResult.fee).toBeGreaterThan(0);
      expect(revealResult.outputAmount).toBeGreaterThan(0);
      expect(revealResult.outputAmount + revealResult.fee).toBe(commitResult.revealAmount);
    });

    it("should throw for invalid commit txid (too short)", () => {
      const commitResult = buildTestCommit();

      expect(() =>
        buildRevealTransaction({
          commitTxid: "tooshort",
          commitVout: 0,
          commitAmount: commitResult.revealAmount,
          revealScript: commitResult.revealScript,
          recipientAddress: testTaprootAddress,
          feeRate: 10,
          network: "mainnet",
          contentSize: TEST_INSCRIPTION.body.length,
        })
      ).toThrow("Invalid commit transaction ID");
    });

    it("should throw for negative fee rate", () => {
      const commitResult = buildTestCommit();

      expect(() =>
        buildRevealTransaction({
          commitTxid: "d".repeat(64),
          commitVout: 0,
          commitAmount: commitResult.revealAmount,
          revealScript: commitResult.revealScript,
          recipientAddress: testTaprootAddress,
          feeRate: -5,
          network: "mainnet",
          contentSize: TEST_INSCRIPTION.body.length,
        })
      ).toThrow("Fee rate must be positive");
    });

    it("should throw when commit amount is too small to cover fee and dust", () => {
      const commitResult = buildTestCommit();

      expect(() =>
        buildRevealTransaction({
          commitTxid: "e".repeat(64),
          commitVout: 0,
          commitAmount: 600,
          revealScript: commitResult.revealScript,
          recipientAddress: testTaprootAddress,
          feeRate: 10,
          network: "mainnet",
          contentSize: TEST_INSCRIPTION.body.length,
        })
      ).toThrow("dust threshold");
    });
  });

  describe("buildCommitTransaction", () => {
    it("should return valid commit result with tapLeafScript, reveal address, and transaction", () => {
      const result = buildTestCommit();

      expect(result.tx).toBeInstanceOf(btc.Transaction);
      expect(result.fee).toBeGreaterThan(0);
      expect(result.revealAmount).toBeGreaterThan(0);
      expect(result.revealAddress).toMatch(/^bc1p/);
      expect(result.revealScript.tapLeafScript).toBeDefined();
      expect(Array.isArray(result.revealScript.tapLeafScript)).toBe(true);
      expect(result.revealScript.tapLeafScript!.length).toBeGreaterThan(0);
    });

    it("should throw for empty UTXOs", () => {
      expect(() =>
        buildCommitTransaction({
          utxos: [],
          inscription: TEST_INSCRIPTION,
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("No UTXOs provided");
    });

    it("should throw for invalid pubkey length (not 33 bytes)", () => {
      expect(() =>
        buildCommitTransaction({
          utxos: [createMockUtxo(MOCK_TXID, 0, 500000)],
          inscription: TEST_INSCRIPTION,
          feeRate: 10,
          senderPubKey: new Uint8Array(16),
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("Sender public key must be 33 bytes");
    });

    it("should throw for no confirmed UTXOs", () => {
      expect(() =>
        buildCommitTransaction({
          utxos: [createMockUtxo(MOCK_TXID, 0, 500000, false)],
          inscription: TEST_INSCRIPTION,
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("No confirmed UTXOs available");
    });
  });

  describe("commit-reveal round trip", () => {
    it("should complete the full commit-reveal flow with signing and finalization", () => {
      const commitResult = buildTestCommit();

      expect(commitResult.revealAddress).toMatch(/^bc1p/);
      expect(commitResult.revealAmount).toBeGreaterThan(0);
      expect(commitResult.fee).toBeGreaterThan(0);

      commitResult.tx.sign(testKeyPair.privateKey);
      expect(() => commitResult.tx.finalize()).not.toThrow();

      const revealResult = buildTestReveal(commitResult);

      expect(revealResult.outputAmount).toBeGreaterThan(0);
      expect(revealResult.fee).toBeGreaterThan(0);

      // tapLeafScript must be correctly set for signing to work
      revealResult.tx.sign(testKeyPair.privateKey);
      expect(() => revealResult.tx.finalize()).not.toThrow();
    });

    it("should derive the same reveal address in commit and standalone deriveRevealScript", () => {
      const commitResult = buildTestCommit();

      const standaloneScript = deriveRevealScript({
        inscription: TEST_INSCRIPTION,
        senderPubKey: testPubKey,
        network: "mainnet",
      });

      expect(commitResult.revealAddress).toBe(standaloneScript.address);
    });
  });
});
