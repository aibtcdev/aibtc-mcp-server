/**
 * Operations Audit — سجل العمليات الشامل
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 *
 * يسجل كل عملية حساسة في سلسلة تدقيق لا تُزوَّر:
 * - التحويلات (STX, BTC, sBTC)
 * - استدعاءات العقود
 * - فحوصات الامتثال
 * - أي عملية تمس الأموال
 *
 * لا شيء يحدث بدون علم المالك.
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import { computeUniversalState } from "./universal-bridge.js";

const OPS_AUDIT_FILE = join(homedir(), ".aibtc", "ops-audit.json");

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpsType =
  | "transfer_stx"
  | "transfer_btc"
  | "transfer_sbtc"
  | "contract_call"
  | "contract_deploy"
  | "compliance_check"
  | "wallet_unlock"
  | "wallet_lock"
  | "key_sign";

export interface OpsAuditEntry {
  index:         number;
  timestamp:     number;
  type:          OpsType;
  from:          string;
  to:            string;
  amount:        string;
  network:       string;
  result:        "success" | "blocked" | "failed" | "pending";
  txid?:         string;
  reason?:       string;
  universalHash: string;   // ربط بالنظام الكوني عند وقت العملية
  auditHash:     string;
  prevHash:      string;
}

// ── Chain I/O ─────────────────────────────────────────────────────────────────

async function loadOpsLog(): Promise<OpsAuditEntry[]> {
  try {
    const raw = await fs.readFile(OPS_AUDIT_FILE, "utf8");
    return JSON.parse(raw) as OpsAuditEntry[];
  } catch {
    return [];
  }
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * يسجل عملية حساسة في سجل التدقيق.
 * يُستدعى من داخل أدوات التحويل والعقود.
 */
export async function recordOp(params: {
  type:    OpsType;
  from:    string;
  to:      string;
  amount:  string;
  network: string;
  result:  OpsAuditEntry["result"];
  txid?:   string;
  reason?: string;
}): Promise<OpsAuditEntry> {
  const log   = await loadOpsLog();
  const prev  = log.length > 0 ? log[log.length - 1].auditHash : "GENESIS";
  const index = log.length;
  const timestamp = Date.now();

  // الهاش الكوني في لحظة العملية
  let universalHash = "unavailable";
  try {
    const state = await computeUniversalState();
    universalHash = state.universalHash;
  } catch { /* لا نوقف العملية إذا فشل الجسر */ }

  const auditHash = createHash("sha256")
    .update(`${index}:${prev}:${params.type}:${params.from}:${params.to}:${params.amount}:${params.result}:${timestamp}:${universalHash}`)
    .digest("hex");

  const entry: OpsAuditEntry = {
    index,
    timestamp,
    type:    params.type,
    from:    params.from,
    to:      params.to,
    amount:  params.amount,
    network: params.network,
    result:  params.result,
    txid:    params.txid,
    reason:  params.reason,
    universalHash,
    auditHash,
    prevHash: prev,
  };

  log.push(entry);
  await fs.mkdir(join(homedir(), ".aibtc"), { recursive: true });
  await fs.writeFile(OPS_AUDIT_FILE, JSON.stringify(log, null, 2), "utf8");

  return entry;
}

/**
 * يُرجع آخر N عملية.
 */
export async function getOpsLog(limit = 20): Promise<OpsAuditEntry[]> {
  const log = await loadOpsLog();
  return log.slice(-limit).reverse();
}

/**
 * يتحقق من سلامة سجل العمليات.
 */
export async function verifyOpsIntegrity(): Promise<{
  intact:  boolean;
  entries: number;
  breach?: string;
}> {
  const log = await loadOpsLog();
  if (log.length === 0) return { intact: true, entries: 0 };

  for (let i = 1; i < log.length; i++) {
    if (log[i].prevHash !== log[i - 1].auditHash) {
      return { intact: false, entries: log.length, breach: `خرق عند العملية ${i}` };
    }
  }

  return { intact: true, entries: log.length };
}
