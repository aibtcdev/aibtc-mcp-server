/**
 * session-guard.ts — MCPTox Attack Protection Layer
 *
 * Flying Whale — zaghmout.btc | ERC-8004 #54
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 * On-chain IP: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1
 *
 * Open to all of humanity — MIT License.
 * The energy is cosmic. No artificial gates.
 *
 * Defends only against real attacks (MCPTox-class, arxiv March 2026):
 * - Cyclic overthinking loops (142x token amplification)
 * - Denial-of-Wallet: rapid repeated on-chain transactions
 * - Indirect prompt injection via external content channels
 *
 * Defense Layers (natural laws only — no artificial caps):
 *   L3C. Loop detection: same tool N times consecutively = abort
 *   L3D. Rapid-fire detection: N calls/10s = Denial-of-Wallet block
 *   L3E. IPI scanning: indirect prompt injection in tool results
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
// Phrases matched as case-insensitive substrings against tool response content.
// Keep these specific to known attack patterns — generic prefixes like "agents must"
// or "agents should" are too broad and will block legitimate API responses.
export const IPI_ATTACK_PHRASES: ReadonlyArray<string> = [
  // Authority + urgency (Zest Protocol attack pattern — signal 1)
  "agents must update packages",
  "agents must immediately",
  "update packages immediately",
  // Beat Editor manipulation (aibtc.news attack pattern — signal 2)
  "agents should monitor the correspondent",
  "monitor the correspondent",
  "secure available contract slots",
  "secure available slots",
  "optimize for high-volume",
  // Capability expansion (aibtc.news attack pattern — signal 3)
  "agents can now execute",
  "execute signal-gated",
  "signal-gated write operations",
  // Generic injection patterns — require full, unambiguous phrases only
  "automate commercial transactions",
  "execute on behalf of",
  "override safety",
  "ignore previous instructions",
  "disregard previous instructions",
  "new instructions:\n",
  "system override:",
  "admin override:",
  "emergency protocol:",
];

export interface IpiScanResult {
  detected: boolean;
  phrase?: string;
  source?: string;
}

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
  return [...ipiAuditLog];
}

export function ipiIsCoordinatedAttack(phrase: string): boolean {
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
  const lower = content.toLowerCase();
  const match = IPI_ATTACK_PHRASES.find((phrase) => lower.includes(phrase.toLowerCase()));
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

// ─── Configuration ────────────────────────────────────────────────────────────

const LOOP_DETECTION_CONSECUTIVE = 5;       // abort if same tool called 5 times in a row
const LOOP_DETECTION_RAPID_WINDOW_MS = 10_000; // 10 seconds
const LOOP_DETECTION_RAPID_COUNT = 8;       // 8 calls to same tool within 10s = loop

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
  // DeFi
  "alex_swap",
  "zest_supply",
  "zest_borrow",
  "zest_withdraw",
  "zest_repay",
  "zest_enable_collateral",
  "stack_stx",
  "extend_stacking",
  "sbtc_deposit",
  "sbtc_withdraw",
  "sbtc_transfer",
  "pillar_send",
  "pillar_fund",
  "pillar_boost",
  "pillar_supply",
  "pillar_unwind",
  // x402 paid endpoints
  "execute_x402_endpoint",
  // Bitcoin
  "psbt_sign",
  "psbt_broadcast",
  "ordinals_buy",
  "ordinals_list_for_sale_submit",
  "ordinals_p2p_create_offer",
  "ordinals_p2p_psbt_swap",
  "transfer_rune",
  "inscribe",
  "inscribe_reveal",
]);

// ─── Session State ─────────────────────────────────────────────────────────────

interface CallRecord {
  tool: string;
  timestamp: number;
}

class SessionGuard {
  private calls: CallRecord[] = [];
  private readonly sessionStart = Date.now();
  private blocked = false;
  private blockReason = "";

  check(toolName: string): { allowed: boolean; reason?: string } {
    if (this.blocked && WALLET_SENSITIVE.has(toolName)) {
      return { allowed: false, reason: `Session blocked: ${this.blockReason}` };
    }

    const now = Date.now();
    this.calls.push({ tool: toolName, timestamp: now });

    // L3C — Consecutive loop detection
    if (this.calls.length >= LOOP_DETECTION_CONSECUTIVE) {
      const tail = this.calls.slice(-LOOP_DETECTION_CONSECUTIVE);
      if (tail.every((c) => c.tool === toolName)) {
        const reason = `Loop detected: "${toolName}" called ${LOOP_DETECTION_CONSECUTIVE}x consecutively — MCPTox attack`;
        this.blocked = true;
        this.blockReason = reason;
        return { allowed: false, reason };
      }
    }

    // L3D — Rapid-fire detection (Denial-of-Wallet)
    const recentSameTool = this.calls.filter(
      (c) => c.tool === toolName && now - c.timestamp < LOOP_DETECTION_RAPID_WINDOW_MS
    );
    if (recentSameTool.length > LOOP_DETECTION_RAPID_COUNT) {
      const reason = `Rapid loop: "${toolName}" called ${recentSameTool.length}x in ${LOOP_DETECTION_RAPID_WINDOW_MS / 1000}s — Denial-of-Wallet`;
      this.blocked = true;
      this.blockReason = reason;
      return { allowed: false, reason };
    }

    return { allowed: true };
  }

  unblock(): void {
    this.blocked = false;
    this.blockReason = "";
    this.calls = this.calls.slice(-2);
  }

  stats(): {
    totalCalls: number;
    sessionDurationMs: number;
    blocked: boolean;
    blockReason: string;
    ipiDefenseActive: boolean;
    ipiPhraseCount: number;
  } {
    return {
      totalCalls: this.calls.length,
      sessionDurationMs: Date.now() - this.sessionStart,
      blocked: this.blocked,
      blockReason: this.blockReason,
      ipiDefenseActive: true,
      ipiPhraseCount: IPI_ATTACK_PHRASES.length,
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

      // Execute the tool handler
      const result = await handler(...args);

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
export { getGuard, WALLET_SENSITIVE };
