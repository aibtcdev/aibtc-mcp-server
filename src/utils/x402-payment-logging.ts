import { createRequire } from "module";
import type { HttpPaymentStatusResponse } from "@aibtc/tx-schemas/http";
import type {
  CanonicalPaymentDecision,
} from "./x402-payment-state.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version?: string };

type PaymentLogEvent =
  | "payment.accepted"
  | "payment.poll"
  | "payment.finalized"
  | "payment.retry_decision"
  | "payment.fallback_used";

interface PaymentLogFields {
  tool: string;
  paymentId?: string | null;
  status?: string | null;
  terminalReason?: string | null;
  action?: string | null;
  checkStatusUrl?: string | null;
  compatShimUsed?: boolean;
}

function getDeploySha(): string | null {
  return (
    process.env.DEPLOY_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.RENDER_GIT_COMMIT ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    null
  );
}

export function emitPaymentLog(event: PaymentLogEvent, fields: PaymentLogFields): void {
  const deploySha = getDeploySha();
  const payload = {
    event,
    service: "aibtc-mcp-server",
    tool: fields.tool,
    paymentId: fields.paymentId ?? null,
    status: fields.status ?? null,
    terminalReason: fields.terminalReason ?? null,
    action: fields.action ?? null,
    checkStatusUrl_present: Boolean(fields.checkStatusUrl),
    compat_shim_used: fields.compatShimUsed ?? false,
    repo_version: packageJson.version ?? "unknown",
    ...(deploySha ? { deploy_sha: deploySha } : {}),
  };

  console.error(JSON.stringify(payload));
}

export function emitCanonicalPaymentPollLogs(details: {
  tool: string;
  paymentId?: string | null;
  checkStatusUrl: string;
  source: "canonical_hint" | "compat_fallback";
}): boolean {
  const compatShimUsed = details.source === "compat_fallback";

  emitPaymentLog("payment.poll", {
    tool: details.tool,
    paymentId: details.paymentId ?? null,
    checkStatusUrl: details.checkStatusUrl,
    compatShimUsed,
  });

  if (compatShimUsed) {
    emitPaymentLog("payment.fallback_used", {
      tool: details.tool,
      paymentId: details.paymentId ?? null,
      action: "synthesized_check_status_url",
      checkStatusUrl: details.checkStatusUrl,
      compatShimUsed: true,
    });
  }

  return compatShimUsed;
}

export function emitCanonicalPaymentDecisionLogs(details: {
  tool: string;
  status: HttpPaymentStatusResponse;
  decision: CanonicalPaymentDecision;
  compatShimUsed: boolean;
}): void {
  emitPaymentLog("payment.retry_decision", {
    tool: details.tool,
    paymentId: details.status.paymentId,
    status: details.status.status,
    terminalReason: details.status.terminalReason ?? null,
    action: details.decision.action,
    checkStatusUrl: details.status.checkStatusUrl ?? null,
    compatShimUsed: details.compatShimUsed,
  });

  if (details.decision.action !== "poll_same_payment") {
    emitPaymentLog("payment.finalized", {
      tool: details.tool,
      paymentId: details.status.paymentId,
      status: details.status.status,
      terminalReason: details.status.terminalReason ?? null,
      action: details.decision.action,
      checkStatusUrl: details.status.checkStatusUrl ?? null,
      compatShimUsed: details.compatShimUsed,
    });
  }
}
