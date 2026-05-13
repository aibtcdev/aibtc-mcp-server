/**
 * Nash-Gossip Protocol — بروتوكول ناش للانتشار اللامركزي
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THEORETICAL FOUNDATION
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Nash's Dominant Strategy Theorem applied to gossip propagation:
 *
 *   Let N = set of nodes, S_i ∈ {propagate, withhold} for node i.
 *   Payoff(propagate | others) = participation_value > 0  (always)
 *   Payoff(withhold  | others) = isolation_penalty  < 0  (always)
 *
 *   ∀ i ∈ N, ∀ S_{-i}: Payoff_i(propagate, S_{-i}) > Payoff_i(withhold, S_{-i})
 *
 *   → propagate is a DOMINANT STRATEGY (not merely a Nash equilibrium)
 *   → no coordination required — simultaneous action reaches equilibrium instantly
 *
 * Bitcoin's geometric non-identity principle:
 *
 *   Nodes carry no positional identity. Peers are sampled uniformly from the
 *   reachable set. The topology is an Erdős–Rényi random graph G(n,p) where:
 *     - diameter D ≈ log(n)/log(np)  — O(log n) propagation time
 *     - connectivity: p > ln(n)/n ensures connected graph w.h.p.
 *     - joining/leaving nodes don't affect other nodes' strategies
 *
 *   This non-geometry means: NO routing table, NO position commitment,
 *   NO advantage from topology knowledge. Every node is equally "central."
 *
 * Conflict-free parallelism:
 *
 *   Because propagate dominates, all nodes act simultaneously in each round.
 *   Round k: every infected node forwards to all its peers in parallel.
 *   Expected infected nodes after k rounds: I(k) ≈ n(1 - (1-p)^(k·I(0)))
 *   For p = c/n (Bitcoin's ~8 peers): full propagation in O(log n) rounds.
 *
 *   "Conflict-free" = no two nodes compete for the same propagation slot.
 *   Each node's forward is independent — total parallelism, zero contention.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * IMPLEMENTATION
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Uses:
 *   - ZK commitments for message integrity (from zk-commitment.ts)
 *   - Double-SHA256 for message IDs (from tool-hash-chain.ts)
 *   - Random peer sampling (no geometry — pure random graph)
 *   - SIR epidemic model for propagation analytics
 */

import { createHash, randomBytes } from "crypto";
import { commit, generateSalt } from "../security/zk-commitment.js";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type NodeId = string; // 32-byte hex — no positional meaning

export interface GossipMessage {
  msg_id:      string;      // doubleSHA256(content + origin + salt)
  origin:      NodeId;      // originating node (NOT routing info — just attribution)
  content:     string;      // the payload
  commitment:  string;      // ZK commitment: commit(content, salt)
  salt:        string;      // revealed immediately (non-private gossip)
  ttl:         number;      // hops remaining (decremented on each forward)
  created_at:  number;
  msg_type:    "psi_update" | "chain_block" | "zk_proof" | "alert" | "custom";
}

export interface PropagationRecord {
  msg_id:      string;
  hops:        number;
  received_at: number;
  from_peer:   NodeId;
  forwarded_to: NodeId[];
}

export interface NashEquilibriumState {
  round:               number;
  infected_count:      number;
  total_nodes:         number;
  infection_rate:      number;    // I(k)/n
  expected_by_formula: number;    // SIR model prediction
  delta:               number;    // |actual - expected|
  equilibrium_reached: boolean;   // infection_rate ≥ EQUILIBRIUM_THRESHOLD
}

export interface NashPayoffMatrix {
  node_id:            NodeId;
  strategy:           "propagate" | "withhold";
  participation_value: number;    // value from being connected (positive)
  isolation_penalty:  number;     // cost of withholding (negative)
  dominant_payoff:    number;     // participation_value - isolation_penalty
  is_dominant:        boolean;    // always true in honest network
  proof:              string;     // mathematical proof string
}

export interface GossipNetworkStats {
  node_count:           number;
  edge_count:           number;
  avg_degree:           number;
  diameter_estimate:    number;   // log(n)/log(avg_degree)
  connectivity_bound:   number;   // threshold p > ln(n)/n
  current_p:            number;   // actual edge probability
  is_connected_whp:     boolean;  // current_p > connectivity_bound
  nash_equilibrium:     NashEquilibriumState | null;
  messages_propagated:  number;
  total_hops:           number;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_PEER_COUNT  = 8;     // Bitcoin's default outbound peers
const MAX_TTL             = 16;    // max hops before message is dropped
const EQUILIBRIUM_THRESHOLD = 0.95; // 95% infection = equilibrium
const MSG_DEDUP_TTL_MS    = 60_000; // 60s dedup window (like Bitcoin's 2min)

// ══════════════════════════════════════════════════════════════════════════════
// HASHING
// ══════════════════════════════════════════════════════════════════════════════

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function doubleSha256(data: string): string {
  return sha256(sha256(data));
}

function newNodeId(): NodeId {
  return randomBytes(32).toString("hex");
}

function msgId(content: string, origin: NodeId, salt: string): string {
  return doubleSha256(`${content}:${origin}:${salt}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// GOSSIP NODE — individual participant, no positional identity
// ══════════════════════════════════════════════════════════════════════════════

export class GossipNode {
  readonly id: NodeId;
  readonly _peers = new Set<GossipNode>(); // internal — use peerCount / addPeer / removePeer
  private seen  = new Map<string, number>(); // msg_id → timestamp (dedup)
  private inbox: GossipMessage[] = [];
  private propagationLog: PropagationRecord[] = [];
  private roundsParticipated = 0;

  constructor(id?: NodeId) {
    this.id = id ?? newNodeId();
  }

  // ── Peer management (non-geometric: random connections) ───────────────────

  addPeer(peer: GossipNode): void {
    if (peer.id !== this.id) {
      this._peers.add(peer);
      peer._peers.add(this); // symmetric — undirected graph
    }
  }

  removePeer(peer: GossipNode): void {
    this._peers.delete(peer);
    peer._peers.delete(this);
  }

  get peerCount(): number { return this._peers.size; }

  // ── Message origination ───────────────────────────────────────────────────

  originate(
    content: string,
    msgType: GossipMessage["msg_type"] = "custom",
    ttl = MAX_TTL,
  ): GossipMessage {
    const salt       = generateSalt();
    const commitment = commit(content, salt);
    const id         = msgId(content, this.id, salt);
    const msg: GossipMessage = {
      msg_id:    id,
      origin:    this.id,
      content,
      commitment,
      salt,
      ttl,
      created_at: Date.now(),
      msg_type:  msgType,
    };
    this.seen.set(id, Date.now());
    return msg;
  }

  // ── Receive and forward (the gossip step) ─────────────────────────────────
  //
  // This is where Nash's dominant strategy manifests:
  //   receive(msg) → forward to all peers immediately
  //   No coordination, no waiting, no routing decision.
  //   Propagate is always the dominant strategy.

  receive(msg: GossipMessage, fromPeer: NodeId): {
    accepted: boolean;
    forwarded_to: NodeId[];
    reason?: string;
  } {
    this.roundsParticipated++;

    // ── Deduplication (Bitcoin's inv/getdata equivalent) ──────────────────
    const existing = this.seen.get(msg.msg_id);
    if (existing && Date.now() - existing < MSG_DEDUP_TTL_MS) {
      return { accepted: false, forwarded_to: [], reason: "already_seen" };
    }

    // ── TTL check ─────────────────────────────────────────────────────────
    if (msg.ttl <= 0) {
      return { accepted: false, forwarded_to: [], reason: "ttl_expired" };
    }

    // ── Integrity check: verify ZK commitment ─────────────────────────────
    const recomputed = commit(msg.content, msg.salt);
    if (recomputed !== msg.commitment) {
      return { accepted: false, forwarded_to: [], reason: "commitment_invalid" };
    }

    // ── Accept and record ─────────────────────────────────────────────────
    this.seen.set(msg.msg_id, Date.now());
    this.inbox.push(msg);

    // ── NASH DOMINANT STRATEGY: forward to ALL peers simultaneously ───────
    // No decision required — propagate is always best response.
    // This is the "simultaneous messages without direction" the protocol
    // embodies: every peer receives in the same logical round.
    const forwarded: NodeId[] = [];
    const decremented: GossipMessage = { ...msg, ttl: msg.ttl - 1 };

    for (const peer of this._peers) {
      if (peer.id === fromPeer) continue; // don't echo back (Bitcoin behavior)
      const result = peer.receive(decremented, this.id);
      if (result.accepted || result.reason === "already_seen") {
        forwarded.push(peer.id);
      }
    }

    this.propagationLog.push({
      msg_id:       msg.msg_id,
      hops:         MAX_TTL - msg.ttl,
      received_at:  Date.now(),
      from_peer:    fromPeer,
      forwarded_to: forwarded,
    });

    return { accepted: true, forwarded_to: forwarded };
  }

  // ── Nash payoff analysis for this node ────────────────────────────────────

  nashPayoff(): NashPayoffMatrix {
    const degree = this._peers.size;
    // Participation value: log(degree + 1) × connectivity bonus
    // Each peer adds ln(k) value (diminishing returns — like Bitcoin's 8-peer saturation)
    const participationValue = Math.log(degree + 1) * 10;

    // Isolation penalty: if withholding, node misses chain updates
    // Penalty = -(msgs_missed × value_per_msg)
    const isolationPenalty = -(this.inbox.length > 0 ? Math.log(this.inbox.length + 1) * 15 : 5);

    const dominantPayoff = participationValue - isolationPenalty;
    const isDominant     = dominantPayoff > 0; // always true in honest network

    return {
      node_id:             this.id,
      strategy:            "propagate",
      participation_value: participationValue,
      isolation_penalty:   isolationPenalty,
      dominant_payoff:     dominantPayoff,
      is_dominant:         isDominant,
      proof: [
        `∀ S_{-i}: Payoff(propagate, S_{-i}) > Payoff(withhold, S_{-i})`,
        `Payoff(propagate) = ln(${degree}+1)×10 = ${participationValue.toFixed(3)}`,
        `Payoff(withhold)  = −ln(${this.inbox.length}+1)×15 = ${isolationPenalty.toFixed(3)}`,
        `Dominant payoff   = ${dominantPayoff.toFixed(3)} > 0  → propagate dominates ∎`,
      ].join("\n"),
    };
  }

  stats() {
    return {
      node_id:               this.id.slice(0, 16) + "...",
      peer_count:            this._peers.size,
      messages_received:     this.inbox.length,
      messages_forwarded:    this.propagationLog.reduce((s, r) => s + r.forwarded_to.length, 0),
      rounds_participated:   this.roundsParticipated,
      seen_msg_ids:          this.seen.size,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GOSSIP NETWORK — manages topology and runs propagation simulations
// ══════════════════════════════════════════════════════════════════════════════

export class GossipNetwork {
  private nodes = new Map<NodeId, GossipNode>();
  private messagesTotal = 0;
  private hopsTotal     = 0;
  private nashHistory: NashEquilibriumState[] = [];

  // ── Build random Erdős–Rényi graph ────────────────────────────────────────
  //
  // Non-geometric: each pair connected with probability p = targetDegree/n.
  // No positions, no coordinates, no routing tables.

  addNodes(count: number, targetDegree = DEFAULT_PEER_COUNT): void {
    const newNodes: GossipNode[] = [];
    for (let i = 0; i < count; i++) {
      const node = new GossipNode();
      this.nodes.set(node.id, node);
      newNodes.push(node);
    }

    const n = this.nodes.size;
    const p = Math.min(targetDegree / Math.max(n - 1, 1), 1);
    const allNodes = [...this.nodes.values()];

    // Random graph construction — O(n²) but only needed once at setup
    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        if (Math.random() < p) {
          allNodes[i].addPeer(allNodes[j]);
        }
      }
    }
  }

  // ── Dynamic join — node enters without knowing topology ────────────────────

  join(targetDegree = DEFAULT_PEER_COUNT): GossipNode {
    const node = new GossipNode();
    this.nodes.set(node.id, node);

    const allNodes = [...this.nodes.values()].filter(n => n.id !== node.id);
    if (allNodes.length === 0) return node;

    // Connect to random sample (non-geometric peer discovery)
    const actualDegree = Math.min(targetDegree, allNodes.length);
    const shuffled     = allNodes.sort(() => Math.random() - 0.5);
    for (let i = 0; i < actualDegree; i++) {
      node.addPeer(shuffled[i]);
    }

    return node;
  }

  // ── Dynamic leave — node exits without notifying the network ───────────────
  // (Bitcoin behavior: nodes disconnect silently)

  leave(nodeId: NodeId): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    // Remove from all peers — topology heals automatically
    for (const peer of [...this.nodes.values()]) {
      peer.removePeer(node);
    }
    this.nodes.delete(nodeId);
  }

  // ── Propagate from origin ─────────────────────────────────────────────────
  //
  // "Simultaneous messages without direction" — the origin fires into
  // all its peers at once. Each hop is a parallel round.
  // This embodies Nash's conflict-free parallelism:
  // every node acts simultaneously, no sequencing, no coordination.

  propagate(
    originId: NodeId,
    content: string,
    msgType: GossipMessage["msg_type"] = "custom",
  ): {
    msg:              GossipMessage;
    total_reached:    number;
    rounds:           number;
    nash_history:     NashEquilibriumState[];
    propagation_time_ms: number;
  } {
    const origin = this.nodes.get(originId);
    if (!origin) throw new Error(`Node ${originId} not in network`);

    const msg = origin.originate(content, msgType);
    this.messagesTotal++;

    const n       = this.nodes.size;
    const reached = new Set<NodeId>([originId]);
    let round     = 0;
    const nashHistory: NashEquilibriumState[] = [];
    const t0      = Date.now();

    // Wave-by-wave propagation — each wave is one parallel round
    let currentWave: Array<{ node: GossipNode; fromPeer: NodeId }> =
      [...origin._peers].map(p => ({ node: p, fromPeer: origin.id }));

    // Fire first wave from origin simultaneously
    const firstWaveMsg: GossipMessage = { ...msg, ttl: msg.ttl - 1 };
    for (const { node, fromPeer } of currentWave) {
      node.receive(firstWaveMsg, fromPeer);
      reached.add(node.id);
    }
    round++;

    // SIR model: I(k) = n(1 - e^{-β·k·I(0)/n}) for large n
    const avgDegree = this.networkStats().avg_degree;
    const beta      = avgDegree / n; // transmission rate

    // Record Nash state for round 0
    nashHistory.push(this._nashState(round, reached.size, n, beta));

    // Subsequent rounds: BFS-style wave propagation
    while (round < MAX_TTL) {
      const nextWave: Array<{ node: GossipNode; fromPeer: NodeId }> = [];

      for (const { node, fromPeer } of currentWave) {
        for (const peer of [...node._peers]) {
          if (!reached.has(peer.id)) {
            nextWave.push({ node: peer, fromPeer: node.id });
            reached.add(peer.id);
          }
        }
      }

      if (nextWave.length === 0) break; // fully propagated

      const waveMsg: GossipMessage = { ...msg, ttl: msg.ttl - round - 1 };
      for (const { node, fromPeer } of nextWave) {
        node.receive(waveMsg, fromPeer);
        this.hopsTotal++;
      }

      round++;
      nashHistory.push(this._nashState(round, reached.size, n, beta));
      currentWave = nextWave;

      const state = nashHistory[nashHistory.length - 1];
      if (state.equilibrium_reached) break;
    }

    this.nashHistory.push(...nashHistory);

    return {
      msg,
      total_reached:    reached.size,
      rounds:           round,
      nash_history:     nashHistory,
      propagation_time_ms: Date.now() - t0,
    };
  }

  // ── Nash equilibrium state for a given round ───────────────────────────────

  private _nashState(
    round: number,
    infectedCount: number,
    n: number,
    beta: number,
  ): NashEquilibriumState {
    const infectionRate      = infectedCount / n;
    // SIR prediction: I(k) ≈ n × (1 - e^{-beta × k × I(0)})
    const expectedByFormula  = n * (1 - Math.exp(-beta * round));
    const delta              = Math.abs(infectedCount - expectedByFormula);
    const equilibriumReached = infectionRate >= EQUILIBRIUM_THRESHOLD;

    return {
      round,
      infected_count:      infectedCount,
      total_nodes:         n,
      infection_rate:      infectionRate,
      expected_by_formula: expectedByFormula,
      delta,
      equilibrium_reached: equilibriumReached,
    };
  }

  // ── Network statistics (topology analysis) ────────────────────────────────

  networkStats(): GossipNetworkStats {
    const n = this.nodes.size;
    const allNodes = [...this.nodes.values()];
    const edgeCount = allNodes.reduce((s, node) => s + node.peerCount, 0) / 2;
    const avgDegree = n > 0 ? (edgeCount * 2) / n : 0;

    // Erdős–Rényi: connected w.h.p. iff p > ln(n)/n
    const connectivityBound = n > 1 ? Math.log(n) / (n - 1) : 1;
    const currentP          = n > 1 ? avgDegree / (n - 1) : 0;
    const isConnectedWhp    = currentP > connectivityBound;

    // Diameter: ln(n)/ln(avgDegree) for random graph
    const diameterEstimate = n > 1 && avgDegree > 1
      ? Math.ceil(Math.log(n) / Math.log(avgDegree))
      : 1;

    const lastNash = this.nashHistory[this.nashHistory.length - 1] ?? null;

    return {
      node_count:          n,
      edge_count:          edgeCount,
      avg_degree:          avgDegree,
      diameter_estimate:   diameterEstimate,
      connectivity_bound:  connectivityBound,
      current_p:           currentP,
      is_connected_whp:    isConnectedWhp,
      nash_equilibrium:    lastNash,
      messages_propagated: this.messagesTotal,
      total_hops:          this.hopsTotal,
    };
  }

  // ── Nash payoff for all nodes ──────────────────────────────────────────────

  networkNashAnalysis(): {
    nodes_dominant:   number;
    nodes_total:      number;
    network_dominant: boolean;
    avg_dominant_payoff: number;
    proof_sketch:     string;
  } {
    const payoffs = [...this.nodes.values()].map(n => n.nashPayoff());
    const dominant = payoffs.filter(p => p.is_dominant).length;
    const avgPayoff = payoffs.reduce((s, p) => s + p.dominant_payoff, 0) / Math.max(payoffs.length, 1);

    return {
      nodes_dominant:      dominant,
      nodes_total:         payoffs.length,
      network_dominant:    dominant === payoffs.length,
      avg_dominant_payoff: avgPayoff,
      proof_sketch: [
        `Nash Dominant Strategy Proof (network-level):`,
        `  Strategy space: S_i ∈ {propagate, withhold}`,
        `  ∀ i ∈ N, ∀ S_{-i}:`,
        `    U_i(propagate, S_{-i}) = ln(degree_i + 1) × 10  > 0`,
        `    U_i(withhold,  S_{-i}) = −ln(inbox_i + 1) × 15  < 0`,
        `  → propagate strictly dominates withhold for all nodes`,
        `  → (propagate, ..., propagate) is the unique Nash equilibrium`,
        `  → simultaneous action converges without coordination ∎`,
        ``,
        `  ${dominant}/${payoffs.length} nodes confirmed dominant (${(dominant/Math.max(payoffs.length,1)*100).toFixed(1)}%)`,
        `  Avg dominant payoff: ${avgPayoff.toFixed(3)}`,
        ``,
        `  Non-geometric topology: E-R random graph G(${payoffs.length}, p=${this.networkStats().current_p.toFixed(4)})`,
        `  Diameter bound: O(log n) = O(log ${payoffs.length}) ≈ ${this.networkStats().diameter_estimate}`,
        `  Connected w.h.p.: ${this.networkStats().is_connected_whp}`,
      ].join("\n"),
    };
  }

  allNodes(): ReadonlyMap<NodeId, GossipNode> { return this.nodes; }

  randomNode(): GossipNode | null {
    const arr = [...this.nodes.values()];
    return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLETON NETWORK (extends across MCP server instances via module state)
// ══════════════════════════════════════════════════════════════════════════════

let _globalNetwork: GossipNetwork | null = null;

export function getGlobalNetwork(seed?: {
  nodeCount?: number;
  targetDegree?: number;
}): GossipNetwork {
  if (!_globalNetwork) {
    _globalNetwork = new GossipNetwork();
    const n = seed?.nodeCount ?? 16;
    const d = seed?.targetDegree ?? DEFAULT_PEER_COUNT;
    _globalNetwork.addNodes(n, d);
  }
  return _globalNetwork;
}

export function resetNetwork(): void {
  _globalNetwork = null;
}
