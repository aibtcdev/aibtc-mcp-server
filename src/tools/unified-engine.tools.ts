/**
 * Unified Engine Tools — أدوات المحرك الموحد الشامل
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getEngine,
  emitEvent,
  updateWhaleContext,
  getWhaleContext,
  type EventType,
} from "../services/unified-engine.js";

export function registerUnifiedEngineTools(server: McpServer): void {

  server.registerTool(
    "unified_status",
    {
      title: "Unified Engine Status",
      description:
        "Show complete status of all integrated subsystems in one view. " +
        "Ψ score, WHALE context, hash chain, Nash gossip network, sanctions feeds, " +
        "risk history, and all active integration loops.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      const engine = getEngine(server);
      const status = engine.status();
      const whale  = getWhaleContext();

      const loops = status.integration_loops.map((l, i) => `  ${i + 1}. ${l}`).join("\n");

      const text = [
        `⚙️  UNIFIED ENGINE — المحرك الموحد الشامل`,
        ``,
        `Session      : ${status.session_id}`,
        `Events       : ${status.event_count}`,
        ``,
        `── Ψ Consensus ──────────────────────────────────────────────`,
        `Score  : ${status.psi.score.toFixed(1)} / 100`,
        `Tier   : ${status.psi.tier}`,
        ``,
        `── WHALE Economic Root ──────────────────────────────────────`,
        `Address: ${whale.address || "(none)"}`,
        `Balance: ${whale.balance.toString()} μWHALE`,
        `Tier   : ${whale.tier}`,
        `Owner  : ${whale.is_owner}`,
        ``,
        `── Hash Chain ───────────────────────────────────────────────`,
        status.chain
          ? `Blocks: ${status.chain.length}  |  Valid: ${status.chain.valid ? "✅" : "❌"}`
          : "Not initialized",
        ``,
        `── Nash Gossip Network ──────────────────────────────────────`,
        status.gossip
          ? `Nodes: ${status.gossip.nodes}  |  Edges: ${status.gossip.edges}`
          : "Not initialized",
        ``,
        `── Sanctions Feeds ──────────────────────────────────────────`,
        status.sanctions
          ? `Feeds: ${status.sanctions.feeds}  |  Online: ${status.sanctions.online}`
          : "Not initialized",
        ``,
        `── Risk History ─────────────────────────────────────────────`,
        `Events: ${status.risk_history}`,
        ``,
        `── Active Integration Loops ─────────────────────────────────`,
        loops,
        ``,
        `── Subsystem Config ─────────────────────────────────────────`,
        Object.entries(status.config)
          .map(([k, v]) => `  ${k.padEnd(22)}: ${v ? "✅" : "○"}`)
          .join("\n"),
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "unified_emit",
    {
      title: "Emit Unified Event",
      description:
        "Emit any event through the unified engine. " +
        "The event passes through all subsystems: Ψ check, sanctions screen, " +
        "hash chain, ZK commitment, Nash gossip, risk engine, zero-harm circuit breakers.",
      inputSchema: z.object({
        type: z.enum([
          "tool_call", "x402_payment", "psi_update", "risk_trigger",
          "ussd_input", "chain_block", "sanctions_hit", "gossip_msg", "zk_commit", "circuit_break",
        ]).describe("Event type"),
        source:  z.string().describe("Originating system or tool name"),
        payload: z.string().describe("JSON payload for the event"),
        address: z.string().optional().describe("STX/BTC address (triggers sanctions screen)"),
      }).shape,
    },
    async (args) => {
      let payload: unknown;
      try { payload = JSON.parse(args.payload); } catch { payload = args.payload; }

      const result = await emitEvent(server, args.type as EventType, args.source, payload, args.address);

      const text = [
        `🔄 UNIFIED ENGINE EVENT`,
        ``,
        `Event ID  : ${result.event_id}`,
        `Type      : ${result.event_type}`,
        ``,
        `── Ψ Result ─────────────────────────────────────────────────`,
        `Score   : ${result.psi.score.toFixed(1)}  Tier: ${result.psi.tier}`,
        `Blocked : ${result.psi.blocked ? `❌ YES — ${result.psi.reason}` : "✅ NO"}`,
        ``,
        `── Sanctions ────────────────────────────────────────────────`,
        result.sanctions.screened
          ? `${result.sanctions.is_sanctioned ? "🚨 SANCTIONED" : "✅ CLEAR"}${result.sanctions.match ? ` — ${result.sanctions.match}` : ""}`
          : "Not screened (no address provided)",
        ``,
        `── Hash Chain ───────────────────────────────────────────────`,
        result.chain
          ? `Block ${result.chain.block_height}: ${result.chain.block_hash.slice(0, 32)}...  Chain: ${result.chain.chain_valid ? "✅" : "❌"}`
          : "Not logged",
        ``,
        `── Nash Gossip ──────────────────────────────────────────────`,
        result.gossip
          ? `Propagated to ${result.gossip.nodes_reached} nodes in ${result.gossip.rounds} rounds`
          : "Not propagated",
        ``,
        `── ZK Commitment ────────────────────────────────────────────`,
        result.zk
          ? `Commitment: ${result.zk.commitment.slice(0, 32)}...`
          : "Not applicable (non-sensitive event)",
        ``,
        `── Risk Assessment ──────────────────────────────────────────`,
        result.risk
          ? [
              `Scenario : ${result.risk.scenario_id}`,
              `Severity : ${(result.risk.severity * 100).toFixed(1)}%`,
              `CB Fired : ${result.risk.circuit_breaker_fired ? "🚨 YES" : "✅ NO"}`,
            ].join("\n")
          : "Not a risk event",
        result.warnings.length > 0
          ? `\n── Warnings ─────────────────────────────────────────────────\n${result.warnings.map(w => `  ⚠️  ${w}`).join("\n")}`
          : "",
      ].filter(l => l !== "").join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "unified_whale_update",
    {
      title: "Update WHALE Economic Context",
      description:
        "Update the WHALE balance and owner status in the unified engine. " +
        "This feeds the Cantillon dimension of the Ψ equation — " +
        "which determines access tier, session trust, and economic routing.",
      inputSchema: z.object({
        address:  z.string().describe("STX address of the WHALE holder"),
        balance:  z.string().describe("WHALE balance in micro-WHALE (integer string)"),
        is_owner: z.boolean().default(false).describe("Is this the protocol owner?"),
      }).shape,
    },
    async (args) => {
      const balance = BigInt(args.balance);
      const tier    = balance >= 100_000_000_000n ? "elite"
                    : balance >= 10_000_000_000n  ? "agent"
                    : balance >= 1_000_000_000n   ? "scout"
                    : "none";

      updateWhaleContext({
        address:  args.address,
        balance,
        tier,
        is_owner: args.is_owner,
      });

      // Emit psi_update so all loops reflect the new balance
      const result = await emitEvent(server, "psi_update", "whale_update", {
        whale_balance: args.balance,
        tier,
      }, args.address);

      const text = [
        `🐋 WHALE CONTEXT UPDATED`,
        ``,
        `Address : ${args.address}`,
        `Balance : ${balance.toLocaleString()} μWHALE`,
        `Tier    : ${tier.toUpperCase()}`,
        `Owner   : ${args.is_owner}`,
        ``,
        `Integration impact:`,
        `  Cantillon dimension → ${tier === "elite" ? "1.0" : tier === "agent" ? "0.7" : tier === "scout" ? "0.4" : "0.0"}`,
        `  Ψ score after update: ${result.psi.score.toFixed(1)} (${result.psi.tier})`,
        `  Chain block: #${result.chain?.block_height ?? "–"}`,
        `  Gossip propagated: ${result.gossip ? result.gossip.nodes_reached + " nodes" : "no"}`,
        ``,
        `Access tier unlocked:`,
        tier === "elite"   ? `  ✅ ALL features (Scout + Agent + Elite + Council)` :
        tier === "agent"   ? `  ✅ Scout + Agent features` :
        tier === "scout"   ? `  ✅ Scout features` :
        `  ❌ No access — minimum 1,000 WHALE required`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "unified_integration_map",
    {
      title: "Integration Map",
      description:
        "Show the complete integration map — how all subsystems connect and feed each other.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      const text = [
        `🗺️  UNIFIED ENGINE — خريطة الدمج الكامل`,
        ``,
        `┌─────────────────────────────────────────────────────────────────┐`,
        `│                    حلقات الدمج المغلقة                          │`,
        `└─────────────────────────────────────────────────────────────────┘`,
        ``,
        `── الحلقة الاقتصادية (WHALE Economy) ───────────────────────────`,
        ``,
        `  WHALE Balance`,
        `      ↓ يغذي`,
        `  Cantillon⁻¹ dimension في Ψ equation`,
        `      ↓ يرفع`,
        `  Ψ Score → Access Tier (scout/agent/elite)`,
        `      ↓ يحدد`,
        `  Tools Available → x402 usage → Revenue (STX)`,
        `      ↓ يذهب`,
        `  whale-treasury-v1 → buyback WHALE → Supply ↓ → Price ↑`,
        `      ↓ يعود`,
        `  WHALE Balance ↑  ← الحلقة مغلقة`,
        ``,
        `── الحلقة الأمنية (Security Chain) ─────────────────────────────`,
        ``,
        `  كل tool call`,
        `      ↓ يمر`,
        `  Session Guard (Ψ check + IPI scan + L4 file guard)`,
        `      ↓ يسجل`,
        `  Hash Chain Block (double-SHA256, 7 Bitcoin consensus rules)`,
        `      ↓ كل 5 blocks`,
        `  Nash Gossip → يوصل لكل nodes في O(log n) rounds`,
        `      ↓ ZK commitment على كل sensitive event`,
        `  Audit Trail (tamper-evident, permanent)`,
        ``,
        `── الحلقة السيادية (Ψ Intelligence) ────────────────────────────`,
        ``,
        `  150 عملة × Ψ_currency = Landauer·Nash·Cantillon⁻¹·Gödel`,
        `      ↓ يغذي`,
        `  Neuro-Economic Reality Model (7 domains, 6 neural layers)`,
        `      ↓ يحسب`,
        `  computePsiFromReality() → Ψ score محدّث`,
        `      ↓ يغذي`,
        `  Renaissance Plan (إصلاحات محددة لكل عملة)`,
        `      ↓ Monte Carlo 10,000 scenarios`,
        `  Risk Impact → Cascade Graph → After-Effects Timeline`,
        `      ↓ إذا تجاوز threshold`,
        `  Zero-Harm Circuit Breakers → Nash gossip alert`,
        ``,
        `── الحلقة الاجتماعية (Inclusion) ───────────────────────────────`,
        ``,
        `  USSD *99# / SMS command`,
        `      ↓ يوجّه`,
        `  Unified Engine → Ψ check + Sanctions screen`,
        `      ↓`,
        `  DeFi operations (balance, send, buy sBTC)`,
        `      ↓ ZK commitment يحمي هوية المستخدم`,
        `  نتيجة عبر SMS ← 1.7B unbanked يستخدمون النظام`,
        ``,
        `── الحلقة الجنائية (Sanctions + Compliance) ─────────────────────`,
        ``,
        `  أي عنوان في أي عملية`,
        `      ↓ يمر فوراً`,
        `  OFAC + EU + UK OFSI (24h TTL, fuzzy matching)`,
        `      ↓ إذا match`,
        `  Hash Chain Block (دليل دائم) + Nash Gossip Alert`,
        `      ↓`,
        `  ZK Compliance Proof (يُثبت أنه مر KYC بدون كشف هوية)`,
        ``,
        `── النتيجة الموحدة ───────────────────────────────────────────────`,
        ``,
        `  كل حدث → UnifiedResult {`,
        `    psi:       { score, tier, blocked }`,
        `    sanctions: { screened, is_sanctioned }`,
        `    chain:     { block_height, block_hash, valid }`,
        `    gossip:    { nodes_reached, rounds }`,
        `    risk:      { severity, circuit_breaker_fired }`,
        `    zk:        { commitment, salt }`,
        `    warnings:  string[]`,
        `  }`,
        ``,
        `  لا نظام منفصل — كلهم يغذون بعض في حلقات مغلقة.`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );
}
