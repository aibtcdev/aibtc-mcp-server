/**
 * Redact sensitive values from strings before logging
 */

// All field names whose values should be redacted
const SENSITIVE_FIELDS =
  "password|mnemonic|secret|privateKey|btcPrivateKey|taprootPrivateKey|nostrPrivateKey|stxPrivateKey|seed|seedPhrase|CLIENT_MNEMONIC|apiKey|api_key|authToken|auth_token";

/**
 * Redacts sensitive values from JSON-like strings.
 * Covers:
 *   - JSON fields: "mnemonic":"value", privateKey:"value", etc.
 *   - Hex private keys: 64 consecutive hex characters (secp256k1/ed25519)
 *   - WIF private keys: Bitcoin WIF format (starts with K, L, or 5)
 */
export function redactSensitive(input: string): string {
  return input
    // JSON double-quoted field : double-quoted value
    .replace(
      new RegExp(`"(${SENSITIVE_FIELDS})"\\s*:\\s*"([^"]*)"`, "gi"),
      '"$1":"[REDACTED]"'
    )
    // JSON single-quoted field : single-quoted value
    .replace(
      new RegExp(`'(${SENSITIVE_FIELDS})'\\s*:\\s*'([^']*)'`, "gi"),
      "'$1':'[REDACTED]'"
    )
    // Object literal field : double-quoted value
    .replace(
      new RegExp(`(${SENSITIVE_FIELDS})\\s*:\\s*"([^"]*)"`, "gi"),
      '$1:"[REDACTED]"'
    )
    // Object literal field : single-quoted value
    .replace(
      new RegExp(`(${SENSITIVE_FIELDS})\\s*:\\s*'([^']*)'`, "gi"),
      "$1:'[REDACTED]'"
    )
    // Hex private key: 64 hex chars (secp256k1 / ed25519 private keys)
    .replace(/\b([0-9a-f]{64})\b/gi, "[HEX-KEY-REDACTED]")
    // WIF private key: starts with K, L, or 5 (Bitcoin mainnet compressed/uncompressed)
    .replace(/\b([KL5][1-9A-HJ-NP-Za-km-z]{50,51})\b/g, "[WIF-KEY-REDACTED]");
}
