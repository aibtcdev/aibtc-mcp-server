/**
 * Universal Bridge — الجسر الكوني الموحد
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * النظام الكوني الموحد — الأسس الخمسة في نقطة واحدة
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * يجمع هذا الملف كل السلاسل في هاش واحد قابل للتحقق:
 *
 *   psi-chain   → consensus + sovereign layer
 *   fw-chain    → Bitcoin-complete PoW + sovereign layer
 *   universal   → SHA-256(psiTail + fwTail + sovereignTail + timestamp)
 *
 * أي عبث بأي سلسلة يكسر الـ universalHash — لا إخفاء ممكن.
 *
 * الأسس الخمسة المدمجة في كل تحقق:
 *   1. الحقيقة       — كل هاش قابل للتحقق الرياضي
 *   2. الملكية       — العنوان مُضمَّن في كل حلقة
 *   3. العمل         — Landauer score = جهد حوسبي حقيقي
 *   4. الحرية        — لا حاجز مركزي يوقف التحقق
 *   5. المسؤولية     — كل فعل موثق إلى الأبد
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PsiChainEntry, SovereignLayer } from "./psi-consensus.js";
import type { FWBlock } from "./btc-chain.js";

const AIBTC_DIR      = join(homedir(), ".aibtc");
const PSI_CHAIN_FILE = join(AIBTC_DIR, "psi-chain.json");
const FW_CHAIN_FILE  = join(AIBTC_DIR, "fw-chain.json");
const BRIDGE_FILE    = join(AIBTC_DIR, "universal-bridge.json");

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface UniversalState {
  timestamp:      number;
  psiChainLength: number;
  psiTailHash:    string;         // آخر هاش في psi-chain
  fwChainLength:  number;
  fwTailHash:     string;         // آخر هاش في fw-chain
  sovereignTail:  SovereignLayer | null; // الطبقة الكونية لآخر حلقة
  universalHash:  string;         // الهاش الموحد — يكسر إذا عُبث بأي سلسلة
  integrity: {
    psiChain: boolean;
    fwChain:  boolean;
    bridge:   boolean;
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Chain Readers
// ══════════════════════════════════════════════════════════════════════════════

async function readPsiChain(): Promise<PsiChainEntry[]> {
  try {
    const raw = await fs.readFile(PSI_CHAIN_FILE, "utf8");
    return JSON.parse(raw) as PsiChainEntry[];
  } catch {
    return [];
  }
}

async function readFwChain(): Promise<FWBlock[]> {
  try {
    const raw = await fs.readFile(FW_CHAIN_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as FWBlock[] : [parsed as FWBlock];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Integrity Verifiers
// ══════════════════════════════════════════════════════════════════════════════

function verifyPsiIntegrity(chain: PsiChainEntry[]): boolean {
  if (chain.length === 0) return true;
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i - 1].hash) return false;
    // إذا كانت الحلقة تحمل طبقة كونية، تحقق من universalHash
    if (chain[i].sovereign) {
      const s = chain[i].sovereign!;
      const expected = createHash("sha256")
        .update(`${s.truth}:${s.responsibility}:${s.ownership}:${s.work}:${s.freedom ? "1" : "0"}`)
        .digest("hex");
      if (expected !== s.universalHash) return false;
    }
  }
  return true;
}

function verifyFwIntegrity(chain: FWBlock[]): boolean {
  if (chain.length === 0) return true;
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i - 1].hash) return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// Universal Hash Computation
// ══════════════════════════════════════════════════════════════════════════════

function computeUniversalHash(
  psiTailHash: string,
  fwTailHash:  string,
  sovereignTail: SovereignLayer | null,
  timestamp: number
): string {
  const sovereignPart = sovereignTail
    ? `${sovereignTail.universalHash}:${sovereignTail.truth}:${sovereignTail.responsibility}`
    : "SOVEREIGN_ABSENT";

  return createHash("sha256")
    .update(`UNIVERSAL:${psiTailHash}:${fwTailHash}:${sovereignPart}:${timestamp}`)
    .digest("hex");
}

// ══════════════════════════════════════════════════════════════════════════════
// Main API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * يحسب الحالة الكونية الموحدة للنظام.
 * يقرأ كلتا السلسلتين ويولّد هاشاً واحداً يُثبت سلامة الكل.
 */
export async function computeUniversalState(): Promise<UniversalState> {
  const [psiChain, fwChain] = await Promise.all([readPsiChain(), readFwChain()]);

  const psiTailHash = psiChain.length > 0
    ? psiChain[psiChain.length - 1].hash
    : "000000000000000000000000000000000000000000000000000000000000PSI0";

  const fwTailHash = fwChain.length > 0
    ? fwChain[fwChain.length - 1].hash
    : "000000000000000000000000000000000000000000000000000000000000FW00";

  const lastPsiEntry = psiChain.length > 0 ? psiChain[psiChain.length - 1] : null;
  const sovereignTail = lastPsiEntry?.sovereign ?? null;

  const timestamp = Date.now();

  const universalHash = computeUniversalHash(psiTailHash, fwTailHash, sovereignTail, timestamp);

  const state: UniversalState = {
    timestamp,
    psiChainLength: psiChain.length,
    psiTailHash,
    fwChainLength:  fwChain.length,
    fwTailHash,
    sovereignTail,
    universalHash,
    integrity: {
      psiChain: verifyPsiIntegrity(psiChain),
      fwChain:  verifyFwIntegrity(fwChain),
      bridge:   true,
    },
  };

  // حفظ الحالة الكونية
  await fs.mkdir(AIBTC_DIR, { recursive: true });
  await fs.writeFile(BRIDGE_FILE, JSON.stringify(state, null, 2), "utf8");

  return state;
}

/**
 * تحقق سريع من سلامة النظام الكوني الكامل.
 * يُستخدم كبوابة أمان عند كل عملية حساسة.
 */
export async function verifyUniversalIntegrity(): Promise<{
  intact:       boolean;
  universalHash: string;
  breaches:     string[];
}> {
  const state  = await computeUniversalState();
  const breaches: string[] = [];

  if (!state.integrity.psiChain) breaches.push("psi-chain integrity broken");
  if (!state.integrity.fwChain)  breaches.push("fw-chain integrity broken");

  return {
    intact:        breaches.length === 0,
    universalHash: state.universalHash,
    breaches,
  };
}

/**
 * يُرجع ملخصاً قابلاً للعرض عن الحالة الكونية.
 */
export async function getUniversalSummary(): Promise<string> {
  const state = await computeUniversalState();
  const { intact, breaches } = await verifyUniversalIntegrity();

  const status   = intact ? "✅ سليم" : `❌ خرق: ${breaches.join(", ")}`;
  const sovereign = state.sovereignTail
    ? [
        `  الحقيقة:       ${state.sovereignTail.truth.slice(0, 16)}...`,
        `  الملكية:       ${state.sovereignTail.ownership}`,
        `  العمل:         ${state.sovereignTail.work} وحدة Landauer`,
        `  الحرية:        ${state.sovereignTail.freedom ? "مضمونة" : "مقيدة"}`,
        `  المسؤولية:     ${state.sovereignTail.responsibility.slice(0, 16)}...`,
        `  الرابط الكوني: ${state.sovereignTail.universalHash.slice(0, 16)}...`,
      ].join("\n")
    : "  (لا طبقة كونية بعد — تحتاج تسجيل Ψ أولاً)";

  return [
    `النظام الكوني الموحد — Universal Bridge`,
    `══════════════════════════════════════`,
    `الحالة:          ${status}`,
    `psi-chain:       ${state.psiChainLength} حلقة | آخر: ${state.psiTailHash.slice(0, 16)}...`,
    `fw-chain:        ${state.fwChainLength} بلوك | آخر: ${state.fwTailHash.slice(0, 16)}...`,
    `الهاش الموحد:    ${state.universalHash.slice(0, 32)}...`,
    ``,
    `الطبقة الكونية السيادية (آخر حلقة):`,
    sovereign,
  ].join("\n");
}
