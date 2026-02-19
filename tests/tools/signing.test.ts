/**
 * Tests for Stacks message signing (SIWS-compatible)
 *
 * These tests verify round-trip sign/verify functionality for plain text messages
 * using the Stacks message signing format compatible with SIWS (Sign In With Stacks).
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  signMessageHashRsv,
  publicKeyFromSignatureRsv,
  getAddressFromPublicKey,
} from "@stacks/transactions";
import { hashMessage, verifyMessageSignatureRsv, hashSha256Sync } from "@stacks/encryption";
import { bytesToHex, hexToBytes } from "@stacks/common";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hex } from "@scure/base";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import { STACKS_TESTNET } from "@stacks/network";

// Test mnemonic (DO NOT use in production)
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("Stacks Message Signing (SIWS-compatible)", () => {
  // Set up test wallet
  let privateKey: string;
  let publicKey: string;
  let address: string;

  beforeAll(async () => {
    const wallet = await generateWallet({
      secretKey: TEST_MNEMONIC,
      password: "",
    });
    const account = wallet.accounts[0];
    privateKey = account.stxPrivateKey;
    address = getStxAddress({
      account,
      transactionVersion: STACKS_TESTNET.transactionVersion,
    });

    // Get public key by signing and recovering
    const testHash = bytesToHex(hashMessage("test"));
    const testSig = signMessageHashRsv({
      messageHash: testHash,
      privateKey,
    });
    publicKey = publicKeyFromSignatureRsv(testHash, testSig);
  });

  describe("Message prefix format", () => {
    it("should use correct SIWS prefix format", () => {
      const prefix = "\x17Stacks Signed Message:\n";
      expect(prefix.length).toBe(24); // 0x17 = 23 for the text + newline
      expect(prefix.charCodeAt(0)).toBe(0x17); // First byte is length indicator
      expect(prefix.substring(1)).toBe("Stacks Signed Message:\n");
    });

    it("should hash message with prefix", () => {
      const message = "Hello, Stacks!";
      const hash = hashMessage(message);

      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32); // SHA-256 output
    });
  });

  describe("Sign and verify round-trip", () => {
    it("should sign and verify a simple message", () => {
      const message = "Hello, Stacks!";
      const messageHash = bytesToHex(hashMessage(message));

      // Sign
      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      expect(signature).toMatch(/^[0-9a-f]{130}$/i); // 65 bytes = 130 hex chars

      // Verify using verifyMessageSignatureRsv
      const isValid = verifyMessageSignatureRsv({
        signature,
        message,
        publicKey,
      });

      expect(isValid).toBe(true);
    });

    it("should recover correct address from signature", () => {
      const message = "Prove address ownership";
      const messageHash = bytesToHex(hashMessage(message));

      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      // Recover public key and derive address (mainnet to match default getAddressFromPublicKey)
      const recoveredPubKey = publicKeyFromSignatureRsv(messageHash, signature);
      const recoveredAddress = getAddressFromPublicKey(recoveredPubKey, "mainnet");

      // Get mainnet address for comparison
      const mainnetAddress = getAddressFromPublicKey(publicKey, "mainnet");
      expect(recoveredAddress).toBe(mainnetAddress);
    });

    it("should fail verification with wrong message", () => {
      const originalMessage = "Original message";
      const wrongMessage = "Wrong message";
      const messageHash = bytesToHex(hashMessage(originalMessage));

      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      // Try to verify with wrong message
      const isValid = verifyMessageSignatureRsv({
        signature,
        message: wrongMessage,
        publicKey,
      });

      expect(isValid).toBe(false);
    });

    it("should fail verification with wrong public key", async () => {
      const message = "Test message";
      const messageHash = bytesToHex(hashMessage(message));

      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      // Generate a different wallet for a different public key
      const differentWallet = await generateWallet({
        secretKey:
          "legal winner thank year wave sausage worth useful legal winner thank yellow",
        password: "",
      });
      const differentAccount = differentWallet.accounts[0];
      const differentPrivateKey = differentAccount.stxPrivateKey;

      // Get different public key
      const differentHash = bytesToHex(hashMessage("different"));
      const differentSig = signMessageHashRsv({
        messageHash: differentHash,
        privateKey: differentPrivateKey,
      });
      const differentPubKey = publicKeyFromSignatureRsv(differentHash, differentSig);

      // Try to verify with different public key
      const isValid = verifyMessageSignatureRsv({
        signature,
        message,
        publicKey: differentPubKey,
      });

      expect(isValid).toBe(false);
    });
  });

  describe("Unicode and special characters", () => {
    it("should handle unicode messages", () => {
      const message = "Hello \u{1F600} World!"; // Emoji
      const messageHash = bytesToHex(hashMessage(message));

      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      const isValid = verifyMessageSignatureRsv({
        signature,
        message,
        publicKey,
      });

      expect(isValid).toBe(true);
    });

    it("should handle multi-line messages", () => {
      const message = "Line 1\nLine 2\nLine 3";
      const messageHash = bytesToHex(hashMessage(message));

      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      const isValid = verifyMessageSignatureRsv({
        signature,
        message,
        publicKey,
      });

      expect(isValid).toBe(true);
    });

    it("should handle empty message", () => {
      const message = "";
      const messageHash = bytesToHex(hashMessage(message));

      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      const isValid = verifyMessageSignatureRsv({
        signature,
        message,
        publicKey,
      });

      expect(isValid).toBe(true);
    });
  });

  describe("SIWS format compatibility", () => {
    it("should handle SIWS-style message format", () => {
      // Example SIWS message format
      const siwsMessage = `example.com wants you to sign in with your Stacks account:
${address}

Sign in to Example App

URI: https://example.com
Version: 1
Chain ID: 2147483648
Nonce: abc123def456
Issued At: 2025-01-06T12:00:00.000Z`;

      const messageHash = bytesToHex(hashMessage(siwsMessage));

      const signature = signMessageHashRsv({
        messageHash,
        privateKey,
      });

      const isValid = verifyMessageSignatureRsv({
        signature,
        message: siwsMessage,
        publicKey,
      });

      expect(isValid).toBe(true);

      // Recover signer address (using mainnet for consistency)
      const recoveredPubKey = publicKeyFromSignatureRsv(messageHash, signature);
      const recoveredAddress = getAddressFromPublicKey(recoveredPubKey, "mainnet");

      // Get mainnet address for comparison
      const mainnetAddress = getAddressFromPublicKey(publicKey, "mainnet");
      expect(recoveredAddress).toBe(mainnetAddress);
    });
  });
});

/**
 * Fixture-based tests for hash functions
 *
 * These tests lock in expected hash values to prevent regressions when
 * changing hash implementations (e.g., @noble/hashes → @stacks/encryption).
 */
describe("Hash Function Fixtures", () => {
  // hashSha256Sync, bytesToHex, and hexToBytes are imported at the top of the file

  describe("SHA-256 (hashSha256Sync)", () => {
    it("should produce correct hash for empty input", () => {
      const input = new Uint8Array(0);
      const hash = hashSha256Sync(input);
      const expected =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      expect(bytesToHex(hash)).toBe(expected);
    });

    it("should produce correct hash for 'hello'", () => {
      const input = new TextEncoder().encode("hello");
      const hash = hashSha256Sync(input);
      const expected =
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
      expect(bytesToHex(hash)).toBe(expected);
    });

    it("should produce correct hash for known hex input", () => {
      // SHA256 of 0x0102030405
      const input = hexToBytes("0102030405");
      const hash = hashSha256Sync(input);
      const expected =
        "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0";
      expect(bytesToHex(hash)).toBe(expected);
    });
  });

  describe("Double SHA-256 (Bitcoin standard)", () => {
    // doubleSha256 implementation using hashSha256Sync
    function doubleSha256(data: Uint8Array): Uint8Array {
      return hashSha256Sync(hashSha256Sync(data));
    }

    it("should produce correct double hash for empty input", () => {
      const input = new Uint8Array(0);
      const hash = doubleSha256(input);
      // SHA256(SHA256("")) = SHA256(e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
      const expected =
        "5df6e0e2761359d30a8275058e299fcc0381534545f55cf43e41983f5d4c9456";
      expect(bytesToHex(hash)).toBe(expected);
    });

    it("should produce correct double hash for 'hello'", () => {
      const input = new TextEncoder().encode("hello");
      const hash = doubleSha256(input);
      const expected =
        "9595c9df90075148eb06860365df33584b75bff782a510c6cd4883a419833d50";
      expect(bytesToHex(hash)).toBe(expected);
    });
  });

  describe("Stacks message hash (SIWS prefix)", () => {
    it("should produce consistent hash for known message", () => {
      const message = "Hello, Stacks!";
      const hash = hashMessage(message);

      // This fixture ensures hashMessage (which uses the SIWS prefix) is stable
      // Format: SHA256("\x17Stacks Signed Message:\n" + message)
      expect(hash.length).toBe(32);

      // Lock in the expected hash for "Hello, Stacks!"
      // SHA256("\x17Stacks Signed Message:\n" + "Hello, Stacks!")
      const expected =
        "040e43757933d6df896cc8956d70699e6163af7b75bfdb6ae8c098023abc0e97";
      expect(bytesToHex(hash)).toBe(expected);
    });

    it("should produce consistent hash for empty message", () => {
      const message = "";
      const hash = hashMessage(message);
      // SHA256("\x17Stacks Signed Message:\n" + "")
      const expected =
        "89da565bd5b575c8d3b4370ce0b5965eb43e51d4434680cfe72c9420f8e790b4";
      expect(bytesToHex(hash)).toBe(expected);
    });
  });
});

/**
 * Tests for Schnorr signing (BIP-340) for Taproot
 *
 * These tests verify Schnorr signature creation and verification
 * for use in Taproot script-path spending and multisig coordination.
 */
describe("Schnorr Signing (BIP-340 for Taproot)", () => {
  // schnorr and hex are imported at the top of the file

  describe("Schnorr signature format", () => {
    it("should produce a 64-byte signature", () => {
      // BIP-340 Schnorr signatures are exactly 64 bytes
      const privateKey = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000001"
      );
      const digest = hex.decode(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );

      const signature = schnorr.sign(digest, privateKey);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });

    it("should produce deterministic signatures with same auxRand", () => {
      const privateKey = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000001"
      );
      const digest = hex.decode(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );
      // Use explicit auxRand for deterministic signing
      const auxRand = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000000"
      );

      const sig1 = schnorr.sign(digest, privateKey, auxRand);
      const sig2 = schnorr.sign(digest, privateKey, auxRand);

      expect(hex.encode(sig1)).toBe(hex.encode(sig2));
    });
  });

  describe("Sign and verify round-trip", () => {
    it("should sign and verify a digest", () => {
      const privateKey = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000001"
      );
      const publicKey = schnorr.getPublicKey(privateKey);
      const digest = hex.decode(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );

      const signature = schnorr.sign(digest, privateKey);
      const isValid = schnorr.verify(signature, digest, publicKey);

      expect(isValid).toBe(true);
    });

    it("should fail verification with wrong digest", () => {
      const privateKey = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000001"
      );
      const publicKey = schnorr.getPublicKey(privateKey);
      const digest = hex.decode(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );
      const wrongDigest = hex.decode(
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      const signature = schnorr.sign(digest, privateKey);
      const isValid = schnorr.verify(signature, wrongDigest, publicKey);

      expect(isValid).toBe(false);
    });

    it("should fail verification with wrong public key", () => {
      const privateKey1 = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000001"
      );
      const privateKey2 = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000002"
      );
      const publicKey2 = schnorr.getPublicKey(privateKey2);
      const digest = hex.decode(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );

      const signature = schnorr.sign(digest, privateKey1);
      const isValid = schnorr.verify(signature, digest, publicKey2);

      expect(isValid).toBe(false);
    });
  });

  describe("BIP-340 test vectors", () => {
    // Official BIP-340 test vector #0
    // https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv
    it("should match BIP-340 test vector #0", () => {
      const secretKey = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000003"
      );
      const publicKey = schnorr.getPublicKey(secretKey);
      const message = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000000"
      );
      const auxRand = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000000"
      );

      // Expected public key (x-only, 32 bytes)
      const expectedPubKey =
        "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9";
      expect(hex.encode(publicKey)).toBe(expectedPubKey);

      // Sign with auxRand for determinism matching test vector
      const signature = schnorr.sign(message, secretKey, auxRand);

      // Expected signature from BIP-340 test vectors
      const expectedSig =
        "e907831f80848d1069a5371b402410364bdf1c5f8307b0084c55f1ce2dca821525f66a4a85ea8b71e482a74f382d2ce5ebeee8fdb2172f477df4900d310536c0";
      expect(hex.encode(signature)).toBe(expectedSig);

      // Verification should pass
      const isValid = schnorr.verify(signature, message, publicKey);
      expect(isValid).toBe(true);
    });

    // BIP-340 test vector #1
    it("should match BIP-340 test vector #1", () => {
      const secretKey = hex.decode(
        "b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfef"
      );
      const message = hex.decode(
        "243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89"
      );
      const auxRand = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000001"
      );

      const publicKey = schnorr.getPublicKey(secretKey);
      const expectedPubKey =
        "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659";
      expect(hex.encode(publicKey)).toBe(expectedPubKey);

      const signature = schnorr.sign(message, secretKey, auxRand);
      const expectedSig =
        "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de33418906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a";
      expect(hex.encode(signature)).toBe(expectedSig);

      const isValid = schnorr.verify(signature, message, publicKey);
      expect(isValid).toBe(true);
    });
  });

  describe("x-only public key format", () => {
    it("should produce 32-byte x-only public keys", () => {
      const privateKey = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000001"
      );
      const publicKey = schnorr.getPublicKey(privateKey);

      expect(publicKey.length).toBe(32);
    });
  });

  describe("Multisig coordination scenario", () => {
    it("should allow multiple parties to sign the same digest", () => {
      // Simulate 3 parties in a 2-of-3 multisig
      const privateKeys = [
        hex.decode("0000000000000000000000000000000000000000000000000000000000000001"),
        hex.decode("0000000000000000000000000000000000000000000000000000000000000002"),
        hex.decode("0000000000000000000000000000000000000000000000000000000000000003"),
      ];
      const publicKeys = privateKeys.map((pk) => schnorr.getPublicKey(pk));

      // Same digest for all (e.g., BIP-341 sighash)
      const sighash = hex.decode(
        "c37af31116d1b27caf68aae9e3ac82f1477929014d5b917657d0eb49478cb670"
      );

      // Each party signs
      const signatures = privateKeys.map((pk) => schnorr.sign(sighash, pk));

      // All signatures should be valid
      signatures.forEach((sig, i) => {
        const isValid = schnorr.verify(sig, sighash, publicKeys[i]);
        expect(isValid).toBe(true);
      });

      // Signatures should be different
      expect(hex.encode(signatures[0])).not.toBe(hex.encode(signatures[1]));
      expect(hex.encode(signatures[1])).not.toBe(hex.encode(signatures[2]));
    });
  });
});
