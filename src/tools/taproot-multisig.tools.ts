/**
 * Taproot Multisig Tools
 *
 * MCP tools for Taproot M-of-N multisig coordination between agents.
 *
 * - taproot_get_pubkey: Derive the x-only Taproot public key from the active wallet
 *   (BIP-86 path m/86'/0'/0'/0/0). Requires wallet unlock.
 *
 * - taproot_verify_cosig: Verify a Schnorr signature against a BIP-341 sighash.
 *   Read-only — no wallet needed.
 *
 * - taproot_multisig_guide: Return a step-by-step guide for M-of-N Taproot multisig
 *   coordination using OP_CHECKSIGADD (BIP-341/342). Read-only.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { z } from "zod";
import { getWalletManager } from "../services/wallet-manager.js";
import { createErrorResponse, createJsonResponse } from "../utils/index.js";

export function registerTaprootMultisigTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // taproot_get_pubkey
  // ---------------------------------------------------------------------------
  server.registerTool(
    "taproot_get_pubkey",
    {
      description:
        "Derive the x-only Taproot public key (32 bytes hex) from the active wallet using the " +
        "BIP-86 derivation path m/86'/0'/0'/0/0. " +
        "Share this pubkey with co-signers to construct a Taproot multisig script tree. " +
        "Requires the wallet to be unlocked (use wallet_unlock first).",
      inputSchema: {},
    },
    async () => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();

        if (!account?.taprootPublicKey) {
          throw new Error(
            "Taproot key not available. Unlock your wallet first with wallet_unlock."
          );
        }

        if (account.taprootPublicKey.length !== 32) {
          throw new Error(
            `Unexpected taproot public key length: ${account.taprootPublicKey.length} bytes (expected 32).`
          );
        }

        const pubkeyHex = Buffer.from(account.taprootPublicKey).toString("hex");

        return createJsonResponse({
          success: true,
          pubkey: pubkeyHex,
          encoding: "x-only (BIP-340, 32 bytes hex)",
          derivationPath: "m/86'/0'/0'/0/0",
          note:
            "Share this pubkey with co-signers. Use taproot_multisig_guide for coordination steps.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // taproot_verify_cosig
  // ---------------------------------------------------------------------------
  server.registerTool(
    "taproot_verify_cosig",
    {
      description:
        "Verify a Schnorr co-signature against a BIP-341 sighash. " +
        "Use this to confirm that a co-signer's signature is valid before combining and broadcasting. " +
        "Read-only — no wallet unlock required.",
      inputSchema: {
        sighash: z
          .string()
          .length(64)
          .regex(/^[0-9a-fA-F]+$/, "must be valid hex")
          .describe(
            "BIP-341 sighash as 32-byte hex string (64 hex chars). " +
              "This is the transaction commitment that was signed."
          ),
        signature: z
          .string()
          .length(128)
          .regex(/^[0-9a-fA-F]+$/, "must be valid hex")
          .describe(
            "Schnorr signature as 64-byte hex string (128 hex chars, BIP-340 format)."
          ),
        pubkey: z
          .string()
          .length(64)
          .regex(/^[0-9a-fA-F]+$/, "must be valid hex")
          .describe(
            "Signer's x-only public key as 32-byte hex string (64 hex chars). " +
              "Obtain via taproot_get_pubkey from each co-signer."
          ),
      },
    },
    async ({ sighash, signature, pubkey }) => {
      try {
        const sighashBytes = Buffer.from(sighash, "hex");
        const signatureBytes = Buffer.from(signature, "hex");
        const pubkeyBytes = Buffer.from(pubkey, "hex");

        if (sighashBytes.length !== 32) {
          throw new Error(
            `sighash must be exactly 32 bytes (64 hex chars), got ${sighashBytes.length} bytes.`
          );
        }
        if (signatureBytes.length !== 64) {
          throw new Error(
            `signature must be exactly 64 bytes (128 hex chars), got ${signatureBytes.length} bytes.`
          );
        }
        if (pubkeyBytes.length !== 32) {
          throw new Error(
            `pubkey must be exactly 32 bytes (64 hex chars), got ${pubkeyBytes.length} bytes.`
          );
        }

        const valid = schnorr.verify(signatureBytes, sighashBytes, pubkeyBytes);

        return createJsonResponse({
          valid,
          sighash,
          signature,
          pubkey,
          message: valid
            ? "Signature is valid. This co-signer's Schnorr signature is authentic."
            : "Signature is INVALID. Do not proceed with this co-signer's input.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // taproot_multisig_guide
  // ---------------------------------------------------------------------------
  server.registerTool(
    "taproot_multisig_guide",
    {
      description:
        "Return a step-by-step guide for M-of-N Taproot multisig coordination between agents " +
        "using OP_CHECKSIGADD (BIP-341/342). Read-only — no wallet needed.",
      inputSchema: {
        m: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(2)
          .describe("Number of required signatures (default: 2)."),
        n: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(3)
          .describe("Total number of co-signers (default: 3)."),
      },
    },
    async ({ m, n }) => {
      if (m > n) {
        return createErrorResponse(
          new Error(`Invalid parameters: m (${m}) cannot exceed n (${n}).`)
        );
      }

      const guide = {
        title: `${m}-of-${n} Taproot Multisig Coordination Guide`,
        overview:
          `Taproot M-of-N multisig uses OP_CHECKSIGADD (BIP-342) inside a Taproot script leaf (BIP-341). ` +
          `Each co-signer holds an independent BIP-86 keypair and signs the same BIP-341 sighash ` +
          `with a Schnorr signature. No interaction is required during signing — co-signers collect ` +
          `each other's signatures and combine them off-chain before broadcast.`,
        steps: [
          {
            step: 1,
            title: "Exchange x-only public keys",
            details: [
              `Each of the ${n} co-signers calls taproot_get_pubkey to obtain their x-only BIP-86 pubkey (32 bytes).`,
              "Share pubkeys out-of-band (e.g. via the AIBTC inbox or a shared coordination channel).",
              "Agree on a canonical ordering of the pubkeys (e.g. lexicographic ascending). This order must be consistent across all participants.",
            ],
            bip: "BIP-86 (key derivation), BIP-340 (x-only pubkey encoding)",
          },
          {
            step: 2,
            title: "Construct the Taproot script leaf with OP_CHECKSIGADD",
            details: [
              `Assemble the ${m}-of-${n} script using the agreed pubkey order:`,
              `  <pubkey_1> OP_CHECKSIG <pubkey_2> OP_CHECKSIGADD ... <pubkey_${n}> OP_CHECKSIGADD OP_${m} OP_NUMEQUAL`,
              "Compute the TapLeaf hash: SHA256(0xC0 || compact_size(script_len) || script).",
              "Build the Taproot output key: internalKey = KeyAgg(pubkeys) tweaked by TapTweak.",
              "The final P2TR address is: OP_1 <32-byte_output_key>.",
              "All co-signers must independently verify they compute the same P2TR address before funding.",
            ],
            bip: "BIP-341 (Taproot output construction), BIP-342 (Tapscript OP_CHECKSIGADD)",
          },
          {
            step: 3,
            title: "Create the PSBT",
            details: [
              "One co-signer (the initiator) constructs the unsigned PSBT encoding the spending transaction.",
              "The PSBT input must include: witnessUtxo (the P2TR output being spent), tapLeafScript (the multisig leaf), and tapBip32Derivation for each signer.",
              "Compute the BIP-341 sighash (SIGHASH_DEFAULT = 0x00) over the PSBT using the script-path spending rules.",
              "Distribute the PSBT and the sighash hex to all co-signers.",
            ],
            bip: "BIP-174 (PSBT), BIP-341 §Common signature message",
          },
          {
            step: 4,
            title: "Sign independently with Schnorr",
            details: [
              "Each co-signer receives the PSBT and signs the BIP-341 sighash with their BIP-86 Taproot private key.",
              "Use psbt_sign (or use raw sighash signing when available) to produce a 64-byte BIP-340 Schnorr signature.",
              `Only ${m} of the ${n} co-signers need to sign — but all ${n} must verify.`,
              "Each signer returns their (pubkey, signature) pair to the combiner.",
            ],
            bip: "BIP-340 (Schnorr signatures), BIP-342 (script-path spending)",
          },
          {
            step: 5,
            title: "Verify co-signatures with taproot_verify_cosig",
            details: [
              "The combiner calls taproot_verify_cosig for each received (sighash, signature, pubkey) tuple.",
              `Collect at least ${m} valid signatures before proceeding.`,
              "Reject any signature that returns valid: false.",
              "This step ensures no invalid or malformed signatures enter the final PSBT.",
            ],
            tool: "taproot_verify_cosig",
          },
          {
            step: 6,
            title: "Combine signatures and broadcast",
            details: [
              `Insert the ${m} valid Schnorr signatures into the PSBT as tapScriptSig entries (one per signer).`,
              "The witness stack for OP_CHECKSIGADD script-path spending is: [sig_1, sig_2, ..., sig_m, script, control_block].",
              "Absent signers (in an M < N setup) provide an empty stack item (0x00) as placeholder.",
              "Finalize the PSBT (psbt_broadcast or psbt_sign with finalizeSignedInputs: true).",
              "Broadcast the finalized transaction to the Bitcoin network.",
            ],
            bip: "BIP-341 §Script path spending, BIP-342 §Validation",
            tool: "psbt_broadcast",
          },
        ],
        securityNotes: [
          "Never share your private key. Only share x-only public keys and signatures.",
          "Always verify the P2TR address before funding — an incorrect script tree cannot be spent.",
          "Verify co-signatures with taproot_verify_cosig before broadcasting.",
          "Use a fresh nonce for each signing session to avoid nonce reuse attacks (handled automatically by @noble/curves).",
          "For high-value multisig, use an air-gapped signer and verify the sighash independently.",
        ],
        tools: {
          get_pubkey: "taproot_get_pubkey",
          verify_cosig: "taproot_verify_cosig",
          sign_psbt: "psbt_sign",
          broadcast: "psbt_broadcast",
          decode_psbt: "psbt_decode",
        },
        references: [
          "BIP-340: https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki",
          "BIP-341: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki",
          "BIP-342: https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki",
          "BIP-86:  https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki",
        ],
      };

      return createJsonResponse(guide);
    }
  );
}
