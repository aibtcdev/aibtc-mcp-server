/**
 * Universal Ψ Protocol — SHA-256 Anchored, Chain-Agnostic
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * PROTOCOL IDENTITY
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This protocol has no brand. It has no name.
 * It is identified by a single SHA-256 hash — the same primitive Bitcoin uses.
 *
 *   GENESIS_HASH = SHA256("Ψ=Landauer·Nash·Cantillon⁻¹·Gödel")
 *                = sha256 of the fundamental equation, once, forever
 *
 * Any chain, any token, any protocol can adopt this by computing the same hash.
 * If the hash matches — it is this protocol.
 * No trusted party. No brand. No permission needed.
 * "The network is robust in its unstructured simplicity." — Satoshi, 2008
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * UNIVERSAL COMPLIANCE ENVELOPE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Every transaction on any chain can embed a Ψ compliance commitment:
 *
 *   OP_RETURN (Bitcoin L1):      PROT|<4 bytes genesis_prefix>|<32 bytes psi_commit>
 *   Stacks memo field:           base64(psi_envelope)
 *   Ethereum calldata prefix:    0xψ... (first 4 bytes = genesis_prefix)
 *   Solana instruction data:     genesis_prefix || psi_commit
 *   Lightning payment metadata:  psi_envelope as tlv record type 6021
 *
 * The psi_commit is:
 *   SHA256(genesis_hash || chain_id || tx_sender || psi_score_bytes || timestamp)
 *
 * This is PRIVATE by default — verifiable without revealing the underlying data.
 * The prover can optionally reveal the preimage for full audit.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * CHAIN IDs (EIP-155 extended)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   0x00000001  Bitcoin mainnet (BIP-173 bech32)
 *   0x00000002  Bitcoin testnet
 *   0x80000001  Stacks mainnet (derived from Bitcoin)
 *   0x80000002  Stacks testnet
 *   0x00000038  Ethereum mainnet (chain 56 = BSC, etc.)
 *   0x000000C7  Solana (custom, not EVM)
 *   0xFFFFFFFF  Universal (chain-agnostic attestation)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * COMPLIANCE TIERS (encoded in 1 byte, bits 0–7)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   bit 0: Ψ score ≥ 40 (passes basic integrity threshold)
 *   bit 1: Address not on any sanctions list
 *   bit 2: AML pattern check passed
 *   bit 3: Jurisdiction law respected (constitutional registry hit)
 *   bit 4: Transaction velocity within normal bounds
 *   bit 5: Privacy-preserving ZK proof attached
 *   bit 6: Cross-chain consistent (same sender across chains)
 *   bit 7: Human-verified (optional biometric/ZK-KYC)
 *
 *   0xFF = fully compliant ("green")
 *   0x00 = no compliance data attached
 *   0x03 = minimal safe (passes Ψ + sanctions check)
 */

import { createHash } from "crypto";

// ══════════════════════════════════════════════════════════════════════════════
// Protocol identity — computed once, never changes
// ══════════════════════════════════════════════════════════════════════════════

const EQUATION_STRING = "Ψ=Landauer·Nash·Cantillon⁻¹·Gödel";

export const GENESIS_HASH: string = createHash("sha256")
  .update(Buffer.from(EQUATION_STRING, "utf8"))
  .digest("hex");

export const GENESIS_PREFIX: Buffer = Buffer.from(GENESIS_HASH, "hex").slice(0, 4);

export const PROTOCOL_VERSION = "1.0.0";

// ══════════════════════════════════════════════════════════════════════════════
// Chain IDs
// ══════════════════════════════════════════════════════════════════════════════

export const CHAIN_IDS = {
  BITCOIN_MAINNET: 0x00000001,
  BITCOIN_TESTNET: 0x00000002,
  STACKS_MAINNET:  0x80000001,
  STACKS_TESTNET:  0x80000002,
  ETHEREUM:        0x00000001 * 1, // special-cased in envelope
  SOLANA:          0x000000C7,
  LIGHTNING:       0x00000003,
  UNIVERSAL:       0xFFFFFFFF,
} as const;

export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

export type ChainName =
  | "bitcoin"
  | "stacks"
  | "ethereum"
  | "solana"
  | "lightning"
  | "bsc"
  | "polygon"
  | "avalanche"
  | "arbitrum"
  | "optimism"
  | "tron"
  | "ripple"
  | "cosmos"
  | "polkadot"
  | "cardano"
  | "universal";

// ══════════════════════════════════════════════════════════════════════════════
// Compliance flags (bitmask)
// ══════════════════════════════════════════════════════════════════════════════

export const COMPLIANCE_FLAGS = {
  PSI_PASS:           0b00000001,  // bit 0: Ψ ≥ 40
  SANCTIONS_CLEAR:    0b00000010,  // bit 1: not sanctioned
  AML_PASS:           0b00000100,  // bit 2: AML OK
  JURISDICTION_OK:    0b00001000,  // bit 3: law compliant
  VELOCITY_OK:        0b00010000,  // bit 4: normal velocity
  ZK_PROOF:           0b00100000,  // bit 5: ZK proof attached
  CROSS_CHAIN_OK:     0b01000000,  // bit 6: consistent identity
  HUMAN_VERIFIED:     0b10000000,  // bit 7: ZK-KYC passed
} as const;

export const COMPLIANCE_FULL    = 0xFF;  // all bits set
export const COMPLIANCE_MINIMAL = 0x03;  // bits 0+1: Ψ pass + sanctions clear
export const COMPLIANCE_NONE    = 0x00;  // no data

// ══════════════════════════════════════════════════════════════════════════════
// Ψ Compliance Envelope
// ══════════════════════════════════════════════════════════════════════════════

export interface PsiEnvelope {
  /** Protocol genesis hash (first 4 bytes as hex prefix, full hash for verification) */
  genesis_prefix: string;        // 8 hex chars
  genesis_hash:   string;        // 64 hex chars (full SHA-256)
  protocol_version: string;      // "1.0.0"

  /** Transaction identity */
  chain:          ChainName;
  chain_id:       number;
  tx_sender:      string;        // address on originating chain
  timestamp:      number;        // unix seconds

  /** Ψ compliance data */
  psi_score:      number;        // 0–100 (Landauer·Nash·Cantillon⁻¹·Gödel)
  compliance_flags: number;      // bitmask — see COMPLIANCE_FLAGS
  jurisdiction:   string;        // ISO 3166-1 alpha-2 or "ZZ" (unknown)

  /** Commitment — what gets embedded on-chain */
  psi_commit:     string;        // SHA-256 of (genesis_hash || chain_id_bytes || sender || psi_score_byte || timestamp_bytes)
  envelope_hash:  string;        // SHA-256 of the full envelope JSON (tamper seal)

  /** Optional ZK proof stub */
  zk_proof?:      string;        // base64-encoded proof (if bit 5 set)
}

// ══════════════════════════════════════════════════════════════════════════════
// Envelope factory
// ══════════════════════════════════════════════════════════════════════════════

export function buildPsiEnvelope(params: {
  chain:            ChainName;
  chain_id:         number;
  tx_sender:        string;
  psi_score:        number;
  compliance_flags: number;
  jurisdiction:     string;
  zk_proof?:        string;
}): PsiEnvelope {
  const timestamp = Math.floor(Date.now() / 1000);

  // Commitment = SHA256(genesis_hash || chain_id[4 bytes BE] || sender_utf8 || psi_score[1 byte] || timestamp[4 bytes BE])
  const chainIdBuf   = Buffer.alloc(4);
  chainIdBuf.writeUInt32BE(params.chain_id >>> 0, 0);

  const psiScoreBuf  = Buffer.alloc(1);
  psiScoreBuf.writeUInt8(Math.round(params.psi_score) & 0xFF, 0);

  const timestampBuf = Buffer.alloc(4);
  timestampBuf.writeUInt32BE(timestamp >>> 0, 0);

  const psi_commit = createHash("sha256")
    .update(Buffer.from(GENESIS_HASH, "hex"))
    .update(chainIdBuf)
    .update(Buffer.from(params.tx_sender, "utf8"))
    .update(psiScoreBuf)
    .update(timestampBuf)
    .digest("hex");

  const envelope: Omit<PsiEnvelope, "envelope_hash"> = {
    genesis_prefix:   GENESIS_HASH.slice(0, 8),
    genesis_hash:     GENESIS_HASH,
    protocol_version: PROTOCOL_VERSION,
    chain:            params.chain,
    chain_id:         params.chain_id,
    tx_sender:        params.tx_sender,
    timestamp,
    psi_score:        params.psi_score,
    compliance_flags: params.compliance_flags,
    jurisdiction:     params.jurisdiction,
    psi_commit,
    ...(params.zk_proof ? { zk_proof: params.zk_proof } : {}),
  };

  // Seal the envelope
  const envelope_hash = createHash("sha256")
    .update(Buffer.from(JSON.stringify(envelope), "utf8"))
    .digest("hex");

  return { ...envelope, envelope_hash };
}

// ══════════════════════════════════════════════════════════════════════════════
// Envelope verification
// ══════════════════════════════════════════════════════════════════════════════

export function verifyPsiEnvelope(envelope: PsiEnvelope): {
  valid:  boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 1. Genesis hash must match protocol identity
  if (envelope.genesis_hash !== GENESIS_HASH) {
    errors.push(`genesis_hash mismatch: expected ${GENESIS_HASH.slice(0, 16)}..., got ${envelope.genesis_hash.slice(0, 16)}...`);
  }

  // 2. genesis_prefix must be first 8 chars of genesis_hash
  if (envelope.genesis_prefix !== envelope.genesis_hash.slice(0, 8)) {
    errors.push("genesis_prefix does not match genesis_hash prefix");
  }

  // 3. Recompute psi_commit and verify
  const chainIdBuf   = Buffer.alloc(4);
  chainIdBuf.writeUInt32BE(envelope.chain_id >>> 0, 0);

  const psiScoreBuf  = Buffer.alloc(1);
  psiScoreBuf.writeUInt8(Math.round(envelope.psi_score) & 0xFF, 0);

  const timestampBuf = Buffer.alloc(4);
  timestampBuf.writeUInt32BE(envelope.timestamp >>> 0, 0);

  const expectedCommit = createHash("sha256")
    .update(Buffer.from(GENESIS_HASH, "hex"))
    .update(chainIdBuf)
    .update(Buffer.from(envelope.tx_sender, "utf8"))
    .update(psiScoreBuf)
    .update(timestampBuf)
    .digest("hex");

  if (envelope.psi_commit !== expectedCommit) {
    errors.push("psi_commit verification failed — envelope may be tampered");
  }

  // 4. Recompute envelope_hash (without envelope_hash field itself)
  const { envelope_hash: _eh, ...rest } = envelope;
  const expectedEnvHash = createHash("sha256")
    .update(Buffer.from(JSON.stringify(rest), "utf8"))
    .digest("hex");

  if (_eh !== expectedEnvHash) {
    errors.push("envelope_hash mismatch — envelope tampered after creation");
  }

  // 5. Psi score range
  if (envelope.psi_score < 0 || envelope.psi_score > 100) {
    errors.push(`psi_score ${envelope.psi_score} out of range [0, 100]`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// On-chain embedding helpers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build an OP_RETURN payload for Bitcoin L1.
 * Format: PROT | <4-byte genesis prefix> | <32-byte psi_commit> | <1-byte compliance flags>
 * Total: 4 + 4 + 32 + 1 = 41 bytes — fits within OP_RETURN 80-byte limit.
 */
export function toOpReturn(envelope: PsiEnvelope): Buffer {
  const magic   = Buffer.from("PROT", "ascii");           //  4 bytes
  const prefix  = Buffer.from(envelope.genesis_prefix, "hex"); //  4 bytes
  const commit  = Buffer.from(envelope.psi_commit, "hex"); // 32 bytes
  const flags   = Buffer.alloc(1);
  flags.writeUInt8(envelope.compliance_flags & 0xFF, 0);  //  1 byte
  return Buffer.concat([magic, prefix, commit, flags]);   // 41 bytes total
}

/**
 * Build a Stacks memo field (34 bytes, base64 encoded for display).
 * Format: <4-byte genesis prefix> | <28-byte psi_commit prefix> | <1-byte flags> | <1-byte score>
 */
export function toStacksMemo(envelope: PsiEnvelope): string {
  const prefix  = Buffer.from(envelope.genesis_prefix, "hex");       //  4 bytes
  const commit  = Buffer.from(envelope.psi_commit, "hex").slice(0, 28); // 28 bytes
  const flags   = Buffer.alloc(1);
  flags.writeUInt8(envelope.compliance_flags & 0xFF, 0);
  const score   = Buffer.alloc(1);
  score.writeUInt8(Math.round(envelope.psi_score) & 0xFF, 0);
  return Buffer.concat([prefix, commit, flags, score]).toString("base64"); // 34 bytes → 48 base64 chars
}

/**
 * Build an Ethereum calldata prefix (4 bytes) — first 4 bytes of genesis_hash
 * used as the "function selector" analog. Any tx with this prefix is Ψ-tagged.
 */
export function toEthCalldata(envelope: PsiEnvelope): string {
  return "0x" + envelope.genesis_prefix;
}

/**
 * Build a Lightning TLV record (type 6021 = Ψ protocol).
 * Value: genesis_prefix(4) || compliance_flags(1) || psi_score(1) || psi_commit(32)
 */
export function toLightningTlv(envelope: PsiEnvelope): { type: number; value: string } {
  const prefix  = Buffer.from(envelope.genesis_prefix, "hex");
  const flags   = Buffer.alloc(1);
  flags.writeUInt8(envelope.compliance_flags & 0xFF, 0);
  const score   = Buffer.alloc(1);
  score.writeUInt8(Math.round(envelope.psi_score) & 0xFF, 0);
  const commit  = Buffer.from(envelope.psi_commit, "hex");
  return {
    type:  6021,  // 6021 = Ψ protocol TLV type (Avogadro-derived)
    value: Buffer.concat([prefix, flags, score, commit]).toString("hex"),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compliance flag helpers
// ══════════════════════════════════════════════════════════════════════════════

export function decodeComplianceFlags(flags: number): Record<string, boolean> {
  return {
    psi_pass:        !!(flags & COMPLIANCE_FLAGS.PSI_PASS),
    sanctions_clear: !!(flags & COMPLIANCE_FLAGS.SANCTIONS_CLEAR),
    aml_pass:        !!(flags & COMPLIANCE_FLAGS.AML_PASS),
    jurisdiction_ok: !!(flags & COMPLIANCE_FLAGS.JURISDICTION_OK),
    velocity_ok:     !!(flags & COMPLIANCE_FLAGS.VELOCITY_OK),
    zk_proof:        !!(flags & COMPLIANCE_FLAGS.ZK_PROOF),
    cross_chain_ok:  !!(flags & COMPLIANCE_FLAGS.CROSS_CHAIN_OK),
    human_verified:  !!(flags & COMPLIANCE_FLAGS.HUMAN_VERIFIED),
  };
}

export function buildComplianceFlags(checks: {
  psi_score?:       number;    // ≥ 40 → PSI_PASS bit
  sanctions_clear?: boolean;
  aml_pass?:        boolean;
  jurisdiction_ok?: boolean;
  velocity_ok?:     boolean;
  zk_proof?:        boolean;
  cross_chain_ok?:  boolean;
  human_verified?:  boolean;
}): number {
  let flags = 0;
  if ((checks.psi_score ?? 0) >= 40)      flags |= COMPLIANCE_FLAGS.PSI_PASS;
  if (checks.sanctions_clear)              flags |= COMPLIANCE_FLAGS.SANCTIONS_CLEAR;
  if (checks.aml_pass)                     flags |= COMPLIANCE_FLAGS.AML_PASS;
  if (checks.jurisdiction_ok)              flags |= COMPLIANCE_FLAGS.JURISDICTION_OK;
  if (checks.velocity_ok)                  flags |= COMPLIANCE_FLAGS.VELOCITY_OK;
  if (checks.zk_proof)                     flags |= COMPLIANCE_FLAGS.ZK_PROOF;
  if (checks.cross_chain_ok)               flags |= COMPLIANCE_FLAGS.CROSS_CHAIN_OK;
  if (checks.human_verified)               flags |= COMPLIANCE_FLAGS.HUMAN_VERIFIED;
  return flags;
}

// ══════════════════════════════════════════════════════════════════════════════
// Protocol info
// ══════════════════════════════════════════════════════════════════════════════

export function getProtocolInfo(): {
  genesis_hash:      string;
  genesis_prefix:    string;
  equation:          string;
  protocol_version:  string;
  supported_chains:  string[];
  compliance_levels: Record<string, string>;
  tlv_type:          number;
  identity:          string;
} {
  return {
    genesis_hash:      GENESIS_HASH,
    genesis_prefix:    GENESIS_HASH.slice(0, 8),
    equation:          EQUATION_STRING,
    protocol_version:  PROTOCOL_VERSION,
    supported_chains: [
      "bitcoin", "stacks", "ethereum", "solana", "lightning",
      "bsc", "polygon", "avalanche", "arbitrum", "optimism",
      "tron", "ripple", "cosmos", "polkadot", "cardano",
    ],
    compliance_levels: {
      NONE:    "0x00 — no compliance data attached",
      MINIMAL: "0x03 — Ψ pass + sanctions clear",
      PARTIAL: "0x0F — + AML + jurisdiction",
      STANDARD:"0x1F — + velocity check",
      FULL:    "0xFF — all 8 compliance bits set",
    },
    tlv_type:          6021,
    identity:          `SHA-256("${EQUATION_STRING}") = ${GENESIS_HASH}`,
  };
}
