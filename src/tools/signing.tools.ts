/**
 * Message Signing Tools
 *
 * These tools provide message signing capabilities for agent identity and authentication:
 * - sip018_sign: Sign structured Clarity data (SIP-018 standard)
 * - sip018_verify: Verify SIP-018 signature and recover signer
 * - sip018_hash: Compute SIP-018 message hash without signing
 *
 * SIP-018 signatures can be verified both off-chain and on-chain by smart contracts.
 * Use cases: meta-transactions, off-chain voting, permits, proving address control.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  signStructuredData,
  hashStructuredData,
  encodeStructuredData,
  publicKeyFromSignatureRsv,
  getAddressFromPublicKey,
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
 * SIP-018 structured data prefix (ASCII "SIP018")
 */
const SIP018_PREFIX = "0x534950303138";

/**
 * Convert a JSON value to a ClarityValue
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
  if (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  ) {
    const typed = value as { type: string; value?: unknown };

    switch (typed.type) {
      case "uint":
        if (typeof typed.value !== "number" && typeof typed.value !== "string") {
          throw new Error("uint type requires a numeric value");
        }
        return uintCV(BigInt(typed.value));

      case "int":
        if (typeof typed.value !== "number" && typeof typed.value !== "string") {
          throw new Error("int type requires a numeric value");
        }
        return intCV(BigInt(typed.value));

      case "principal":
        if (typeof typed.value !== "string") {
          throw new Error("principal type requires a string value");
        }
        return principalCV(typed.value);

      case "ascii":
        if (typeof typed.value !== "string") {
          throw new Error("ascii type requires a string value");
        }
        return stringAsciiCV(typed.value);

      case "utf8":
        if (typeof typed.value !== "string") {
          throw new Error("utf8 type requires a string value");
        }
        return stringUtf8CV(typed.value);

      case "buff":
      case "buffer":
        if (typeof typed.value !== "string") {
          throw new Error("buff type requires a hex string value");
        }
        // Support both "0x..." and raw hex
        const hexStr = typed.value.startsWith("0x")
          ? typed.value.slice(2)
          : typed.value;
        return bufferCV(Uint8Array.from(Buffer.from(hexStr, "hex")));

      case "bool":
        return typed.value ? trueCV() : falseCV();

      case "none":
        return noneCV();

      case "some":
        return someCV(jsonToClarityValue(typed.value));

      case "list":
        if (!Array.isArray(typed.value)) {
          throw new Error("list type requires an array value");
        }
        return listCV(typed.value.map(jsonToClarityValue));

      case "tuple":
        if (typeof typed.value !== "object" || typed.value === null) {
          throw new Error("tuple type requires an object value");
        }
        const tupleData: { [key: string]: ClarityValue } = {};
        for (const [k, v] of Object.entries(typed.value)) {
          tupleData[k] = jsonToClarityValue(v);
        }
        return tupleCV(tupleData);

      default:
        throw new Error(`Unknown type hint: ${typed.type}`);
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
        // Get wallet account (requires unlocked wallet)
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();

        if (!account) {
          throw new Error(
            "Wallet is not unlocked. Use wallet_unlock first to enable signing."
          );
        }

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

        // Compute the message hash for reference
        const messageHash = hashStructuredData(messageCV);
        const domainHash = hashStructuredData(domainCV);
        const fullEncodedHash = encodeStructuredData({
          message: messageCV,
          domain: domainCV,
        });

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
            full: fullEncodedHash,
            prefix: SIP018_PREFIX,
          },
          domain: {
            name: domain.name,
            version: domain.version,
            chainId,
          },
          verificationNote:
            "Use sip018_verify with the signature and full hash to recover the signer. " +
            "For on-chain verification, use secp256k1-recover? with the full hash.",
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
        "Takes the full encoded hash (from sip018_sign or sip018_hash) and the signature, " +
        "then recovers the public key and derives the signer's Stacks address.",
      inputSchema: {
        messageHash: z
          .string()
          .describe(
            "The full SIP-018 encoded hash (from sip018_sign 'full' hash or sip018_hash). " +
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
        const fullEncodedHash = encodeStructuredData({
          message: messageCV,
          domain: domainCV,
        });

        return createJsonResponse({
          success: true,
          hashes: {
            message: messageHash,
            domain: domainHash,
            full: fullEncodedHash,
          },
          hashConstruction: {
            prefix: SIP018_PREFIX,
            formula: "sha256(prefix || domainHash || messageHash)",
          },
          domain: {
            name: domain.name,
            version: domain.version,
            chainId,
          },
          network: NETWORK,
          clarityVerification: {
            note: "For on-chain verification, use these hashes with secp256k1-recover?",
            example:
              "(secp256k1-recover? (sha256 (concat 0x534950303138 (concat domain-hash message-hash))) signature)",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
