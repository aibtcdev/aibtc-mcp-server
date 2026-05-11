/**
 * Dashboard Tools — لوحة التحكم البسيطة
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { getStxBalance } from "../services/hiro-api.js";
import { createMempoolApi } from "../services/mempool-api.js";
import { viewSeedIdentity, getIdentityAuditLog, verifyIdentityAudit } from "../services/seed-identity.js";
import { getUniversalSummary, verifyUniversalIntegrity } from "../services/universal-bridge.js";
import { createJsonResponse } from "../utils/formatting.js";
import { createErrorResponse } from "../utils/errors.js";
import { NETWORK } from "../config/networks.js";

export function registerDashboardTools(server: McpServer): void {

  // ── الأداة الرئيسية: كل شيء في نظرة واحدة ──────────────────────────────
  server.registerTool(
    "my_dashboard",
    {
      description:
        "لوحة التحكم الشاملة — ترى كل شيء في مكان واحد: " +
        "المحفظة، الأرصدة، الهوية، وسلامة النظام. " +
        "الأداة الأولى التي يستخدمها أي مستخدم جديد.",
    },
    async () => {
      try {
        const manager   = getWalletManager();
        const session   = manager.getSessionInfo();
        const hasWallets = await manager.hasWallets();

        // ── حالة المحفظة ──────────────────────────────────────────────────
        if (!hasWallets) {
          return createJsonResponse({
            status: "لا توجد محفظة",
            خطوات_البدء: [
              "1. أنشئ محفظة: wallet_create",
              "2. أو استورد محفظة موجودة: wallet_import",
              "3. افتح المحفظة: wallet_unlock",
            ],
          });
        }

        if (!session) {
          const wallets = await manager.listWallets();
          return createJsonResponse({
            status: "المحفظة مقفلة",
            المحافظ_المتاحة: wallets.map(w => ({ اسم: w.name, معرف: w.id })),
            لفتح_المحفظة: "استخدم wallet_unlock مع المعرف وكلمة المرور",
          });
        }

        // ── الأرصدة ───────────────────────────────────────────────────────
        let stxBalance   = "غير متاح";
        let btcBalance   = "غير متاح";

        try {
          const stx = await getStxBalance(session.address, NETWORK);
          const stxAmount = Number(BigInt(stx.stx)) / 1_000_000;
          stxBalance = `${stxAmount.toFixed(6)} STX`;
        } catch { /* استمر */ }

        if (session.btcAddress) {
          try {
            const mempoolApi = createMempoolApi(NETWORK);
            const utxos = await mempoolApi.getUtxos(session.btcAddress);
            const sats  = utxos.reduce((sum: number, u: { value: number }) => sum + u.value, 0);
            const btc   = sats / 100_000_000;
            btcBalance  = `${btc.toFixed(8)} BTC (${sats.toLocaleString()} sat)`;
          } catch { /* استمر */ }
        }

        // ── الهوية ────────────────────────────────────────────────────────
        let identity: Record<string, string> = {};
        let auditStatus = "غير متاح";
        try {
          const view   = await viewSeedIdentity();
          const audit  = await verifyIdentityAudit();
          identity = {
            Stacks:  view.stacks,
            Bitcoin: view.bitcoin,
            Taproot: view.taproot,
            Nostr:   view.nostr.slice(0, 16) + "...",
          };
          auditStatus = audit.intact
            ? `✅ سليم (${audit.entries} عملية مسجلة)`
            : `❌ خرق: ${audit.breach}`;
        } catch { /* استمر */ }

        // ── سلامة النظام ──────────────────────────────────────────────────
        let systemIntegrity = "غير متاح";
        try {
          const check = await verifyUniversalIntegrity();
          systemIntegrity = check.intact
            ? "✅ النظام سليم"
            : `❌ خرق: ${check.breaches.join(", ")}`;
        } catch { /* استمر */ }

        return createJsonResponse({
          status:        "✅ نشط",
          الشبكة:        NETWORK === "mainnet" ? "الشبكة الرئيسية" : "شبكة الاختبار",
          الأرصدة: {
            STX: stxBalance,
            BTC: btcBalance,
          },
          الهوية:        identity,
          سجل_التدقيق:   auditStatus,
          سلامة_النظام:  systemIntegrity,
          أدوات_مفيدة: [
            "transfer_stx    — إرسال STX",
            "transfer_btc    — إرسال BTC",
            "my_identity     — تفاصيل الهوية",
            "my_audit        — سجل كل العمليات",
            "my_system       — تفاصيل سلامة النظام",
          ],
        });

      } catch (err) {
        return createErrorResponse(`خطأ في لوحة التحكم: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  // ── الهوية التفصيلية ────────────────────────────────────────────────────
  server.registerTool(
    "my_identity",
    {
      description:
        "عرض كل عناوينك على جميع السلاسل — Stacks, Bitcoin, Taproot, Nostr. " +
        "المفاتيح الخاصة لا تظهر أبداً. كل استعراض يُسجَّل تلقائياً.",
    },
    async () => {
      try {
        const view  = await viewSeedIdentity();
        const audit = await verifyIdentityAudit();

        return createJsonResponse({
          عناوينك: {
            "Stacks  (SP...)":  view.stacks,
            "Bitcoin (bc1q...)": view.bitcoin,
            "Taproot (bc1p...)": view.taproot,
            "Nostr   (hex)":    view.nostr,
          },
          الشبكة:          view.network,
          وقت_الاستعراض:  new Date(view.viewedAt).toISOString(),
          بصمة_الاستعراض: view.auditHash.slice(0, 32) + "...",
          سجل_التدقيق:    audit.intact
            ? `✅ سليم — ${audit.entries} عملية`
            : `❌ ${audit.breach}`,
          ملاحظة: "المفاتيح الخاصة محفوظة محلياً فقط — لا تغادر جهازك أبداً",
        });
      } catch (err) {
        return createErrorResponse(`${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  // ── سجل العمليات ────────────────────────────────────────────────────────
  server.registerTool(
    "my_audit",
    {
      description:
        "سجل كل العمليات التي جرت على هويتك — لا شيء مخفي. " +
        "كل استعراض وكل عملية مسجلة بهاش لا يُزوَّر.",
    },
    async () => {
      try {
        const log    = await getIdentityAuditLog(20);
        const verify = await verifyIdentityAudit();

        if (log.length === 0) {
          return createJsonResponse({
            status: "السجل فارغ",
            ملاحظة: "استخدم my_identity أو my_dashboard لبدء التسجيل",
          });
        }

        return createJsonResponse({
          سلامة_السجل: verify.intact ? "✅ سليم" : `❌ ${verify.breach}`,
          عدد_العمليات: verify.entries,
          آخر_20_عملية: log.map(e => ({
            رقم:      e.index,
            عملية:    e.operation,
            وقت:      new Date(e.timestamp).toISOString(),
            بصمة:     e.auditHash.slice(0, 16) + "...",
          })),
        });
      } catch (err) {
        return createErrorResponse(`${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  // ── سلامة النظام ────────────────────────────────────────────────────────
  server.registerTool(
    "my_system",
    {
      description:
        "تقرير سلامة النظام الكامل — psi-chain, fw-chain, والجسر الكوني. " +
        "يكشف أي عبث فوراً.",
    },
    async () => {
      try {
        const summary = await getUniversalSummary();
        return createJsonResponse({ تقرير_النظام: summary });
      } catch (err) {
        return createErrorResponse(`${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );
}
