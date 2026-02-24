/**
 * Message Signing Tools
 *
 * These tools provide message signing capabilities for agent identity and authentication:
 *
 * SIP-018 (Structured Data Signing):
 * - sip018_sign: Sign structured Clarity data (SIP-018 standard)
 * - sip018_verify: Verify SIP-018 signature and recover signer
 * - sip018_hash: Compute SIP-018 message hash without signing
 *
 * Stacks Message Signing (SIWS-Compatible):
 * - stacks_sign_message: Sign plain text messages with Stacks prefix
 * - stacks_verify_message: Verify message signature and recover signer
 *
 * Bitcoin Message Signing (BIP-137 / BIP-322):
 * - btc_sign_message: Sign messages with Bitcoin private key (BIP-137 for legacy, BIP-322 for bc1q/bc1p)
 * - btc_verify_message: Verify Bitcoin message signatures (auto-detects BIP-137 vs BIP-322)
 *
 * SIP-018 signatures can be verified both off-chain and on-chain by smart contracts.
 * Stacks message signatures are SIWS-compatible for web authentication flows.
 * Bitcoin signatures use BIP-137 format compatible with most Bitcoin wallets.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  signStructuredData,
  hashStructuredData,
  encodeStructuredDataBytes,
  publicKeyFromSignatureRsv,
  getAddressFromPublicKey,
  signMessageHashRsv,
  tupleCV,
  stringAsciiCV,
  stringUtf8CV,
  uintCV,
  intCV,
  principalCV,
  bufferCV,
  listCV,
  noneCV,
  someCV,
  trueCV,
  falseCV,
  type ClarityValue,
} from "@stacks/transactions";
import { hashMessage, verifyMessageSignatureRsv, hashSha256Sync } from "@stacks/encryption";
import { bytesToHex } from "@stacks/common";
import { secp256k1, schnorr } from "@noble/curves/secp256k1.js";
import { hex } from "@scure/base";
import {
  Transaction,
  p2wpkh,
  p2pkh,
  p2sh,
  p2tr,
  Script,
  SigHash,
  RawWitness,
  RawTx,
  Address,
  NETWORK as BTC_MAINNET,
  TEST_NETWORK as BTC_TESTNET,
} from "@scure/btc-signer";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";

/**
 * Chain IDs for SIP-018 domain (from SIP-005)
 */
const CHAIN_IDS = {
  mainnet: 1,
  testnet: 2147483648, // 0x80000000
} as const;

/**
 * SIP-018 structured data prefix as hex.
 * ASCII "SIP018" = 0x534950303138
 * Included in responses to show how the verification hash is constructed.
 */
const SIP018_MSG_PREFIX = "0x534950303138";

/**
 * Stacks message signing prefix (SIWS-compatible)
 * 'Stacks Signed Message:\n'.length === 23 (0x17 in hex)
 * The hashMessage function from @stacks/encryption applies this internally
 */
const STACKS_MSG_PREFIX = "\x17Stacks Signed Message:\n";

/**
 * Bitcoin message signing prefix (BIP-137)
 * '\x18Bitcoin Signed Message:\n' where 0x18 = 24 (length of "Bitcoin Signed Message:\n")
 */
const BITCOIN_MSG_PREFIX = "\x18Bitcoin Signed Message:\n";

/**
 * BIP-137 header byte base values for different address types.
 * The actual header = base + recoveryId (0-3)
 *
 * - 27-30: P2PKH uncompressed
 * - 31-34: P2PKH compressed
 * - 35-38: P2SH-P2WPKH (SegWit wrapped)
 * - 39-42: P2WPKH native SegWit (bech32)
 */
const BIP137_HEADER_BASE = {
  P2PKH_UNCOMPRESSED: 27,
  P2PKH_COMPRESSED: 31,
  P2SH_P2WPKH: 35,
  P2WPKH: 39,
} as const;

/**
 * Encode a variable-length integer (Bitcoin varint format)
 * Used for encoding message length in BIP-137
 */
function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) {
    return new Uint8Array([n]);
  } else if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    return buf;
  } else if (n <= 0xffffffff) {
    const buf = new Uint8Array(5);
    buf[0] = 0xfe;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    buf[3] = (n >> 16) & 0xff;
    buf[4] = (n >> 24) & 0xff;
    return buf;
  } else {
    throw new Error("Message too long for varint encoding");
  }
}

/**
 * Format a message for Bitcoin signing (BIP-137)
 * Returns: prefix || varint(message.length) || message
 */
function formatBitcoinMessage(message: string): Uint8Array {
  const prefixBytes = new TextEncoder().encode(BITCOIN_MSG_PREFIX);
  const messageBytes = new TextEncoder().encode(message);
  const lengthBytes = encodeVarInt(messageBytes.length);

  const result = new Uint8Array(
    prefixBytes.length + lengthBytes.length + messageBytes.length
  );
  result.set(prefixBytes, 0);
  result.set(lengthBytes, prefixBytes.length);
  result.set(messageBytes, prefixBytes.length + lengthBytes.length);

  return result;
}

/**
 * Double SHA-256 hash (Bitcoin standard)
 */
function doubleSha256(data: Uint8Array): Uint8Array {
  return hashSha256Sync(hashSha256Sync(data));
}

/**
 * Concatenate multiple Uint8Arrays into one.
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/**
 * Write a 32-bit little-endian integer into a buffer.
 */
function writeUint32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = n & 0xff;
  buf[1] = (n >> 8) & 0xff;
  buf[2] = (n >> 16) & 0xff;
  buf[3] = (n >> 24) & 0xff;
  return buf;
}

/**
 * Write a 64-bit little-endian BigInt into a buffer.
 */
function writeUint64LE(n: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

/**
 * Convert a DER-encoded ECDSA signature to compact (64-byte) format.
 *
 * Bitcoin witness stacks store ECDSA signatures in DER format with a hashtype byte appended.
 * @noble/curves secp256k1.verify() requires compact (64-byte r||s) format in v2.
 *
 * DER format: 30 <total_len> 02 <r_len> [00?] <r_bytes> 02 <s_len> [00?] <s_bytes>
 * The leading 0x00 is padding for high-bit integers (to keep the sign positive).
 */
function parseDERSignature(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) throw new Error("parseDERSignature: expected 0x30 header");
  let pos = 2; // skip 0x30 and total length byte
  if (der[pos] !== 0x02) throw new Error("parseDERSignature: expected 0x02 for r");
  pos++;
  const rLen = der[pos++];
  // Strip optional leading 0x00 padding byte (added when high bit is set)
  const rBytes = der.slice(rLen === 33 ? pos + 1 : pos, pos + rLen);
  pos += rLen;
  if (der[pos] !== 0x02) throw new Error("parseDERSignature: expected 0x02 for s");
  pos++;
  const sLen = der[pos++];
  const sBytes = der.slice(sLen === 33 ? pos + 1 : pos, pos + sLen);

  const compact = new Uint8Array(64);
  compact.set(rBytes.slice(-32), 0);  // r (last 32 bytes, in case rLen < 32)
  compact.set(sBytes.slice(-32), 32); // s (last 32 bytes)
  return compact;
}

// ---------------------------------------------------------------------------
// BIP-322 helper functions
// ---------------------------------------------------------------------------

/**
 * BIP-322 tagged hash: SHA256(SHA256(tag) || SHA256(tag) || varint(msg.len) || msg)
 * where tag = "BIP0322-signed-message"
 */
function bip322TaggedHash(message: string): Uint8Array {
  const tagBytes = new TextEncoder().encode("BIP0322-signed-message");
  const tagHash = hashSha256Sync(tagBytes);
  const msgBytes = new TextEncoder().encode(message);
  const varint = encodeVarInt(msgBytes.length);
  const msgPart = concatBytes(varint, msgBytes);
  return hashSha256Sync(concatBytes(tagHash, tagHash, msgPart));
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
function bip322BuildToSpendTxId(message: string, scriptPubKey: Uint8Array): Uint8Array {
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
function bip322Sign(
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

/**
 * BIP-322 "simple" verification for P2WPKH (bc1q/tb1q) addresses.
 *
 * Reconstructs the to_sign transaction, computes the BIP143 witness-v0 sighash,
 * verifies the ECDSA signature, and checks the recovered address matches.
 */
function bip322VerifyP2WPKH(
  message: string,
  signatureBase64: string,
  address: string,
  btcNetwork: typeof BTC_MAINNET
): boolean {
  const sigBytes = new Uint8Array(Buffer.from(signatureBase64, "base64"));
  const witnessItems = RawWitness.decode(sigBytes);

  if (witnessItems.length !== 2) {
    throw new Error(`P2WPKH BIP-322: expected 2 witness items, got ${witnessItems.length}`);
  }

  const ecdsaSigWithHashtype = witnessItems[0];
  const pubkeyBytes = witnessItems[1];

  if (pubkeyBytes.length !== 33) {
    throw new Error(`P2WPKH BIP-322: expected 33-byte compressed pubkey, got ${pubkeyBytes.length}`);
  }

  // Derive scriptPubKey from witness pubkey (for building to_spend)
  const scriptPubKey = p2wpkh(pubkeyBytes, btcNetwork).script;

  // Build to_spend txid using the claimed address's scriptPubKey
  const toSpendTxid = bip322BuildToSpendTxId(message, scriptPubKey);

  // Build the (unsigned) to_sign transaction for sighash computation.
  // allowUnknownOutputs: true is required for the OP_RETURN output in BIP-322 virtual transactions.
  const toSignTx = new Transaction({ version: 0, lockTime: 0, allowUnknownOutputs: true });
  toSignTx.addInput({
    txid: toSpendTxid,
    index: 0,
    sequence: 0,
    witnessUtxo: { amount: 0n, script: scriptPubKey },
  });
  toSignTx.addOutput({ script: Script.encode(["RETURN"]), amount: 0n });

  // Compute BIP143 witness-v0 sighash.
  // scriptCode for P2WPKH is the P2PKH script: OP_DUP OP_HASH160 <hash160(pubkey)> OP_EQUALVERIFY OP_CHECKSIG
  const scriptCode = p2pkh(pubkeyBytes).script;
  const sighash = toSignTx.preimageWitnessV0(0, scriptCode, SigHash.ALL, 0n);

  // Strip hashtype byte from DER signature.
  // @noble/curves secp256k1.verify() in v2 requires compact (64-byte) format, not DER.
  const derSig = ecdsaSigWithHashtype.slice(0, -1);
  const compactSig = parseDERSignature(derSig);

  // Verify ECDSA signature
  const sigValid = secp256k1.verify(compactSig, sighash, pubkeyBytes, { prehash: false });

  if (!sigValid) return false;

  // Derive the Bitcoin address from the witness pubkey and compare to claimed address
  const derivedAddress = p2wpkh(pubkeyBytes, btcNetwork).address;
  return derivedAddress === address;
}

/**
 * BIP-322 "simple" verification for P2TR (bc1p/tb1p) addresses.
 *
 * Reconstructs the to_sign transaction, computes the BIP341 tapscript sighash manually,
 * verifies the Schnorr signature, and checks the pubkey matches the address.
 *
 * BIP341 key-path sighash for SIGHASH_DEFAULT (0x00):
 * tagged_hash("TapSighash", 0x00 || sigMsg)
 * where sigMsg encodes: epoch, hashType, version, locktime, hashPrevouts, hashAmounts,
 * hashScriptPubkeys, hashSequences, hashOutputs, spend_type, input_index.
 */
function bip322VerifyP2TR(
  message: string,
  signatureBase64: string,
  address: string,
  btcNetwork: typeof BTC_MAINNET
): boolean {
  const sigBytes = new Uint8Array(Buffer.from(signatureBase64, "base64"));
  const witnessItems = RawWitness.decode(sigBytes);

  if (witnessItems.length !== 1) {
    throw new Error(`P2TR BIP-322: expected 1 witness item, got ${witnessItems.length}`);
  }

  const schnorrSig = witnessItems[0];
  if (schnorrSig.length !== 64) {
    throw new Error(`P2TR BIP-322: expected 64-byte Schnorr sig, got ${schnorrSig.length}`);
  }

  // Extract the tweaked output key from the P2TR address.
  // Address().decode() returns decoded.pubkey = the TWEAKED key embedded in the bech32 data.
  // We must NOT call p2tr(decoded.pubkey, ...) — that would apply another TapTweak.
  // Instead, build the scriptPubKey directly: OP_1 (0x51) OP_PUSH32 (0x20) <tweakedKey>
  const decoded = Address(btcNetwork).decode(address);
  if (decoded.type !== "tr") {
    throw new Error(`P2TR BIP-322: address does not decode to P2TR type`);
  }
  const tweakedKey = decoded.pubkey;
  const scriptPubKey = new Uint8Array([0x51, 0x20, ...tweakedKey]);

  // Build to_spend txid
  const toSpendTxid = bip322BuildToSpendTxId(message, scriptPubKey);

  // Compute BIP341 sighash manually for SIGHASH_DEFAULT (0x00) key-path spending.
  //
  // From BIP341:
  //   sighash = tagged_hash("TapSighash", 0x00 || sigMsg)
  //   sigMsg = epoch(1) || hashType(1) || nVersion(4LE) || nLockTime(4LE)
  //          || hashPrevouts(32) || hashAmounts(32) || hashScriptPubkeys(32)
  //          || hashSequences(32) || hashOutputs(32)
  //          || spend_type(1) || input_index(4LE)
  //
  // to_sign values:
  //   version = 0, locktime = 0
  //   1 input: txid=toSpendTxid, vout=0, sequence=0, amount=0n, scriptPubKey=p2tr_script
  //   1 output: amount=0n, script=OP_RETURN (0x6a, 1 byte)

  // hashPrevouts = SHA256(txid_wire_bytes || vout(4LE))
  //
  // @scure/btc-signer stores txid as-is but applies P.bytes(32, true) (reversing) when
  // encoding TxHashIdx for the BIP341 sighash computation. This means the wire-format txid
  // used in hashPrevouts is the reverse of what bip322BuildToSpendTxId returns.
  // We must re-reverse to produce the same bytes that btc-signer uses when signing.
  const txidForHashPrevouts = toSpendTxid.slice().reverse();
  const prevouts = concatBytes(txidForHashPrevouts, writeUint32LE(0));
  const hashPrevouts = hashSha256Sync(prevouts);

  // hashAmounts = SHA256(amount_8LE)  [amount = 0n for our virtual input]
  const amounts = writeUint64LE(0n);
  const hashAmounts = hashSha256Sync(amounts);

  // hashScriptPubkeys = SHA256(varint(scriptPubKey.length) || scriptPubKey)
  const scriptPubKeyWithLen = concatBytes(encodeVarInt(scriptPubKey.length), scriptPubKey);
  const hashScriptPubkeys = hashSha256Sync(scriptPubKeyWithLen);

  // hashSequences = SHA256(sequence_4LE)  [sequence = 0]
  const sequences = writeUint32LE(0);
  const hashSequences = hashSha256Sync(sequences);

  // hashOutputs = SHA256(amount_8LE || varint(script.length) || script)
  // Output: amount=0n, script=Script.encode(['RETURN']) = 0x6a (1 byte)
  const opReturnScript = Script.encode(["RETURN"]);
  const outputBytes = concatBytes(
    writeUint64LE(0n),
    encodeVarInt(opReturnScript.length),
    opReturnScript
  );
  const hashOutputs = hashSha256Sync(outputBytes);

  // sigMsg assembly
  const sigMsg = concatBytes(
    new Uint8Array([0x00]),        // epoch
    new Uint8Array([0x00]),        // hashType = SIGHASH_DEFAULT
    writeUint32LE(0),              // nVersion = 0
    writeUint32LE(0),              // nLockTime = 0
    hashPrevouts,                  // 32 bytes
    hashAmounts,                   // 32 bytes
    hashScriptPubkeys,             // 32 bytes
    hashSequences,                 // 32 bytes
    hashOutputs,                   // 32 bytes
    new Uint8Array([0x00]),        // spend_type = 0 (key-path, no annex)
    writeUint32LE(0)               // input_index = 0
  );

  // tagged_hash("TapSighash", sigMsg) = SHA256(SHA256(tag) || SHA256(tag) || sigMsg)
  const tagBytes = new TextEncoder().encode("TapSighash");
  const tagHash = hashSha256Sync(tagBytes);
  const sighash = hashSha256Sync(concatBytes(tagHash, tagHash, sigMsg));

  // Schnorr verification uses the TWEAKED output key (the one in the scriptPubKey bytes)
  return schnorr.verify(schnorrSig, sighash, tweakedKey);
}

/**
 * BIP-322 "simple" verification — auto-detects P2WPKH vs P2TR from address prefix.
 *
 * @param message - Original plain text message
 * @param signatureBase64 - Base64-encoded BIP-322 "simple" signature
 * @param address - Bitcoin address that allegedly signed the message
 * @param network - 'mainnet' or 'testnet'
 * @returns true if signature is valid for the given address and message
 */
function bip322Verify(
  message: string,
  signatureBase64: string,
  address: string,
  network: string
): boolean {
  const btcNetwork = network === "mainnet" ? BTC_MAINNET : BTC_TESTNET;

  if (
    address.startsWith("bc1q") ||
    address.startsWith("tb1q")
  ) {
    return bip322VerifyP2WPKH(message, signatureBase64, address, btcNetwork);
  }

  if (
    address.startsWith("bc1p") ||
    address.startsWith("tb1p")
  ) {
    return bip322VerifyP2TR(message, signatureBase64, address, btcNetwork);
  }

  throw new Error(`bip322Verify: unsupported address type for BIP-322: ${address}`);
}

/**
 * Detect whether a decoded signature is BIP-137 or BIP-322.
 * BIP-137: exactly 65 bytes, first byte in range 27-42.
 * BIP-322: everything else (witness-serialized).
 */
function isBip137Signature(sigBytes: Uint8Array): boolean {
  return sigBytes.length === 65 && sigBytes[0] >= 27 && sigBytes[0] <= 42;
}

/**
 * Get Bitcoin address type from BIP-137 header byte
 */
function getAddressTypeFromHeader(header: number): string {
  if (header >= 27 && header <= 30) return "P2PKH (uncompressed)";
  if (header >= 31 && header <= 34) return "P2PKH (compressed)";
  if (header >= 35 && header <= 38) return "P2SH-P2WPKH (SegWit wrapped)";
  if (header >= 39 && header <= 42) return "P2WPKH (native SegWit)";
  return "Unknown";
}

/**
 * Extract recovery ID from BIP-137 header byte
 */
function getRecoveryIdFromHeader(header: number): number {
  if (header >= 27 && header <= 30) return header - 27;
  if (header >= 31 && header <= 34) return header - 31;
  if (header >= 35 && header <= 38) return header - 35;
  if (header >= 39 && header <= 42) return header - 39;
  throw new Error(`Invalid BIP-137 header byte: ${header}`);
}

/**
 * Type guard for explicit Clarity type hint objects.
 * Checks if value is an object with a "type" string property.
 */
function isTypedValue(value: unknown): value is { type: string; value?: unknown } {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

/**
 * Convert a JSON value to a ClarityValue.
 *
 * Supports explicit type hints for typed arguments:
 * - { type: "uint", value: 100 }
 * - { type: "int", value: -50 }
 * - { type: "principal", value: "SP..." }
 * - { type: "ascii", value: "hello" }
 * - { type: "utf8", value: "hello" }
 * - { type: "buff", value: "0x1234" }
 * - { type: "bool", value: true }
 * - { type: "none" }
 * - { type: "some", value: ... }
 * - { type: "list", value: [...] }
 * - { type: "tuple", value: {...} }
 *
 * Also supports implicit conversion:
 * - string -> stringUtf8CV
 * - number -> intCV (signed)
 * - boolean -> trueCV/falseCV
 * - null -> noneCV
 * - array -> listCV
 * - object -> tupleCV (recursively)
 */
function jsonToClarityValue(value: unknown): ClarityValue {
  // Handle explicit type hints
  if (isTypedValue(value)) {
    switch (value.type) {
      case "uint":
        if (typeof value.value !== "number" && typeof value.value !== "string") {
          throw new Error("uint type requires a numeric value");
        }
        return uintCV(BigInt(value.value));

      case "int":
        if (typeof value.value !== "number" && typeof value.value !== "string") {
          throw new Error("int type requires a numeric value");
        }
        return intCV(BigInt(value.value));

      case "principal":
        if (typeof value.value !== "string") {
          throw new Error("principal type requires a string value");
        }
        return principalCV(value.value);

      case "ascii":
        if (typeof value.value !== "string") {
          throw new Error("ascii type requires a string value");
        }
        return stringAsciiCV(value.value);

      case "utf8":
        if (typeof value.value !== "string") {
          throw new Error("utf8 type requires a string value");
        }
        return stringUtf8CV(value.value);

      case "buff":
      case "buffer":
        if (typeof value.value !== "string") {
          throw new Error("buff type requires a hex string value");
        }
        // Support both "0x..." and raw hex
        const hexStr = value.value.startsWith("0x")
          ? value.value.slice(2)
          : value.value;
        return bufferCV(Uint8Array.from(Buffer.from(hexStr, "hex")));

      case "bool":
        return value.value ? trueCV() : falseCV();

      case "none":
        return noneCV();

      case "some":
        return someCV(jsonToClarityValue(value.value));

      case "list":
        if (!Array.isArray(value.value)) {
          throw new Error("list type requires an array value");
        }
        return listCV(value.value.map(jsonToClarityValue));

      case "tuple":
        if (typeof value.value !== "object" || value.value === null) {
          throw new Error("tuple type requires an object value");
        }
        const tupleData: { [key: string]: ClarityValue } = {};
        for (const [k, v] of Object.entries(value.value)) {
          tupleData[k] = jsonToClarityValue(v);
        }
        return tupleCV(tupleData);

      default:
        throw new Error(`Unknown type hint: ${value.type}`);
    }
  }

  // Implicit conversion for primitives
  if (value === null || value === undefined) {
    return noneCV();
  }

  if (typeof value === "boolean") {
    return value ? trueCV() : falseCV();
  }

  if (typeof value === "number") {
    // Use intCV for implicit numbers (can be negative)
    return intCV(BigInt(Math.floor(value)));
  }

  if (typeof value === "string") {
    // Default to UTF-8 string
    return stringUtf8CV(value);
  }

  if (Array.isArray(value)) {
    return listCV(value.map(jsonToClarityValue));
  }

  if (typeof value === "object") {
    const tupleData: { [key: string]: ClarityValue } = {};
    for (const [k, v] of Object.entries(value)) {
      tupleData[k] = jsonToClarityValue(v);
    }
    return tupleCV(tupleData);
  }

  throw new Error(`Cannot convert value to ClarityValue: ${typeof value}`);
}

/**
 * Build the standard SIP-018 domain tuple
 */
function buildDomainCV(
  name: string,
  version: string,
  chainId: number
): ClarityValue {
  return tupleCV({
    name: stringAsciiCV(name),
    version: stringAsciiCV(version),
    "chain-id": uintCV(chainId),
  });
}

/**
 * Get the active wallet account or throw a consistent error message
 */
function requireUnlockedWallet() {
  const walletManager = getWalletManager();
  const account = walletManager.getActiveAccount();

  if (!account) {
    throw new Error(
      "Wallet is not unlocked. Use wallet_unlock first to enable signing."
    );
  }

  return account;
}

export function registerSigningTools(server: McpServer): void {
  // Sign structured data (SIP-018)
  server.registerTool(
    "sip018_sign",
    {
      description:
        "Sign structured Clarity data using SIP-018 standard. " +
        "Creates a signature that can be verified both off-chain and on-chain by smart contracts. " +
        "Use cases: meta-transactions, off-chain voting, permits, proving address control. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        message: z
          .record(z.string(), z.unknown())
          .describe(
            "The structured data to sign as a JSON object. " +
              "Use type hints for explicit types: {type: 'uint', value: 100}, " +
              "{type: 'principal', value: 'SP...'}, etc. " +
              "Implicit conversion: strings->utf8, numbers->int, booleans->bool."
          ),
        domain: z
          .object({
            name: z.string().describe("Application name (e.g., 'My App')"),
            version: z.string().describe("Application version (e.g., '1.0.0')"),
          })
          .describe(
            "Domain binding for the signature. Prevents cross-app and cross-version replay."
          ),
      },
    },
    async ({ message, domain }) => {
      try {
        const account = requireUnlockedWallet();

        // Build domain CV with chain-id
        const chainId = CHAIN_IDS[NETWORK];
        const domainCV = buildDomainCV(domain.name, domain.version, chainId);

        // Convert message to ClarityValue
        const messageCV = jsonToClarityValue(message);

        // Sign the structured data
        const signature = signStructuredData({
          message: messageCV,
          domain: domainCV,
          privateKey: account.privateKey,
        });

        // Compute hashes for reference and verification
        const messageHash = hashStructuredData(messageCV);
        const domainHash = hashStructuredData(domainCV);

        // Compute the full encoded bytes and its sha256 hash (used for signing/verification)
        const encodedBytes = encodeStructuredDataBytes({
          message: messageCV,
          domain: domainCV,
        });
        const encodedHex = bytesToHex(encodedBytes);
        const verificationHash = bytesToHex(hashSha256Sync(encodedBytes));

        return createJsonResponse({
          success: true,
          signature,
          signatureFormat: "RSV (65 bytes hex)",
          signer: account.address,
          network: NETWORK,
          chainId,
          hashes: {
            message: messageHash,
            domain: domainHash,
            encoded: encodedHex,
            verification: verificationHash,
            prefix: SIP018_MSG_PREFIX,
          },
          domain: {
            name: domain.name,
            version: domain.version,
            chainId,
          },
          verificationNote:
            "Use sip018_verify with the 'verification' hash and signature to recover the signer. " +
            "For on-chain verification, use secp256k1-recover? with sha256 of the 'encoded' hash.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Verify SIP-018 signature
  server.registerTool(
    "sip018_verify",
    {
      description:
        "Verify a SIP-018 signature and recover the signer's address. " +
        "Takes the verification hash (from sip018_sign or sip018_hash 'verification' field) and the signature, " +
        "then recovers the public key and derives the signer's Stacks address.",
      inputSchema: {
        messageHash: z
          .string()
          .describe(
            "The SIP-018 verification hash (from sip018_sign/sip018_hash 'verification' field). " +
              "This is sha256(prefix || domainHash || messageHash)."
          ),
        signature: z
          .string()
          .describe("The signature in RSV format (65 bytes hex from sip018_sign)"),
        expectedSigner: z
          .string()
          .optional()
          .describe(
            "Optional: expected signer address to verify against. " +
              "If provided, returns whether the signature is valid for this signer."
          ),
      },
    },
    async ({ messageHash, signature, expectedSigner }) => {
      try {
        // Recover public key from signature
        // The signature is in RSV format, messageHash should be the full encoded hash
        const recoveredPubKey = publicKeyFromSignatureRsv(messageHash, signature);

        // Derive address from public key for current network
        const recoveredAddress = getAddressFromPublicKey(recoveredPubKey, NETWORK);

        // Check against expected signer if provided
        const isValid = expectedSigner
          ? recoveredAddress === expectedSigner
          : undefined;

        return createJsonResponse({
          success: true,
          recoveredPublicKey: recoveredPubKey,
          recoveredAddress,
          network: NETWORK,
          verification: expectedSigner
            ? {
                expectedSigner,
                isValid,
                message: isValid
                  ? "Signature is valid for the expected signer"
                  : "Signature does NOT match expected signer",
              }
            : undefined,
          note:
            "The recovered address is derived from the public key recovered from the signature. " +
            "For on-chain verification, use secp256k1-recover? and principal-of?.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Hash structured data (SIP-018) without signing
  server.registerTool(
    "sip018_hash",
    {
      description:
        "Compute the SIP-018 message hash without signing. " +
        "Returns the full encoded hash, domain hash, and message hash. " +
        "Useful for preparing data for on-chain verification or multi-sig coordination. " +
        "Does not require an unlocked wallet.",
      inputSchema: {
        message: z
          .record(z.string(), z.unknown())
          .describe(
            "The structured data as a JSON object. " +
              "Use type hints for explicit types: {type: 'uint', value: 100}, " +
              "{type: 'principal', value: 'SP...'}, etc."
          ),
        domain: z
          .object({
            name: z.string().describe("Application name"),
            version: z.string().describe("Application version"),
            chainId: z
              .number()
              .optional()
              .describe(
                "Optional chain ID. Defaults to current network (1 for mainnet, 2147483648 for testnet)"
              ),
          })
          .describe("Domain binding for the hash"),
      },
    },
    async ({ message, domain }) => {
      try {
        // Use provided chainId or default to current network
        const chainId = domain.chainId ?? CHAIN_IDS[NETWORK];
        const domainCV = buildDomainCV(domain.name, domain.version, chainId);

        // Convert message to ClarityValue
        const messageCV = jsonToClarityValue(message);

        // Compute hashes
        const messageHash = hashStructuredData(messageCV);
        const domainHash = hashStructuredData(domainCV);

        // Compute the full encoded bytes and its sha256 hash
        const encodedBytes = encodeStructuredDataBytes({
          message: messageCV,
          domain: domainCV,
        });
        const encodedHex = bytesToHex(encodedBytes);
        const verificationHash = bytesToHex(hashSha256Sync(encodedBytes));

        return createJsonResponse({
          success: true,
          hashes: {
            message: messageHash,
            domain: domainHash,
            encoded: encodedHex,
            verification: verificationHash,
          },
          hashConstruction: {
            prefix: SIP018_MSG_PREFIX,
            formula: "verification = sha256(prefix || domainHash || messageHash)",
            note: "Use 'verification' hash with sip018_verify. Use 'encoded' with secp256k1-recover? on-chain.",
          },
          domain: {
            name: domain.name,
            version: domain.version,
            chainId,
          },
          network: NETWORK,
          clarityVerification: {
            note: "For on-chain verification, use sha256 of 'encoded' with secp256k1-recover?",
            example:
              "(secp256k1-recover? (sha256 encoded-data) signature)",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Sign plain text message (SIWS-compatible)
  server.registerTool(
    "stacks_sign_message",
    {
      description:
        "Sign a plain text message using the Stacks message signing format. " +
        "The message is prefixed with '\\x17Stacks Signed Message:\\n' before hashing (SIWS-compatible). " +
        "Use cases: proving address ownership, authentication, sign-in flows. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        message: z
          .string()
          .describe(
            "The plain text message to sign. Will be prefixed with Stacks message prefix before signing."
          ),
      },
    },
    async ({ message }) => {
      try {
        const account = requireUnlockedWallet();

        // Hash the message with the Stacks prefix
        const msgHash = hashMessage(message);
        const msgHashHex = bytesToHex(msgHash);

        // Sign the message hash
        const signature = signMessageHashRsv({
          messageHash: msgHashHex,
          privateKey: account.privateKey,
        });

        return createJsonResponse({
          success: true,
          signature,
          signatureFormat: "RSV (65 bytes hex)",
          signer: account.address,
          network: NETWORK,
          message: {
            original: message,
            prefix: STACKS_MSG_PREFIX,
            prefixHex: bytesToHex(new TextEncoder().encode(STACKS_MSG_PREFIX)),
            hash: msgHashHex,
          },
          verificationNote:
            "Use stacks_verify_message with the original message and signature to verify. " +
            "Compatible with SIWS (Sign In With Stacks) authentication flows.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Verify plain text message signature (SIWS-compatible)
  server.registerTool(
    "stacks_verify_message",
    {
      description:
        "Verify a Stacks message signature and recover the signer's address. " +
        "Takes the original message and signature, applies the Stacks prefix, and verifies. " +
        "Compatible with SIWS (Sign In With Stacks) authentication flows.",
      inputSchema: {
        message: z
          .string()
          .describe(
            "The original plain text message that was signed."
          ),
        signature: z
          .string()
          .describe(
            "The signature in RSV format (65 bytes hex from stacks_sign_message or wallet signature)."
          ),
        expectedSigner: z
          .string()
          .optional()
          .describe(
            "Optional: expected signer address to verify against. " +
              "If provided, returns whether the signature is valid for this signer."
          ),
      },
    },
    async ({ message, signature, expectedSigner }) => {
      try {
        // Hash the message with the Stacks prefix
        const messageHash = hashMessage(message);
        const messageHashHex = bytesToHex(messageHash);

        // Recover public key from signature
        const recoveredPubKey = publicKeyFromSignatureRsv(messageHashHex, signature);

        // Derive address from public key for current network
        const recoveredAddress = getAddressFromPublicKey(recoveredPubKey, NETWORK);

        // Verify the signature using the encryption library
        const signatureValid = verifyMessageSignatureRsv({
          signature,
          message,
          publicKey: recoveredPubKey,
        });

        // Check against expected signer if provided
        const signerMatches = expectedSigner
          ? recoveredAddress === expectedSigner
          : undefined;

        const isFullyValid = signatureValid && (expectedSigner ? signerMatches : true);

        return createJsonResponse({
          success: true,
          signatureValid,
          recoveredPublicKey: recoveredPubKey,
          recoveredAddress,
          network: NETWORK,
          message: {
            original: message,
            prefix: STACKS_MSG_PREFIX,
            hash: messageHashHex,
          },
          verification: expectedSigner
            ? {
                expectedSigner,
                signerMatches,
                isFullyValid,
                message: isFullyValid
                  ? "Signature is valid and matches expected signer"
                  : signatureValid
                    ? "Signature is valid but does NOT match expected signer"
                    : "Signature is invalid",
              }
            : undefined,
          note:
            "The recovered address is derived from the public key recovered from the signature. " +
            "Compatible with SIWS (Sign In With Stacks) authentication flows.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Sign Bitcoin message (BIP-137 for legacy, BIP-322 for native SegWit and Taproot)
  server.registerTool(
    "btc_sign_message",
    {
      description:
        "Sign a plain text message using Bitcoin message signing. " +
        "Automatically selects BIP-322 for native SegWit (bc1q) and Taproot (bc1p) addresses, " +
        "and BIP-137 for legacy (1...) and wrapped SegWit (3...) addresses. " +
        "Use addressType 'p2tr' to force signing with the Taproot key. " +
        "Use cases: proving Bitcoin address ownership, authentication, off-chain verification. " +
        "Requires an unlocked wallet with Bitcoin keys.",
      inputSchema: {
        message: z
          .string()
          .describe(
            "The plain text message to sign."
          ),
        addressType: z
          .enum(["p2wpkh", "p2tr"])
          .optional()
          .describe(
            "Optional: address type to sign with. 'p2wpkh' uses native SegWit (bc1q, BIP-322), " +
            "'p2tr' uses Taproot (bc1p, BIP-322). If omitted, auto-detects from wallet address type."
          ),
      },
    },
    async ({ message, addressType }) => {
      try {
        const account = requireUnlockedWallet();
        const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;

        // Determine signing mode from addressType param or auto-detect from btcAddress prefix
        const useTaproot =
          addressType === "p2tr" ||
          (account.btcAddress &&
            (account.btcAddress.startsWith("bc1p") ||
              account.btcAddress.startsWith("tb1p") ||
              account.btcAddress.startsWith("bcrt1p")));

        const isLegacyAddress =
          account.btcAddress &&
          (account.btcAddress.startsWith("1") ||
            account.btcAddress.startsWith("3") ||
            account.btcAddress.startsWith("m") ||
            account.btcAddress.startsWith("n") ||
            account.btcAddress.startsWith("2"));

        if (useTaproot) {
          // BIP-322 with Taproot (P2TR) key
          if (!account.taprootPrivateKey || !account.taprootPublicKey || !account.taprootAddress) {
            throw new Error(
              "Taproot keys not available. Ensure the wallet has Taproot key derivation."
            );
          }

          const xOnlyPubkey = account.taprootPublicKey;
          const scriptPubKey = p2tr(xOnlyPubkey, undefined, btcNetwork).script;
          // Pass xOnlyPubkey as tapInternalKey: signIdx requires the UNTWEAKED internal key,
          // not the tweaked key embedded in the P2TR scriptPubKey bytes.
          const signatureBase64 = bip322Sign(message, account.taprootPrivateKey, scriptPubKey, xOnlyPubkey);

          return createJsonResponse({
            success: true,
            signatureBase64,
            signatureFormat: "BIP-322 (witness-serialized, Taproot/P2TR)",
            signer: account.taprootAddress,
            network: NETWORK,
            addressType: "P2TR (Taproot)",
            message: {
              original: message,
            },
            verificationNote:
              "Use btc_verify_message with the original message, signature, and address to verify. " +
              "BIP-322 Taproot signatures contain a 64-byte Schnorr witness.",
          });
        } else if (isLegacyAddress) {
          // BIP-137 for legacy (P2PKH) and wrapped SegWit (P2SH-P2WPKH) addresses
          if (!account.btcPrivateKey || !account.btcPublicKey) {
            throw new Error(
              "Bitcoin keys not available. Ensure the wallet has Bitcoin key derivation."
            );
          }

          const formattedMsg = formatBitcoinMessage(message);
          const msgHash = doubleSha256(formattedMsg);

          const sigWithRecovery = secp256k1.sign(msgHash, account.btcPrivateKey, {
            prehash: false,
            lowS: true,
            format: "recovered",
          });

          const recoveryId = sigWithRecovery[0];

          // Select BIP-137 header base by address type
          let headerBase: number;
          const addrPrefix = account.btcAddress!.charAt(0);
          if (addrPrefix === "1" || addrPrefix === "m" || addrPrefix === "n") {
            headerBase = BIP137_HEADER_BASE.P2PKH_COMPRESSED;
          } else if (addrPrefix === "3" || addrPrefix === "2") {
            headerBase = BIP137_HEADER_BASE.P2SH_P2WPKH;
          } else {
            headerBase = BIP137_HEADER_BASE.P2WPKH;
          }
          const header = headerBase + recoveryId;

          const rBytes = sigWithRecovery.slice(1, 33);
          const sBytes = sigWithRecovery.slice(33, 65);

          const bip137Sig = new Uint8Array(65);
          bip137Sig[0] = header;
          bip137Sig.set(rBytes, 1);
          bip137Sig.set(sBytes, 33);

          const signatureHex = hex.encode(bip137Sig);
          const signatureBase64 = Buffer.from(bip137Sig).toString("base64");

          return createJsonResponse({
            success: true,
            signature: signatureHex,
            signatureBase64,
            signatureFormat: "BIP-137 (65 bytes: 1 header + 32 r + 32 s)",
            signer: account.btcAddress,
            network: NETWORK,
            addressType: getAddressTypeFromHeader(header),
            message: {
              original: message,
              prefix: BITCOIN_MSG_PREFIX,
              prefixHex: hex.encode(new TextEncoder().encode(BITCOIN_MSG_PREFIX)),
              formattedHex: hex.encode(formattedMsg),
              hash: hex.encode(msgHash),
            },
            header: {
              value: header,
              recoveryId,
              addressType: getAddressTypeFromHeader(header),
            },
            verificationNote:
              "Use btc_verify_message with the original message and signature to verify. " +
              "Base64 format is commonly used by wallets like Electrum and Bitcoin Core.",
          });
        } else {
          // BIP-322 for native SegWit P2WPKH (bc1q/tb1q) — the default path
          if (!account.btcPrivateKey || !account.btcPublicKey) {
            throw new Error(
              "Bitcoin keys not available. Ensure the wallet has Bitcoin key derivation."
            );
          }

          const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
          const signatureBase64 = bip322Sign(message, account.btcPrivateKey, scriptPubKey);

          return createJsonResponse({
            success: true,
            signatureBase64,
            signatureFormat: "BIP-322 (witness-serialized, native SegWit/P2WPKH)",
            signer: account.btcAddress,
            network: NETWORK,
            addressType: "P2WPKH (native SegWit)",
            message: {
              original: message,
            },
            verificationNote:
              "Use btc_verify_message with the original message, signature, and address to verify. " +
              "BIP-322 P2WPKH signatures contain a 2-item witness: ECDSA sig + compressed pubkey.",
          });
        }
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Verify Bitcoin message signature (BIP-137 or BIP-322)
  server.registerTool(
    "btc_verify_message",
    {
      description:
        "Verify a Bitcoin message signature (BIP-137 or BIP-322) and recover or confirm the signer. " +
        "Auto-detects BIP-137 (65-byte compact) vs BIP-322 (witness-serialized) format. " +
        "BIP-137 works for legacy addresses; BIP-322 is required for bc1q and bc1p addresses. " +
        "Takes the original message and signature (hex or base64). " +
        "Compatible with signatures from most Bitcoin wallets.",
      inputSchema: {
        message: z
          .string()
          .describe("The original plain text message that was signed."),
        signature: z
          .string()
          .describe(
            "The signature in hex or base64. BIP-137: 65 bytes (130 hex / 88 base64). " +
              "BIP-322: variable-length witness-serialized (base64)."
          ),
        address: z
          .string()
          .optional()
          .describe(
            "The Bitcoin address that allegedly signed the message. " +
            "Required for BIP-322 verification (bc1q for P2WPKH, bc1p for P2TR). " +
            "Also used for BIP-137 to confirm the recovered address matches."
          ),
        expectedSigner: z
          .string()
          .optional()
          .describe(
            "Optional: alias for address (backward compatibility). " +
              "If address is not provided, this is used instead."
          ),
      },
    },
    async ({ message, signature, address, expectedSigner }) => {
      try {
        // Use address param, fall back to expectedSigner for backward compat
        const signerAddress = address || expectedSigner;

        // Parse signature from hex or base64
        let signatureBytes: Uint8Array;

        if (
          signature.length === 130 &&
          /^[0-9a-fA-F]+$/.test(signature)
        ) {
          // 130 hex chars = 65 bytes — likely BIP-137
          signatureBytes = hex.decode(signature);
        } else if (/^[A-Za-z0-9+/]+=*$/.test(signature)) {
          // Base64 (BIP-137 88-char or BIP-322 variable length)
          signatureBytes = new Uint8Array(Buffer.from(signature, "base64"));
        } else {
          // Attempt hex decode for arbitrary-length hex
          try {
            signatureBytes = hex.decode(signature);
          } catch {
            signatureBytes = new Uint8Array(Buffer.from(signature, "base64"));
          }
        }

        const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;

        // Detect signature format: BIP-137 (65 bytes, header 27-42) or BIP-322 (witness)
        if (isBip137Signature(signatureBytes)) {
          // ---------------------------------------------------------------
          // BIP-137 verification path
          // ---------------------------------------------------------------
          const header = signatureBytes[0];
          const rBytes = signatureBytes.slice(1, 33);
          const sBytes = signatureBytes.slice(33, 65);

          const recoveryId = getRecoveryIdFromHeader(header);
          const addressType = getAddressTypeFromHeader(header);

          const formattedMessage = formatBitcoinMessage(message);
          const messageHash = doubleSha256(formattedMessage);

          const r = BigInt("0x" + hex.encode(rBytes));
          const s = BigInt("0x" + hex.encode(sBytes));

          const sig = new secp256k1.Signature(r, s, recoveryId);
          const recoveredPoint = sig.recoverPublicKey(messageHash);
          const recoveredPubKey = recoveredPoint.toBytes(true); // compressed

          const isValidSig = secp256k1.verify(
            sig.toBytes(),
            messageHash,
            recoveredPubKey,
            { prehash: false }
          );

          // Derive Bitcoin address from recovered public key based on header type
          let recoveredAddress: string;
          if (header >= 27 && header <= 34) {
            // P2PKH (uncompressed 27-30, compressed 31-34)
            recoveredAddress = p2pkh(recoveredPubKey, btcNetwork).address!;
          } else if (header >= 35 && header <= 38) {
            // P2SH-P2WPKH (SegWit wrapped)
            recoveredAddress = p2sh(p2wpkh(recoveredPubKey, btcNetwork), btcNetwork).address!;
          } else {
            // P2WPKH (native SegWit, headers 39-42)
            recoveredAddress = p2wpkh(recoveredPubKey, btcNetwork).address!;
          }

          const signerMatches = signerAddress
            ? recoveredAddress === signerAddress
            : undefined;

          const isFullyValid =
            isValidSig && (signerAddress ? signerMatches : true);

          return createJsonResponse({
            success: true,
            signatureFormat: "BIP-137",
            signatureValid: isValidSig,
            recoveredPublicKey: hex.encode(recoveredPubKey),
            recoveredAddress,
            network: NETWORK,
            message: {
              original: message,
              prefix: BITCOIN_MSG_PREFIX,
              hash: hex.encode(messageHash),
            },
            header: {
              value: header,
              recoveryId,
              addressType,
            },
            verification: signerAddress
              ? {
                  expectedSigner: signerAddress,
                  signerMatches,
                  isFullyValid,
                  message: isFullyValid
                    ? "Signature is valid and matches expected signer"
                    : isValidSig
                      ? "Signature is valid but does NOT match expected signer"
                      : "Signature is invalid",
                }
              : undefined,
            note:
              "The recovered address is derived from the public key recovered from the signature. " +
              "BIP-137 signatures are compatible with most Bitcoin wallets (Electrum, Bitcoin Core, etc.).",
          });
        } else {
          // ---------------------------------------------------------------
          // BIP-322 verification path
          // ---------------------------------------------------------------
          const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

          if (signerAddress) {
            // Verify against provided address
            let isValid: boolean;
            try {
              isValid = bip322Verify(message, signatureBase64, signerAddress, NETWORK);
            } catch {
              isValid = false;
            }

            return createJsonResponse({
              success: true,
              signatureFormat: "BIP-322",
              signatureValid: isValid,
              network: NETWORK,
              message: {
                original: message,
              },
              verification: {
                expectedSigner: signerAddress,
                signerMatches: isValid,
                isFullyValid: isValid,
                message: isValid
                  ? "BIP-322 signature is valid for the expected signer"
                  : "BIP-322 signature is INVALID for the expected signer",
              },
              note:
                "BIP-322 'simple' format. Witness-serialized signature verified against address.",
            });
          } else {
            // Without address, attempt P2WPKH recovery from witness pubkey
            const witnessItems = RawWitness.decode(signatureBytes);

            if (witnessItems.length === 2 && witnessItems[1].length === 33) {
              // P2WPKH: [ecdsa_sig, compressed_pubkey]
              const pubkeyBytes = witnessItems[1];
              const recoveredAddress = p2wpkh(pubkeyBytes, btcNetwork).address!;

              let isValid: boolean;
              try {
                isValid = bip322Verify(message, signatureBase64, recoveredAddress, NETWORK);
              } catch {
                isValid = false;
              }

              return createJsonResponse({
                success: true,
                signatureFormat: "BIP-322",
                signatureValid: isValid,
                recoveredAddress,
                network: NETWORK,
                message: {
                  original: message,
                },
                note:
                  "BIP-322 P2WPKH: address recovered from witness pubkey. " +
                  "Provide 'address' parameter to verify against a specific address.",
              });
            } else if (witnessItems.length === 1 && witnessItems[0].length === 64) {
              throw new Error(
                "BIP-322 P2TR signatures require the 'address' parameter to verify (no key recovery for Taproot)."
              );
            } else {
              throw new Error(
                `BIP-322: unexpected witness structure (${witnessItems.length} items). ` +
                  "Provide the 'address' parameter to verify."
              );
            }
          }
        }
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Sign raw digest with Schnorr (BIP-340) for Taproot
  server.registerTool(
    "schnorr_sign_digest",
    {
      description:
        "Sign a raw 32-byte digest with Schnorr (BIP-340) using the wallet's Taproot private key. " +
        "Use for Taproot script-path spending, multisig coordination, or any case where " +
        "you need a BIP-340 Schnorr signature over a pre-computed hash (e.g., BIP-341 sighash). " +
        "WARNING: This signs raw digests that cannot be human-verified — use confirmBlindSign=true after reviewing the digest. " +
        "Returns a 64-byte signature and the x-only public key. Requires an unlocked wallet.",
      inputSchema: {
        digest: z
          .string()
          .length(64)
          .regex(/^[0-9a-fA-F]+$/)
          .describe(
            "32-byte hex-encoded digest to sign (e.g., BIP-341 transaction sighash)"
          ),
        auxRand: z
          .string()
          .length(64)
          .regex(/^[0-9a-fA-F]+$/)
          .optional()
          .describe(
            "Optional 32-byte hex auxiliary randomness for BIP-340 (improves side-channel resistance)"
          ),
        confirmBlindSign: z
          .boolean()
          .optional()
          .describe(
            "Set to true to confirm you have reviewed the digest and accept the risk of signing a raw hash. " +
            "Default is false, which returns a warning with the digest for review before signing."
          ),
      },
    },
    async ({ digest, auxRand, confirmBlindSign }) => {
      try {
        // Safety gate: require explicit confirmation before signing a raw digest.
        // An agent could be tricked into signing a malicious transaction sighash
        // because raw digests cannot be decoded into human-readable intent.
        if (!confirmBlindSign) {
          return createJsonResponse({
            warning:
              "schnorr_sign_digest signs a raw 32-byte digest that cannot be decoded or human-verified. " +
              "If an attacker controls the digest value, they could trick you into signing a malicious " +
              "transaction sighash or other sensitive data.",
            digestToReview: digest,
            instructions:
              "Review the digest above. If you trust its origin and intent, re-call schnorr_sign_digest " +
              "with the same parameters plus confirmBlindSign: true to proceed with signing.",
          });
        }

        const account = requireUnlockedWallet();

        if (!account.taprootPrivateKey || !account.taprootPublicKey) {
          throw new Error(
            "Taproot keys not available. Ensure the wallet has Taproot key derivation."
          );
        }

        if (!account.taprootAddress) {
          throw new Error(
            "Taproot address not available for this account."
          );
        }

        // Decode the digest (Zod schema enforces 64 hex chars = 32 bytes)
        const digestBytes = hex.decode(digest);

        // Optional auxiliary randomness for BIP-340 (Zod schema enforces 64 hex chars = 32 bytes when provided)
        const auxBytes = auxRand ? hex.decode(auxRand) : undefined;

        // Sign with Schnorr (BIP-340)
        const signature = schnorr.sign(
          digestBytes,
          account.taprootPrivateKey,
          auxBytes
        );

        // Get x-only public key (already stored as 32 bytes)
        const xOnlyPubkey = account.taprootPublicKey;

        return createJsonResponse({
          success: true,
          signature: hex.encode(signature),
          publicKey: hex.encode(xOnlyPubkey),
          address: account.taprootAddress,
          network: NETWORK,
          signatureFormat: "BIP-340 Schnorr (64 bytes)",
          publicKeyFormat: "x-only (32 bytes)",
          note:
            "For Taproot script-path spending, append sighash type byte if not SIGHASH_DEFAULT (0x00). " +
            "Use this signature with OP_CHECKSIGADD for multisig witness assembly.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Verify Schnorr signature (BIP-340)
  server.registerTool(
    "schnorr_verify_digest",
    {
      description:
        "Verify a BIP-340 Schnorr signature over a 32-byte digest. " +
        "Takes the digest, signature, and public key, returns whether the signature is valid. " +
        "Use for verifying Taproot signatures from other agents in multisig coordination.",
      inputSchema: {
        digest: z
          .string()
          .length(64)
          .regex(/^[0-9a-fA-F]+$/)
          .describe("32-byte hex-encoded digest that was signed"),
        signature: z
          .string()
          .length(128)
          .regex(/^[0-9a-fA-F]+$/)
          .describe("64-byte hex-encoded BIP-340 Schnorr signature"),
        publicKey: z
          .string()
          .length(64)
          .regex(/^[0-9a-fA-F]+$/)
          .describe("32-byte hex-encoded x-only public key of the signer"),
      },
    },
    async ({ digest, signature, publicKey }) => {
      try {
        // Decode inputs (Zod schema enforces correct hex lengths:
        // digest=64 chars/32 bytes, signature=128 chars/64 bytes, publicKey=64 chars/32 bytes)
        const digestBytes = hex.decode(digest);
        const signatureBytes = hex.decode(signature);
        const publicKeyBytes = hex.decode(publicKey);

        // Verify the Schnorr signature
        const isValid = schnorr.verify(
          signatureBytes,
          digestBytes,
          publicKeyBytes
        );

        return createJsonResponse({
          success: true,
          isValid,
          digest,
          signature,
          publicKey,
          message: isValid
            ? "Signature is valid for the given digest and public key"
            : "Signature is INVALID",
          note:
            "BIP-340 Schnorr verification. Use for validating signatures in Taproot multisig coordination.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
