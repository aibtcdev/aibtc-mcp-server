import { describe, it, expect } from "vitest";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import {
  estimateTxSize,
  buildBtcTransaction,
  signBtcTransaction,
  buildAndSignBtcTransaction,
  type BuildBtcTransactionOptions,
} from "../../src/transactions/bitcoin-builder.js";
import type { UTXO } from "../../src/services/mempool-api.js";
import { deriveBitcoinKeyPair } from "../../src/utils/bitcoin.js";

describe("bitcoin-builder", () => {
  // Test mnemonic from BIP84 test vectors
  const TEST_MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  // Derive key pair for testing
  const testKeyPair = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");
  const testPubKey = hex.decode(testKeyPair.publicKey);

  // Create mock confirmed UTXO
  const createMockUtxo = (
    txid: string,
    vout: number,
    value: number,
    confirmed = true
  ): UTXO => ({
    txid,
    vout,
    value,
    status: {
      confirmed,
      block_height: confirmed ? 800000 : undefined,
    },
  });

  describe("estimateTxSize", () => {
    it("should calculate size for 1 input, 1 output", () => {
      const vsize = estimateTxSize(1, 1);
      // overhead (10.5) + 1 input (68) + 1 output (31) = 109.5
      expect(vsize).toBeCloseTo(109.5, 1);
    });

    it("should calculate size for 1 input, 2 outputs", () => {
      const vsize = estimateTxSize(1, 2);
      // overhead (10.5) + 1 input (68) + 2 outputs (62) = 140.5
      expect(vsize).toBeCloseTo(140.5, 1);
    });

    it("should calculate size for 2 inputs, 2 outputs", () => {
      const vsize = estimateTxSize(2, 2);
      // overhead (10.5) + 2 inputs (136) + 2 outputs (62) = 208.5
      expect(vsize).toBeCloseTo(208.5, 1);
    });

    it("should calculate size for multiple inputs", () => {
      const vsize = estimateTxSize(5, 2);
      // overhead (10.5) + 5 inputs (340) + 2 outputs (62) = 412.5
      expect(vsize).toBeCloseTo(412.5, 1);
    });

    it("should throw error for 0 inputs", () => {
      expect(() => estimateTxSize(0, 2)).toThrow("at least 1 input");
    });

    it("should throw error for 0 outputs", () => {
      expect(() => estimateTxSize(1, 0)).toThrow("at least 1 output");
    });

    it("should throw error for negative inputs", () => {
      expect(() => estimateTxSize(-1, 2)).toThrow("at least 1 input");
    });

    it("should increase linearly with input count", () => {
      const size1 = estimateTxSize(1, 2);
      const size2 = estimateTxSize(2, 2);
      const size3 = estimateTxSize(3, 2);

      // Each additional input adds 68 vB
      expect(size2 - size1).toBe(68);
      expect(size3 - size2).toBe(68);
    });

    it("should increase linearly with output count", () => {
      const size1 = estimateTxSize(1, 1);
      const size2 = estimateTxSize(1, 2);
      const size3 = estimateTxSize(1, 3);

      // Each additional output adds 31 vB
      expect(size2 - size1).toBe(31);
      expect(size3 - size2).toBe(31);
    });
  });

  describe("buildBtcTransaction", () => {
    it("should build a transaction with single UTXO", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const result = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      expect(result.tx).toBeInstanceOf(btc.Transaction);
      expect(result.fee).toBeGreaterThan(0);
      expect(result.vsize).toBeGreaterThan(0);
      expect(result.inputUtxos).toHaveLength(1);
    });

    it("should include change output when above dust threshold", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const result = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 10000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      // Should have change since 100000 - 10000 - fee > dust_threshold
      expect(result.change).toBeGreaterThan(546);
    });

    it("should not include change output when below dust threshold", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          10000
        ),
      ];

      // With 10000 sats UTXO, 1 input 2 outputs = ~140.5 vB, at 10 sat/vB = ~1405 fee
      // Change = 10000 - amount - 1405
      // For change < 546 (dust), amount must be > 10000 - 1405 - 546 = 8049
      // With 1 input 1 output = ~109.5 vB, fee = ~1095
      // So amount ~8900 leaves change of ~5 which is below dust
      const result = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 8400, // Leaves ~500 sats change (below 546 dust threshold)
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      // Change should be 0 (no change output because it would be dust)
      expect(result.change).toBe(0);
    });

    it("should throw error for insufficient funds", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          1000
        ),
      ];

      expect(() =>
        buildBtcTransaction({
          utxos,
          recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
          amount: 50000,
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("Insufficient funds");
    });

    it("should throw error for amount below dust threshold", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      expect(() =>
        buildBtcTransaction({
          utxos,
          recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
          amount: 100, // Below 546 dust threshold
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("dust threshold");
    });

    it("should throw error for empty UTXOs", () => {
      expect(() =>
        buildBtcTransaction({
          utxos: [],
          recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
          amount: 50000,
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("No UTXOs provided");
    });

    it("should throw error for negative amount", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      expect(() =>
        buildBtcTransaction({
          utxos,
          recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
          amount: -1000,
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("Amount must be positive");
    });

    it("should throw error for negative fee rate", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      expect(() =>
        buildBtcTransaction({
          utxos,
          recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
          amount: 50000,
          feeRate: -10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("Fee rate must be positive");
    });

    it("should only use confirmed UTXOs", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          50000,
          false // unconfirmed
        ),
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000002",
          0,
          100000,
          true // confirmed
        ),
      ];

      const result = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      // Should only use the confirmed UTXO
      expect(result.inputUtxos).toHaveLength(1);
      expect(result.inputUtxos[0].txid).toBe(
        "0000000000000000000000000000000000000000000000000000000000000002"
      );
    });

    it("should throw error when only unconfirmed UTXOs available", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000,
          false
        ),
      ];

      expect(() =>
        buildBtcTransaction({
          utxos,
          recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
          amount: 50000,
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        })
      ).toThrow("No confirmed UTXOs available");
    });

    it("should build testnet transaction", () => {
      const testnetKeyPair = deriveBitcoinKeyPair(TEST_MNEMONIC, "testnet");
      const testnetPubKey = hex.decode(testnetKeyPair.publicKey);

      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const result = buildBtcTransaction({
        utxos,
        recipient: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testnetPubKey,
        senderAddress: testnetKeyPair.address,
        network: "testnet",
      });

      expect(result.tx).toBeInstanceOf(btc.Transaction);
      expect(result.fee).toBeGreaterThan(0);
    });

    it("should select multiple UTXOs when needed", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          30000
        ),
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000002",
          0,
          30000
        ),
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000003",
          0,
          30000
        ),
      ];

      const result = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      // Should use multiple UTXOs
      expect(result.inputUtxos.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("signBtcTransaction", () => {
    it("should sign a transaction and return hex", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const { tx } = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      const result = signBtcTransaction(tx, testKeyPair.privateKey);

      expect(result.txHex).toBeDefined();
      expect(typeof result.txHex).toBe("string");
      expect(result.txHex.length).toBeGreaterThan(0);
    });

    it("should return valid transaction ID", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const { tx } = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      const result = signBtcTransaction(tx, testKeyPair.privateKey);

      // Txid should be 64 hex characters
      expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should return vsize", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const { tx } = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      const result = signBtcTransaction(tx, testKeyPair.privateKey);

      expect(result.vsize).toBeGreaterThan(0);
    });

    it("should throw error for invalid private key length", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const { tx } = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      // Wrong length private key
      const invalidKey = new Uint8Array(16);
      expect(() => signBtcTransaction(tx, invalidKey)).toThrow(
        "Private key must be 32 bytes"
      );
    });

    it("should produce deterministic signatures for same input", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const options: BuildBtcTransactionOptions = {
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      };

      // Build and sign twice with same parameters
      const { tx: tx1 } = buildBtcTransaction(options);
      const result1 = signBtcTransaction(tx1, testKeyPair.privateKey);

      const { tx: tx2 } = buildBtcTransaction(options);
      const result2 = signBtcTransaction(tx2, testKeyPair.privateKey);

      // Same txid (deterministic)
      expect(result1.txid).toBe(result2.txid);
    });
  });

  describe("buildAndSignBtcTransaction", () => {
    it("should build and sign in one step", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const result = buildAndSignBtcTransaction(
        {
          utxos,
          recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
          amount: 50000,
          feeRate: 10,
          senderPubKey: testPubKey,
          senderAddress: testKeyPair.address,
          network: "mainnet",
        },
        testKeyPair.privateKey
      );

      expect(result.txHex).toBeDefined();
      expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
      expect(result.fee).toBeGreaterThan(0);
      expect(result.change).toBeGreaterThanOrEqual(0);
    });

    it("should return consistent results with separate build/sign", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const options: BuildBtcTransactionOptions = {
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 50000,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      };

      // Combined approach
      const combined = buildAndSignBtcTransaction(options, testKeyPair.privateKey);

      // Separate approach
      const { tx, fee, change } = buildBtcTransaction(options);
      const separate = signBtcTransaction(tx, testKeyPair.privateKey);

      // Should produce same results
      expect(combined.txid).toBe(separate.txid);
      expect(combined.fee).toBe(fee);
      expect(combined.change).toBe(change);
    });
  });

  describe("buildBtcTransaction fee reporting", () => {
    // Sum of a built transaction's outputs, in sats.
    const outputTotal = (tx: btc.Transaction): bigint => {
      let total = 0n;
      for (let i = 0; i < tx.outputsLength; i++) {
        total += tx.getOutput(i).amount ?? 0n;
      }
      return total;
    };

    it("reports the fee actually paid when change is dust (no change output)", () => {
      // Same fixture as the existing below-dust test:
      // changeAmount = 10000 - 8400 - ceil(140.5 * 10) = 195 < 546.
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          10000
        ),
      ];

      const result = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 8400,
        feeRate: 10,
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      expect(result.change).toBe(0);
      expect(result.tx.outputsLength).toBe(1);
      // The fee paid is whatever the inputs leave behind: 10000 - 8400 = 1600.
      // Reporting the one-output estimate instead would give ceil(109.5 * 10) = 1095.
      const actualFee = 10000n - outputTotal(result.tx);
      expect(BigInt(result.fee)).toBe(actualFee);
    });

    it("reports the fee actually paid when change is above dust", () => {
      const utxos: UTXO[] = [
        createMockUtxo(
          "0000000000000000000000000000000000000000000000000000000000000001",
          0,
          100000
        ),
      ];

      const result = buildBtcTransaction({
        utxos,
        recipient: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: 98200,
        feeRate: 1, // change = 100000 - 98200 - ceil(140.5) = 1659 > 546
        senderPubKey: testPubKey,
        senderAddress: testKeyPair.address,
        network: "mainnet",
      });

      expect(result.change).toBeGreaterThan(546);
      const actualFee = 100000n - outputTotal(result.tx);
      expect(BigInt(result.fee)).toBe(actualFee);
    });
  });
});
