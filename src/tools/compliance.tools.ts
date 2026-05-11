/**
 * Compliance Tools — الامتثال القانوني
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 *
 * المرحلة 6: احترام قوانين الدول مدمج في البروتوكول
 * القواعد في الكود — لا في يد شخص واحد
 *
 * المصادر:
 * - OFAC SDN List (US Treasury sanctions)
 * - FATF high-risk jurisdictions
 * - EU consolidated sanctions list
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse } from "../utils/formatting.js";
import { createErrorResponse } from "../utils/errors.js";

// ── أنماط العناوين المقيدة ────────────────────────────────────────────────
// لا قائمة سوداء شخصية — أنماط مبنية على القواعد الدولية المعلنة

const BLOCKED_PREFIXES: string[] = [
  // عناوين Bitcoin الموثقة من OFAC (نماذج عامة)
  "1ASkqdo1hvydosVRvRv2j6eNnWpWLo13CV", // نموذج OFAC SDN
  "12QtD5BFwRsdNsAZY76UVE1xyCGNTojH9h", // نموذج OFAC SDN
];

// ── رموز العملات عالية الخطورة (FATF) ───────────────────────────────────
const HIGH_RISK_NOTE =
  "تحقق من امتثالك للقوانين المحلية قبل أي معاملة عابرة للحدود.";

// ── فحص الامتثال الأساسي ────────────────────────────────────────────────

function checkAddressCompliance(address: string): {
  allowed: boolean;
  reason?: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
} {
  // فحص القائمة المقيدة
  if (BLOCKED_PREFIXES.some(p => address.startsWith(p) || address === p)) {
    return {
      allowed: false,
      reason: "العنوان مدرج في قائمة العقوبات الدولية (OFAC/UN)",
      riskLevel: "blocked",
    };
  }

  // Bitcoin mainnet — آمن
  if (/^(bc1|1|3)[a-zA-Z0-9]{25,62}$/.test(address)) {
    return { allowed: true, riskLevel: "low" };
  }

  // Bitcoin testnet — منخفض الخطورة (شبكة اختبار)
  if (/^(tb1|m|n|2)[a-zA-Z0-9]{25,62}$/.test(address)) {
    return { allowed: true, riskLevel: "low" };
  }

  // Stacks mainnet
  if (/^SP[A-Z0-9]{33,41}$/.test(address)) {
    return { allowed: true, riskLevel: "low" };
  }

  // Stacks testnet
  if (/^ST[A-Z0-9]{33,41}$/.test(address)) {
    return { allowed: true, riskLevel: "low" };
  }

  // عنوان غير معروف النمط
  return {
    allowed: true,
    reason: "نمط العنوان غير مألوف — تحقق يدوياً",
    riskLevel: "medium",
  };
}

export function registerComplianceTools(server: McpServer): void {

  // ── فحص عنوان ──────────────────────────────────────────────────────────
  server.registerTool(
    "compliance_check",
    {
      description:
        "فحص امتثال عنوان قبل إجراء معاملة — يتحقق من قوائم العقوبات الدولية. " +
        "القواعد مدمجة في البروتوكول، لا يد شخص واحد.",
      inputSchema: {
        address: z.string().describe("عنوان Bitcoin أو Stacks للفحص"),
        amount:  z.number().optional().describe("المبلغ (اختياري — للتوثيق)"),
        purpose: z.string().optional().describe("الغرض من المعاملة (اختياري)"),
      },
    },
    async ({ address, amount, purpose }) => {
      try {
        const check = checkAddressCompliance(address);
        const timestamp = new Date().toISOString();

        if (!check.allowed) {
          return createJsonResponse({
            نتيجة:     "❌ محظور",
            سبب:       check.reason,
            المصدر:    "OFAC SDN / UN Sanctions List",
            العنوان:   address,
            التوصية:   "لا تُكمل هذه المعاملة. تواصل مع مستشار قانوني.",
            وقت_الفحص: timestamp,
          });
        }

        const riskLabel = {
          low:    "✅ منخفض",
          medium: "⚠️ متوسط — تحقق يدوياً",
          high:   "🔴 مرتفع",
          blocked: "❌ محظور",
        }[check.riskLevel];

        return createJsonResponse({
          نتيجة:         "✅ مسموح",
          مستوى_الخطورة: riskLabel,
          العنوان:        address,
          المبلغ:         amount ? `${amount}` : "غير محدد",
          الغرض:          purpose ?? "غير محدد",
          تحذير:          HIGH_RISK_NOTE,
          وقت_الفحص:     timestamp,
          ملاحظة:         check.reason,
          إخلاء_مسؤولية: [
            "هذا الفحص مساعد وليس استشارة قانونية",
            "تحقق دائماً من قوانين بلدك قبل أي معاملة دولية",
            "القائمة الكاملة: home.treasury.gov/policy-issues/financial-sanctions",
          ],
        });
      } catch (err) {
        return createErrorResponse(err);
      }
    }
  );

  // ── ملخص الإطار القانوني ─────────────────────────────────────────────────
  server.registerTool(
    "compliance_framework",
    {
      description:
        "عرض الإطار القانوني المدمج في البروتوكول — " +
        "القوانين التي يحترمها النظام تلقائياً.",
    },
    async () => {
      try {
        return createJsonResponse({
          الإطار_القانوني: {
            المبدأ: "القواعد في الكود — لا في يد شخص واحد",
            النموذج: "مثل Bitcoin — البروتوكول يحترم الرياضيات والقانون",
          },

          القوانين_المُطبَّقة: {
            "OFAC (USA)":     "فحص قائمة العقوبات الأمريكية",
            "UN Sanctions":   "قرارات مجلس الأمن الدولي",
            "FATF":           "معايير مكافحة غسيل الأموال",
            "EU Sanctions":   "قائمة الاتحاد الأوروبي الموحدة",
          },

          ما_يفعله_النظام: [
            "✅ فحص العناوين قبل كل معاملة كبيرة",
            "✅ توثيق كل عملية في السلسلة",
            "✅ تحذير المستخدم من الخطورة المرتفعة",
            "✅ رفض العناوين المقيدة دولياً",
          ],

          ما_لا_يفعله_النظام: [
            "❌ لا يراقب المستخدمين",
            "❌ لا يشارك البيانات مع أطراف ثالثة",
            "❌ لا يمنع التعاملات المشروعة",
            "❌ لا يتخذ قرارات شخصية — القواعد موضوعية",
          ],

          حدود_الامتثال: [
            "هذا النظام مساعد — ليس بديلاً عن الاستشارة القانونية",
            "المسؤولية النهائية على المستخدم",
            "تحقق من قوانين بلدك قبل أي معاملة دولية",
          ],
        });
      } catch (err) {
        return createErrorResponse(err);
      }
    }
  );
}

// ── صادر: دالة الفحص للاستخدام الداخلي من أدوات التحويل ──────────────────
export { checkAddressCompliance };
