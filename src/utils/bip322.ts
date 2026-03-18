/**
 * Shared BIP-322 signing primitives (P2WPKH and P2TR)
 *
 * BIP-322 defines a general message signing format for Bitcoin addresses.
 * This module implements the "simple" variant used by P2WPKH (bc1q) and P2TR (bc1p)
 * addresses.
 *
 * Spec: https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki
 *
 * These primitives are shared across:
 * - src/tools/signing.tools.ts (btc_sign_message / btc_verify_message)
 * - src/tools/news.tools.ts (news_file_signal auth headers)
 */

import {
  Transaction,
  Script,
  RawWitness,
  RawTx,
} from "@scure/btc-signer";
import { hashSha256Sync } from "@stacks/encryption";
import { concatBytes } from "@stacks/common";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function doubleSha256(data: Uint8Array): Uint8Array {
  return hashSha256Sync(hashSha256Sync(data));
}

// ---------------------------------------------------------------------------
// Exported primitives
// ---------------------------------------------------------------------------

/**
 * BIP-322 tagged hash: SHA256(SHA256(tag) || SHA256(tag) || msg)
 * where tag = "BIP0322-signed-message"
 *
 * Per BIP-322 spec, message bytes are passed directly — no varint length prefix.
 * Ref: https://github.com/aibtcdev/x402-sponsor-relay/issues/135
 */
export function bip322TaggedHash(message: string): Uint8Array {
  const tagBytes = new TextEncoder().encode("BIP0322-signed-message");
  const tagHash = hashSha256Sync(tagBytes);
  const msgBytes = new TextEncoder().encode(message);
  return hashSha256Sync(concatBytes(tagHash, tagHash, msgBytes));
}

/**
 * Build the BIP-322 to_spend virtual transaction and return its txid (32 bytes, LE).
 *
 * The to_spend tx is a virtual legacy transaction:
 * - Input: txid=zero32, vout=0xFFFFFFFF, sequence=0, scriptSig = OP_0 push32 <msgHash>
 * - Output: amount=0, script=scriptPubKey of the signing address
 *
 * The txid is computed as doubleSha256 of the legacy (non-segwit) serialization.
 * The returned txid is already in the byte order used by transaction inputs (reversed).
 */
export function bip322BuildToSpendTxId(
  message: string,
  scriptPubKey: Uint8Array
): Uint8Array {
  const msgHash = bip322TaggedHash(message);
  // scriptSig: OP_0 (0x00) push32 (0x20) <32-byte hash>
  const scriptSig = concatBytes(new Uint8Array([0x00, 0x20]), msgHash);

  const rawTx = RawTx.encode({
    version: 0,
    inputs: [
      {
        txid: new Uint8Array(32),
        index: 0xffffffff,
        finalScriptSig: scriptSig,
        sequence: 0,
      },
    ],
    outputs: [
      {
        amount: 0n,
        script: scriptPubKey,
      },
    ],
    lockTime: 0,
  });

  // txid is double-SHA256 of the serialized tx, returned in little-endian byte order
  return doubleSha256(rawTx).reverse();
}

/**
 * BIP-322 "simple" signing.
 *
 * Builds and signs the to_sign virtual transaction. The private key is used directly —
 * @scure/btc-signer's Transaction.signIdx() auto-detects the address type from witnessUtxo.script
 * and computes the correct sighash (BIP143 for P2WPKH, BIP341 for P2TR).
 *
 * @param message - Plain text message to sign
 * @param privateKey - 32-byte private key (P2WPKH key for bc1q, Taproot key for bc1p)
 * @param scriptPubKey - scriptPubKey of the signing address
 * @param tapInternalKey - For P2TR: the UNTWEAKED x-only pubkey (32 bytes). Required for Taproot
 *   signing. Must be the internal key BEFORE TapTweak, NOT the tweaked key in the scriptPubKey.
 * @returns Base64-encoded BIP-322 "simple" signature (serialized witness)
 */
export function bip322Sign(
  message: string,
  privateKey: Uint8Array,
  scriptPubKey: Uint8Array,
  tapInternalKey?: Uint8Array
): string {
  const toSpendTxid = bip322BuildToSpendTxId(message, scriptPubKey);

  // allowUnknownOutputs: true is required for the OP_RETURN output in BIP-322 virtual transactions.
  const toSignTx = new Transaction({ version: 0, lockTime: 0, allowUnknownOutputs: true });

  toSignTx.addInput({
    txid: toSpendTxid,
    index: 0,
    sequence: 0,
    witnessUtxo: { amount: 0n, script: scriptPubKey },
    ...(tapInternalKey && { tapInternalKey }),
  });
  toSignTx.addOutput({ script: Script.encode(["RETURN"]), amount: 0n });

  // signIdx auto-detects P2WPKH vs P2TR from witnessUtxo.script and applies correct sighash
  toSignTx.signIdx(privateKey, 0);
  toSignTx.finalizeIdx(0);

  const input = toSignTx.getInput(0);
  if (!input.finalScriptWitness) {
    throw new Error("BIP-322 signing failed: no witness produced");
  }

  const encodedWitness = RawWitness.encode(input.finalScriptWitness);
  return Buffer.from(encodedWitness).toString("base64");
}
