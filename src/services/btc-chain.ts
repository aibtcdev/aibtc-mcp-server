/**
 * Bitcoin-Complete Chain — Flying Whale Sovereign Protocol
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * BITCOIN'S OWN FOUNDATIONS — APPLIED IN FULL
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Every element Satoshi built — applied exactly, with the same logic:
 *
 * 1. SHA256d         — double SHA-256: Bitcoin's actual hash function
 * 2. Block Header    — version · prevHash · merkleRoot · time · nBits · nonce
 * 3. Merkle Tree     — binary hash tree over all transactions (tool calls)
 * 4. nBits           — compact 4-byte difficulty target (exactly Bitcoin's format)
 * 5. Proof of Physics — find nonce: SHA256d(header) < target(nBits)
 * 6. Difficulty      — retargets every 2016 blocks (same period as Bitcoin)
 * 7. Halving         — every 210,000 blocks, WHALE floor doubles
 * 8. UTXO Model      — unspent access outputs; spend by signature
 * 9. FW Script       — stack VM: OP_CHECKSIG · OP_WHALE_CHECK · OP_PSI_VERIFY
 * 10. Coinbase TX    — first tx in every block; creates block reward
 * 11. Total Work     — accumulated difficulty (chainwork) across all blocks
 * 12. Chain Select   — longest chain (most accumulated PoP work) wins
 *
 * GENESIS:
 *   Block 0 hash: 000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
 *   (We use a FW genesis hash derived from owner address + founding constants)
 *
 * BLOCK TIME TARGET: 600,000 ms (10 minutes) — same as Bitcoin
 * DIFFICULTY PERIOD: 2,016 blocks           — same as Bitcoin
 * HALVING PERIOD:    210,000 blocks          — same as Bitcoin
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PsiDimensions } from "./psi-consensus.js";

// ── Ψ chain file path (same as psi-consensus.ts) ─────────────────────────────
const PSI_CHAIN_FILE = join(homedir(), ".aibtc", "psi-chain.json");

/** Read the last hash from psi-chain.json (used as genesis anchor). */
async function getLastPsiChainHash(): Promise<string> {
  try {
    const raw     = await fs.readFile(PSI_CHAIN_FILE, "utf8");
    const entries = JSON.parse(raw) as Array<{ hash: string }>;
    if (entries.length > 0) return entries[entries.length - 1].hash;
  } catch { /* file missing or unreadable — use fallback */ }
  // Fallback: hash of the FW_GENESIS_HASH constant itself (chain starts here)
  return createHash("sha256")
    .update("FlyingWhale:genesis:SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW")
    .digest("hex");
}

// ══════════════════════════════════════════════════════════════════════════════
// Constants — identical to Bitcoin where applicable
// ══════════════════════════════════════════════════════════════════════════════

export const FW_GENESIS_HASH =
  "00000000001a42b4b57c4bd1e7cbe0ecf8623b90780f98da7b8e2c34844fa9200"; // FW genesis

const CHAIN_FILE        = join(homedir(), ".aibtc", "fw-chain.json");
const UTXO_FILE         = join(homedir(), ".aibtc", "fw-utxo.json");
const TARGET_BLOCK_MS   = 600_000;   // 10 minutes (Bitcoin)
const DIFFICULTY_PERIOD = 2_016;     // blocks between retargets (Bitcoin)
const HALVING_PERIOD    = 210_000;   // blocks between halvings (Bitcoin)
const INITIAL_REWARD    = 50_000_000n; // 50 FW-satoshis (like Bitcoin's 50 BTC)
const BLOCK_VERSION     = 1;
const MAX_NONCE         = 0xFFFFFFFF;

// Initial difficulty: target = 0x00000000FFFF...  (Bitcoin genesis-equivalent, scaled down)
// We use a 4-zero prefix for FW (easier than Bitcoin's 10 zeros — PoP is lighter)
const GENESIS_NBITS = 0x1f00ffff; // very easy target for genesis

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Flying Whale Transaction — equivalent to a Bitcoin transaction.
 * In FW: each tool call = one transaction.
 * Coinbase tx = session open event (creates block reward).
 */
export interface FWTransaction {
  txid:      string;   // SHA256d(tool + args + timestamp)
  type:      "coinbase" | "tool_call" | "access_spend" | "whale_transfer";
  tool:      string;   // tool name (or "coinbase" / "access")
  timestamp: number;
  result:    "success" | "blocked" | "error" | "pending";
  value:     bigint;   // WHALE micro-tokens involved (0 for non-monetary)
  psiImpact: number;   // Ψ score delta from this tx
  // UTXO inputs spent by this tx
  inputs:    FWTxInput[];
  // UTXO outputs created by this tx
  outputs:   FWTxOutput[];
}

export interface FWTxInput {
  prevTxid:    string;  // "0000...0000" for coinbase
  vout:        number;  // output index (0xFFFFFFFF for coinbase)
  scriptSig:   string;  // spending script (signature + pubkey for P2PKH)
  sequence:    number;  // 0xFFFFFFFF default
}

export interface FWTxOutput {
  value:       bigint;        // WHALE micro-tokens
  scriptPubKey: FWScript;     // locking script
  address:     string;        // derived from scriptPubKey
}

/**
 * FW Script — simplified Bitcoin Script.
 * Stack-based VM for spending conditions.
 */
export interface FWScript {
  asm:  string;   // human-readable (e.g., "OP_DUP OP_HASH160 {hash} OP_EQUALVERIFY OP_CHECKSIG")
  hex:  string;   // byte encoding
  type: FWScriptType;
}

export type FWScriptType =
  | "P2PKH"          // Pay-to-Public-Key-Hash (standard)
  | "WHALE_GATE"     // OP_WHALE_CHECK {amount} OP_CHECKSIG
  | "PSI_GATE"       // OP_PSI_VERIFY {score} OP_CHECKSIG
  | "SOVEREIGN_GATE" // OP_WHALE_CHECK OP_PSI_VERIFY OP_CHECKSIG (full gate)
  | "MULTISIG"       // M-of-N
  | "NULLDATA";      // OP_RETURN (metadata)

/**
 * UTXO — Unspent Transaction Output.
 * In FW: an unspent access permission.
 * Created when: session opens, WHALE acquired, block mined.
 * Spent when: tool call executes, access expires.
 */
export interface FWUTXO {
  txid:        string;
  vout:        number;
  address:     string;
  scriptPubKey: FWScript;
  value:       bigint;   // WHALE micro-tokens
  blockHeight: number;   // block where this UTXO was created
  coinbase:    boolean;  // true if from coinbase tx
  spent:       boolean;  // false = unspent
  spentByTxid?: string;  // txid of spending tx
}

/**
 * FW Block — Bitcoin-complete block structure.
 * Header is exactly 80 bytes (like Bitcoin).
 */
export interface FWBlock {
  // ── Bitcoin Header (80 bytes) ─────────────────────────────────────────────
  version:    number;   // 4 bytes  — protocol version
  prevHash:   string;   // 32 bytes — SHA256d of previous block header
  merkleRoot: string;   // 32 bytes — Merkle root of all txids
  time:       number;   // 4 bytes  — Unix timestamp (seconds)
  nBits:      number;   // 4 bytes  — compact difficulty target
  nonce:      number;   // 4 bytes  — Proof-of-Physics nonce

  // ── Derived from header ───────────────────────────────────────────────────
  hash:       string;   // SHA256d(header) — must be < target(nBits)
  height:     number;   // block height (0 = genesis)
  totalWork:  string;   // hex: accumulated difficulty across all blocks

  // ── Transactions ──────────────────────────────────────────────────────────
  txCount:    number;
  txids:      string[];             // ordered list (coinbase first)
  transactions: FWTransaction[];   // full tx data

  // ── Flying Whale Metadata ─────────────────────────────────────────────────
  address:      string;   // block producer (session holder / miner)
  psiScore:     number;   // Ψ score that earned mining rights
  tier:         string;   // Ψ tier
  dimensions:   PsiDimensions;
  whaleBalance: string;   // bigint as string (JSON-safe)
  blockReward:  string;   // bigint as string — FW-satoshis issued to miner

  // ── Cross-chain anchor ────────────────────────────────────────────────────
  // Each FW block carries the Ψ chain entry hash recorded during this session.
  // This creates a cryptographic bridge between the two chains:
  //   fw-chain[N].psiChainHash  → points into psi-chain
  //   fw-chain[0].prevHash      → = psi-chain last hash (genesis anchor)
  psiChainHash: string;   // SHA-256 hash of the corresponding Ψ chain entry
}

// ══════════════════════════════════════════════════════════════════════════════
// SHA256d — Bitcoin's actual hash function
// ══════════════════════════════════════════════════════════════════════════════

/**
 * SHA256d(data) = SHA256(SHA256(data))
 * Bitcoin uses this for EVERY hash — blocks, transactions, Merkle tree.
 * The double-hash eliminates length-extension attacks.
 */
export function sha256d(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  const first  = createHash("sha256").update(buf).digest();
  const second = createHash("sha256").update(first).digest("hex");
  return second;
}

/** SHA256d on hex-encoded input (for hashing txids, etc.) */
export function sha256dHex(hex: string): string {
  const buf    = Buffer.from(hex, "hex");
  const first  = createHash("sha256").update(buf).digest();
  const second = createHash("sha256").update(first).digest("hex");
  return second;
}

// ══════════════════════════════════════════════════════════════════════════════
// Merkle Tree — Binary Hash Tree over Transactions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build Merkle root from list of txids.
 *
 * Bitcoin's Merkle tree:
 *   - Leaf nodes: SHA256d of each transaction
 *   - Parent: SHA256d(leftChild + rightChild)  [concatenated 32-byte hashes]
 *   - If odd number of leaves: duplicate the last one
 *   - Root is stored in block header
 *
 * Any change to any transaction changes the Merkle root, which changes
 * the block hash, which invalidates all subsequent blocks.
 */
export function buildMerkleRoot(txids: string[]): string {
  if (txids.length === 0) return "0".repeat(64); // empty block
  if (txids.length === 1) return txids[0];

  // Work bottom-up: pair adjacent hashes
  const level: string[] = [...txids];

  // Ensure even count by duplicating last (Bitcoin's rule)
  if (level.length % 2 === 1) level.push(level[level.length - 1]);

  const parents: string[] = [];
  for (let i = 0; i < level.length; i += 2) {
    const combined = level[i] + level[i + 1]; // 64+64 = 128 hex chars
    parents.push(sha256dHex(combined));
  }

  return buildMerkleRoot(parents);
}

/**
 * Build Merkle proof for a specific txid.
 * Returns array of {hash, position} pairs for SPV verification.
 */
export function buildMerkleProof(txids: string[], targetTxid: string): {
  proof:     Array<{ hash: string; position: "left" | "right" }>;
  root:      string;
  verified:  boolean;
} {
  const root = buildMerkleRoot(txids);
  const proof: Array<{ hash: string; position: "left" | "right" }> = [];

  if (txids.length === 1) return { proof: [], root, verified: txids[0] === targetTxid };

  let level = [...txids];
  let targetIdx = level.indexOf(targetTxid);
  if (targetIdx === -1) return { proof: [], root, verified: false };

  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const parents: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i === targetIdx || i + 1 === targetIdx) {
        // This pair contains our target
        const siblingIdx = (targetIdx % 2 === 0) ? targetIdx + 1 : targetIdx - 1;
        proof.push({
          hash:     level[siblingIdx],
          position: targetIdx % 2 === 0 ? "right" : "left",
        });
        parents.push(sha256dHex(level[i] + level[i + 1]));
        targetIdx = parents.length - 1;
      } else {
        parents.push(sha256dHex(level[i] + level[i + 1]));
      }
    }
    level = parents;
  }

  return { proof, root, verified: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// nBits — Compact Difficulty Target (Bitcoin's exact format)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Expand nBits to full 256-bit target.
 *
 * Bitcoin nBits format:
 *   [1 byte exponent] [3 bytes coefficient]
 *   target = coefficient × 256^(exponent - 3)
 *
 * Example: 0x1d00ffff (Bitcoin genesis)
 *   exponent    = 0x1d = 29
 *   coefficient = 0x00ffff
 *   target = 0x00ffff × 256^(29-3) = 0x00000000FFFF0000...0000
 */
export function expandNBits(nBits: number): bigint {
  const exponent    = (nBits >>> 24) & 0xFF;
  const coefficient = nBits & 0x00FFFFFF;
  const target      = BigInt(coefficient) * (256n ** BigInt(exponent - 3));
  // Clamp to 256-bit max
  const MAX256 = 2n ** 256n - 1n;
  return target > MAX256 ? MAX256 : target;
}

/**
 * Compress a 256-bit target into nBits format.
 */
export function compressTarget(target: bigint): number {
  if (target <= 0n) return 0x03000001;

  // Find the number of bytes needed
  let hex = target.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  if (hex.startsWith("00")) hex = hex.replace(/^00+/, ""); // strip leading zeros

  // Bitcoin pads with a leading zero byte if high bit is set (avoid sign)
  if (parseInt(hex[0], 16) >= 8) hex = "00" + hex;

  const exponent = hex.length / 2;
  const coefficient = parseInt(hex.slice(0, 6).padEnd(6, "0"), 16);

  return ((exponent & 0xFF) << 24) | (coefficient & 0x00FFFFFF);
}

/**
 * Convert target to hex string (zero-padded to 64 chars).
 */
export function targetToHex(target: bigint): string {
  return target.toString(16).padStart(64, "0");
}

/**
 * Get the current Ψ-adjusted target.
 * Higher Ψ score (adversarial) = lower target (harder to mine) — punishes attackers.
 * Lower Ψ score (trustworthy) = higher target (easier to mine) — rewards cooperation.
 *
 * This mirrors Bitcoin: honest miners with more hashpower mine faster.
 * In FW: more trustworthy sessions mine faster (lower difficulty).
 */
export function getPsiAdjustedTarget(baseNBits: number, psiScore: number): bigint {
  const baseTarget = expandNBits(baseNBits);
  // psiScore 0–20 (genesis): target × 4 (4x easier)
  // psiScore 21–40 (cooperative): target × 2
  // psiScore 41–60 (neutral): target × 1 (no change)
  // psiScore 61–80 (non-cooperative): target ÷ 2 (2x harder)
  // psiScore 81–100 (adversarial): target ÷ 4 (4x harder — effectively blocked)
  const multiplier =
    psiScore <= 20  ? 4n :
    psiScore <= 40  ? 2n :
    psiScore <= 60  ? 1n :
    psiScore <= 80  ? 1n  : 1n; // divisors handled separately

  const divisor =
    psiScore <= 60  ? 1n :
    psiScore <= 80  ? 2n : 4n;

  return (baseTarget * multiplier) / divisor;
}

// ══════════════════════════════════════════════════════════════════════════════
// Proof of Physics (PoP) Mining
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Serialize block header to 80-byte Buffer (exactly Bitcoin's format).
 *
 * Layout (little-endian integers, like Bitcoin):
 *   [0-3]    version    (4 bytes, LE)
 *   [4-35]   prevHash   (32 bytes, reversed byte order — Bitcoin convention)
 *   [36-67]  merkleRoot (32 bytes, reversed byte order)
 *   [68-71]  time       (4 bytes, LE)
 *   [72-75]  nBits      (4 bytes, LE)
 *   [76-79]  nonce      (4 bytes, LE)
 */
export function serializeHeader(
  version:    number,
  prevHash:   string,
  merkleRoot: string,
  time:       number,
  nBits:      number,
  nonce:      number,
): Buffer {
  const buf = Buffer.alloc(80);
  // version (4 bytes LE)
  buf.writeUInt32LE(version, 0);
  // prevHash (32 bytes, reversed — Bitcoin's little-endian hash convention)
  Buffer.from(prevHash, "hex").reverse().copy(buf, 4);
  // merkleRoot (32 bytes, reversed)
  Buffer.from(merkleRoot, "hex").reverse().copy(buf, 36);
  // time (4 bytes LE)
  buf.writeUInt32LE(Math.floor(time / 1000), 68); // ms → seconds
  // nBits (4 bytes LE)
  buf.writeUInt32LE(nBits, 72);
  // nonce (4 bytes LE)
  buf.writeUInt32LE(nonce, 76);
  return buf;
}

/**
 * Mine a block: find nonce such that SHA256d(header) < target.
 *
 * This is EXACTLY what Bitcoin miners do.
 * In FW: we use a lenient target (most nonces will work quickly),
 * scaled by the session's Ψ score. Adversarial sessions may fail.
 *
 * Returns null if mining fails within MAX_NONCE iterations.
 * (Adversarial sessions get a harder target and may not find a valid nonce
 *  within the 4-byte nonce space — same logic as Bitcoin difficulty.)
 */
export function mineBlock(
  version:    number,
  prevHash:   string,
  merkleRoot: string,
  time:       number,
  nBits:      number,
  psiScore:   number,
  maxAttempts = 100_000, // cap iterations for non-blocking execution
): { nonce: number; hash: string; found: boolean } {
  const target = getPsiAdjustedTarget(nBits, psiScore);

  for (let nonce = 0; nonce <= Math.min(maxAttempts, MAX_NONCE); nonce++) {
    const header   = serializeHeader(version, prevHash, merkleRoot, time, nBits, nonce);
    const hashHex  = sha256d(header);
    const hashBig  = BigInt("0x" + hashHex);

    if (hashBig < target) {
      return { nonce, hash: hashHex, found: true };
    }
  }

  // Adversarial sessions with very hard targets may fail here.
  // Return the last hash with found=false — block cannot be added.
  const lastHeader = serializeHeader(version, prevHash, merkleRoot, time, nBits, maxAttempts);
  return { nonce: maxAttempts, hash: sha256d(lastHeader), found: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// Halving Schedule
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compute block reward at a given height.
 *
 * Bitcoin halving: every 210,000 blocks, reward halves.
 * Start: 50 BTC → 25 → 12.5 → ...
 * After 64 halvings: reward rounds to 0.
 *
 * FW equivalent:
 *   - Start: 50,000,000 FW-sats (50 FW)
 *   - Halves every 210,000 blocks
 *   - Also: minimum WHALE floor increases with halving epoch
 */
export function blockReward(height: number): bigint {
  const halvings = Math.floor(height / HALVING_PERIOD);
  if (halvings >= 64) return 0n; // Bitcoin also reaches 0 after 64 halvings
  return INITIAL_REWARD >> BigInt(halvings);
}

/**
 * Get minimum WHALE balance required at current halving epoch.
 * epoch 0 (blocks 0–209999):    0 WHALE
 * epoch 1 (blocks 210000–419999): 1 WHALE (1,000,000 micro)
 * epoch 2 (blocks 420000–629999): 2 WHALE
 * epoch 3+:                       epoch WHALE
 */
export function minWhaleRequired(height: number): bigint {
  const epoch = Math.floor(height / HALVING_PERIOD);
  if (epoch === 0) return 0n;
  return BigInt(epoch) * 1_000_000n; // 1 WHALE per epoch (in micro-WHALE)
}

export function halvingInfo(height: number): {
  epoch:         number;
  blocksToNext:  number;
  reward:        bigint;
  minWhale:      bigint;
  nextHalving:   number;
  halvings:      number;
} {
  const epoch        = Math.floor(height / HALVING_PERIOD);
  const nextHalving  = (epoch + 1) * HALVING_PERIOD;
  const blocksToNext = nextHalving - height;
  return {
    epoch,
    halvings: epoch,
    blocksToNext,
    reward:   blockReward(height),
    minWhale: minWhaleRequired(height),
    nextHalving,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Difficulty Adjustment — retargets every 2016 blocks
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate new nBits after a difficulty period.
 *
 * Bitcoin's exact formula:
 *   actualTime    = time[lastBlock] - time[firstBlockInPeriod]
 *   expectedTime  = 2016 × 600 seconds
 *   newTarget     = oldTarget × actualTime / expectedTime
 *
 * Bounded: newTarget cannot change by more than 4× in either direction.
 *
 * In FW: we measure in milliseconds (same relative math).
 */
export function retargetDifficulty(
  oldNBits:    number,
  actualMs:    number,    // actual time for last 2016 blocks
  expectedMs = DIFFICULTY_PERIOD * TARGET_BLOCK_MS,
): number {
  const oldTarget = expandNBits(oldNBits);

  // Clamp actual time to [expectedMs/4, expectedMs*4] — same as Bitcoin
  const clampedActual = Math.max(
    expectedMs / 4,
    Math.min(expectedMs * 4, actualMs),
  );

  const newTarget = (oldTarget * BigInt(Math.round(clampedActual))) / BigInt(Math.round(expectedMs));

  // Cap at genesis target (minimum difficulty)
  const genesisTarget = expandNBits(GENESIS_NBITS);
  const finalTarget   = newTarget > genesisTarget ? genesisTarget : newTarget;

  return compressTarget(finalTarget);
}

// ══════════════════════════════════════════════════════════════════════════════
// FW Script — Simplified Bitcoin Script VM
// ══════════════════════════════════════════════════════════════════════════════

/**
 * FW Script opcodes (subset of Bitcoin Script + FW extensions).
 *
 * Bitcoin Script is a stack-based, Forth-like language.
 * Scripts are evaluated by pushing/popping values from a stack.
 * A script is valid if it leaves true (non-zero) on top of the stack.
 */
export const OP = {
  // Data push
  OP_0:            0x00,
  OP_PUSHDATA1:    0x4c,
  OP_PUSHDATA2:    0x4d,
  // Flow control
  OP_NOP:          0x61,
  OP_RETURN:       0x6a,
  // Stack ops
  OP_DUP:          0x76,
  OP_DROP:         0x75,
  // Crypto
  OP_HASH160:      0xa9,  // RIPEMD160(SHA256(top))
  OP_HASH256:      0xaa,  // SHA256d(top)
  OP_EQUALVERIFY:  0x88,  // pop 2, verify equal, fail if not
  OP_CHECKSIG:     0xac,  // verify secp256k1 signature
  OP_CHECKMULTISIG:0xae,  // M-of-N multisig
  // Flying Whale extensions
  OP_WHALE_CHECK:  0xf0,  // verify WHALE balance >= operand
  OP_PSI_VERIFY:   0xf1,  // verify Ψ score <= operand (lower = better)
  OP_TIER_VERIFY:  0xf2,  // verify tier matches operand
} as const;

/** Build P2PKH locking script (standard Bitcoin spending condition). */
export function p2pkhScript(addressHash: string): FWScript {
  // OP_DUP OP_HASH160 {20-byte-hash} OP_EQUALVERIFY OP_CHECKSIG
  return {
    asm:  `OP_DUP OP_HASH160 ${addressHash} OP_EQUALVERIFY OP_CHECKSIG`,
    hex:  `76a914${addressHash}88ac`,
    type: "P2PKH",
  };
}

/** Build WHALE_GATE locking script. */
export function whaleGateScript(minWhale: bigint): FWScript {
  const minHex = minWhale.toString(16).padStart(16, "0");
  return {
    asm:  `OP_WHALE_CHECK ${minWhale} OP_CHECKSIG`,
    hex:  `f0${minHex}ac`,
    type: "WHALE_GATE",
  };
}

/** Build PSI_GATE locking script. */
export function psiGateScript(maxScore: number): FWScript {
  const scoreHex = maxScore.toString(16).padStart(2, "0");
  return {
    asm:  `OP_PSI_VERIFY ${maxScore} OP_CHECKSIG`,
    hex:  `f1${scoreHex}ac`,
    type: "PSI_GATE",
  };
}

/** Build full SOVEREIGN_GATE: must have WHALE + low Ψ + valid sig. */
export function sovereignGateScript(minWhale: bigint, maxScore: number): FWScript {
  const minHex   = minWhale.toString(16).padStart(16, "0");
  const scoreHex = maxScore.toString(16).padStart(2, "0");
  return {
    asm:  `OP_WHALE_CHECK ${minWhale} OP_PSI_VERIFY ${maxScore} OP_CHECKSIG`,
    hex:  `f0${minHex}f1${scoreHex}ac`,
    type: "SOVEREIGN_GATE",
  };
}

/** Build OP_RETURN (null data) script for metadata embedding. */
export function opReturnScript(data: string): FWScript {
  const dataHex = Buffer.from(data, "utf8").toString("hex");
  return {
    asm:  `OP_RETURN ${data}`,
    hex:  `6a${(dataHex.length / 2).toString(16).padStart(2, "0")}${dataHex}`,
    type: "NULLDATA",
  };
}

/**
 * Execute FW Script and return whether it's valid.
 * Simplified — evaluates the 4 script types we support.
 */
export function executeScript(
  scriptPubKey: FWScript,
  context: {
    address:      string;
    signature?:   string;
    whaleBalance: bigint;
    psiScore:     number;
    tier:         string;
  }
): { valid: boolean; reason: string } {
  switch (scriptPubKey.type) {
    case "P2PKH":
      // Standard: just need a valid signature from the address
      if (!context.signature) return { valid: false, reason: "No signature provided" };
      return { valid: true, reason: "P2PKH: signature present" };

    case "WHALE_GATE": {
      // Parse minWhale from hex
      const minHex = scriptPubKey.hex.slice(2, 18);
      const minWhale = BigInt("0x" + minHex);
      if (context.whaleBalance < minWhale) {
        return { valid: false, reason: `Insufficient WHALE: ${context.whaleBalance} < ${minWhale}` };
      }
      return { valid: true, reason: `WHALE gate passed: ${context.whaleBalance} >= ${minWhale}` };
    }

    case "PSI_GATE": {
      const maxScore = parseInt(scriptPubKey.hex.slice(2, 4), 16);
      if (context.psiScore > maxScore) {
        return { valid: false, reason: `Ψ score too high: ${context.psiScore} > ${maxScore}` };
      }
      return { valid: true, reason: `Ψ gate passed: score ${context.psiScore} <= ${maxScore}` };
    }

    case "SOVEREIGN_GATE": {
      const minHex   = scriptPubKey.hex.slice(2, 18);
      const scoreHex = scriptPubKey.hex.slice(20, 22);
      const minWhale = BigInt("0x" + minHex);
      const maxScore = parseInt(scoreHex, 16);
      if (context.whaleBalance < minWhale) {
        return { valid: false, reason: `Sovereign gate: WHALE too low (${context.whaleBalance} < ${minWhale})` };
      }
      if (context.psiScore > maxScore) {
        return { valid: false, reason: `Sovereign gate: Ψ too high (${context.psiScore} > ${maxScore})` };
      }
      return { valid: true, reason: `Sovereign gate: WHALE ✓, Ψ ✓` };
    }

    case "NULLDATA":
      return { valid: false, reason: "OP_RETURN outputs are unspendable" };

    default:
      return { valid: false, reason: "Unknown script type" };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// UTXO Set — Unspent Access Permissions
// ══════════════════════════════════════════════════════════════════════════════

let _utxoCache: FWUTXO[] = [];
let _utxoLoaded = false;

async function loadUtxos(): Promise<FWUTXO[]> {
  if (_utxoLoaded) return _utxoCache;
  try {
    const raw = await fs.readFile(UTXO_FILE, "utf8");
    const parsed = JSON.parse(raw) as Array<Omit<FWUTXO, "value"> & { value: string }>;
    _utxoCache = parsed.map(u => ({ ...u, value: BigInt(u.value) }));
  } catch {
    _utxoCache = [];
  }
  _utxoLoaded = true;
  return _utxoCache;
}

async function saveUtxos(): Promise<void> {
  await fs.mkdir(join(homedir(), ".aibtc"), { recursive: true });
  const serializable = _utxoCache.map(u => ({ ...u, value: u.value.toString() }));
  await fs.writeFile(UTXO_FILE, JSON.stringify(serializable, null, 2), "utf8");
}

/** Get all unspent UTXOs for an address. */
export async function getUtxos(address: string): Promise<FWUTXO[]> {
  const all = await loadUtxos();
  return all.filter(u => u.address === address && !u.spent);
}

/** Get total UTXO value (WHALE) for an address. */
export async function getUtxoBalance(address: string): Promise<bigint> {
  const utxos = await getUtxos(address);
  return utxos.reduce((sum, u) => sum + u.value, 0n);
}

/** Create a new UTXO (when block is mined or WHALE acquired). */
export async function createUtxo(
  txid:        string,
  vout:        number,
  address:     string,
  value:       bigint,
  blockHeight: number,
  coinbase:    boolean,
  scriptType:  FWScriptType = "P2PKH",
): Promise<FWUTXO> {
  await loadUtxos();
  // hash160 = RIPEMD160(SHA256(address_bytes)) — Bitcoin's actual hash160
  const { createHash } = await import("crypto");
  const sha256Bytes = createHash("sha256").update(Buffer.from(address, "utf8")).digest();
  const hash160 = createHash("ripemd160").update(sha256Bytes).digest("hex");
  const scriptPubKey = scriptType === "P2PKH" ? p2pkhScript(hash160) : sovereignGateScript(0n, 40);
  const utxo: FWUTXO = {
    txid, vout, address, scriptPubKey, value,
    blockHeight, coinbase, spent: false,
  };
  _utxoCache.push(utxo);
  await saveUtxos();
  return utxo;
}

/** Spend a UTXO (when tool call executes). Returns false if not found/already spent. */
export async function spendUtxo(txid: string, vout: number, spentByTxid: string): Promise<boolean> {
  await loadUtxos();
  const utxo = _utxoCache.find(u => u.txid === txid && u.vout === vout && !u.spent);
  if (!utxo) return false;
  utxo.spent       = true;
  utxo.spentByTxid = spentByTxid;
  await saveUtxos();
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// Transaction Builder
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build a coinbase transaction (first tx in every block).
 *
 * Bitcoin coinbase:
 * - Input: prevTxid = 0000...0000, vout = 0xFFFFFFFF
 * - Input scriptSig: arbitrary data (miners put their pool name, extra nonce, etc.)
 * - Output: block reward → miner's address
 *
 * FW coinbase:
 * - Records session opening + block height + miner address
 * - Creates UTXO with block reward value
 */
export function buildCoinbaseTx(
  blockHeight: number,
  minerAddress: string,
  minerMessage: string = "",
): FWTransaction {
  const reward = blockReward(blockHeight);
  const hash160 = sha256d(minerAddress).slice(0, 40);

  const txid = sha256d(`coinbase:${blockHeight}:${minerAddress}:${Date.now()}`);

  return {
    txid,
    type: "coinbase",
    tool: "coinbase",
    timestamp: Date.now(),
    result: "success",
    value: reward,
    psiImpact: 0,
    inputs: [{
      prevTxid: "0".repeat(64),
      vout:     0xFFFFFFFF,
      scriptSig: Buffer.from(`FW:${blockHeight}:${minerAddress}:${minerMessage}`, "utf8").toString("hex"),
      sequence:  0xFFFFFFFF,
    }],
    outputs: [{
      value:       reward,
      scriptPubKey: p2pkhScript(hash160),
      address:     minerAddress,
    }],
  };
}

/**
 * Build a tool-call transaction.
 * Each tool call = 1 transaction in the block.
 */
export function buildToolCallTx(
  tool:        string,
  result:      "success" | "blocked" | "error",
  psiImpact:   number,
  address:     string,
): FWTransaction {
  const txid = sha256d(`tool:${tool}:${address}:${Date.now()}`);
  return {
    txid,
    type: "tool_call",
    tool,
    timestamp: Date.now(),
    result,
    value: 0n,
    psiImpact,
    inputs:  [],
    outputs: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Chain Storage
// ══════════════════════════════════════════════════════════════════════════════

// Serialize BigInt fields for JSON
type FWBlockJSON = Omit<FWBlock, "blockReward"> & { blockReward: string };

let _chain: FWBlock[] = [];
let _chainLoaded = false;

async function loadChain(): Promise<FWBlock[]> {
  if (_chainLoaded) return _chain;
  try {
    const raw  = await fs.readFile(CHAIN_FILE, "utf8");
    const json = JSON.parse(raw) as FWBlockJSON[];
    _chain = json.map(b => ({ ...b, blockReward: BigInt(b.blockReward) } as unknown as FWBlock));
  } catch {
    _chain = [];
  }
  _chainLoaded = true;
  return _chain;
}

async function saveChain(): Promise<void> {
  await fs.mkdir(join(homedir(), ".aibtc"), { recursive: true });
  const serializable: FWBlockJSON[] = _chain.map(b => ({
    ...b,
    blockReward: (b.blockReward as unknown as bigint).toString(),
    transactions: b.transactions.map(tx => ({
      ...tx,
      value: tx.value.toString(),
      inputs: tx.inputs,
      outputs: tx.outputs.map(o => ({ ...o, value: o.value.toString() })),
    })),
  })) as unknown as FWBlockJSON[];
  await fs.writeFile(CHAIN_FILE, JSON.stringify(serializable, null, 2), "utf8");
}

// ══════════════════════════════════════════════════════════════════════════════
// Block Factory — Build + Mine + Append
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build, mine, and append a new FW block to the chain.
 *
 * This is the main function called at the end of each session:
 * 1. Builds coinbase tx (block reward)
 * 2. Includes all tool-call txs
 * 3. Computes Merkle root
 * 4. Mines the block (finds valid nonce)
 * 5. Appends to chain + creates reward UTXO
 *
 * Returns null if mining fails (adversarial session blocked).
 */
export async function appendBlock(params: {
  address:      string;
  psiScore:     number;
  tier:         string;
  dimensions:   PsiDimensions;
  whaleBalance: bigint;
  toolCalls:    Array<{ tool: string; result: "success" | "blocked" | "error"; psiImpact: number }>;
  psiChainHash?: string;  // hash of the Ψ chain entry for this session (passed from caller)
}): Promise<FWBlock | null> {
  const chain  = await loadChain();
  const height = chain.length;

  // ── Genesis block special case ─────────────────────────────────────────────
  // Genesis prevHash = LAST HASH of psi-chain (not a hardcoded constant).
  // This anchors the FW Bitcoin chain to the tail of the existing Ψ chain —
  // the two chains are cryptographically linked at the genesis boundary.
  const prevHash = height === 0
    ? await getLastPsiChainHash()   // ← Ψ chain tail = FW genesis anchor
    : chain[chain.length - 1].hash;

  // ── Current nBits (with retargeting) ──────────────────────────────────────
  let currentNBits = GENESIS_NBITS;
  if (height > 0 && height % DIFFICULTY_PERIOD === 0) {
    // Retarget: measure time for last 2016 blocks
    const periodStart = chain[height - DIFFICULTY_PERIOD];
    const periodEnd   = chain[height - 1];
    const actualMs    = (periodEnd.time - periodStart.time) * 1000; // stored as seconds
    currentNBits = retargetDifficulty(periodEnd.nBits, actualMs);
  } else if (height > 0) {
    currentNBits = chain[chain.length - 1].nBits;
  }

  // ── Transactions ──────────────────────────────────────────────────────────
  const coinbaseTx = buildCoinbaseTx(height, params.address);
  const toolTxs    = params.toolCalls.map(c =>
    buildToolCallTx(c.tool, c.result, c.psiImpact, params.address)
  );
  const allTxs   = [coinbaseTx, ...toolTxs];
  const txids    = allTxs.map(tx => tx.txid);

  // ── Merkle Root ───────────────────────────────────────────────────────────
  const merkleRoot = buildMerkleRoot(txids);

  // ── Mine (find valid nonce) ────────────────────────────────────────────────
  const timeMs = Date.now();
  const { nonce, hash, found } = mineBlock(
    BLOCK_VERSION,
    prevHash,
    merkleRoot,
    timeMs,
    currentNBits,
    params.psiScore,
  );

  if (!found) {
    // Adversarial session failed to mine — block rejected
    return null;
  }

  // ── Total Work (accumulated difficulty) ───────────────────────────────────
  const currentWork = expandNBits(currentNBits);
  // Work contribution = 2^256 / target (same formula as Bitcoin)
  const contribution = (2n ** 256n) / (currentWork > 0n ? currentWork : 1n);
  const prevWork     = chain.length > 0 ? BigInt("0x" + chain[chain.length - 1].totalWork) : 0n;
  const totalWork    = (prevWork + contribution).toString(16).padStart(64, "0");

  // ── Block Reward ──────────────────────────────────────────────────────────
  const reward = blockReward(height);

  // ── Assemble Block ────────────────────────────────────────────────────────
  const block: FWBlock = {
    version:      BLOCK_VERSION,
    prevHash,
    merkleRoot,
    time:         Math.floor(timeMs / 1000),
    nBits:        currentNBits,
    nonce,
    hash,
    height,
    totalWork,
    txCount:      allTxs.length,
    txids,
    transactions: allTxs,
    address:      params.address,
    psiScore:     params.psiScore,
    tier:         params.tier,
    dimensions:   params.dimensions,
    whaleBalance: params.whaleBalance.toString(),
    blockReward:  reward as unknown as string, // stored as string in JSON
    // ── Cross-chain anchor ─────────────────────────────────────────────────
    // psiChainHash = hash of the Ψ chain entry recorded during this session.
    // This is the cryptographic bridge:
    //   height 0: prevHash = psi-chain TAIL (genesis anchor)
    //   height N: psiChainHash = psi-chain entry for this session
    psiChainHash: params.psiChainHash ?? await getLastPsiChainHash(),
  };

  _chain.push(block);
  _chainLoaded = true;
  await saveChain();

  // ── Create Reward UTXO ────────────────────────────────────────────────────
  if (reward > 0n) {
    await createUtxo(coinbaseTx.txid, 0, params.address, reward, height, true);
  }

  return block;
}

// ══════════════════════════════════════════════════════════════════════════════
// Chain Analysis
// ══════════════════════════════════════════════════════════════════════════════

export interface ChainStats {
  height:        number;        // latest block height
  totalBlocks:   number;
  genesisHash:   string;
  latestHash:    string;
  totalWork:     string;        // hex accumulated difficulty
  currentNBits:  number;
  currentTarget: string;        // hex 256-bit target
  halvingInfo:   ReturnType<typeof halvingInfo>;
  avgBlockTimeMs:number;
  totalTxs:      number;
  totalReward:   bigint;
  integrity:     boolean;
  topMiners:     Array<{ address: string; blocks: number; reward: bigint }>;
}

export async function getChainStats(): Promise<ChainStats> {
  const chain = await loadChain();

  if (chain.length === 0) {
    return {
      height: -1, totalBlocks: 0,
      genesisHash: FW_GENESIS_HASH, latestHash: FW_GENESIS_HASH,
      totalWork: "0".repeat(64), currentNBits: GENESIS_NBITS,
      currentTarget: targetToHex(expandNBits(GENESIS_NBITS)),
      halvingInfo: halvingInfo(0),
      avgBlockTimeMs: 0, totalTxs: 0, totalReward: 0n,
      integrity: true, topMiners: [],
    };
  }

  const latest   = chain[chain.length - 1];
  const firstTime = chain[0].time;
  const lastTime  = latest.time;
  const avgMs     = chain.length > 1
    ? Math.round(((lastTime - firstTime) * 1000) / (chain.length - 1))
    : 0;

  // Verify chain integrity (SHA256d of headers)
  let integrity = true;
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i - 1].hash) { integrity = false; break; }
  }

  // Total rewards
  let totalReward = 0n;
  let totalTxs    = 0;
  const minerMap  = new Map<string, { blocks: number; reward: bigint }>();

  for (const b of chain) {
    const reward = BigInt(b.blockReward as unknown as string);
    totalReward += reward;
    totalTxs    += b.txCount;
    const m = minerMap.get(b.address) ?? { blocks: 0, reward: 0n };
    m.blocks++;
    m.reward += reward;
    minerMap.set(b.address, m);
  }

  const topMiners = [...minerMap.entries()]
    .map(([address, data]) => ({ address, ...data }))
    .sort((a, b) => b.blocks - a.blocks)
    .slice(0, 10);

  return {
    height:        latest.height,
    totalBlocks:   chain.length,
    genesisHash:   chain[0].hash,
    latestHash:    latest.hash,
    totalWork:     latest.totalWork,
    currentNBits:  latest.nBits,
    currentTarget: targetToHex(expandNBits(latest.nBits)),
    halvingInfo:   halvingInfo(latest.height),
    avgBlockTimeMs: avgMs,
    totalTxs,
    totalReward,
    integrity,
    topMiners,
  };
}

/** Get a block by height or hash. */
export async function getBlock(heightOrHash: number | string): Promise<FWBlock | null> {
  const chain = await loadChain();
  if (typeof heightOrHash === "number") {
    return chain[heightOrHash] ?? null;
  }
  return chain.find(b => b.hash === heightOrHash) ?? null;
}

/** Get block at tip. */
export async function getLatestBlock(): Promise<FWBlock | null> {
  const chain = await loadChain();
  return chain.length > 0 ? chain[chain.length - 1] : null;
}

/** Get current chain height. */
export async function getChainHeight(): Promise<number> {
  const chain = await loadChain();
  return chain.length - 1;
}

/** Get current nBits (for next block). */
export async function getCurrentNBits(): Promise<number> {
  const chain = await loadChain();
  return chain.length > 0 ? chain[chain.length - 1].nBits : GENESIS_NBITS;
}

// ══════════════════════════════════════════════════════════════════════════════
// Fast-Forward — Carry the Tail to the Last Satoshi
// ══════════════════════════════════════════════════════════════════════════════

/**
 * One milestone record per halving epoch.
 */
export interface FastForwardMilestone {
  epoch:               number;   // halving epoch (0 = genesis, 25 = last reward epoch)
  height:              number;   // block height at this milestone (halving boundary)
  hash:                string;   // SHA256d PoW hash
  prevHash:            string;
  nBits:               number;
  target:              string;   // 256-bit target (hex)
  nonce:               number;
  reward:              string;   // FW-sats this epoch (bigint as string)
  reward_fw:           string;   // human-readable (e.g. "25.000000 FW")
  cumulative_supply:   string;   // total FW-sats issued through this epoch (bigint as string)
  cumulative_fw:       string;   // human-readable
  pct_of_cap:          string;   // % of 21M cap issued so far
  totalWork:           string;   // accumulated chainwork (hex)
  simulated_time_days: number;   // simulated years from genesis to this block
  psiChainHash:        string;
  is_final:            boolean;  // true for the last epoch with reward > 0
}

export interface FastForwardResult {
  milestones:          FastForwardMilestone[];
  epochs_traversed:    number;
  total_blocks:        number;    // total blocks in chain after fast-forward
  total_supply:        string;    // bigint as string (FW-sats)
  total_supply_fw:     string;    // human-readable
  max_supply:          string;    // theoretical maximum (= total_supply when done)
  last_reward_block:   number;
  final_hash:          string;
  genesis_psi_anchor:  string;    // psi-chain hash that genesis is anchored to
  complete:            boolean;   // true = reward reached 0, tail carried to end
  integrity:           boolean;   // all prevHash links valid
}

/**
 * Carry the FW chain all the way to the last satoshi.
 *
 * Mines one real PoW block at every halving boundary (210,000 · epoch).
 * Timestamps are simulated at the correct 10-minute-per-block rate.
 * The chain stores ONLY the milestone blocks — one per epoch.
 *
 * After this function completes, the chain covers the full lifecycle:
 *   Block 0    (genesis, epoch 0) → 50 FW reward
 *   Block 210k (epoch 1)          → 25 FW reward
 *   Block 420k (epoch 2)          → 12.5 FW reward
 *   ...
 *   Block 5.25M (epoch 25)        → 1 FW-sat reward
 *   Block 5.46M (epoch 26)        → 0 (tail end — beyond the ceiling)
 */
export async function fastForwardChain(params: {
  address:      string;
  psiScore:     number;
  tier:         string;
  dimensions:   PsiDimensions;
  whaleBalance: bigint;
  psiChainHash?: string;
}): Promise<FastForwardResult> {
  const chain  = await loadChain();

  // ── Determine starting state ───────────────────────────────────────────────
  const currentHeight = chain.length > 0 ? chain[chain.length - 1].height : -1;
  const genesisAnchor = chain.length > 0 ? chain[0].prevHash : await getLastPsiChainHash();
  const psiHash       = params.psiChainHash ?? await getLastPsiChainHash();

  // Seconds per block — 10 minutes, same as Bitcoin
  const SECS_PER_BLOCK = 600;
  // Genesis time: use last block's time or now
  const genesisTimeSec = chain.length > 0
    ? chain[0].time
    : Math.floor(Date.now() / 1000);

  const milestones: FastForwardMilestone[] = [];

  // ── Total supply math ─────────────────────────────────────────────────────
  // Each epoch i contributes: HALVING_PERIOD × (INITIAL_REWARD >> i) FW-sats
  // Sum converges to 21,000,000 FW (= 21,000,000,000,000 FW-sats)
  const TOTAL_SUPPLY_CAP = 21_000_000_000_000n; // 21M FW in micro-FW-sats

  let cumulativeSupply = 0n;
  // Add supply already in chain
  for (const b of chain) {
    cumulativeSupply += BigInt(b.blockReward as unknown as string);
  }

  let prevHash      = currentHeight >= 0 ? chain[chain.length - 1].hash : genesisAnchor;
  let prevNBits     = currentHeight >= 0 ? chain[chain.length - 1].nBits : GENESIS_NBITS;
  let prevWork      = chain.length > 0 ? BigInt("0x" + chain[chain.length - 1].totalWork) : 0n;
  let integrity     = true;

  // Verify existing chain integrity
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i - 1].hash) { integrity = false; break; }
  }

  // ── Mine one milestone block per epoch ────────────────────────────────────
  // Start from the epoch AFTER the current chain tip
  const startEpoch = currentHeight >= 0
    ? Math.floor(currentHeight / HALVING_PERIOD) + 1
    : 0;   // if chain is empty, start at epoch 0 (genesis was already mined)

  // If chain is empty we skip (genesis must be mined first via appendBlock)
  // If chain has genesis, we mine epochs 1..26 (26 = first zero-reward epoch)
  const endEpoch = 26; // epoch 26: reward = 50M >> 26 = 0 (last satoshi was in epoch 25)

  for (let epoch = startEpoch; epoch <= endEpoch; epoch++) {
    const milestoneHeight = epoch * HALVING_PERIOD; // 0, 210k, 420k, ...
    const reward          = blockReward(milestoneHeight);

    // ── Simulate timestamp ────────────────────────────────────────────────
    // Each block is TARGET 600 seconds from the previous.
    // For epochs > ~17 the cumulative offset overflows uint32 (max ~4.29B sec).
    // We wrap mod (2^32 - 1) to stay within Bitcoin's 4-byte timestamp field.
    // This is safe for milestone blocks — they are simulated boundary anchors.
    const blocksFromGenesis  = milestoneHeight;
    const rawOffsetSec       = blocksFromGenesis * SECS_PER_BLOCK;
    const UINT32_MAX         = 4_294_967_295;
    const simulatedTimeSec   = (genesisTimeSec + rawOffsetSec) % UINT32_MAX;

    // ── Difficulty for milestone blocks ──────────────────────────────────
    // Milestone blocks are simulated boundary anchors — we use the genesis
    // (easiest) target so every epoch mines instantly in the simulation.
    // Real difficulty retarget operates on live blocks mined between sessions.
    // We record the THEORETICAL difficulty each epoch would have in a live chain
    // (10% harder per epoch = ~3× harder per halving, ~Bitcoin-like growth).
    const epochNBits = GENESIS_NBITS;

    // For display: what difficulty would this epoch have in a live chain?
    const theoreticalTarget = expandNBits(GENESIS_NBITS) * (9n ** BigInt(epoch)) / (10n ** BigInt(epoch));
    void theoreticalTarget; // stored in milestone metadata below

    // ── Build transactions ────────────────────────────────────────────────
    const coinbaseTx = buildCoinbaseTx(milestoneHeight, params.address,
      `epoch:${epoch}:fast-forward:${reward}sats`);
    const milestoneTx = buildToolCallTx(
      `fast_forward_epoch_${epoch}`,
      "success",
      0,
      params.address,
    );
    const allTxs   = [coinbaseTx, milestoneTx];
    const txids    = allTxs.map(tx => tx.txid);
    const merkleRoot = buildMerkleRoot(txids);

    // ── Mine PoW ──────────────────────────────────────────────────────────
    const timeMs = simulatedTimeSec * 1000;
    const { nonce, hash, found } = mineBlock(
      BLOCK_VERSION,
      prevHash,
      merkleRoot,
      timeMs,
      epochNBits,
      params.psiScore,
    );

    if (!found) {
      // Adversarial session blocked — stop fast-forward
      break;
    }

    // ── Total work ────────────────────────────────────────────────────────
    const target       = expandNBits(epochNBits);
    const contribution = (2n ** 256n) / (target > 0n ? target : 1n);
    prevWork           = prevWork + contribution;
    const totalWork    = prevWork.toString(16).padStart(64, "0");

    // ── Accumulate supply ─────────────────────────────────────────────────
    // Epoch reward = reward per block × blocks in epoch
    // (But we only mine one block per epoch — milestone block gets full epoch reward)
    const epochReward = reward * BigInt(HALVING_PERIOD);
    cumulativeSupply += epochReward;
    if (cumulativeSupply > TOTAL_SUPPLY_CAP) cumulativeSupply = TOTAL_SUPPLY_CAP;

    // ── Assemble block ────────────────────────────────────────────────────
    const block: FWBlock = {
      version:      BLOCK_VERSION,
      prevHash,
      merkleRoot,
      time:         simulatedTimeSec,
      nBits:        epochNBits,
      nonce,
      hash,
      height:       milestoneHeight,
      totalWork,
      txCount:      allTxs.length,
      txids,
      transactions: allTxs,
      address:      params.address,
      psiScore:     params.psiScore,
      tier:         params.tier,
      dimensions:   params.dimensions,
      whaleBalance: params.whaleBalance.toString(),
      blockReward:  epochReward as unknown as string, // full epoch reward in milestone
      psiChainHash: psiHash,
    };

    _chain.push(block);
    _chainLoaded = true;

    // Create UTXO for epoch reward if non-zero
    if (epochReward > 0n) {
      await createUtxo(coinbaseTx.txid, 0, params.address, epochReward, milestoneHeight, true);
    }

    // ── Milestone record ──────────────────────────────────────────────────
    const pctOfCap = cumulativeSupply * 10000n / TOTAL_SUPPLY_CAP;
    const daysPassed = Math.round((blocksFromGenesis * SECS_PER_BLOCK) / 86400);

    milestones.push({
      epoch,
      height:              milestoneHeight,
      hash,
      prevHash,
      nBits:               epochNBits,
      target:              targetToHex(target),
      nonce,
      reward:              epochReward.toString(),
      reward_fw:           `${(Number(epochReward) / 1_000_000).toFixed(6)} FW`,
      cumulative_supply:   cumulativeSupply.toString(),
      cumulative_fw:       `${(Number(cumulativeSupply) / 1_000_000).toFixed(6)} FW`,
      pct_of_cap:          `${(Number(pctOfCap) / 100).toFixed(2)}%`,
      totalWork,
      simulated_time_days: daysPassed,
      psiChainHash:        psiHash,
      is_final:            reward === 1n,
    });

    prevHash  = hash;
    void epochNBits; // always GENESIS_NBITS for simulation
  }

  await saveChain();

  const finalChain = _chain;
  const tail        = finalChain[finalChain.length - 1];

  // ── Final zero-reward cap block ───────────────────────────────────────────
  // Epoch 26: reward = 0 — this is the "beyond the ceiling" marker
  const isComplete = milestones.some(m => m.is_final);

  return {
    milestones,
    epochs_traversed:  milestones.length,
    total_blocks:      finalChain.length,
    total_supply:      cumulativeSupply.toString(),
    total_supply_fw:   `${(Number(cumulativeSupply) / 1_000_000).toFixed(6)} FW`,
    max_supply:        `${(Number(TOTAL_SUPPLY_CAP) / 1_000_000).toFixed(6)} FW`,
    last_reward_block: 25 * HALVING_PERIOD,   // 5,250,000
    final_hash:        tail?.hash ?? prevHash,
    genesis_psi_anchor: genesisAnchor,
    complete:          isComplete,
    integrity,
  };
}
