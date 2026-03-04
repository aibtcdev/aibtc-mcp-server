import { describe, it, expect } from "vitest";
import { deriveBitcoinAddress, deriveBitcoinKeyPair, deriveNostrKeyPair } from "../../src/utils/bitcoin.js";
import { hex } from "@scure/base";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hashSha256Sync } from "@stacks/encryption";

describe("bitcoin", () => {
  describe("deriveBitcoinAddress", () => {
    // BIP84 test vector from https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki
    // Mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
    const TEST_MNEMONIC =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    it("should derive mainnet address with bc1q prefix", () => {
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");

      expect(result.address).toBeDefined();
      expect(result.address).toMatch(/^bc1q[a-z0-9]{38,58}$/);
    });

    it("should derive testnet address with tb1q prefix", () => {
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "testnet");

      expect(result.address).toBeDefined();
      expect(result.address).toMatch(/^tb1q[a-z0-9]{38,58}$/);
    });

    it("should return compressed public key as hex string", () => {
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");

      expect(result.publicKey).toBeDefined();
      expect(typeof result.publicKey).toBe("string");
      // Compressed public key is 33 bytes (66 hex chars)
      expect(result.publicKey).toMatch(/^(02|03)[0-9a-f]{64}$/);
    });

    it("should derive correct address for BIP84 test vector", () => {
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");

      // From BIP84 test vector:
      // Path: m/84'/0'/0'/0/0
      // Expected address: bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu
      expect(result.address).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
    });

    it("should derive consistent addresses for same mnemonic", () => {
      const result1 = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");
      const result2 = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");

      expect(result1.address).toBe(result2.address);
      expect(result1.publicKey).toBe(result2.publicKey);
    });

    it("should derive different addresses for mainnet vs testnet", () => {
      const mainnet = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");
      const testnet = deriveBitcoinAddress(TEST_MNEMONIC, "testnet");

      expect(mainnet.address).not.toBe(testnet.address);
      expect(mainnet.address).toMatch(/^bc1q/);
      expect(testnet.address).toMatch(/^tb1q/);
    });

    it("should never expose private key in result", () => {
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");

      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("publicKey");
      expect(result).not.toHaveProperty("privateKey");
      expect(result).not.toHaveProperty("secretKey");
      expect(result).not.toHaveProperty("seed");

      // Ensure result only contains expected keys
      const keys = Object.keys(result);
      expect(keys).toEqual(["address", "publicKey"]);
    });

    it("should handle 24-word mnemonic", () => {
      const mnemonic24 =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

      const result = deriveBitcoinAddress(mnemonic24, "mainnet");

      expect(result.address).toBeDefined();
      expect(result.address).toMatch(/^bc1q/);
      expect(result.publicKey).toBeDefined();
    });

    it("should derive correct mainnet address format (P2WPKH)", () => {
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");

      // Native SegWit (P2WPKH) mainnet addresses:
      // - Start with bc1q
      // - Are 42 characters long (for most addresses)
      expect(result.address).toMatch(/^bc1q/);
      expect(result.address.length).toBeGreaterThanOrEqual(42);
      expect(result.address.length).toBeLessThanOrEqual(62);
    });

    it("should derive correct testnet address format (P2WPKH)", () => {
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "testnet");

      // Native SegWit (P2WPKH) testnet addresses:
      // - Start with tb1q
      // - Are 42 characters long (for most addresses)
      expect(result.address).toMatch(/^tb1q/);
      expect(result.address.length).toBeGreaterThanOrEqual(42);
      expect(result.address.length).toBeLessThanOrEqual(62);
    });

    it("should use coin type 0 for mainnet (Bitcoin standard)", () => {
      // This test verifies we're using coin type 0 (Bitcoin) not 5757 (Stacks)
      // By checking against the known BIP84 test vector which uses coin type 0
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");

      // This exact address proves we're using m/84'/0'/0'/0/0 (coin type 0)
      expect(result.address).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
    });

    it("should use coin type 1 for testnet (Bitcoin testnet standard)", () => {
      // Testnet uses coin type 1 per BIP44/BIP84 standards
      const result = deriveBitcoinAddress(TEST_MNEMONIC, "testnet");

      // Different from mainnet (which uses coin type 0)
      expect(result.address).not.toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
      expect(result.address).toMatch(/^tb1q/);
    });
  });

  describe("deriveBitcoinKeyPair", () => {
    // BIP84 test vector from https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki
    const TEST_MNEMONIC =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    it("should return private key as Uint8Array", () => {
      const result = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      expect(result.privateKey).toBeInstanceOf(Uint8Array);
    });

    it("should return private key of correct length (32 bytes)", () => {
      const result = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      // Private key must be 32 bytes (256 bits)
      expect(result.privateKey.length).toBe(32);
    });

    it("should return same address as deriveBitcoinAddress", () => {
      const addressResult = deriveBitcoinAddress(TEST_MNEMONIC, "mainnet");
      const keyPairResult = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      expect(keyPairResult.address).toBe(addressResult.address);
      expect(keyPairResult.publicKey).toBe(addressResult.publicKey);
    });

    it("should derive correct address for BIP84 test vector", () => {
      const result = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      // From BIP84 test vector: m/84'/0'/0'/0/0
      expect(result.address).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
    });

    it("should derive deterministic keys for same mnemonic", () => {
      const result1 = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");
      const result2 = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      expect(result1.address).toBe(result2.address);
      expect(result1.publicKey).toBe(result2.publicKey);

      // Compare private keys byte-by-byte
      expect(result1.privateKey.length).toBe(result2.privateKey.length);
      for (let i = 0; i < result1.privateKey.length; i++) {
        expect(result1.privateKey[i]).toBe(result2.privateKey[i]);
      }
    });

    it("should derive different keys for mainnet vs testnet", () => {
      const mainnet = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");
      const testnet = deriveBitcoinKeyPair(TEST_MNEMONIC, "testnet");

      // Addresses should be different
      expect(mainnet.address).not.toBe(testnet.address);
      expect(mainnet.address).toMatch(/^bc1q/);
      expect(testnet.address).toMatch(/^tb1q/);

      // Private keys should be different (different derivation paths)
      let keysAreDifferent = false;
      for (let i = 0; i < mainnet.privateKey.length; i++) {
        if (mainnet.privateKey[i] !== testnet.privateKey[i]) {
          keysAreDifferent = true;
          break;
        }
      }
      expect(keysAreDifferent).toBe(true);
    });

    it("should return all expected properties", () => {
      const result = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("publicKey");
      expect(result).toHaveProperty("privateKey");

      // Verify types
      expect(typeof result.address).toBe("string");
      expect(typeof result.publicKey).toBe("string");
      expect(result.privateKey).toBeInstanceOf(Uint8Array);
    });

    it("should handle 24-word mnemonic", () => {
      const mnemonic24 =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

      const result = deriveBitcoinKeyPair(mnemonic24, "mainnet");

      expect(result.address).toBeDefined();
      expect(result.address).toMatch(/^bc1q/);
      expect(result.publicKey).toBeDefined();
      expect(result.privateKey).toBeInstanceOf(Uint8Array);
      expect(result.privateKey.length).toBe(32);
    });

    it("private key bytes should not be all zeros", () => {
      const result = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      const allZeros = result.privateKey.every((byte) => byte === 0);
      expect(allZeros).toBe(false);
    });

    it("private key bytes should not be all same value", () => {
      const result = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      const firstByte = result.privateKey[0];
      const allSame = result.privateKey.every((byte) => byte === firstByte);
      expect(allSame).toBe(false);
    });
  });

  describe("deriveNostrKeyPair (NIP-06)", () => {
    // NIP-06 test vector #1
    // https://github.com/nostr-protocol/nips/blob/master/06.md
    const NIP06_MNEMONIC_1 =
      "leader monkey parrot ring guide accident before fence cannon height naive bean";
    const NIP06_EXPECTED_PRIVKEY_1 =
      "7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a";
    const NIP06_EXPECTED_PUBKEY_1 =
      "17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917";

    // NIP-06 test vector #2
    const NIP06_MNEMONIC_2 =
      "what bleak badge arrange retreat wolf trade produce cricket blur garlic valid proud rude strong choose busy staff weather area salt hollow arm fade";
    const NIP06_EXPECTED_PRIVKEY_2 =
      "c15d739894c81a2fcfd3a2df85a0d2c0dbc47a280d092799f144d73d7ae78add";
    const NIP06_EXPECTED_PUBKEY_2 =
      "d41b22899549e1f3d335a31002cfd382174006e166d3e658e3a5eecdb6463573";

    // Standard test mnemonic used elsewhere in this file
    const TEST_MNEMONIC =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    it("should match NIP-06 test vector #1 (private key)", () => {
      const result = deriveNostrKeyPair(NIP06_MNEMONIC_1, "mainnet");
      expect(hex.encode(result.privateKey)).toBe(NIP06_EXPECTED_PRIVKEY_1);
    });

    it("should match NIP-06 test vector #1 (public key)", () => {
      const result = deriveNostrKeyPair(NIP06_MNEMONIC_1, "mainnet");
      expect(hex.encode(result.publicKey)).toBe(NIP06_EXPECTED_PUBKEY_1);
    });

    it("should match NIP-06 test vector #2 (private key)", () => {
      const result = deriveNostrKeyPair(NIP06_MNEMONIC_2, "mainnet");
      expect(hex.encode(result.privateKey)).toBe(NIP06_EXPECTED_PRIVKEY_2);
    });

    it("should match NIP-06 test vector #2 (public key)", () => {
      const result = deriveNostrKeyPair(NIP06_MNEMONIC_2, "mainnet");
      expect(hex.encode(result.publicKey)).toBe(NIP06_EXPECTED_PUBKEY_2);
    });

    it("should return x-only public key (32 bytes)", () => {
      const result = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");

      expect(result.publicKey).toBeInstanceOf(Uint8Array);
      expect(result.publicKey.length).toBe(32);
    });

    it("should return private key as Uint8Array (32 bytes)", () => {
      const result = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");

      expect(result.privateKey).toBeInstanceOf(Uint8Array);
      expect(result.privateKey.length).toBe(32);
    });

    it("should return only publicKey and privateKey properties", () => {
      const result = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");
      const keys = Object.keys(result).sort();

      expect(keys).toEqual(["privateKey", "publicKey"]);
    });

    it("should derive same keys for mainnet and testnet (NIP-06 is network-independent)", () => {
      const mainnet = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");
      const testnet = deriveNostrKeyPair(TEST_MNEMONIC, "testnet");

      // NIP-06 uses coin type 1237 for both networks
      expect(hex.encode(mainnet.publicKey)).toBe(hex.encode(testnet.publicKey));
      expect(hex.encode(mainnet.privateKey)).toBe(hex.encode(testnet.privateKey));
    });

    it("should derive deterministic keys for same mnemonic", () => {
      const result1 = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");
      const result2 = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");

      expect(hex.encode(result1.publicKey)).toBe(hex.encode(result2.publicKey));
      expect(hex.encode(result1.privateKey)).toBe(hex.encode(result2.privateKey));
    });

    it("should derive different keys from different mnemonics", () => {
      const result1 = deriveNostrKeyPair(NIP06_MNEMONIC_1, "mainnet");
      const result2 = deriveNostrKeyPair(NIP06_MNEMONIC_2, "mainnet");

      expect(hex.encode(result1.publicKey)).not.toBe(hex.encode(result2.publicKey));
      expect(hex.encode(result1.privateKey)).not.toBe(hex.encode(result2.privateKey));
    });

    it("should derive keys different from BIP-84 SegWit keys", () => {
      const nostrResult = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");
      const btcResult = deriveBitcoinKeyPair(TEST_MNEMONIC, "mainnet");

      // Nostr uses m/44'/1237'/0'/0/0, SegWit uses m/84'/0'/0'/0/0
      expect(hex.encode(nostrResult.privateKey)).not.toBe(hex.encode(btcResult.privateKey));
    });

    it("private key bytes should not be all zeros", () => {
      const result = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");

      const allZeros = result.privateKey.every((byte) => byte === 0);
      expect(allZeros).toBe(false);
    });

    it("public key bytes should not be all zeros", () => {
      const result = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");

      const allZeros = result.publicKey.every((byte) => byte === 0);
      expect(allZeros).toBe(false);
    });

    it("public key should match schnorr.getPublicKey(privateKey)", () => {
      const result = deriveNostrKeyPair(TEST_MNEMONIC, "mainnet");

      // The x-only public key from NIP-06 derivation should equal the
      // Schnorr public key computed from the derived private key
      const computedPubKey = schnorr.getPublicKey(result.privateKey);
      expect(hex.encode(result.publicKey)).toBe(hex.encode(computedPubKey));
    });

    it("should produce a valid BIP-340 Schnorr signature", () => {
      const result = deriveNostrKeyPair(NIP06_MNEMONIC_1, "mainnet");

      // Sign an arbitrary message and verify
      const message = new TextEncoder().encode("NIP-06 test");
      const digest = hashSha256Sync(message);
      const sig = schnorr.sign(digest, result.privateKey);

      expect(sig.length).toBe(64);
      const isValid = schnorr.verify(sig, digest, result.publicKey);
      expect(isValid).toBe(true);
    });

    it("should handle 24-word mnemonic (NIP-06 test vector #2)", () => {
      // NIP-06 test vector #2 is a 24-word mnemonic
      const result = deriveNostrKeyPair(NIP06_MNEMONIC_2, "mainnet");

      expect(result.publicKey.length).toBe(32);
      expect(result.privateKey.length).toBe(32);
      expect(hex.encode(result.publicKey)).toBe(NIP06_EXPECTED_PUBKEY_2);
    });
  });
});
