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
 * Bitcoin Message Signing (BIP-137):
 * - btc_sign_message: Sign messages with Bitcoin private key (BIP-137 format)
 * - btc_verify_message: Verify Bitcoin message signatures
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
import { hashMessage, verifyMessageSignatureRsv } from "@stacks/encryption";
import { bytesToHex } from "@stacks/common";
import { sha256 } from "@noble/hashes/sha256";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hex } from "@scure/base";
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
  return sha256(sha256(data));
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
        const verificationHash = bytesToHex(sha256(encodedBytes));

        return createJsonResponse({
          success: true,
          signature,
          signatureFormat: "RSV (65 bytes hex)",
          signer: account.stacksAddress,
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
        const verificationHash = bytesToHex(sha256(encodedBytes));

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
          signer: account.stacksAddress,
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

  // Sign Bitcoin message (BIP-137)
  server.registerTool(
    "btc_sign_message",
    {
      description:
        "Sign a plain text message using the Bitcoin message signing format (BIP-137). " +
        "Creates a 65-byte signature compatible with most Bitcoin wallets. " +
        "Use cases: proving Bitcoin address ownership, authentication, off-chain verification. " +
        "Requires an unlocked wallet with Bitcoin keys.",
      inputSchema: {
        message: z
          .string()
          .describe(
            "The plain text message to sign. Will be formatted with Bitcoin message prefix before signing."
          ),
      },
    },
    async ({ message }) => {
      try {
        const account = requireUnlockedWallet();

        if (!account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Ensure the wallet has Bitcoin key derivation."
          );
        }

        // Format and hash the message according to BIP-137
        const formattedMsg = formatBitcoinMessage(message);
        const msgHash = doubleSha256(formattedMsg);

        // Sign with recoverable signature
        // format: 'recovered' returns 65 bytes: [recoveryId][32 r][32 s]
        const sigWithRecovery = secp256k1.sign(msgHash, account.btcPrivateKey, {
          prehash: false,
          lowS: true,
          format: "recovered",
        });

        // Build BIP-137 signature: [header][r][s]
        // For P2WPKH (native SegWit), header = 39 + recoveryId
        const recoveryId = sigWithRecovery[0];
        const header = BIP137_HEADER_BASE.P2WPKH + recoveryId;

        // Build the 65-byte BIP-137 signature: [header][r][s]
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
          signer: account.bitcoinAddress,
          network: NETWORK,
          addressType: "P2WPKH (native SegWit)",
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
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Verify Bitcoin message signature (BIP-137)
  server.registerTool(
    "btc_verify_message",
    {
      description:
        "Verify a BIP-137 Bitcoin message signature and recover the signer's address. " +
        "Takes the original message and signature (hex or base64), recovers the public key, " +
        "and derives the Bitcoin address. Compatible with signatures from most Bitcoin wallets.",
      inputSchema: {
        message: z
          .string()
          .describe("The original plain text message that was signed."),
        signature: z
          .string()
          .describe(
            "The BIP-137 signature (65 bytes as hex or base64). " +
              "Hex format: 130 characters. Base64 format: 88 characters."
          ),
        expectedSigner: z
          .string()
          .optional()
          .describe(
            "Optional: expected signer Bitcoin address to verify against. " +
              "If provided, returns whether the signature is valid for this address."
          ),
      },
    },
    async ({ message, signature, expectedSigner }) => {
      try {
        // Parse signature from hex or base64
        let signatureBytes: Uint8Array;

        // Try to detect format
        if (signature.length === 130 && /^[0-9a-fA-F]+$/.test(signature)) {
          // Hex format (65 bytes = 130 hex chars)
          signatureBytes = hex.decode(signature);
        } else if (signature.length === 88 && /^[A-Za-z0-9+/=]+$/.test(signature)) {
          // Base64 format
          signatureBytes = new Uint8Array(Buffer.from(signature, "base64"));
        } else {
          // Try hex first, then base64
          try {
            signatureBytes = hex.decode(signature);
          } catch {
            signatureBytes = new Uint8Array(Buffer.from(signature, "base64"));
          }
        }

        if (signatureBytes.length !== 65) {
          throw new Error(
            `Invalid signature length: ${signatureBytes.length} bytes. Expected 65 bytes.`
          );
        }

        // Extract header and signature components
        const header = signatureBytes[0];
        const rBytes = signatureBytes.slice(1, 33);
        const sBytes = signatureBytes.slice(33, 65);

        // Get recovery ID and address type from header
        const recoveryId = getRecoveryIdFromHeader(header);
        const addressType = getAddressTypeFromHeader(header);

        // Format the message and hash it
        const formattedMessage = formatBitcoinMessage(message);
        const messageHash = doubleSha256(formattedMessage);

        // Recover public key from signature
        // Create signature object from r, s, and recovery
        const r = BigInt("0x" + hex.encode(rBytes));
        const s = BigInt("0x" + hex.encode(sBytes));

        const sig = new secp256k1.Signature(r, s, recoveryId);
        const recoveredPoint = sig.recoverPublicKey(messageHash);
        const recoveredPubKey = recoveredPoint.toBytes(true); // compressed

        // Verify the signature
        const isValidSig = secp256k1.verify(
          sig.toBytes(),
          messageHash,
          recoveredPubKey,
          { prehash: false }
        );

        // Derive Bitcoin address from public key
        // Import btc-signer for address derivation
        const btc = await import("@scure/btc-signer");
        const btcNetwork = NETWORK === "testnet" ? btc.TEST_NETWORK : btc.NETWORK;
        const p2wpkh = btc.p2wpkh(recoveredPubKey, btcNetwork);
        const recoveredAddress = p2wpkh.address!;

        // Check against expected signer if provided
        const signerMatches = expectedSigner
          ? recoveredAddress === expectedSigner
          : undefined;

        const isFullyValid = isValidSig && (expectedSigner ? signerMatches : true);

        return createJsonResponse({
          success: true,
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
          verification: expectedSigner
            ? {
                expectedSigner,
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
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
