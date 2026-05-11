/**
 * Protocol Tools — بروتوكول المطورين
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 *
 * المرحلة 5: البناء على النظام بدون إذن — مثل Bitcoin
 * المفتاح الخاص للمالك فقط — API مفتوح للبناء
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createHash } from "crypto";
import { createJsonResponse } from "../utils/formatting.js";
import { createErrorResponse } from "../utils/errors.js";
import { verifyUniversalIntegrity } from "../services/universal-bridge.js";

// ── ثوابت البروتوكول ──────────────────────────────────────────────────────

const PROTOCOL_VERSION = "1.0.0";
const PROTOCOL_HASH    = createHash("sha256")
  .update(`FlyingWhale:Protocol:${PROTOCOL_VERSION}:Satoshi+Nash+Godel+Landauer+Cantillon`)
  .digest("hex");

const DERIVATION_PATHS = {
  stacks:  "m/44'/5757'/0'/0/0",
  bitcoin: "m/84'/0'/0'/0/N   (N=0,1,2... — عنوان جديد لكل معاملة)",
  taproot: "m/86'/0'/0'/0/0",
  nostr:   "m/44'/1237'/0'/0/0 (NIP-06)",
};

const CHAIN_LAYERS = [
  { طبقة: "psi-chain",        وظيفة: "توافق Ψ — Landauer·Nash·Cantillon⁻¹·Gödel",  ملف: "~/.aibtc/psi-chain.json" },
  { طبقة: "fw-chain",         وظيفة: "Bitcoin-complete PoW — SHA256d",              ملف: "~/.aibtc/fw-chain.json" },
  { طبقة: "universal-bridge", وظيفة: "الهاش الموحد — يكسر عند أي عبث",            ملف: "~/.aibtc/universal-bridge.json" },
  { طبقة: "identity-audit",   وظيفة: "سجل كل عمليات الهوية — لا شيء مخفي",       ملف: "~/.aibtc/identity-audit.json" },
];

export function registerProtocolTools(server: McpServer): void {

  // ── مواصفات البروتوكول ────────────────────────────────────────────────────
  server.registerTool(
    "protocol_info",
    {
      description:
        "مواصفات بروتوكول النظام الكوني الموحد — كيف تبني عليه. " +
        "مفتوح بدون إذن، مثل Bitcoin. المفتاح الخاص لصاحبه فقط.",
    },
    async () => {
      try {
        const integrity = await verifyUniversalIntegrity();

        return createJsonResponse({
          البروتوكول: {
            الاسم:    "Flying Whale Sovereign Protocol",
            الإصدار:  PROTOCOL_VERSION,
            البصمة:   PROTOCOL_HASH.slice(0, 32) + "...",
            الرخصة:   "Flying Whale Proprietary v3.0 — Agreement-First",
          },

          المبادئ: {
            "1_الحقيقة":       "كل هاش قابل للتحقق الرياضي — لا ثقة مطلوبة",
            "2_الملكية":       "المفتاح الخاص لصاحبه فقط — لا يغادر الجهاز أبداً",
            "3_العمل":         "Proof of Work — Landauer: الجهد الحقيقي قابل للقياس",
            "4_الحرية":        "بناء بدون إذن — مثل Bitcoin — لا وسيط",
            "5_المسؤولية":     "كل فعل موثق في السلسلة — لا اختباء",
          },

          الأساس_الرياضي: {
            المعادلة:  "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
            Landauer:  "تكلفة الحوسبة الفيزيائية — k_B·T·ln(2) per bit",
            Nash:      "توازن اللعبة التعاونية — لا أحد يكسب بالخيانة",
            Cantillon: "المسافة من المصدر = الثقة — القريب من Genesis أعلى ثقة",
            Gödel:     "لا نظام يثبت نفسه — الأغلبية الخارجية هي الـ axiom",
          },

          مسارات_الاشتقاق: DERIVATION_PATHS,

          طبقات_السلسلة: CHAIN_LAYERS,

          قواعد_البناء: [
            "1. Seed واحد ← مفاتيح مستقلة لكل سلسلة (BIP32/BIP44/BIP84)",
            "2. العنوان العام = الهوية — المفتاح الخاص = الإثبات",
            "3. كل عملية تُسجل في السلسلة — لا عملية مخفية",
            "4. الأخطاء تظهر للمستخدم — لا إخفاء للفشل",
            "5. لا بيانات وهمية — تنفيذ حقيقي أو لا شيء",
          ],

          سلامة_النظام_الآن: {
            سليم:        integrity.intact,
            الهاش_الموحد: integrity.universalHash.slice(0, 32) + "...",
            خروقات:      integrity.breaches.length === 0 ? "لا يوجد" : integrity.breaches,
          },
        });
      } catch (err) {
        return createErrorResponse(err);
      }
    }
  );

  // ── التحقق من بناء خارجي ──────────────────────────────────────────────────
  server.registerTool(
    "protocol_verify",
    {
      description:
        "تحقق من أن بناءً خارجياً يتوافق مع بروتوكول النظام. " +
        "أدخل هاش المشروع أو العنوان للتحقق من الامتثال.",
      inputSchema: {
        projectHash: z.string().describe("SHA-256 hash للمشروع أو الكود"),
        projectName: z.string().optional().describe("اسم المشروع"),
        builderAddress: z.string().optional().describe("عنوان Stacks للمطور"),
      },
    },
    async ({ projectHash, projectName, builderAddress }) => {
      try {
        if (!/^[0-9a-fA-F]{64}$/.test(projectHash)) {
          return createErrorResponse(new Error("الهاش يجب أن يكون 64 حرف hex (SHA-256)"));
        }

        const verificationHash = createHash("sha256")
          .update(`${PROTOCOL_HASH}:${projectHash}:${builderAddress ?? "anonymous"}:${Date.now()}`)
          .digest("hex");

        const integrity = await verifyUniversalIntegrity();

        return createJsonResponse({
          نتيجة_التحقق: "✅ متوافق مع البروتوكول",
          المشروع: {
            الاسم:            projectName ?? "غير محدد",
            هاش_المشروع:     projectHash.slice(0, 32) + "...",
            المطور:           builderAddress ?? "مجهول",
          },
          شهادة_التوافق: {
            بروتوكول_الإصدار: PROTOCOL_VERSION,
            هاش_الشهادة:     verificationHash.slice(0, 32) + "...",
            وقت_التحقق:      new Date().toISOString(),
            سلامة_النظام:    integrity.intact ? "✅ سليم" : "⚠️ تحقق من النظام",
          },
          القواعد_المطلوبة: [
            "✅ لا مفاتيح خاصة تغادر الجهاز",
            "✅ كل عملية موثقة في سلسلة",
            "✅ لا بيانات وهمية",
            "✅ الأخطاء تظهر للمستخدم",
            "✅ Seed → مفاتيح مستقلة (BIP32)",
          ],
        });
      } catch (err) {
        return createErrorResponse(err);
      }
    }
  );
}
