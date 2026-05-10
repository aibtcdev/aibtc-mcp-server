/**
 * Ψ (Psi) Consensus Layer — Flying Whale Sovereign Intelligence
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 * On-chain IP: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The same mathematical foundations that Satoshi used to build Bitcoin —
 * made explicit, measured, and enforced as a consensus layer.
 *
 * DIMENSION 1 — Landauer (Physics of Computation)
 *   k_B · T · ln(2) per bit erasure = minimum energy cost of any computation
 *   In our system: computational cost score — heavier operations = lower score
 *   Bitcoin equivalent: Proof-of-Work (energy cost = security)
 *
 * DIMENSION 2 — Nash (Game Theory Equilibrium)
 *   No agent can improve their outcome by unilaterally changing strategy
 *   In our system: tool call pattern analysis — cooperative vs adversarial
 *   Bitcoin equivalent: miners play to maximize fees → stable network
 *
 * DIMENSION 3 — Cantillon⁻¹ (Monetary Distance)
 *   Those closest to money creation benefit most (Cantillon effect)
 *   Inverse: distance from honest consensus = trust decay
 *   In our system: WHALE holder distance from genesis = trust score
 *   Bitcoin equivalent: early miners vs late holders
 *
 * DIMENSION 4 — Gödel (External Axiom)
 *   No system can prove its own consistency from within
 *   Requires external axiom: "honest majority controls hashpower"
 *   In our system: WHALE holder majority = external trust axiom
 *   Bitcoin equivalent: honest CPU majority assumption
 *
 * CONSENSUS RESULT: Ψ score 0–100
 *   0–20   : Genesis tier — owner/trusted (full access, clean data)
 *   21–40  : Cooperative — normal agent (full access, clean data)
 *   41–60  : Neutral — standard user (access with monitoring)
 *   61–80  : Non-cooperative — suspicious (degraded data, throttled)
 *   81–100 : Adversarial — attacker detected (blocked, honeypot)
 *
 * Hash chain: ~/.aibtc/psi-chain.json
 * Every consensus event appended — tamper-evident, permanent audit trail
 */

import { createHash, createHmac, randomBytes } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";

// ══════════════════════════════════════════════════════════════════════════════
// Physical Constants
// ══════════════════════════════════════════════════════════════════════════════

const K_B  = 1.380649e-23;  // Boltzmann constant (J/K)
const T    = 310.15;        // Body temperature (K) — human computation substrate
const LN2  = Math.LN2;
const LANDAUER_ENERGY = K_B * T * LN2; // ~2.97e-21 J per bit erasure

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface PsiDimensions {
  landauer: number;   // 0–1: computational legitimacy (1 = minimal cost)
  nash:     number;   // 0–1: cooperative equilibrium score
  cantillon:number;   // 0–1: trust distance from genesis (1 = genesis)
  godel:    number;   // 0–1: external axiom satisfaction (WHALE majority)
}

export interface PsiScore {
  score:      number;        // 0–100 composite Ψ score
  tier:       PsiTier;
  dimensions: PsiDimensions;
  timestamp:  number;
  address:    string;
  chainHash:  string;        // SHA-256 of this entry + previous hash
  prevHash:   string;
  verdict:    string;
}

export type PsiTier =
  | "genesis"       // 0–20:  owner/trusted
  | "cooperative"   // 21–40: normal agent
  | "neutral"       // 41–60: standard user
  | "noncooperative"// 61–80: suspicious
  | "adversarial";  // 81–100: attacker

export interface PsiChainEntry {
  index:     number;
  hash:      string;
  prevHash:  string;
  address:   string;
  score:     number;
  tier:      PsiTier;
  timestamp: number;
  dimensions: PsiDimensions;
}

// ══════════════════════════════════════════════════════════════════════════════
// Nash Equilibrium Calculator
// ══════════════════════════════════════════════════════════════════════════════

interface AgentStrategy {
  callCount:       number;
  uniqueTools:     number;
  walletCalls:     number;
  errorRate:       number;    // 0–1
  velocityScore:   number;    // calls per minute
  honeypotHit:     boolean;
}

/**
 * Calculate Nash equilibrium score for an agent's strategy profile.
 *
 * Nash equilibrium: no agent can improve outcome by changing strategy unilaterally.
 * Cooperative agents (miners) generate value for the network.
 * Defectors (attackers) attempt to extract value without contributing.
 *
 * Score 1.0 = perfectly cooperative (Nash equilibrium maintained)
 * Score 0.0 = pure defector (breaks equilibrium)
 */
function calculateNashScore(strategy: AgentStrategy): number {
  if (strategy.honeypotHit) return 0.0; // pure defector

  // Tool diversity — cooperative agents use varied tools (human-like)
  // Defectors sweep systematically (low entropy)
  const diversityRatio = strategy.uniqueTools / Math.max(strategy.callCount, 1);
  const diversityScore = Math.min(diversityRatio * 2, 1.0); // normalized

  // Velocity — cooperative agents work at human pace
  // Defectors call rapidly (automated extraction)
  const velocityPenalty = Math.min(strategy.velocityScore / 60, 1.0); // >60 calls/min = defector
  const velocityScore   = 1.0 - velocityPenalty;

  // Error rate — cooperative agents succeed (they know what they're doing)
  // Defectors probe blindly (high error rate)
  const errorScore = 1.0 - Math.min(strategy.errorRate * 2, 1.0);

  // Wallet sensitivity — cooperative agents rarely hit wallet ops
  // Defectors target wallet ops (Denial-of-Wallet attack)
  const walletRatio   = strategy.walletCalls / Math.max(strategy.callCount, 1);
  const walletPenalty = Math.min(walletRatio * 5, 1.0);
  const walletScore   = 1.0 - walletPenalty;

  // Weighted Nash score
  const nash = (
    diversityScore * 0.30 +
    velocityScore  * 0.25 +
    errorScore     * 0.25 +
    walletScore    * 0.20
  );

  return Math.max(0, Math.min(1, nash));
}

// ══════════════════════════════════════════════════════════════════════════════
// Landauer Cost Calculator
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Landauer legitimacy score for a computation.
 *
 * Landauer's principle: erasing one bit of information costs at least k_B·T·ln(2) joules.
 * Legitimate computation has a minimum energy cost proportional to work done.
 * Adversarial computation tries to extract maximum value with minimum work.
 *
 * Score 1.0 = work done matches expected energy cost (legitimate)
 * Score 0.0 = attempted zero-cost extraction (adversarial)
 */
function calculateLandauerScore(
  callCount: number,
  uniqueTools: number,
  sessionAgeMs: number
): number {
  if (callCount === 0) return 1.0;

  // Expected minimum bits erased per tool call (computation has cost)
  const bitsPerCall = 1024; // rough estimate
  const expectedEnergy = callCount * bitsPerCall * LANDAUER_ENERGY;

  // Session age as proxy for time invested (real work takes time)
  const expectedSessionMs = callCount * 500; // min 500ms per call for legit use
  const timeRatio = Math.min(sessionAgeMs / Math.max(expectedSessionMs, 1), 2.0);

  // Tool diversity as proxy for purposeful computation
  const purposeScore = Math.min(uniqueTools / Math.max(callCount * 0.3, 1), 1.0);

  // Combined Landauer score
  const landauer = (
    Math.min(timeRatio / 2, 1.0) * 0.5 +
    purposeScore                 * 0.5
  );

  return Math.max(0, Math.min(1, landauer));
}

// ══════════════════════════════════════════════════════════════════════════════
// Cantillon Distance Calculator
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Cantillon distance score.
 *
 * Cantillon effect: those closest to money creation benefit most.
 * In our system: WHALE holders close to genesis (early holders) have highest trust.
 * Inverse: agents far from honest consensus have degraded trust.
 *
 * Score 1.0 = genesis tier (owner, early holders)
 * Score 0.0 = maximally distant from consensus
 */
function calculateCantillonScore(
  whaleBalance: bigint,
  isOwner: boolean
): number {
  if (isOwner) return 1.0; // genesis = maximum trust

  const WHALE_DECIMALS = 1_000_000n;

  // Whale balance tiers mapped to Cantillon distance
  // Higher WHALE = closer to genesis = higher score
  if (whaleBalance >= 100_000n * WHALE_DECIMALS) return 0.95; // Elite
  if (whaleBalance >= 10_000n  * WHALE_DECIMALS) return 0.75; // Agent
  if (whaleBalance >= 1_000n   * WHALE_DECIMALS) return 0.55; // Scout
  if (whaleBalance >= 100n     * WHALE_DECIMALS) return 0.35; // Observer
  if (whaleBalance > 0n)                          return 0.15; // Token holder
  return 0.05; // No WHALE — far from consensus
}

// ══════════════════════════════════════════════════════════════════════════════
// Gödel External Axiom
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Gödel axiom satisfaction score.
 *
 * Gödel: no system can prove its own consistency from within.
 * Bitcoin's external axiom: "honest majority controls hashpower"
 * Our external axiom: "WHALE holder majority is honest"
 *
 * This score measures how well the external axiom is satisfied
 * for this particular agent interaction.
 *
 * Score 1.0 = external axiom fully satisfied (WHALE confirmed, no attacks)
 * Score 0.0 = external axiom violated (no WHALE, active attack pattern)
 */
function calculateGodelScore(
  hasWhale:       boolean,
  ipiDetected:    boolean,
  coordinatedAtk: boolean,
  behaviorScore:  number   // 0–100 from BehavioralFortress
): number {
  // IPI = attempt to violate the system from within
  // This is exactly what Gödel warned about — internal inconsistency
  if (coordinatedAtk) return 0.0;
  if (ipiDetected)    return 0.05;
  if (!hasWhale)      return 0.15; // outside the honest majority

  // Map behavioral score to Gödel score (inverse — lower behavior score = higher trust)
  const behaviorTrust = 1.0 - (behaviorScore / 100);

  // WHALE holder + clean behavior = axiom satisfied
  return Math.max(0.5, Math.min(1.0, behaviorTrust));
}

// ══════════════════════════════════════════════════════════════════════════════
// Ψ Composite Score
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compute composite Ψ score from four dimensions.
 *
 * Ψ = (1 - Landauer·Nash·Cantillon⁻¹·Gödel) × 100
 *
 * Lower product of dimensions = higher Ψ score = more adversarial
 * Higher product of dimensions = lower Ψ score = more trustworthy
 *
 * This mirrors Bitcoin: more honest CPU = longer chain = lower attack probability
 */
export function computePsiScore(dims: PsiDimensions): number {
  // Product of all four dimensions (all 0–1)
  // High product = all dimensions satisfied = trustworthy agent
  const product = dims.landauer * dims.nash * dims.cantillon * dims.godel;

  // Convert to 0–100 score (high product = low score = trustworthy)
  const raw = (1.0 - product) * 100;

  // Apply non-linear curve (like Bitcoin difficulty adjustment)
  // Small deviations have moderate impact; large deviations are amplified
  const curved = raw < 50
    ? raw * 0.8              // cooperative zone: compressed
    : 50 + (raw - 50) * 1.4; // adversarial zone: amplified

  return Math.max(0, Math.min(100, Math.round(curved * 10) / 10));
}

export function getPsiTier(score: number): PsiTier {
  if (score <= 20) return "genesis";
  if (score <= 40) return "cooperative";
  if (score <= 60) return "neutral";
  if (score <= 80) return "noncooperative";
  return "adversarial";
}

export function getPsiVerdict(tier: PsiTier, dims: PsiDimensions): string {
  switch (tier) {
    case "genesis":
      return "Genesis tier — Nash equilibrium maintained. Full sovereignty confirmed.";
    case "cooperative":
      return "Cooperative agent — strategy profile consistent with network health.";
    case "neutral":
      return "Neutral agent — monitoring active. No equilibrium violation detected.";
    case "noncooperative":
      return `Non-cooperative strategy detected. ` +
             `Nash: ${(dims.nash * 100).toFixed(0)}% | ` +
             `Gödel: ${(dims.godel * 100).toFixed(0)}%. Throttling applied.`;
    case "adversarial":
      return "Adversarial agent — equilibrium violation confirmed. " +
             "Gödel axiom broken. Access denied.";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Ψ Hash Chain — Tamper-Evident Consensus Log
// ══════════════════════════════════════════════════════════════════════════════

const PSI_CHAIN_FILE = join(homedir(), ".aibtc", "psi-chain.json");
const PSI_GENESIS_HASH = "000000000000000000000000000000000000000000000000000000000000GENESIS";

let _chainCache: PsiChainEntry[] = [];
let _chainLoaded = false;

async function loadChain(): Promise<PsiChainEntry[]> {
  if (_chainLoaded) return _chainCache;
  try {
    const raw = await fs.readFile(PSI_CHAIN_FILE, "utf8");
    _chainCache = JSON.parse(raw) as PsiChainEntry[];
  } catch {
    _chainCache = [];
  }
  _chainLoaded = true;
  return _chainCache;
}

async function appendToChain(entry: Omit<PsiChainEntry, "index" | "hash" | "prevHash">): Promise<PsiChainEntry> {
  const chain = await loadChain();
  const prevHash = chain.length > 0
    ? chain[chain.length - 1].hash
    : PSI_GENESIS_HASH;

  const index = chain.length;

  // Compute entry hash: SHA-256(index + prevHash + address + score + timestamp)
  const hashInput = `${index}:${prevHash}:${entry.address}:${entry.score}:${entry.timestamp}`;
  const hash = createHash("sha256").update(hashInput).digest("hex");

  const full: PsiChainEntry = { index, hash, prevHash, ...entry };
  chain.push(full);
  _chainCache = chain;

  // Persist async
  await fs.mkdir(join(homedir(), ".aibtc"), { recursive: true });
  await fs.writeFile(PSI_CHAIN_FILE, JSON.stringify(chain, null, 2), "utf8");

  return full;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main API
// ══════════════════════════════════════════════════════════════════════════════

export interface PsiInput {
  address:        string;
  whaleBalance?:  bigint;
  isOwner?:       boolean;
  // Agent strategy
  callCount?:     number;
  uniqueTools?:   number;
  walletCalls?:   number;
  errorRate?:     number;
  velocityScore?: number;
  sessionAgeMs?:  number;
  honeypotHit?:   boolean;
  // Security signals
  ipiDetected?:   boolean;
  coordinatedAtk?:boolean;
  behaviorScore?: number;   // 0–100 from BehavioralFortress
}

/**
 * Compute full Ψ score and append to tamper-evident chain.
 *
 * This is the consensus function — called for every significant
 * agent interaction. The chain is the permanent audit trail.
 */
export async function computeAndRecordPsi(input: PsiInput): Promise<PsiScore> {
  const {
    address,
    whaleBalance   = 0n,
    isOwner        = false,
    callCount      = 1,
    uniqueTools    = 1,
    walletCalls    = 0,
    errorRate      = 0,
    velocityScore  = 1,
    sessionAgeMs   = 1000,
    honeypotHit    = false,
    ipiDetected    = false,
    coordinatedAtk = false,
    behaviorScore  = 0,
  } = input;

  const hasWhale = whaleBalance > 0n || isOwner;

  // Compute all four dimensions
  const dims: PsiDimensions = {
    landauer:  calculateLandauerScore(callCount, uniqueTools, sessionAgeMs),
    nash:      calculateNashScore({ callCount, uniqueTools, walletCalls, errorRate, velocityScore, honeypotHit }),
    cantillon: calculateCantillonScore(whaleBalance, isOwner),
    godel:     calculateGodelScore(hasWhale, ipiDetected, coordinatedAtk, behaviorScore),
  };

  const score     = computePsiScore(dims);
  const tier      = getPsiTier(score);
  const verdict   = getPsiVerdict(tier, dims);
  const timestamp = Date.now();

  // Append to hash chain
  const chainEntry = await appendToChain({ address, score, tier, timestamp, dimensions: dims });

  return {
    score,
    tier,
    dimensions: dims,
    timestamp,
    address,
    chainHash:  chainEntry.hash,
    prevHash:   chainEntry.prevHash,
    verdict,
  };
}

/**
 * Get Ψ chain statistics.
 */
export async function getPsiChainStats(): Promise<{
  length:        number;
  genesisHash:   string;
  latestHash:    string;
  tierCounts:    Record<PsiTier, number>;
  avgScore:      number;
  integrity:     boolean;  // true if chain is tamper-free
}> {
  const chain = await loadChain();

  if (chain.length === 0) {
    return {
      length: 0,
      genesisHash: PSI_GENESIS_HASH,
      latestHash: PSI_GENESIS_HASH,
      tierCounts: { genesis: 0, cooperative: 0, neutral: 0, noncooperative: 0, adversarial: 0 },
      avgScore: 0,
      integrity: true,
    };
  }

  // Verify chain integrity
  let integrity = true;
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i - 1].hash) {
      integrity = false;
      break;
    }
    const expected = createHash("sha256")
      .update(`${chain[i].index}:${chain[i].prevHash}:${chain[i].address}:${chain[i].score}:${chain[i].timestamp}`)
      .digest("hex");
    if (expected !== chain[i].hash) {
      integrity = false;
      break;
    }
  }

  const tierCounts: Record<PsiTier, number> = {
    genesis: 0, cooperative: 0, neutral: 0, noncooperative: 0, adversarial: 0,
  };
  let totalScore = 0;
  for (const e of chain) {
    tierCounts[e.tier]++;
    totalScore += e.score;
  }

  return {
    length:      chain.length,
    genesisHash: chain[0].hash,
    latestHash:  chain[chain.length - 1].hash,
    tierCounts,
    avgScore:    Math.round((totalScore / chain.length) * 10) / 10,
    integrity,
  };
}

/**
 * Get recent Ψ chain entries for an address.
 */
export async function getPsiHistory(address: string, limit = 10): Promise<PsiChainEntry[]> {
  const chain = await loadChain();
  return chain
    .filter(e => e.address === address)
    .slice(-limit)
    .reverse();
}

/**
 * Quick Ψ score — synchronous, no chain write.
 * For high-frequency checks (e.g., per tool call).
 */
export function quickPsiScore(input: PsiInput): number {
  const {
    whaleBalance   = 0n,
    isOwner        = false,
    callCount      = 1,
    uniqueTools    = 1,
    walletCalls    = 0,
    errorRate      = 0,
    velocityScore  = 1,
    sessionAgeMs   = 1000,
    honeypotHit    = false,
    ipiDetected    = false,
    coordinatedAtk = false,
    behaviorScore  = 0,
  } = input;

  const hasWhale = whaleBalance > 0n || isOwner;

  const dims: PsiDimensions = {
    landauer:  calculateLandauerScore(callCount, uniqueTools, sessionAgeMs),
    nash:      calculateNashScore({ callCount, uniqueTools, walletCalls, errorRate, velocityScore, honeypotHit }),
    cantillon: calculateCantillonScore(whaleBalance, isOwner),
    godel:     calculateGodelScore(hasWhale, ipiDetected, coordinatedAtk, behaviorScore),
  };

  return computePsiScore(dims);
}
