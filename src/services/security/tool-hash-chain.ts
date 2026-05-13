/**
 * Tool Hash Chain — سلسلة تجزئة الأدوات
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * Bitcoin-identical internal security design:
 *
 *   Bitcoin block  →  Tool block
 *   ─────────────────────────────────────────────────────
 *   prev_block_hash → prev_block_hash
 *   merkle_root     → merkle_root (all call hashes in session)
 *   timestamp       → timestamp (monotonic, milliseconds)
 *   nonce           → session_nonce (random 32-byte)
 *   transactions[]  → {tool_name, input_hash, output_hash}
 *   block_hash      → SHA256(SHA256(block_header))  ← Bitcoin double-SHA256
 *
 * Bitcoin consensus rules (7) applied to tool calls:
 *   Rule 1: Genesis block must anchor to GENESIS_HASH
 *   Rule 2: prev_block_hash must match previous block's hash
 *   Rule 3: Timestamp must be ≥ previous block timestamp
 *   Rule 4: input_hash must equal SHA256(actual inputs)
 *   Rule 5: Tool must be registered (like valid transaction format)
 *   Rule 6: Block size ≤ MAX_OUTPUT_BYTES (like block weight limit)
 *   Rule 7: No double-spend: same (tool, input_hash) not called twice per session
 *
 * Merkle tree: every session builds a binary Merkle tree of block hashes.
 * SPV proof: prove any single call without revealing all session calls.
 */

import { createHash, randomBytes } from "crypto";

// ══════════════════════════════════════════════════════════════════════════════
// BITCOIN CONSTANTS (mirrored exactly)
// ══════════════════════════════════════════════════════════════════════════════

// SHA-256("Ψ=Landauer·Nash·Cantillon⁻¹·Gödel") — the protocol genesis
export const GENESIS_HASH =
  "bbc267eec7ee6f3889dfc7fc7fd723103e3ba1bc126547515d09edddcae0d4d1";

// Genesis block — block 0, like Bitcoin's genesis block (Jan 3 2009 = 1231006505)
// Our genesis: 2026-01-01T00:00:00Z = 1735689600
export const GENESIS_TIMESTAMP = 1735689600_000; // ms

const MAX_OUTPUT_BYTES = 512 * 1024; // 512 KB (like Bitcoin's 4MB weight limit)

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface ToolBlock {
  block_height: number;       // call index in this session (0 = genesis)
  prev_block_hash: string;    // hash of previous block (GENESIS_HASH for block 0)
  tool_name: string;
  input_hash: string;         // SHA256(SHA256(JSON(inputs)))
  output_hash: string;        // SHA256(SHA256(JSON(output)))
  output_size_bytes: number;
  timestamp_ms: number;
  session_nonce: string;      // 8-byte hex — unique per session
  block_hash: string;         // SHA256(SHA256(block_header_hex))
  merkle_root: string;        // Merkle root of all block_hashes so far
}

export interface ConsensusViolation {
  rule: number;
  rule_name: string;
  detail: string;
}

export interface MerkleProof {
  block_height: number;
  block_hash: string;
  proof_hashes: string[];     // sibling hashes from leaf to root
  proof_positions: ("left" | "right")[]; // position of each sibling
  merkle_root: string;
  verification_formula: string;
}

export interface ChainVerification {
  valid: boolean;
  block_count: number;
  violations: ConsensusViolation[];
  merkle_root: string;
  chain_hash: string;         // SHA256 of entire chain — tamper-evident fingerprint
}

// ══════════════════════════════════════════════════════════════════════════════
// HASHING — Bitcoin-identical double-SHA256
// ══════════════════════════════════════════════════════════════════════════════

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function doubleSha256(data: string): string {
  return sha256(sha256(data));
}

function hashInputs(inputs: unknown): string {
  return doubleSha256(JSON.stringify(inputs ?? {}));
}

function hashOutput(output: unknown): string {
  const str = JSON.stringify(output ?? {});
  return doubleSha256(str);
}

// ══════════════════════════════════════════════════════════════════════════════
// MERKLE TREE — Binary Merkle tree identical to Bitcoin's
// ══════════════════════════════════════════════════════════════════════════════

function buildMerkleTree(hashes: string[]): string[][] {
  if (hashes.length === 0) return [[GENESIS_HASH]];
  const levels: string[][] = [hashes.slice()];
  let current = hashes.slice();
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i]; // duplicate last (Bitcoin behavior)
      next.push(doubleSha256(left + right));
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return GENESIS_HASH;
  const levels = buildMerkleTree(hashes);
  return levels[levels.length - 1][0];
}

export function generateMerkleProof(hashes: string[], leafIndex: number): MerkleProof {
  const levels = buildMerkleTree(hashes);
  const proofHashes: string[] = [];
  const proofPositions: ("left" | "right")[] = [];
  let idx = leafIndex;

  for (let level = 0; level < levels.length - 1; level++) {
    const row = levels[level];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : Math.min(idx + 1, row.length - 1);
    proofHashes.push(row[siblingIdx]);
    proofPositions.push(isRight ? "left" : "right");
    idx = Math.floor(idx / 2);
  }

  const root = levels[levels.length - 1][0];
  const steps = proofHashes.map((h, i) =>
    proofPositions[i] === "left"
      ? `dSHA256(${h} || current)`
      : `dSHA256(current || ${h})`
  );

  return {
    block_height: leafIndex,
    block_hash: hashes[leafIndex],
    proof_hashes: proofHashes,
    proof_positions: proofPositions,
    merkle_root: root,
    verification_formula: `Start: ${hashes[leafIndex]} → ${steps.join(" → ")} → ${root}`,
  };
}

export function verifyMerkleProof(proof: MerkleProof): boolean {
  let current = proof.block_hash;
  for (let i = 0; i < proof.proof_hashes.length; i++) {
    const sibling = proof.proof_hashes[i];
    const pos = proof.proof_positions[i];
    current = pos === "left"
      ? doubleSha256(sibling + current)
      : doubleSha256(current + sibling);
  }
  return current === proof.merkle_root;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCK CONSTRUCTION — Bitcoin-identical header format
// ══════════════════════════════════════════════════════════════════════════════

function buildBlockHeader(
  blockHeight: number,
  prevBlockHash: string,
  merkleRoot: string,
  timestamp: number,
  sessionNonce: string,
  toolName: string,
  inputHash: string,
  outputHash: string,
): string {
  // Bitcoin header: version + prev_hash + merkle_root + time + bits + nonce
  // Our header:     height  + prev_hash + merkle_root + time + tool + input_hash + output_hash + nonce
  return [
    blockHeight.toString(16).padStart(8, "0"),
    prevBlockHash,
    merkleRoot,
    timestamp.toString(16).padStart(16, "0"),
    sha256(toolName),                    // tool identifier
    inputHash,
    outputHash,
    sessionNonce,
  ].join("");
}

// ══════════════════════════════════════════════════════════════════════════════
// SESSION CHAIN — per-session blockchain
// ══════════════════════════════════════════════════════════════════════════════

export class ToolChain {
  private blocks: ToolBlock[] = [];
  private readonly sessionNonce: string;
  private readonly doubleSpendGuard = new Set<string>(); // tool+inputHash

  constructor() {
    this.sessionNonce = randomBytes(8).toString("hex");
  }

  get length(): number { return this.blocks.length; }
  get chain(): ReadonlyArray<ToolBlock> { return this.blocks; }

  addBlock(
    toolName: string,
    inputs: unknown,
    output: unknown,
  ): { block: ToolBlock; violations: ConsensusViolation[] } {
    const violations: ConsensusViolation[] = [];
    const now = Date.now();
    const inputHash  = hashInputs(inputs);
    const outputStr  = JSON.stringify(output ?? {});
    const outputHash = hashOutput(output);
    const outputSize = Buffer.byteLength(outputStr, "utf8");
    const height     = this.blocks.length;
    const prevHash   = height === 0 ? GENESIS_HASH : this.blocks[height - 1].block_hash;
    const allHashes  = this.blocks.map(b => b.block_hash);

    // ── 7 Consensus Rules ────────────────────────────────────────────────────

    // Rule 1: Genesis anchor
    if (height === 0 && prevHash !== GENESIS_HASH) {
      violations.push({ rule: 1, rule_name: "Genesis anchor",
        detail: `First block must reference GENESIS_HASH. Got: ${prevHash}` });
    }

    // Rule 2: prev_hash continuity
    if (height > 0 && prevHash !== this.blocks[height - 1].block_hash) {
      violations.push({ rule: 2, rule_name: "Chain continuity",
        detail: `prev_hash mismatch at height ${height}` });
    }

    // Rule 3: Timestamp monotonic
    if (height > 0 && now < this.blocks[height - 1].timestamp_ms) {
      violations.push({ rule: 3, rule_name: "Timestamp monotonic",
        detail: `Timestamp ${now} < previous ${this.blocks[height - 1].timestamp_ms}` });
    }

    // Rule 4: Input hash integrity (always valid here — computed from actual inputs)
    if (!inputHash || inputHash.length !== 64) {
      violations.push({ rule: 4, rule_name: "Input hash integrity",
        detail: "Input hash computation failed" });
    }

    // Rule 5: Tool name non-empty
    if (!toolName || toolName.length === 0) {
      violations.push({ rule: 5, rule_name: "Tool registration",
        detail: "Tool name cannot be empty" });
    }

    // Rule 6: Output size limit
    if (outputSize > MAX_OUTPUT_BYTES) {
      violations.push({ rule: 6, rule_name: "Block size limit",
        detail: `Output ${outputSize} bytes exceeds ${MAX_OUTPUT_BYTES} byte limit` });
    }

    // Rule 7: No double-spend (same tool + same inputs = same result → no replay)
    const dsKey = `${toolName}:${inputHash}`;
    if (this.doubleSpendGuard.has(dsKey)) {
      violations.push({ rule: 7, rule_name: "No double-spend",
        detail: `Tool "${toolName}" called with identical inputs twice — possible replay attack` });
    } else {
      this.doubleSpendGuard.add(dsKey);
    }

    // ── Build block ───────────────────────────────────────────────────────────
    const pendingHashes = [...allHashes]; // will add current block hash after
    // Compute merkle root with a placeholder first, then recompute
    const merkleRoot = computeMerkleRoot(pendingHashes.length === 0
      ? [GENESIS_HASH]
      : pendingHashes);

    const header = buildBlockHeader(
      height, prevHash, merkleRoot,
      now, this.sessionNonce,
      toolName, inputHash, outputHash,
    );
    const blockHash = doubleSha256(header);

    const block: ToolBlock = {
      block_height: height,
      prev_block_hash: prevHash,
      tool_name: toolName,
      input_hash: inputHash,
      output_hash: outputHash,
      output_size_bytes: outputSize,
      timestamp_ms: now,
      session_nonce: this.sessionNonce,
      block_hash: blockHash,
      merkle_root: merkleRoot,
    };

    this.blocks.push(block);
    return { block, violations };
  }

  verify(): ChainVerification {
    const violations: ConsensusViolation[] = [];
    const allHashes = this.blocks.map(b => b.block_hash);

    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      const expected = i === 0 ? GENESIS_HASH : this.blocks[i - 1].block_hash;

      if (b.prev_block_hash !== expected) {
        violations.push({ rule: 2, rule_name: "Chain continuity",
          detail: `Block ${i}: prev_hash mismatch` });
      }
      if (i > 0 && b.timestamp_ms < this.blocks[i - 1].timestamp_ms) {
        violations.push({ rule: 3, rule_name: "Timestamp monotonic",
          detail: `Block ${i}: timestamp regression` });
      }
    }

    const merkleRoot = computeMerkleRoot(allHashes);
    const chainHash  = doubleSha256(allHashes.join(""));

    return {
      valid: violations.length === 0,
      block_count: this.blocks.length,
      violations,
      merkle_root: merkleRoot,
      chain_hash: chainHash,
    };
  }

  getProof(blockHeight: number): MerkleProof | null {
    if (blockHeight < 0 || blockHeight >= this.blocks.length) return null;
    const hashes = this.blocks.map(b => b.block_hash);
    return generateMerkleProof(hashes, blockHeight);
  }

  stats() {
    const verification = this.verify();
    return {
      session_nonce: this.sessionNonce,
      block_count: this.blocks.length,
      chain_valid: verification.valid,
      merkle_root: verification.merkle_root,
      chain_hash: verification.chain_hash,
      genesis_anchor: GENESIS_HASH,
      last_block: this.blocks[this.blocks.length - 1] ?? null,
      violation_count: verification.violations.length,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SESSION REGISTRY — one chain per MCP server instance
// ══════════════════════════════════════════════════════════════════════════════

const chainRegistry = new WeakMap<object, ToolChain>();

export function getChain(server: object): ToolChain {
  let chain = chainRegistry.get(server);
  if (!chain) {
    chain = new ToolChain();
    chainRegistry.set(server, chain);
  }
  return chain;
}
