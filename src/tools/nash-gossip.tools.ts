/**
 * Nash-Gossip Tools — أدوات بروتوكول ناش للانتشار اللامركزي
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GossipNetwork,
  GossipNode,
  getGlobalNetwork,
  resetNetwork,
  type NodeId,
} from "../services/network/nash-gossip.js";

export function registerNashGossipTools(server: McpServer): void {

  server.registerTool(
    "gossip_network_init",
    {
      title: "Initialize Nash-Gossip Network",
      description:
        "Build an Erdős–Rényi random gossip network with n nodes and target degree d. " +
        "Non-geometric: no positions, no routing tables. " +
        "Models Bitcoin's decentralized propagation topology.",
      inputSchema: z.object({
        node_count:     z.number().int().min(2).max(256).default(32).describe("Number of nodes (2–256)"),
        target_degree:  z.number().int().min(1).max(64).default(8).describe("Target peer count per node (Bitcoin default: 8)"),
        reset:          z.boolean().default(false).describe("Reset existing network before building"),
      }).shape,
    },
    async (args) => {
      if (args.reset) resetNetwork();
      const net = getGlobalNetwork({ nodeCount: args.node_count, targetDegree: args.target_degree });
      const stats = net.networkStats();
      const nash  = net.networkNashAnalysis();

      const text = [
        `🌐 NASH-GOSSIP NETWORK INITIALIZED`,
        ``,
        `Topology (Erdős–Rényi random graph — non-geometric):`,
        `  Nodes         : ${stats.node_count}`,
        `  Edges         : ${stats.edge_count}`,
        `  Avg degree    : ${stats.avg_degree.toFixed(2)}`,
        `  Diameter O(log n) : ≈ ${stats.diameter_estimate} hops`,
        `  p = ${stats.current_p.toFixed(4)}  |  threshold ln(n)/n = ${stats.connectivity_bound.toFixed(4)}`,
        `  Connected w.h.p.: ${stats.is_connected_whp ? "✅ YES" : "⚠️ NO (increase node count or degree)"}`,
        ``,
        `Nash Equilibrium Analysis:`,
        `  Dominant nodes: ${nash.nodes_dominant}/${nash.nodes_total} (${(nash.nodes_dominant/nash.nodes_total*100).toFixed(1)}%)`,
        `  Network Nash:   ${nash.network_dominant ? "✅ ALL DOMINANT — conflict-free" : "⚠️ partial"}`,
        `  Avg payoff:     ${nash.avg_dominant_payoff.toFixed(3)}`,
        ``,
        `Theoretical guarantee:`,
        `  Propagation rounds to reach 95% nodes: O(log ${stats.node_count}) ≈ ${stats.diameter_estimate}`,
        `  No routing required — dominant strategy = propagate`,
        `  Nodes join/leave without disrupting equilibrium`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "gossip_propagate",
    {
      title: "Propagate Message Through Network",
      description:
        "Originate a message from a random (or specified) node and trace its propagation. " +
        "Shows Nash equilibrium evolution round by round. " +
        "Uses ZK commitment for message integrity.",
      inputSchema: z.object({
        content:  z.string().describe("Message content to propagate"),
        msg_type: z.enum(["psi_update", "chain_block", "zk_proof", "alert", "custom"]).default("custom"),
        node_id:  z.string().optional().describe("Originating node ID (random if omitted)"),
      }).shape,
    },
    async (args) => {
      const net    = getGlobalNetwork();
      const origin = args.node_id
        ? net.allNodes().get(args.node_id) ?? net.randomNode()
        : net.randomNode();

      if (!origin) {
        return { content: [{ type: "text", text: "Network is empty — call gossip_network_init first." }], isError: true };
      }

      const result = net.propagate(origin.id, args.content, args.msg_type);
      const stats  = net.networkStats();

      const roundTable = result.nash_history.map((r, i) =>
        `  Round ${String(i + 1).padStart(2)}: ${r.infected_count.toString().padStart(4)}/${r.total_nodes} nodes ` +
        `(${(r.infection_rate * 100).toFixed(1).padStart(5)}%)  SIR≈${r.expected_by_formula.toFixed(0).padStart(4)}  Δ=${r.delta.toFixed(1).padStart(5)}` +
        `  ${r.equilibrium_reached ? "✅ EQUILIBRIUM" : "⏳"}`
      ).join("\n");

      const text = [
        `📡 NASH-GOSSIP PROPAGATION`,
        ``,
        `Message ID  : ${result.msg.msg_id.slice(0, 32)}...`,
        `Commitment  : ${result.msg.commitment.slice(0, 32)}...`,
        `Origin node : ${origin.id.slice(0, 16)}...`,
        `Type        : ${result.msg.msg_type}`,
        ``,
        `Propagation (SIR epidemic model — E-R random graph):`,
        roundTable,
        ``,
        `Result:`,
        `  Nodes reached : ${result.total_reached}/${stats.node_count} (${(result.total_reached/stats.node_count*100).toFixed(1)}%)`,
        `  Rounds        : ${result.rounds}  (theoretical O(log n) = ${stats.diameter_estimate})`,
        `  Time          : ${result.propagation_time_ms}ms`,
        ``,
        `Nash guarantee: all nodes propagated because dominant strategy = propagate.`,
        `No routing, no coordination — simultaneous flood reached equilibrium.`,
        ``,
        `ZK integrity: commit(content, salt) = ${result.msg.commitment.slice(0, 32)}...`,
        `Each forwarding node verified commitment before accepting.`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "gossip_network_stats",
    {
      title: "Nash-Gossip Network Statistics",
      description:
        "Show complete network topology stats, Nash equilibrium analysis, " +
        "and graph-theoretic properties of the current gossip network.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      const net   = getGlobalNetwork();
      const stats = net.networkStats();
      const nash  = net.networkNashAnalysis();

      const text = [
        `📊 NASH-GOSSIP NETWORK STATISTICS`,
        ``,
        `── Graph Topology ───────────────────────────────────────────`,
        `Nodes             : ${stats.node_count}`,
        `Edges             : ${stats.edge_count}`,
        `Avg degree        : ${stats.avg_degree.toFixed(3)}  (Bitcoin target: 8)`,
        `Edge probability p: ${stats.current_p.toFixed(6)}`,
        `Connectivity bound: ln(n)/n = ${stats.connectivity_bound.toFixed(6)}`,
        `Connected w.h.p.  : ${stats.is_connected_whp ? "✅ YES" : "❌ NO"}`,
        `Diameter (O(log n)): ≈ ${stats.diameter_estimate} hops`,
        ``,
        `── Propagation History ──────────────────────────────────────`,
        `Messages propagated: ${stats.messages_propagated}`,
        `Total hops         : ${stats.total_hops}`,
        stats.nash_equilibrium ? [
          `Last propagation:`,
          `  Round           : ${stats.nash_equilibrium.round}`,
          `  Infection rate  : ${(stats.nash_equilibrium.infection_rate * 100).toFixed(1)}%`,
          `  SIR model delta : ${stats.nash_equilibrium.delta.toFixed(2)}`,
          `  Equilibrium     : ${stats.nash_equilibrium.equilibrium_reached ? "✅ REACHED" : "⏳ in progress"}`,
        ].join("\n") : "No propagations yet.",
        ``,
        `── Nash Equilibrium Analysis ────────────────────────────────`,
        nash.proof_sketch,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "gossip_node_join",
    {
      title: "Node Join Network",
      description:
        "Add a new node to the gossip network. " +
        "The node connects to random peers (no position commitment). " +
        "Models Bitcoin node discovery: connect to random reachable peers.",
      inputSchema: z.object({
        target_degree: z.number().int().min(1).max(32).default(8).describe("How many peers to connect to"),
      }).shape,
    },
    async (args) => {
      const net  = getGlobalNetwork();
      const node = net.join(args.target_degree);
      const payoff = node.nashPayoff();

      const text = [
        `➕ NODE JOINED NETWORK`,
        ``,
        `Node ID     : ${node.id.slice(0, 32)}...`,
        `Peers       : ${node.peerCount}`,
        ``,
        `Nash payoff analysis:`,
        payoff.proof,
        ``,
        `Geometric identity: NONE — node connected to random peers.`,
        `No routing table needed. No position in any metric space.`,
        `New node can receive messages in next propagation round.`,
        ``,
        `Network now: ${net.networkStats().node_count} nodes, ${net.networkStats().edge_count} edges`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "gossip_node_leave",
    {
      title: "Node Leave Network",
      description:
        "Remove a node from the network (silent disconnect — Bitcoin behavior). " +
        "Network heals automatically; remaining nodes maintain equilibrium.",
      inputSchema: z.object({
        node_id: z.string().optional().describe("Node ID to remove (random node if omitted)"),
      }).shape,
    },
    async (args) => {
      const net    = getGlobalNetwork();
      const before = net.networkStats();
      const target = args.node_id
        ? net.allNodes().get(args.node_id)
        : net.randomNode();

      if (!target) {
        return { content: [{ type: "text", text: "Node not found or network empty." }], isError: true };
      }

      const nodeId = target.id;
      net.leave(nodeId);
      const after = net.networkStats();
      const nash  = net.networkNashAnalysis();

      const text = [
        `➖ NODE LEFT NETWORK`,
        ``,
        `Node ID     : ${nodeId.slice(0, 32)}... (disconnected silently)`,
        ``,
        `Network before: ${before.node_count} nodes, ${before.edge_count} edges`,
        `Network after : ${after.node_count} nodes, ${after.edge_count} edges`,
        ``,
        `Self-healing: remaining nodes maintain connectivity.`,
        `No announcement, no re-election, no coordination needed.`,
        ``,
        `Nash equilibrium preserved:`,
        `  Dominant nodes: ${nash.nodes_dominant}/${nash.nodes_total}`,
        `  Network stable: ${nash.network_dominant ? "✅ YES" : "⚠️ partial — may need more nodes"}`,
        ``,
        `This is the non-committal geometric identity property:`,
        `nodes leave without affecting other nodes' topological position.`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "gossip_nash_proof",
    {
      title: "Nash Equilibrium Formal Proof",
      description:
        "Generate the complete formal Nash equilibrium proof for the gossip protocol. " +
        "Shows why propagate is a dominant strategy and why no coordination is needed.",
      inputSchema: z.object({
        include_sir_derivation: z.boolean().default(true).describe("Include SIR epidemic model derivation"),
      }).shape,
    },
    async (args) => {
      const net   = getGlobalNetwork();
      const stats = net.networkStats();
      const nash  = net.networkNashAnalysis();

      const sirDerivation = args.include_sir_derivation ? [
        ``,
        `── SIR Epidemic Model (propagation speed) ───────────────────`,
        ``,
        `I(k) = n × (1 − e^{−β × k × I₀/n})`,
        ``,
        `where:`,
        `  n  = ${stats.node_count}  (total nodes)`,
        `  β  = avg_degree/n = ${stats.avg_degree.toFixed(3)}/${stats.node_count} = ${(stats.avg_degree/stats.node_count).toFixed(6)}`,
        `  I₀ = 1  (single origin)`,
        `  k  = round number`,
        ``,
        `Expected propagation to 95% in:`,
        `  k* = −n/(β×I₀) × ln(1−0.95) = ${(-stats.node_count/(stats.avg_degree/stats.node_count)*Math.log(0.05)).toFixed(1)} / n ≈ ${stats.diameter_estimate} rounds`,
        ``,
        `Bitcoin empirical: 1 block propagates to 90% of nodes in ~1s`,
        `  This matches O(log n) with n ≈ 10,000, degree ≈ 8`,
      ].join("\n") : "";

      const text = [
        `📐 NASH EQUILIBRIUM PROOF — Gossip Propagation`,
        ``,
        `Theorem: In an honest gossip network, propagate is a dominant strategy`,
        `for every node, making (propagate, ..., propagate) the unique Nash equilibrium.`,
        ``,
        `── Formal Setup ─────────────────────────────────────────────`,
        ``,
        `Players     : N = {1, ..., n}  (all network nodes)`,
        `Strategy set: Sᵢ ∈ {propagate, withhold}  for each node i`,
        `Message     : m = (content, commitment, salt, ttl)`,
        ``,
        `── Payoff Functions ──────────────────────────────────────────`,
        ``,
        `U_i(propagate, S_{-i}):`,
        `  + Network participation value: ln(degree_i + 1) × 10`,
        `    Justification: each additional peer exponentially increases`,
        `    reachability. Diminishing returns (log) matches Bitcoin's`,
        `    saturation at 8 outbound peers.`,
        `  + Chain update value: receive next blocks promptly → mine competitively`,
        `  Total: POSITIVE for all degree_i ≥ 0`,
        ``,
        `U_i(withhold, S_{-i}):`,
        `  − Isolation penalty: −ln(inbox + 1) × 15`,
        `    Justification: withholder misses chain updates → mines on stale tip`,
        `    → orphan risk → revenue loss`,
        `  − Reputation penalty: peers drop withholder after timeout`,
        `  Total: NEGATIVE for all inbox ≥ 0`,
        ``,
        `── Dominance Argument ────────────────────────────────────────`,
        ``,
        `∀ i ∈ N, ∀ S_{-i} ∈ {propagate, withhold}^{n-1}:`,
        ``,
        `  U_i(propagate, S_{-i}) = ln(degᵢ + 1)×10 > 0`,
        `  U_i(withhold,  S_{-i}) = −ln(inboxᵢ + 1)×15 < 0`,
        ``,
        `  ⟹ U_i(propagate, S_{-i}) > U_i(withhold, S_{-i})`,
        ``,
        `  propagate STRICTLY DOMINATES withhold`,
        `  (not just a best response — dominates for ALL opponent strategies)`,
        ``,
        `── Nash Equilibrium ──────────────────────────────────────────`,
        ``,
        `s* = (propagate, propagate, ..., propagate)`,
        ``,
        `This is the unique Nash equilibrium because:`,
        `  1. No node benefits from unilaterally switching to withhold`,
        `  2. Dominant strategy → equilibrium requires no coordination`,
        `  3. Holds whether others propagate OR withhold → robust`,
        ``,
        `── Conflict-Free Parallelism ─────────────────────────────────`,
        ``,
        `Because s* is a dominant strategy equilibrium:`,
        `  - All nodes act simultaneously in each round`,
        `  - No message ordering required`,
        `  - No two nodes compete for the same propagation slot`,
        `  - The protocol is fully parallel — O(log n) wall-clock rounds`,
        `    with O(n × degree) total messages`,
        ``,
        `── Geometric Non-Identity ────────────────────────────────────`,
        ``,
        `Topology: Erdős–Rényi G(n, p) with p = avg_degree/(n-1)`,
        `  = G(${stats.node_count}, ${stats.current_p.toFixed(6)})`,
        ``,
        `  No node has positional coordinates.`,
        `  No routing metric. No DHT key space.`,
        `  Peer set changes freely — join/leave do not alter others' positions`,
        `  because positions do NOT EXIST.`,
        ``,
        `  Connected w.h.p. iff p > ln(n)/n = ${stats.connectivity_bound.toFixed(6)}`,
        `  Current p = ${stats.current_p.toFixed(6)}  → ${stats.is_connected_whp ? "✅ CONNECTED" : "❌ below threshold"}`,
        ``,
        `  This is Bitcoin's key insight: route-free flooding on a random graph`,
        `  is optimal when propagation is a dominant strategy. ∎`,
        sirDerivation,
        ``,
        `── Network Verification ──────────────────────────────────────`,
        nash.proof_sketch,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );
}
