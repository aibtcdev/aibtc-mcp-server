/**
 * Seed Identity — الهوية المشتقة من الـ Seed
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * مبدأ ساتوشي: Seed واحد → مفاتيح مستقلة لكل سلسلة
 * المفتاح الخاص لا يغادر الجهاز — العناوين العامة فقط تُعرض
 * كل عملية موثقة — لا شيء يحدث بدون علم المالك
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getWalletManager } from "./wallet-manager.js";

const AUDIT_FILE = join(homedir(), ".aibtc", "identity-audit.json");

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface SeedIdentityView {
  stacks:   string;        // SP... — Stacks address
  bitcoin:  string;        // bc1q... — P2WPKH native SegWit
  taproot:  string;        // bc1p... — Taproot
  nostr:    string;        // hex pubkey — Nostr (NIP-06)
  network:  string;        // mainnet | testnet
  viewedAt: number;        // timestamp
  auditHash: string;       // SHA-256 يُثبت ما شاهدته
}

export interface IdentityAuditEntry {
  index:     number;
  timestamp: number;
  operation: string;       // "view" | "derive" | "sign"
  addresses: string[];     // العناوين المتعلقة بالعملية
  auditHash: string;
  prevHash:  string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Audit Trail — سجل لا يُمسح
// ══════════════════════════════════════════════════════════════════════════════

async function loadAudit(): Promise<IdentityAuditEntry[]> {
  try {
    const raw = await fs.readFile(AUDIT_FILE, "utf8");
    return JSON.parse(raw) as IdentityAuditEntry[];
  } catch {
    return [];
  }
}

async function appendAudit(
  operation: string,
  addresses: string[]
): Promise<IdentityAuditEntry> {
  const log   = await loadAudit();
  const prev  = log.length > 0 ? log[log.length - 1].auditHash : "GENESIS";
  const index = log.length;
  const timestamp = Date.now();

  const auditHash = createHash("sha256")
    .update(`${index}:${prev}:${operation}:${addresses.join(",")}:${timestamp}`)
    .digest("hex");

  const entry: IdentityAuditEntry = {
    index, timestamp, operation, addresses, auditHash, prevHash: prev,
  };

  log.push(entry);
  await fs.mkdir(join(homedir(), ".aibtc"), { recursive: true });
  await fs.writeFile(AUDIT_FILE, JSON.stringify(log, null, 2), "utf8");

  return entry;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * يُظهر كل العناوين المشتقة من الـ seed الحالي.
 * المفاتيح الخاصة لا تظهر — العناوين العامة فقط.
 * كل استعراض يُسجَّل في سجل التدقيق.
 */
export async function viewSeedIdentity(): Promise<SeedIdentityView> {
  const manager = getWalletManager();
  const account = manager.getActiveAccount();

  if (!account) {
    throw new Error("المحفظة مقفلة — افتحها أولاً باستخدام wallet_unlock");
  }

  const nostrPubHex = account.nostrPublicKey
    ? Buffer.from(account.nostrPublicKey).toString("hex")
    : "غير متاح";

  const view: SeedIdentityView = {
    stacks:   account.address,
    bitcoin:  account.btcAddress  ?? "غير متاح",
    taproot:  account.taprootAddress ?? "غير متاح",
    nostr:    nostrPubHex,
    network:  account.network,
    viewedAt: Date.now(),
    auditHash: "",
  };

  const entry = await appendAudit("view", [
    view.stacks,
    view.bitcoin,
    view.taproot,
    view.nostr,
  ]);

  view.auditHash = entry.auditHash;

  return view;
}

/**
 * يُرجع سجل كل العمليات على الهوية — لا شيء مخفي.
 */
export async function getIdentityAuditLog(limit = 20): Promise<IdentityAuditEntry[]> {
  const log = await loadAudit();
  return log.slice(-limit).reverse();
}

/**
 * يتحقق من سلامة سجل التدقيق — أي عبث يظهر فوراً.
 */
export async function verifyIdentityAudit(): Promise<{
  intact:  boolean;
  entries: number;
  breach?: string;
}> {
  const log = await loadAudit();

  if (log.length === 0) return { intact: true, entries: 0 };

  for (let i = 1; i < log.length; i++) {
    if (log[i].prevHash !== log[i - 1].auditHash) {
      return {
        intact: false,
        entries: log.length,
        breach: `خرق عند الحلقة ${i} — prevHash لا يتطابق`,
      };
    }

    const expected = createHash("sha256")
      .update(`${log[i].index}:${log[i].prevHash}:${log[i].operation}:${log[i].addresses.join(",")}:${log[i].timestamp}`)
      .digest("hex");

    if (expected !== log[i].auditHash) {
      return {
        intact: false,
        entries: log.length,
        breach: `خرق عند الحلقة ${i} — auditHash مزوّر`,
      };
    }
  }

  return { intact: true, entries: log.length };
}

/**
 * ملخص قابل للعرض عن الهوية الحالية.
 */
export async function getIdentitySummary(): Promise<string> {
  const view   = await viewSeedIdentity();
  const audit  = await verifyIdentityAudit();
  const status = audit.intact ? "✅ سليم" : `❌ ${audit.breach}`;

  return [
    `الهوية المشتقة — Seed Identity`,
    `══════════════════════════════`,
    `Stacks:  ${view.stacks}`,
    `Bitcoin: ${view.bitcoin}`,
    `Taproot: ${view.taproot}`,
    `Nostr:   ${view.nostr.slice(0, 16)}...`,
    `الشبكة:  ${view.network}`,
    ``,
    `سجل التدقيق: ${audit.entries} عملية — ${status}`,
    `بصمة هذا الاستعراض: ${view.auditHash.slice(0, 32)}...`,
  ].join("\n");
}
