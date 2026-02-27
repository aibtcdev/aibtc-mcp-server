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
import { hex, bech32 } from "@scure/base";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import { STACKS_TESTNET } from "@stacks/network";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

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

/**
 * Tests for Nostr event signing (NIP-01)
 *
 * These tests verify that NIP-01 event ID computation, Schnorr signature validity,
 * and NIP-19 npub encoding work correctly using the same crypto primitives as
 * the nostr_sign_event tool in src/tools/signing.tools.ts.
 *
 * The algorithm under test:
 *   serialized = JSON.stringify([0, pubkeyHex, created_at, kind, tags, content])
 *   eventId    = SHA-256(UTF-8(serialized))
 *   sig        = schnorr.sign(eventIdBytes, taprootPrivateKey)
 *   npub       = bech32.encode("npub", bech32.toWords(xOnlyPubkey), 1023)
 */
describe("nostr_sign_event (NIP-01)", () => {
  // Helpers that replicate the exact algorithm from signing.tools.ts
  function computeEventId(
    pubkeyHex: string,
    created_at: number,
    kind: number,
    tags: string[][],
    content: string
  ): { serialized: string; eventIdBytes: Uint8Array; eventId: string } {
    const serialized = JSON.stringify([0, pubkeyHex, created_at, kind, tags, content]);
    const serializedBytes = new TextEncoder().encode(serialized);
    const eventIdBytes = hashSha256Sync(serializedBytes);
    const eventId = hex.encode(eventIdBytes);
    return { serialized, eventIdBytes, eventId };
  }

  // Fixed test key (same as used throughout the signing tests)
  const PRIVATE_KEY = hex.decode(
    "0000000000000000000000000000000000000000000000000000000000000001"
  );
  const PUBLIC_KEY = schnorr.getPublicKey(PRIVATE_KEY);
  const PUBKEY_HEX = hex.encode(PUBLIC_KEY);

  describe("NIP-01 event ID computation", () => {
    it("should produce deterministic event ID for same inputs", () => {
      const { eventId: id1 } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");
      const { eventId: id2 } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should produce different event IDs for different content", () => {
      const { eventId: id1 } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");
      const { eventId: id2 } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "different content");

      expect(id1).not.toBe(id2);
    });

    it("should produce different event IDs for different kinds", () => {
      const { eventId: id1 } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "same content");
      const { eventId: id2 } = computeEventId(PUBKEY_HEX, 1700000000, 0, [], "same content");

      expect(id1).not.toBe(id2);
    });

    it("should produce different event IDs for different created_at", () => {
      const { eventId: id1 } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "same content");
      const { eventId: id2 } = computeEventId(PUBKEY_HEX, 1700000001, 1, [], "same content");

      expect(id1).not.toBe(id2);
    });
  });

  describe("NIP-01 serialization format", () => {
    it("should serialize in correct NIP-01 canonical order", () => {
      const { serialized } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "test");
      const parsed = JSON.parse(serialized);

      // NIP-01 format: [0, pubkey, created_at, kind, tags, content]
      expect(parsed[0]).toBe(0);
      expect(parsed[1]).toBe(PUBKEY_HEX);
      expect(parsed[2]).toBe(1700000000);
      expect(parsed[3]).toBe(1);
      expect(parsed[4]).toEqual([]);
      expect(parsed[5]).toBe("test");
    });

    it("should include non-empty tags in serialization", () => {
      const tags = [["e", "abc123"], ["p", "def456"]];
      const { serialized } = computeEventId(PUBKEY_HEX, 1700000000, 1, tags, "content");
      const parsed = JSON.parse(serialized);

      expect(parsed[4]).toEqual(tags);
    });
  });

  describe("Sign and verify round-trip", () => {
    it("should produce a valid Schnorr signature over the event ID", () => {
      const { eventIdBytes } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");
      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);

      const isValid = schnorr.verify(sig, eventIdBytes, PUBLIC_KEY);
      expect(isValid).toBe(true);
    });

    it("should produce a 64-byte signature", () => {
      const { eventIdBytes } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");
      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);

      expect(sig.length).toBe(64);
    });

    it("should produce a 32-byte event ID", () => {
      const { eventIdBytes } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");

      expect(eventIdBytes.length).toBe(32);
    });

    it("should fail verification with wrong event ID", () => {
      const { eventIdBytes } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "original");
      const { eventIdBytes: wrongIdBytes } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "tampered");
      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);

      const isValid = schnorr.verify(sig, wrongIdBytes, PUBLIC_KEY);
      expect(isValid).toBe(false);
    });

    it("should fail verification with wrong public key", () => {
      const { eventIdBytes } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");
      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);

      const wrongPrivKey = hex.decode(
        "0000000000000000000000000000000000000000000000000000000000000002"
      );
      const wrongPubKey = schnorr.getPublicKey(wrongPrivKey);

      const isValid = schnorr.verify(sig, eventIdBytes, wrongPubKey);
      expect(isValid).toBe(false);
    });
  });

  describe("NIP-19 npub encoding", () => {
    it("should encode pubkey as bech32 with npub HRP", () => {
      const npubWords = bech32.toWords(PUBLIC_KEY);
      const npub = bech32.encode("npub", npubWords, 1023);

      expect(npub).toMatch(/^npub1/);

      // Decode and verify round-trip
      const decoded = bech32.decode(npub, 1023);
      expect(decoded.prefix).toBe("npub");

      const decodedBytes = bech32.fromWords(decoded.words);
      expect(hex.encode(decodedBytes)).toBe(PUBKEY_HEX);
    });
  });

  describe("Edge cases", () => {
    it("should handle unicode content (emoji)", () => {
      const content = "Hello \u{1F600} from Nostr!";
      const { eventIdBytes } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], content);
      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);

      const isValid = schnorr.verify(sig, eventIdBytes, PUBLIC_KEY);
      expect(isValid).toBe(true);
      expect(eventIdBytes.length).toBe(32);
    });

    it("should handle reaction event (kind 7)", () => {
      const tags = [["e", "abc123def456"]];
      const { eventIdBytes, eventId } = computeEventId(PUBKEY_HEX, 1700000000, 7, tags, "+");
      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);

      expect(eventId).toMatch(/^[0-9a-f]{64}$/);
      const isValid = schnorr.verify(sig, eventIdBytes, PUBLIC_KEY);
      expect(isValid).toBe(true);
    });

    it("should handle multi-tag event with multiple tag types", () => {
      const tags = [
        ["e", "event1id", "wss://relay.example.com"],
        ["p", "pubkey1hex"],
        ["t", "bitcoin"],
      ];
      const { eventIdBytes, serialized } = computeEventId(PUBKEY_HEX, 1700000000, 1, tags, "tagged content");
      const parsed = JSON.parse(serialized);

      expect(parsed[4]).toEqual(tags);
      expect(parsed[4].length).toBe(3);

      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);
      const isValid = schnorr.verify(sig, eventIdBytes, PUBLIC_KEY);
      expect(isValid).toBe(true);
    });
  });

  describe("Deterministic regression fixture", () => {
    // These expected values are pre-computed and lock in the exact NIP-01 algorithm.
    // If the event ID computation changes, this test will catch it.
    //
    // Input:
    //   privateKey  = 0x0000...0001
    //   pubkeyHex   = 79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
    //   created_at  = 1700000000
    //   kind        = 1
    //   tags        = []
    //   content     = "hello nostr"
    //
    // serialized: [0,"79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",1700000000,1,[],"hello nostr"]
    it("should produce known event ID for regression detection", () => {
      const expectedEventId =
        "936f550d3ec0adce0214b32e07a427b90ed36f8605a6ac44a72d1e4ae62ccefb";
      const expectedPubkey =
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const expectedNpub =
        "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d";

      const { eventId } = computeEventId(expectedPubkey, 1700000000, 1, [], "hello nostr");

      expect(eventId).toBe(expectedEventId);
      expect(PUBKEY_HEX).toBe(expectedPubkey);

      const npubWords = bech32.toWords(PUBLIC_KEY);
      const npub = bech32.encode("npub", npubWords, 1023);
      expect(npub).toBe(expectedNpub);
    });

    it("should verify signature over regression fixture event ID", () => {
      const expectedEventId =
        "936f550d3ec0adce0214b32e07a427b90ed36f8605a6ac44a72d1e4ae62ccefb";

      const { eventIdBytes, eventId } = computeEventId(PUBKEY_HEX, 1700000000, 1, [], "hello nostr");

      expect(eventId).toBe(expectedEventId);

      const sig = schnorr.sign(eventIdBytes, PRIVATE_KEY);
      const isValid = schnorr.verify(sig, eventIdBytes, PUBLIC_KEY);

      expect(isValid).toBe(true);
      expect(sig.length).toBe(64);
    });
  });
});

/**
 * Tests for nostr_sign_event keySource parameter
 *
 * These tests verify that the three keySource options ("nostr", "taproot", "segwit")
 * all derive distinct keys from the same mnemonic and each produces a valid
 * BIP-340 Schnorr signature over a NIP-01 event ID.
 *
 * Key derivation paths:
 *   nostr:   m/44'/1237'/0'/0/0  (NIP-06, coin type 1237)
 *   taproot: m/86'/0'/0'/0/0     (BIP-86, mainnet)
 *   segwit:  m/84'/0'/0'/0/0     (BIP-84, mainnet) — x-only = slice(1) of 33-byte compressed
 */
describe("nostr_sign_event keySource selection", () => {
  // Derive all three key pairs from TEST_MNEMONIC (mainnet paths)
  const seed = mnemonicToSeedSync(TEST_MNEMONIC);
  const masterKey = HDKey.fromMasterSeed(seed);

  // NIP-06 nostr key: m/44'/1237'/0'/0/0
  const nostrDerived = masterKey.derive("m/44'/1237'/0'/0/0");
  const nostrPrivKey = new Uint8Array(nostrDerived.privateKey!);
  const nostrPubKey = new Uint8Array(nostrDerived.publicKey!.slice(1)); // x-only

  // BIP-86 taproot key: m/86'/0'/0'/0/0
  const taprootDerived = masterKey.derive("m/86'/0'/0'/0/0");
  const taprootPrivKey = new Uint8Array(taprootDerived.privateKey!);
  const taprootPubKey = new Uint8Array(taprootDerived.publicKey!.slice(1)); // x-only

  // BIP-84 segwit key: m/84'/0'/0'/0/0
  const segwitDerived = masterKey.derive("m/84'/0'/0'/0/0");
  const segwitPrivKey = new Uint8Array(segwitDerived.privateKey!);
  const segwitPubKey = new Uint8Array(segwitDerived.publicKey!.slice(1)); // x-only from 33-byte compressed

  // Shared event parameters for signing tests
  const CREATED_AT = 1700000000;
  const KIND = 1;
  const CONTENT = "hello nostr";

  function computeEventId(pubkeyHex: string): { eventIdBytes: Uint8Array; eventId: string } {
    const serialized = JSON.stringify([0, pubkeyHex, CREATED_AT, KIND, [], CONTENT]);
    const serializedBytes = new TextEncoder().encode(serialized);
    const eventIdBytes = hashSha256Sync(serializedBytes);
    return { eventIdBytes, eventId: hex.encode(eventIdBytes) };
  }

  it("NIP-06 key (nostr) differs from Taproot key", () => {
    expect(hex.encode(nostrPubKey)).not.toBe(hex.encode(taprootPubKey));
  });

  it("NIP-06 key (nostr) differs from SegWit key", () => {
    expect(hex.encode(nostrPubKey)).not.toBe(hex.encode(segwitPubKey));
  });

  it("Taproot key differs from SegWit key", () => {
    expect(hex.encode(taprootPubKey)).not.toBe(hex.encode(segwitPubKey));
  });

  it("all three keySource pubkeys are 32 bytes (x-only)", () => {
    expect(nostrPubKey.length).toBe(32);
    expect(taprootPubKey.length).toBe(32);
    expect(segwitPubKey.length).toBe(32);
  });

  it("keySource='nostr' produces a valid Schnorr signature", () => {
    const pubkeyHex = hex.encode(nostrPubKey);
    const { eventIdBytes } = computeEventId(pubkeyHex);

    const sig = schnorr.sign(eventIdBytes, nostrPrivKey);
    const isValid = schnorr.verify(sig, eventIdBytes, nostrPubKey);

    expect(isValid).toBe(true);
    expect(sig.length).toBe(64);
  });

  it("keySource='taproot' produces a valid Schnorr signature", () => {
    const pubkeyHex = hex.encode(taprootPubKey);
    const { eventIdBytes } = computeEventId(pubkeyHex);

    const sig = schnorr.sign(eventIdBytes, taprootPrivKey);
    const isValid = schnorr.verify(sig, eventIdBytes, taprootPubKey);

    expect(isValid).toBe(true);
    expect(sig.length).toBe(64);
  });

  it("keySource='segwit' produces a valid Schnorr signature", () => {
    const pubkeyHex = hex.encode(segwitPubKey);
    const { eventIdBytes } = computeEventId(pubkeyHex);

    const sig = schnorr.sign(eventIdBytes, segwitPrivKey);
    const isValid = schnorr.verify(sig, eventIdBytes, segwitPubKey);

    expect(isValid).toBe(true);
    expect(sig.length).toBe(64);
  });

  it("keySource='taproot' signature does not verify under nostr pubkey", () => {
    // Signatures from one key source should not verify under a different key
    const taprootPubkeyHex = hex.encode(taprootPubKey);
    const { eventIdBytes } = computeEventId(taprootPubkeyHex);

    const sig = schnorr.sign(eventIdBytes, taprootPrivKey);
    // Verify under nostr pubkey — should fail
    const isValid = schnorr.verify(sig, eventIdBytes, nostrPubKey);
    expect(isValid).toBe(false);
  });

  it("NIP-06 npub differs from Taproot npub", () => {
    // Each key source produces a different NIP-19 npub
    const nostrNpub = bech32.encode("npub", bech32.toWords(nostrPubKey), 1023);
    const taprootNpub = bech32.encode("npub", bech32.toWords(taprootPubKey), 1023);

    expect(nostrNpub).toMatch(/^npub1/);
    expect(taprootNpub).toMatch(/^npub1/);
    expect(nostrNpub).not.toBe(taprootNpub);
  });
});
