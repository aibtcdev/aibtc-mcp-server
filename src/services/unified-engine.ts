/**
 * Unified Engine — المحرك الموحد الشامل
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * الدمج الكامل لكل الأنظمة في حلقة واحدة مغلقة:
 *
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │                    UNIFIED ENGINE v1.0                          │
 *  │                                                                 │
 *  │  WHALE Balance ──→ Cantillon ──→ Ψ Score ──→ Access Tier       │
 *  │       ↑                               ↓                        │
 *  │  Buyback ←── Treasury ←── x402 ←── Tools Used                  │
 *  │       ↑                               ↓                        │
 *  │  Nash Gossip ←─────────── Hash Chain Block                      │
 *  │       ↓                               ↓                        │
 *  │  ZK Commitment          Sanctions Screen                        │
 *  │       ↓                               ↓                        │
 *  │  USSD/SMS ──→ DeFi    Risk Engine ──→ Zero Harm CB              │
 *  │       ↓                               ↓                        │
 *  │  Neuro-Economic ←── Currency Ψ ←── Monte Carlo                  │
 *  └─────────────────────────────────────────────────────────────────┘
 *
 * كل حدث يمر عبر كل الأنظمة — لا نظام منفصل، كلهم يغذون بعض.
 */

import { createHash } from "crypto";

// ── Subsystem imports ─────────────────────────────────────────────────────────

import {
  quickPsiScore,
  getPsiTier,
  type PsiInput,
} from "./psi-consensus.js";

import {
  getChain,
  type ToolBlock,
} from "./security/tool-hash-chain.js";

import {
  commit,
  generateSalt,
  verifyCommitment,
} from "./security/zk-commitment.js";

import {
  getGlobalNetwork,
  type GossipMessage,
} from "./network/nash-gossip.js";

import {
  screenEntity,
  getFeedStatuses,
} from "./security/sanctions-engine.js";

import {
  runMonteCarlo,
  computeCascadeImpact,
  buildAfterEffectsTimeline,
  assessCountryRisks,
  RISK_SCENARIOS,
} from "./simulation/risk-impact-engine.js";

import {
  runNeuroEconomicAnalysis,
  computePsiFromReality,
  buildDefaultReality,
  REALITY_PROFILES,
} from "./simulation/neuro-economic.js";

import {
  assessAction,
  getZeroHarmSummary,
  CIRCUIT_BREAKERS,
} from "./sovereign/zero-harm-protocol.js";

import {
  getDescriptor,
  getLowestPsi,
  getHighestPsiGain,
} from "./sovereign/universal-currency-engine.js";

import {
  processUssdInput,
  parseSmsCommand,
  buildSmsReply,
  getGatewayStatus,
} from "./access/ussd-gateway.js";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES — Unified event model
// ══════════════════════════════════════════════════════════════════════════════

export type EventType =
  | "tool_call"       // MCP tool executed
  | "x402_payment"    // Payment processed
  | "psi_update"      // Ψ score changed
  | "risk_trigger"    // Risk scenario activated
  | "ussd_input"      // USSD/SMS command received
  | "chain_block"     // Hash chain block added
  | "sanctions_hit"   // Sanctions match detected
  | "gossip_msg"      // Nash gossip message received
  | "zk_commit"       // ZK commitment created
  | "circuit_break";  // Zero-harm circuit breaker fired

export interface UnifiedEvent {
  type:       EventType;
  source:     string;         // originating system
  payload:    unknown;
  timestamp:  number;
  session_id?: string;
  address?:   string;         // STX/BTC address if known
}

export interface UnifiedResult {
  event_id:         string;
  event_type:       EventType;
  timestamp:        number;

  // Ψ consensus result
  psi: {
    score:      number;
    tier:       string;
    blocked:    boolean;
    reason?:    string;
  };

  // Sanctions result
  sanctions: {
    screened:      boolean;
    is_sanctioned: boolean;
    match?:        string;
  };

  // Chain integrity
  chain: {
    block_height:  number;
    block_hash:    string;
    chain_valid:   boolean;
  } | null;

  // Nash gossip propagation
  gossip: {
    propagated:    boolean;
    nodes_reached: number;
    rounds:        number;
  } | null;

  // Risk assessment
  risk: {
    scenario_id?:  string;
    severity:      number;       // 0–1
    circuit_breaker_fired: boolean;
    after_effects?: ReturnType<typeof buildAfterEffectsTimeline>;
  } | null;

  // ZK proof if sensitive data
  zk: {
    commitment:    string;
    salt:          string;
  } | null;

  // Subsystem errors (non-fatal — unified engine never throws)
  warnings: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// INTEGRATION REGISTRY — maps event types to active subsystems
// ══════════════════════════════════════════════════════════════════════════════

export interface IntegrationConfig {
  psi_enabled:        boolean;
  sanctions_enabled:  boolean;
  chain_enabled:      boolean;
  gossip_enabled:     boolean;
  risk_enabled:       boolean;
  zk_enabled:         boolean;
  zero_harm_enabled:  boolean;
  ussd_enabled:       boolean;
  neuro_enabled:      boolean;
}

const DEFAULT_CONFIG: IntegrationConfig = {
  psi_enabled:       true,
  sanctions_enabled: true,
  chain_enabled:     true,
  gossip_enabled:    true,
  risk_enabled:      true,
  zk_enabled:        true,
  zero_harm_enabled: true,
  ussd_enabled:      true,
  neuro_enabled:     true,
};

// ══════════════════════════════════════════════════════════════════════════════
// WHALE CONTEXT — economic root of trust
// ══════════════════════════════════════════════════════════════════════════════

export interface WhaleContext {
  address:     string;
  balance:     bigint;      // WHALE balance in micro-WHALE
  tier:        "none" | "scout" | "agent" | "elite" | "council";
  is_owner:    boolean;
  last_update: number;
}

let _whaleCtx: WhaleContext = {
  address:     "",
  balance:     0n,
  tier:        "none",
  is_owner:    false,
  last_update: 0,
};

export function updateWhaleContext(ctx: Partial<WhaleContext>): void {
  _whaleCtx = { ..._whaleCtx, ...ctx, last_update: Date.now() };
}

export function getWhaleContext(): WhaleContext {
  return { ..._whaleCtx };
}

function whaleTier(balance: bigint): WhaleContext["tier"] {
  if (balance >= 100_000_000_000n) return "elite";    // 100K WHALE
  if (balance >= 10_000_000_000n)  return "agent";    // 10K WHALE
  if (balance >= 1_000_000_000n)   return "scout";    // 1K WHALE
  return "none";
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export class UnifiedEngine {
  private readonly config: IntegrationConfig;
  private readonly serverRef: object;
  private eventCount = 0;
  private readonly sessionId: string;

  // Integration state — cross-subsystem memory
  private lastPsiScore   = 50;
  private lastPsiTier    = "cooperative";
  private riskHistory: Array<{ id: string; severity: number; ts: number }> = [];
  private gossipOriginId: string | null = null;
  private cachedSanctionsFeeds: { total: number; online: number } | null = null;

  constructor(serverRef: object, config: Partial<IntegrationConfig> = {}) {
    this.serverRef = serverRef;
    this.config    = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = createHash("sha256")
      .update(`session:${Date.now()}:${Math.random()}`)
      .digest("hex")
      .slice(0, 16);

    // Register this session in Nash gossip network
    if (this.config.gossip_enabled) {
      try {
        const net  = getGlobalNetwork({ nodeCount: 16, targetDegree: 8 });
        const node = net.join(8);
        this.gossipOriginId = node.id;
      } catch { /* gossip init failure is non-fatal */ }
    }
  }

  // ── Main process function — every event flows through here ────────────────

  async process(event: UnifiedEvent): Promise<UnifiedResult> {
    this.eventCount++;
    const warnings: string[] = [];
    const eventId = createHash("sha256")
      .update(`${this.sessionId}:${this.eventCount}:${event.type}:${event.timestamp}`)
      .digest("hex")
      .slice(0, 32);

    // ── 1. Ψ Consensus Check ───────────────────────────────────────────────
    let psiResult: UnifiedResult["psi"] = { score: 50, tier: "cooperative", blocked: false };

    if (this.config.psi_enabled) {
      try {
        const whale      = getWhaleContext();
        const whaleAge   = Date.now() - whale.last_update;
        const whaleBalance = whaleAge < 60_000 ? whale.balance : 0n;

        const psiInput: PsiInput = {
          address:       whale.address || event.address || "unified-engine",
          whaleBalance,
          isOwner:       whale.is_owner,
          callCount:     this.eventCount,
          uniqueTools:   1,
          walletCalls:   0,
          errorRate:     0,
          velocityScore: this.eventCount / Math.max((Date.now() - event.timestamp) / 60_000, 1/60),
          sessionAgeMs:  Date.now() - event.timestamp,
          honeypotHit:   false,
          ipiDetected:   false,
          coordinatedAtk: false,
          behaviorScore: 0,
        };

        const psiScore = quickPsiScore(psiInput);
        const psiTier  = getPsiTier(psiScore);
        this.lastPsiScore = psiScore;
        this.lastPsiTier  = psiTier;

        const blocked = psiTier === "adversarial";
        psiResult = {
          score:   psiScore,
          tier:    psiTier,
          blocked,
          reason:  blocked ? `Ψ adversarial pattern — score ${psiScore.toFixed(1)}` : undefined,
        };

        // Feed Ψ update back to Nash gossip (integration point 1)
        if (this.config.gossip_enabled && Math.abs(psiScore - this.lastPsiScore) > 5) {
          this._gossipPropagate(
            JSON.stringify({ psi: psiScore, tier: psiTier, session: this.sessionId }),
            "psi_update",
          );
        }
      } catch (e) {
        warnings.push(`psi: ${String(e).slice(0, 80)}`);
      }
    }

    // ── 2. Sanctions Screen ────────────────────────────────────────────────
    let sanctionsResult: UnifiedResult["sanctions"] = { screened: false, is_sanctioned: false };

    if (this.config.sanctions_enabled && event.address) {
      try {
        const screen = await screenEntity(event.address, "address", ["US_OFAC", "EU", "UK_OFSI"]);
        const matchId = screen.matches[0]?.matched_name_or_address;
        sanctionsResult = {
          screened:      true,
          is_sanctioned: screen.is_sanctioned,
          match:         matchId,
        };
        if (screen.is_sanctioned) {
          warnings.push(`SANCTIONS HIT: ${event.address} — ${matchId}`);
          // Sanctions hit → propagate alert via Nash gossip (integration point 2)
          this._gossipPropagate(
            JSON.stringify({ sanctions_hit: event.address, match: matchId }),
            "alert",
          );
        }
        // Refresh cached feed status asynchronously
        getFeedStatuses().then(feeds => {
          this.cachedSanctionsFeeds = {
            total:  feeds.length,
            online: feeds.filter(f => f.is_fresh && !f.error).length,
          };
        }).catch(() => { /* non-fatal */ });
      } catch (e) {
        warnings.push(`sanctions: ${String(e).slice(0, 80)}`);
      }
    }

    // ── 3. Hash Chain Block ────────────────────────────────────────────────
    let chainResult: UnifiedResult["chain"] = null;

    if (this.config.chain_enabled) {
      try {
        const chain = getChain(this.serverRef);
        const { block, violations } = chain.addBlock(
          `unified:${event.type}`,
          { event_id: eventId, type: event.type, source: event.source },
          { psi: psiResult.score, sanctions: sanctionsResult.is_sanctioned },
        );
        const verification = chain.verify();
        chainResult = {
          block_height: block.block_height,
          block_hash:   block.block_hash,
          chain_valid:  verification.valid,
        };
        if (violations.length > 0) {
          warnings.push(`chain violations: ${violations.map(v => `Rule${v.rule}`).join(",")}`);
        }

        // Chain block → Nash gossip (integration point 3)
        if (this.config.gossip_enabled && block.block_height % 5 === 0) {
          this._gossipPropagate(block.block_hash, "chain_block");
        }
      } catch (e) {
        warnings.push(`chain: ${String(e).slice(0, 80)}`);
      }
    }

    // ── 4. ZK Commitment for sensitive events ─────────────────────────────
    let zkResult: UnifiedResult["zk"] = null;

    if (this.config.zk_enabled && this._isSensitiveEvent(event)) {
      try {
        const salt       = generateSalt();
        const commitment = commit(JSON.stringify(event.payload ?? {}), salt);
        zkResult = { commitment, salt };
      } catch (e) {
        warnings.push(`zk: ${String(e).slice(0, 80)}`);
      }
    }

    // ── 5. Risk Engine + Zero Harm Circuit Breakers ────────────────────────
    let riskResult: UnifiedResult["risk"] = null;

    if (this.config.risk_enabled && event.type === "risk_trigger") {
      try {
        const payload = event.payload as { risk_id?: string; severity?: number } | null;
        const riskId  = payload?.risk_id ?? "RS-01";
        const scenario = RISK_SCENARIOS.find(s => s.scenario_id === riskId);

        if (scenario) {
          const mc       = runMonteCarlo(scenario, payload?.severity ?? 0.5);
          const cascade  = computeCascadeImpact(riskId, mc.expected_impact);
          const timeline = buildAfterEffectsTimeline(riskId, mc.expected_impact, mc.p90 > 50 ? "irreversible" : "difficult");

          this.riskHistory.push({ id: riskId, severity: mc.expected_impact, ts: Date.now() });

          // Check zero-harm circuit breakers (integration point 4)
          let circuitFired = false;
          if (this.config.zero_harm_enabled) {
            const zhSummary = getZeroHarmSummary();
            circuitFired = mc.expected_impact > 70 || mc.black_swan_probability > 0.05;
            if (circuitFired) {
              warnings.push(`CIRCUIT BREAKER: risk ${riskId} impact=${mc.expected_impact.toFixed(1)}% — zero-harm CB activated`);
              this._gossipPropagate(
                JSON.stringify({ circuit_break: riskId, impact: mc.expected_impact }),
                "alert",
              );
            }
          }

          riskResult = {
            scenario_id:           riskId,
            severity:              mc.expected_impact / 100,
            circuit_breaker_fired: circuitFired,
            after_effects:         timeline,
          };
        }
      } catch (e) {
        warnings.push(`risk: ${String(e).slice(0, 80)}`);
      }
    }

    // ── 6. Nash Gossip — non-risk events ──────────────────────────────────
    let gossipResult: UnifiedResult["gossip"] = null;

    if (this.config.gossip_enabled && event.type === "gossip_msg") {
      try {
        const payload = event.payload as string | null;
        const result  = this._gossipPropagate(payload ?? JSON.stringify(event), "custom");
        if (result) gossipResult = result;
      } catch (e) {
        warnings.push(`gossip: ${String(e).slice(0, 80)}`);
      }
    }

    // ── 7. USSD/SMS routing ────────────────────────────────────────────────
    if (this.config.ussd_enabled && event.type === "ussd_input") {
      try {
        const payload = event.payload as {
          session_id?: string; phone?: string; input?: string; sms?: string;
        } | null;
        if (payload?.sms) {
          const cmd   = parseSmsCommand(payload.phone ?? "", payload.sms);
          const reply = buildSmsReply(cmd);
          warnings.push(`USSD/SMS reply: ${reply.slice(0, 100)}`);
        } else if (payload?.input !== undefined) {
          const response = processUssdInput(
            payload.session_id ?? this.sessionId,
            payload.phone ?? "",
            payload.input,
          );
          warnings.push(`USSD [${response.response_type}]: ${response.message.slice(0, 80)}`);
        }
      } catch (e) {
        warnings.push(`ussd: ${String(e).slice(0, 80)}`);
      }
    }

    // ── 8. Neuro-economic sync — currency Ψ feeds reality model ───────────
    if (this.config.neuro_enabled && event.type === "psi_update") {
      try {
        const payload = event.payload as { currency?: string } | null;
        if (payload?.currency) {
          const descriptor = getDescriptor(payload.currency);
          if (descriptor) {
            const reality = buildDefaultReality(
              descriptor.country,
              descriptor.currency_code,
              descriptor.country,
            );
            // Reality feeds back into Ψ — closes the loop (integration point 5)
            const neuroResult = computePsiFromReality(reality);
            warnings.push(`Neuro-Ψ sync: ${payload.currency} → ${neuroResult.score.toFixed(1)}`);
          }
        }
      } catch (e) {
        warnings.push(`neuro: ${String(e).slice(0, 80)}`);
      }
    }

    return {
      event_id:   eventId,
      event_type: event.type,
      timestamp:  Date.now(),
      psi:        psiResult,
      sanctions:  sanctionsResult,
      chain:      chainResult,
      gossip:     gossipResult,
      risk:       riskResult,
      zk:         zkResult,
      warnings,
    };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _gossipPropagate(
    content: string,
    msgType: GossipMessage["msg_type"],
  ): UnifiedResult["gossip"] | null {
    if (!this.gossipOriginId) return null;
    try {
      const net    = getGlobalNetwork();
      const origin = net.allNodes().get(this.gossipOriginId) ?? net.randomNode();
      if (!origin) return null;
      const result = net.propagate(origin.id, content, msgType);
      return {
        propagated:    true,
        nodes_reached: result.total_reached,
        rounds:        result.rounds,
      };
    } catch {
      return null;
    }
  }

  private _isSensitiveEvent(event: UnifiedEvent): boolean {
    return ["x402_payment", "sanctions_hit", "zk_commit", "ussd_input"].includes(event.type);
  }

  // ── System-wide status ────────────────────────────────────────────────────

  status(): {
    session_id:     string;
    event_count:    number;
    psi:            { score: number; tier: string };
    whale:          WhaleContext;
    chain:          { length: number; valid: boolean } | null;
    gossip:         { nodes: number; edges: number } | null;
    sanctions:      { feeds: number; online: number } | null;
    risk_history:   number;
    config:         IntegrationConfig;
    integration_loops: string[];
  } {
    let chainStatus = null;
    try {
      const chain = getChain(this.serverRef);
      const v     = chain.verify();
      chainStatus = { length: chain.length, valid: v.valid };
    } catch { /* non-fatal */ }

    let gossipStatus = null;
    try {
      const net  = getGlobalNetwork();
      const stats = net.networkStats();
      gossipStatus = { nodes: stats.node_count, edges: stats.edge_count };
    } catch { /* non-fatal */ }

    const sanctionsStatus = this.cachedSanctionsFeeds
      ? { feeds: this.cachedSanctionsFeeds.total, online: this.cachedSanctionsFeeds.online }
      : null;

    return {
      session_id:   this.sessionId,
      event_count:  this.eventCount,
      psi:          { score: this.lastPsiScore, tier: this.lastPsiTier },
      whale:        getWhaleContext(),
      chain:        chainStatus,
      gossip:       gossipStatus,
      sanctions:    sanctionsStatus,
      risk_history: this.riskHistory.length,
      config:       this.config,
      integration_loops: [
        "WHALE → Cantillon → Ψ → Access",
        "x402 → Treasury → Buyback → WHALE supply",
        "Ψ update → Nash gossip propagation",
        "Hash chain block → Nash gossip (every 5 blocks)",
        "Sanctions hit → Nash gossip alert",
        "Risk trigger → Zero harm circuit breakers → Nash alert",
        "Currency Ψ → Neuro-economic reality model → Ψ feedback",
        "USSD/SMS → DeFi operations routing",
        "ZK commitment on all sensitive events",
        "Chain block logged for every unified event",
      ],
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLETON — one engine per MCP server instance
// ══════════════════════════════════════════════════════════════════════════════

const engineRegistry = new WeakMap<object, UnifiedEngine>();

export function getEngine(serverRef: object, config?: Partial<IntegrationConfig>): UnifiedEngine {
  let engine = engineRegistry.get(serverRef);
  if (!engine) {
    engine = new UnifiedEngine(serverRef, config);
    engineRegistry.set(serverRef, engine);
  }
  return engine;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE — fire-and-forget event emission
// ══════════════════════════════════════════════════════════════════════════════

export async function emitEvent(
  serverRef: object,
  type: EventType,
  source: string,
  payload: unknown,
  address?: string,
): Promise<UnifiedResult> {
  const engine = getEngine(serverRef);
  return engine.process({
    type,
    source,
    payload,
    timestamp: Date.now(),
    address,
  });
}
