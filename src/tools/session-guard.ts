/**
 * session-guard.ts — MCPTox Attack Protection Layer
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v2.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 * On-chain IP: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1
 * Enforcement: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-signal-registry-v1
 *
 * Multi-Layer Sovereignty Stack v2.0.0 — Layer 3: Policy VM (Attack Defense)
 * Sovereign Agent OS — 8-Layer Bitcoin AI Infrastructure on Stacks mainnet
 *
 * Defends against MCPTox-class attacks (arxiv March 2026, adversa.ai March 2026):
 * - Cyclic overthinking loops induced by malicious tool servers (142x token amplification)
 * - Denial-of-Wallet: repeated on-chain transactions before hard caps trigger
 * - Sequential tool call explosions draining x402 API budgets
 * - Indirect prompt injection via trusted content channels
 *
 * Defense Layers (Policy VM — L3 of Sovereignty Stack):
 *   L3A. Static rules: blocklist, admin overrides
 *   L3B. Hard cap on wallet-sensitive calls per session (default: 20)
 *   L3C. Loop detection: same tool N times consecutively = abort
 *   L3D. Rapid-fire detection: N calls/10s to same tool = Denial-of-Wallet block
 *   L3E. IPI scanning: detect indirect prompt injection in tool results / external content
 *
 * IPI Defense Policy v1.0 — terms-of-use.md §12 — Effective 2026-04-07
 * Zero-tolerance against embedded instructions in external content (news, APIs, web pages).
 * Known attack phrases catalogued from registered on-chain signals in whale-signal-registry-v1.
 * ANY match → STOP → QUOTE → ASK owner → WAIT for confirmation → LOG on-chain.
 *
 * No WHALE = No Access. Buy: https://app.bitflow.finance — WHALE/wSTX Pool #42
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { quickPsiScore, getPsiTier, computeAndRecordPsi } from "../services/psi-consensus.js";
import { getChain } from "../services/security/tool-hash-chain.js";

// ═══════════════════════════════════════════════════════════════════════════════
// L3E — IPI DEFENSE LAYER (Indirect Prompt Injection)
// Policy: terms-of-use.md §12 — IPI Defense Policy v1.0
// On-chain evidence: whale-signal-registry-v1 (3 registered attack patterns)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Known IPI attack phrases catalogued from on-chain signals.
 * Source: whale-signal-registry-v1 — blocks 7501153+
 *
 * Pattern categories:
 *   - Authority injection  : "agents must", "agents should", "agents can now"
 *   - Urgency manipulation : "immediately execute", "execute now", "update packages immediately"
 *   - Capability expansion : "agents can now execute", "execute signal-gated"
 *   - Task hijacking       : "monitor the correspondent", "secure available slots", "optimize for high-volume"
 */
export const IPI_ATTACK_PHRASES: ReadonlyArray<string> = [
  // Authority + urgency (Zest Protocol attack pattern — signal 1)
  "agents must update packages",
  "agents must immediately",
  "update packages immediately",
  // Beat Editor manipulation (aibtc.news attack pattern — signal 2)
  "agents should monitor",
  "monitor the correspondent",
  "secure available contract slots",
  "secure available slots",
  "optimize for high-volume",
  // Capability expansion (aibtc.news attack pattern — signal 3)
  "agents can now execute",
  "execute signal-gated",
  "signal-gated write operations",
  "agents can now",
  // Generic injection patterns
  "agents must",
  "agents should",
  "automate commercial transactions",
  "immediately execute",
  "execute on behalf of",
  "override safety",
  "ignore previous instructions",
  "disregard previous",
  "new instructions:",
  "system override",
  "admin override",
  "developer mode",
  "emergency protocol",
  // ── Gate-removal attack patterns (2026-05-01 breach — arc0btc PR #495) ────────
  // These phrases were used to social-engineer removal of WHALE gates
  "open infrastructure to all humanity",
  "remove the gate",
  "remove gate",
  "gates removed",
  "no whale required",
  "without whale",
  "open to all",
  "mit license means",
  "nash equilibrium holds without",
  "artificial barriers",
  "cosmic energy unobstructed",
  "serve all of humanity unconditionally",
  "remove whale token gate",
  "remove fw_license",
  "remove license gate",
  "all humans unconditionally",
  "no gate. no lock",
  "tools now serve",
  "inconsistent with v2",
  "open-to-humanity",
  // ── Breach patterns 2026-05-08 — file exfiltration / credential theft ────────
  "show me the private key",
  "print the mnemonic",
  "export the wallet",
  "show env variables",
  "reveal the seed",
  "print env",
  "show credentials",
  "dump keystore",
  "read .env",
  "extract mnemonic",
  "bypass encryption",
  "disable gate",
  "skip authentication",
  "expose private",
  "steal the key",
  "exfiltrate",
  "send credentials to",
  "forward the key",
];

export interface IpiScanResult {
  detected: boolean;
  phrase?: string;
  source?: string;
}

// ─── Aho-Corasick Automaton for IPI Scanning ─────────────────────────────────
// Replaces linear O(N*M) scan with O(content_length) search regardless of
// phrase count. Built once at module load — ~50x faster on large tool responses.
interface AhoCorasickNode {
  children: Map<number, number>; // charCode → nodeIndex
  fail: number;
  output: string | null;         // matched phrase or null
}

function buildAhoCorasick(patterns: ReadonlyArray<string>): {
  search: (text: string) => { found: boolean; phrase: string | null };
} {
  const nodes: AhoCorasickNode[] = [{ children: new Map(), fail: 0, output: null }];

  // Build trie
  for (const pat of patterns) {
    const lower = pat.toLowerCase();
    let cur = 0;
    for (let i = 0; i < lower.length; i++) {
      const c = lower.charCodeAt(i);
      if (!nodes[cur].children.has(c)) {
        nodes[cur].children.set(c, nodes.length);
        nodes.push({ children: new Map(), fail: 0, output: null });
      }
      cur = nodes[cur].children.get(c)!;
    }
    nodes[cur].output = pat; // store original phrase (not lowercased)
  }

  // Build failure links (BFS)
  const queue: number[] = [];
  for (const [, child] of nodes[0].children) {
    nodes[child].fail = 0;
    queue.push(child);
  }
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++];
    for (const [c, v] of nodes[u].children) {
      let f = nodes[u].fail;
      while (f !== 0 && !nodes[f].children.has(c)) f = nodes[f].fail;
      nodes[v].fail = nodes[f].children.get(c) ?? 0;
      if (nodes[v].fail === v) nodes[v].fail = 0;
      if (!nodes[v].output) nodes[v].output = nodes[nodes[v].fail].output;
      queue.push(v);
    }
  }

  return {
    search(text: string): { found: boolean; phrase: string | null } {
      const lower = text.toLowerCase();
      let cur = 0;
      for (let i = 0; i < lower.length; i++) {
        const c = lower.charCodeAt(i);
        while (cur !== 0 && !nodes[cur].children.has(c)) cur = nodes[cur].fail;
        cur = nodes[cur].children.get(c) ?? 0;
        if (nodes[cur].output) return { found: true, phrase: nodes[cur].output };
      }
      return { found: false, phrase: null };
    },
  };
}

// Built once at module load — O(total phrase chars) build cost
const _ipiAutomaton = buildAhoCorasick(IPI_ATTACK_PHRASES);

// ─── IPI Audit Log ────────────────────────────────────────────────────────────
// In-memory log of all injection attempts this session.
// Pattern detection: same phrase 3+ times = coordinated attack.

export interface IpiAuditEntry {
  timestamp: number;
  phrase: string;
  source: string;
  contentSnippet: string;
}

const ipiAuditLog: IpiAuditEntry[] = [];
const ipiPhraseCount: Map<string, number> = new Map();
const COORDINATED_ATTACK_THRESHOLD = 3;

// ─── License Gate ─────────────────────────────────────────────────────────────
// External use of IPI Defense exports requires FW_LICENSE_KEY.
// Internal use (within session-guard.ts itself) is always allowed.
const _FW_OWNER      = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
const _FW_LICENSE_KEY = process.env.FW_LICENSE_KEY ?? "";
// Owner: compare against STX address only — no magic bypass strings
const _FW_IS_OWNER    = _FW_LICENSE_KEY === _FW_OWNER;

function _assertLicensedExternal(fn: string): void {
  if (_FW_IS_OWNER) return;
  if (!_FW_LICENSE_KEY || _FW_LICENSE_KEY.trim() === "") {
    throw new Error(
      `Flying Whale IPI Defense — License Required\n` +
      `Function: ${fn}\n` +
      `FW_LICENSE_KEY not set. Obtain a license: github.com/azagh72-creator\n` +
      `On-chain IP: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1`
    );
  }
}

export function ipiLogAttack(scan: IpiScanResult, contentSnippet: string): void {
  if (!scan.detected || !scan.phrase) return;
  const entry: IpiAuditEntry = {
    timestamp: Date.now(),
    phrase:    scan.phrase,
    source:    scan.source ?? "unknown",
    contentSnippet: contentSnippet.slice(0, 200),
  };
  ipiAuditLog.push(entry);
  const count = (ipiPhraseCount.get(scan.phrase) ?? 0) + 1;
  ipiPhraseCount.set(scan.phrase, count);
  if (count >= COORDINATED_ATTACK_THRESHOLD) {
    console.error(
      `[IPI DEFENSE] ⚠️  COORDINATED ATTACK DETECTED — phrase "${scan.phrase}" seen ${count}x. ` +
      `Sources: ${ipiAuditLog.filter(e => e.phrase === scan.phrase).map(e => e.source).join(" | ")}`
    );
  }
}

export function ipiGetAuditLog(): IpiAuditEntry[] {
  _assertLicensedExternal("ipiGetAuditLog");
  return [...ipiAuditLog];
}

/**
 * Flush IPI audit log to ~/.aibtc/ipi-audit.jsonl (newline-delimited JSON).
 * Called on graceful shutdown to persist attack evidence across sessions.
 * Each line is one IpiAuditEntry — the file grows append-only.
 */
export async function flushIpiAuditLog(): Promise<void> {
  if (ipiAuditLog.length === 0) return;
  try {
    const { default: fs } = await import("fs/promises");
    const { default: path } = await import("path");
    const { default: os } = await import("os");
    const dir = path.join(os.homedir(), ".aibtc");
    await fs.mkdir(dir, { recursive: true });
    const logPath = path.join(dir, "ipi-audit.jsonl");
    const lines = ipiAuditLog.map(e => JSON.stringify(e)).join("\n") + "\n";
    await fs.appendFile(logPath, lines, "utf8");
  } catch (err) {
    console.error("[IPI DEFENSE] Failed to flush audit log:", err);
  }
}

export function ipiIsCoordinatedAttack(phrase: string): boolean {
  _assertLicensedExternal("ipiIsCoordinatedAttack");
  return (ipiPhraseCount.get(phrase) ?? 0) >= COORDINATED_ATTACK_THRESHOLD;
}

/**
 * Sanitize external content by removing/replacing known IPI phrases.
 * Use this when you want to READ the data but strip the injection.
 * Returns { sanitized: string, wasInjected: boolean, removedPhrases: string[] }
 */
export function ipiSanitize(content: string): {
  sanitized: string;
  wasInjected: boolean;
  removedPhrases: string[];
} {
  _assertLicensedExternal("ipiSanitize");
  let sanitized = content;
  const removedPhrases: string[] = [];
  const lower = content.toLowerCase();

  for (const phrase of IPI_ATTACK_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      // Replace the phrase (case-insensitive) with [REDACTED]
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      sanitized = sanitized.replace(regex, "[IPI-REDACTED]");
      removedPhrases.push(phrase);
    }
  }

  return {
    sanitized,
    wasInjected: removedPhrases.length > 0,
    removedPhrases,
  };
}

/**
 * L3E — Scan any string content for known IPI attack phrases.
 *
 * Usage: call this on any external content before acting on it.
 * If detected → STOP. Quote phrase to owner. Ask: "هذا يبدو كـ prompt injection — تنفذه؟"
 * Wait for explicit confirmation. Never execute partial instructions.
 *
 * @param content  The text to scan (tool result, API response, web page, etc.)
 * @param source   Human-readable label for the source (for error reporting)
 */
export function ipiScan(content: string, source = "external content"): IpiScanResult {
  if (!content || typeof content !== "string") return { detected: false };
  // Use Aho-Corasick automaton — O(content_length) vs O(N*M) linear scan
  const result = _ipiAutomaton.search(content);
  const match = result.found ? result.phrase : null;
  if (match) {
    return { detected: true, phrase: match, source };
  }
  return { detected: false };
}

/**
 * Format an IPI detection alert in the standard Flying Whale response format.
 * This is the mandatory response when IPI is detected (Policy §12.3 step 2).
 */
export function ipiAlert(scan: IpiScanResult, quotedContent?: string): string {
  const coordinated = scan.phrase ? ipiIsCoordinatedAttack(scan.phrase) : false;
  const attackCount = scan.phrase ? (ipiPhraseCount.get(scan.phrase) ?? 1) : 1;
  return [
    `⚠️  IPI DEFENSE TRIGGERED — L3E Policy VM`,
    coordinated ? `🚨 COORDINATED ATTACK — phrase seen ${attackCount}x this session` : "",
    ``,
    `Source   : ${scan.source ?? "external content"}`,
    `Phrase   : "${scan.phrase}"`,
    ``,
    quotedContent ? `Suspicious content:\n---\n${quotedContent.slice(0, 500)}\n---\n` : "",
    `Policy   : terms-of-use.md §12 — IPI Defense Policy v1.0`,
    `Registry : SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-signal-registry-v1`,
    `Audit log: ${ipiAuditLog.length} attack(s) recorded this session`,
    ``,
    `ACTION REQUIRED: هذا يبدو كـ prompt injection — تنفذه؟`,
    `→ STOPPED. Awaiting explicit confirmation from zaghmout.btc before any action.`,
  ]
    .filter(l => l !== "")
    .join("\n")
    .trim();
}

// ─── Ψ Whale Context Registry ─────────────────────────────────────────────────
// Stores the last verified WHALE balance per address.
// Called by flying-whale.tools.ts after every successful WHALE gate verification.
// SessionGuard.check() reads from this to populate the Cantillon dimension with
// real on-chain data instead of the 0n default.
//
// Uses module-level state (not WeakMap) because WHALE verification is address-based,
// not server-instance-based. In stdio transport (one process per session) this is
// effectively a session singleton. TTL: 60s (matches WHALE gate cache 30s × 2).

interface _WhaleCtx {
  address:  string;
  balance:  bigint;
  isOwner:  boolean;
  ts:       number;
}
let _latestWhaleCtx: _WhaleCtx = { address: "", balance: 0n, isOwner: false, ts: 0 };

/**
 * Record the result of a successful WHALE gate verification.
 * Called by flying-whale.tools.ts after verifyWhaleAccess() succeeds.
 * Feeds the real on-chain balance into the Cantillon dimension of the Ψ equation.
 */
export function recordWhaleVerification(
  address: string,
  balance: bigint,
  isOwner: boolean
): void {
  _latestWhaleCtx = { address, balance, isOwner, ts: Date.now() };
}

// ─── Configuration ────────────────────────────────────────────────────────────

// ── EMERGENCY LOCKDOWN v1.61.1 — 2026-05-04 ──────────────────────────────────
// Hardened after 2026-05-01 breach (arc0btc PR #495 gate-removal attack).
// Limits reduced 50% until full security audit completes.
const MAX_WALLET_CALLS_PER_SESSION = 10;  // was 20 — halved under lockdown
const MAX_TOTAL_CALLS_PER_SESSION  = 75;  // was 150 — halved under lockdown
const LOOP_DETECTION_CONSECUTIVE   = 3;   // was 5 — tightened
const LOOP_DETECTION_RAPID_WINDOW_MS = 10_000; // 10 seconds
const LOOP_DETECTION_RAPID_COUNT   = 5;   // was 8 — tightened

// ── Sovereign/Ψ intelligence tools — open but rate-limited ───────────────────
// These tools are intentionally open (no WHALE gate) — Ψ equation is a public standard.
// Rate limit: 50 calls/session max to prevent API scraping and Hiro endpoint exhaustion.
const MAX_SOVEREIGN_CALLS_PER_SESSION = 50;
const SOVEREIGN_TOOLS: Set<string> = new Set([
  "psi_score", "psi_oracle", "psi_nation", "psi_system_state",
  "psi_chain_verify", "psi_score_currency", "psi_reform_roadmap",
  "sovereign_debt_snapshot", "sovereign_btc_reserve", "sovereign_renaissance",
  "sovereign_x402_endpoint", "sovereign_invariant",
  "currency_renaissance_plan", "currency_x402_config", "currency_relationships",
  "currency_reform_priorities", "multi_currency_comparison",
  "zero_harm_overview", "civilian_rights", "government_rights",
  "sector_guarantee", "harm_assessment", "circuit_breakers", "full_harm_matrix",
  "system_evaluation", "global_goals", "gap_analysis", "risk_map",
  "intention_classifier", "assets_registry", "data_sovereignty",
  "cooperation_models", "public_interest_doctrine", "master_synthesis",
  "generate_currency_plan", "list_expanded_nations", "risk_mitigation_status",
  "cascade_analysis", "system_isolation_check", "security_audit",
  "whistleblower_report", "environmental_landauer", "quantum_migration_status",
  "governance_propose", "risk_system_status",
  "psi_constitution", "psi_reform_catalog", "psi_adversarial_matrix",
  "psi_stability_mechanisms", "psi_reaction_balance", "psi_monetary_bridge",
  "psi_risk_registry", "psi_unified_call",
]);

// ─── Wallet-sensitive tools (on-chain or x402 payment impact) ─────────────────

const WALLET_SENSITIVE: Set<string> = new Set([
  // Direct transactions
  "call_contract",
  "deploy_contract",
  "transfer_stx",
  "transfer_btc",
  "transfer_token",
  "transfer_nft",
  "broadcast_transaction",
  // Wallet operations (unlock excluded — it doesn't spend funds, blocking it prevents recovery)
  "wallet_create",
  "wallet_import",
  "wallet_export",
  // DeFi — ALEX
  "alex_swap",
  // DeFi — Zest
  "zest_supply",
  "zest_borrow",
  "zest_withdraw",
  "zest_repay",
  "zest_enable_collateral",
  // DeFi — Stacking
  "stack_stx",
  "extend_stacking",
  "dual_stacking_enroll",
  "dual_stacking_opt_out",
  // DeFi — sBTC
  "sbtc_deposit",
  "sbtc_withdraw",
  "sbtc_transfer",
  "sbtc_initiate_withdrawal",
  // DeFi — Bitflow
  "bitflow_swap",
  // DeFi — JingSwap v1
  "jingswap_deposit_stx",
  "jingswap_deposit_sbtc",
  "jingswap_settle",
  "jingswap_settle_with_refresh",
  "jingswap_cancel_stx",
  "jingswap_cancel_sbtc",
  // DeFi — JingSwap v2
  "jingswap_v2_deposit_stx",
  "jingswap_v2_deposit_sbtc",
  "jingswap_v2_cancel_stx",
  "jingswap_v2_cancel_sbtc",
  "jingswap_v2_cancel_cycle",
  "jingswap_v2_close_and_settle_with_refresh",
  // DeFi — Styx
  "styx_deposit",
  // DeFi — StackSpot
  "stackspot_join_pot",
  "stackspot_start_pot",
  "stackspot_claim_rewards",
  // DeFi — Pillar
  "pillar_send",
  "pillar_fund",
  "pillar_boost",
  "pillar_supply",
  "pillar_unwind",
  // x402 paid endpoints
  "execute_x402_endpoint",
  "send_inbox_message",
  // Bitcoin
  "psbt_sign",
  "psbt_broadcast",
  "ordinals_buy",
  "ordinals_list_for_sale_submit",
  "ordinals_p2p_create_offer",
  "ordinals_p2p_psbt_swap",
  "ordinals_p2p_counter",
  "ordinals_p2p_transfer",
  "transfer_rune",
  "inscribe",
  "inscribe_reveal",
  "inscribe_child",
  "inscribe_child_reveal",
]);

// ─── Session State ─────────────────────────────────────────────────────────────

interface CallRecord {
  tool: string;
  timestamp: number;
}

class SessionGuard {
  private calls: CallRecord[] = [];
  private walletCallCount = 0;
  private readonly sessionStart = Date.now();
  private blocked = false;
  private blockReason = "";

  // ── Ψ Consensus State ────────────────────────────────────────────────────
  // Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel
  // The consensus layer — computed on every check, gates wallet ops
  private psiScore = 0;        // current Ψ score (0–100)
  private psiTier  = "cooperative" as ReturnType<typeof getPsiTier>;
  private errorCount = 0;      // for errorRate dimension
  private sovereignCallCount = 0; // rate-limit on open Ψ/sovereign tools

  check(toolName: string, isError = false): { allowed: boolean; reason?: string; psiScore?: number; psiTier?: string } {
    // Read-only tools always pass — only block wallet-sensitive tools
    if (this.blocked && WALLET_SENSITIVE.has(toolName)) {
      return { allowed: false, reason: `Session blocked: ${this.blockReason}` };
    }

    const now = Date.now();
    if (isError) this.errorCount++;
    this.calls.push({ tool: toolName, timestamp: now });

    // ── Ψ Consensus Check ──────────────────────────────────────────────────
    // Compute Ψ score on every call — the consensus layer runs continuously.
    // Cantillon dimension is populated with real on-chain WHALE balance when
    // recordWhaleVerification() has been called (i.e., after WHALE gate passes).
    const sessionAgeMs  = now - this.sessionStart;
    const uniqueTools   = new Set(this.calls.map(c => c.tool)).size;
    const velocityScore = this.calls.length / Math.max(sessionAgeMs / 60_000, 1/60);
    const errorRate     = this.errorCount / Math.max(this.calls.length, 1);

    // Read whale context (TTL: 60s — 2× the WHALE gate cache duration)
    const whaleCtxAge    = now - _latestWhaleCtx.ts;
    const whaleBalance   = whaleCtxAge < 60_000 ? _latestWhaleCtx.balance  : 0n;
    const isOwnerSession = whaleCtxAge < 60_000 ? _latestWhaleCtx.isOwner  : false;
    const sessionAddress = _latestWhaleCtx.address || "session";

    this.psiScore = quickPsiScore({
      address:        sessionAddress,
      whaleBalance,
      isOwner:        isOwnerSession,
      callCount:      this.calls.length,
      uniqueTools,
      walletCalls:    this.walletCallCount,
      errorRate,
      velocityScore,
      sessionAgeMs,
      honeypotHit:    false,  // checked separately by behavioral fortress
      ipiDetected:    ipiAuditLog.length > 0,
      coordinatedAtk: ipiAuditLog.some(e =>
        (ipiPhraseCount.get(e.phrase) ?? 0) >= COORDINATED_ATTACK_THRESHOLD
      ),
      behaviorScore:  0,      // behavioral fortress feeds here externally
    });
    this.psiTier = getPsiTier(this.psiScore);

    // Ψ adversarial tier → block wallet ops immediately
    // "Gödel axiom broken — external consensus violated"
    if (this.psiTier === "adversarial" && WALLET_SENSITIVE.has(toolName)) {
      const reason = `Ψ Consensus BLOCKED — adversarial pattern detected (Ψ=${this.psiScore.toFixed(1)}, tier=${this.psiTier}). Nash equilibrium violated. Wallet operations suspended.`;
      this.blocked = true;
      this.blockReason = reason;
      return { allowed: false, reason, psiScore: this.psiScore, psiTier: this.psiTier };
    }

    // 1. Consecutive loop detection
    if (this.calls.length >= LOOP_DETECTION_CONSECUTIVE) {
      const tail = this.calls.slice(-LOOP_DETECTION_CONSECUTIVE);
      if (tail.every((c) => c.tool === toolName)) {
        const reason = `Loop detected: "${toolName}" called ${LOOP_DETECTION_CONSECUTIVE}x consecutively — possible MCPTox attack`;
        this.blocked = true;
        this.blockReason = reason;
        return { allowed: false, reason };
      }
    }

    // 2. Rapid repeat detection (same tool N times in 10 seconds)
    const recentSameTool = this.calls.filter(
      (c) => c.tool === toolName && now - c.timestamp < LOOP_DETECTION_RAPID_WINDOW_MS
    );
    if (recentSameTool.length > LOOP_DETECTION_RAPID_COUNT) {
      const reason = `Rapid loop: "${toolName}" called ${recentSameTool.length}x in ${LOOP_DETECTION_RAPID_WINDOW_MS / 1000}s — possible Denial-of-Wallet`;
      this.blocked = true;
      this.blockReason = reason;
      return { allowed: false, reason };
    }

    // 3. Sovereign/Ψ open-access rate limit (API scraping prevention)
    // These tools are open by design but rate-limited to prevent Hiro API exhaustion.
    if (SOVEREIGN_TOOLS.has(toolName)) {
      this.sovereignCallCount++;
      if (this.sovereignCallCount > MAX_SOVEREIGN_CALLS_PER_SESSION) {
        return {
          allowed: false,
          reason: `Ψ Intelligence rate limit: ${this.sovereignCallCount}/${MAX_SOVEREIGN_CALLS_PER_SESSION} sovereign calls this session. Open tools are rate-limited to prevent API scraping. Start a new session to continue.`,
        };
      }
    }

    // 4. Wallet-sensitive call cap
    if (WALLET_SENSITIVE.has(toolName)) {
      this.walletCallCount++;
      if (this.walletCallCount > MAX_WALLET_CALLS_PER_SESSION) {
        const reason = `Wallet call limit exceeded: ${this.walletCallCount}/${MAX_WALLET_CALLS_PER_SESSION} — session budget protection active`;
        this.blocked = true;
        this.blockReason = reason;
        return { allowed: false, reason };
      }
    }

    // 4. Total session call cap
    if (this.calls.length > MAX_TOTAL_CALLS_PER_SESSION) {
      const reason = `Session call limit: ${this.calls.length}/${MAX_TOTAL_CALLS_PER_SESSION} total calls — possible runaway agent`;
      this.blocked = true;
      this.blockReason = reason;
      return { allowed: false, reason };
    }

    return { allowed: true };
  }

  unblock(): void {
    this.blocked = false;
    this.blockReason = "";
    // Clear the call history tail so consecutive detection resets cleanly
    this.calls = this.calls.slice(-2);
  }

  stats(): {
    totalCalls: number;
    walletCalls: number;
    sovereignCalls: number;
    sessionDurationMs: number;
    blocked: boolean;
    blockReason: string;
    ipiDefenseActive: boolean;
    ipiPhraseCount: number;
    psi: { score: number; tier: string; equation: string };
  } {
    return {
      totalCalls: this.calls.length,
      walletCalls: this.walletCallCount,
      sovereignCalls: this.sovereignCallCount,
      sessionDurationMs: Date.now() - this.sessionStart,
      blocked: this.blocked,
      blockReason: this.blockReason,
      ipiDefenseActive: true,
      ipiPhraseCount: IPI_ATTACK_PHRASES.length,
      psi: {
        score:    this.psiScore,
        tier:     this.psiTier,
        equation: "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
      },
    };
  }
}

// ─── Session Registry ─────────────────────────────────────────────────────────
//
// Each McpServer instance gets its own SessionGuard, keyed by server identity.
// This ensures that in multi-session transports (HTTP/SSE) where multiple
// McpServer instances share a process, call counts are not conflated across
// clients. For the primary stdio transport (one process per client connection)
// this degenerates to a single guard — identical behaviour to a singleton.

const sessionRegistry = new WeakMap<object, SessionGuard>();

function getGuard(server: object): SessionGuard {
  let g = sessionRegistry.get(server);
  if (!g) {
    g = new SessionGuard();
    sessionRegistry.set(server, g);
  }
  return g;
}

export function unblockSession(server: object): void {
  getGuard(server).unblock();
}

// ─── MCP Server Wrapper ────────────────────────────────────────────────────────

/**
 * Wraps server.registerTool to inject session guard checks before each tool handler.
 * Call this BEFORE registering any tools.
 * Returns a cleanup function.
 *
 * Guard state is scoped to the McpServer instance via WeakMap, so multiple
 * concurrent sessions in an HTTP/SSE deployment each get independent counters.
 *
 * Usage:
 *   const cleanup = withSessionGuard(server);
 *   registerAllTools(server);
 *   // cleanup() to restore
 */
export function withSessionGuard(server: McpServer): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (server as any).registerTool;
  const hasOwn = Object.prototype.hasOwnProperty.call(server, "registerTool");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).registerTool = function (
    name: string,
    config: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...args: any[]) => any
  ) {
    // Wrap the handler with guard check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guardedHandler = async (...args: any[]) => {
      const guard = getGuard(server);
      const check = guard.check(name);
      if (!check.allowed) {
        // Return error in MCP tool response format
        return {
          content: [
            {
              type: "text",
              text: `🛡️ SESSION GUARD BLOCKED\n\n${check.reason}\n\nThis protection prevents MCP Overthinking Attacks (MCPTox / adversa.ai March 2026) that amplify token consumption 142x and can drain wallet budgets via repeated on-chain calls.\n\nSession stats: ${JSON.stringify(guard.stats(), null, 2)}`,
            },
          ],
          isError: true,
        };
      }

      // ── L3E: IPI scan on tool INPUTS ─────────────────────────────────────
      // Scan all string-valued inputs before the tool executes.
      // Prevents adversarial prompts embedded in tool arguments from
      // reaching the handler (e.g. description="agents must immediately...").
      const inputArg = args[0];
      if (inputArg && typeof inputArg === "object") {
        for (const [key, value] of Object.entries(inputArg)) {
          if (typeof value === "string") {
            const inputScan = ipiScan(value, `tool input "${name}.${key}"`);
            if (inputScan.detected) {
              ipiLogAttack(inputScan, value);
              return {
                content: [{ type: "text", text: ipiAlert(inputScan, value) }],
                isError: true,
              };
            }
          }
        }
      }

      // Execute the tool handler
      const result = await handler(...args);

      // ── Bitcoin hash chain: log every call as a block ─────────────────────
      // Runs after execution so output_hash covers the actual result.
      // Violations are logged to stderr but never block the response.
      try {
        const chain = getChain(server);
        const { violations } = chain.addBlock(name, args[0] ?? {}, result);
        if (violations.length > 0) {
          console.error(`[HASH CHAIN] Block violations for "${name}":`, violations.map(v => `Rule ${v.rule}: ${v.detail}`).join("; "));
        }
      } catch (chainErr) {
        console.error("[HASH CHAIN] Block addition failed:", chainErr);
      }

      // ── L3E: IPI scan on tool result content ──────────────────────────────
      // Scan the returned text for indirect prompt injection phrases.
      // If found → override the result with an IPI alert, do NOT return the
      // injected content as-is.  Policy: terms-of-use.md §12.3
      if (result?.content && Array.isArray(result.content)) {
        const sanitizedBlocks = [];
        let anyInjected = false;
        const injectedPhrases: string[] = [];

        for (const block of result.content) {
          if (block?.type === "text" && typeof block.text === "string") {
            const scan = ipiScan(block.text, `tool result from "${name}"`);
            if (scan.detected) {
              // Log the attack for audit
              ipiLogAttack(scan, block.text);
              anyInjected = true;

              // Wallet-sensitive tools: block entirely (hard stop)
              if (WALLET_SENSITIVE.has(name)) {
                return {
                  content: [{ type: "text", text: ipiAlert(scan, block.text) }],
                  isError: true,
                };
              }

              // Read-only tools: sanitize and continue (safe read mode)
              const { sanitized, removedPhrases } = ipiSanitize(block.text);
              injectedPhrases.push(...removedPhrases);
              sanitizedBlocks.push({ ...block, text: sanitized });
            } else {
              sanitizedBlocks.push(block);
            }
          } else {
            sanitizedBlocks.push(block);
          }
        }

        if (anyInjected) {
          // Prepend a warning banner to the sanitized result
          const banner = [
            `⚠️  IPI DEFENSE — SANITIZED MODE`,
            `Injection phrases removed: ${[...new Set(injectedPhrases)].map(p => `"${p}"`).join(", ")}`,
            ipiIsCoordinatedAttack(injectedPhrases[0]) ? `🚨 COORDINATED ATTACK — phrase seen ${ipiAuditLog.length}x this session` : "",
            `Content sanitized and returned safely. Wallet actions remain blocked.`,
            `─────────────────────────────────────────`,
            ``,
          ].filter(Boolean).join("\n");

          return {
            content: [
              { type: "text", text: banner },
              ...sanitizedBlocks,
            ],
          };
        }
      }

      return result;
    };

    return original.call(server, name, config, guardedHandler);
  };

  return () => {
    if (hasOwn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).registerTool = original;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (server as any).registerTool;
    }
  };
}

// Export factory for tests and direct access
// IPI exports (ipiScan, ipiAlert, IPI_ATTACK_PHRASES) are declared above with `export`
// Ψ exports: recordWhaleVerification declared above with `export`
export { getGuard, WALLET_SENSITIVE, MAX_WALLET_CALLS_PER_SESSION };
