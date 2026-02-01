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
import { hashMessage, verifyMessageSignatureRsv } from "@stacks/encryption";
import { bytesToHex } from "@stacks/common";
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
