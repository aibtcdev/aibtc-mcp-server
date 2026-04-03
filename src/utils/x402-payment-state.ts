import {
  HttpPaymentStatusResponseSchema,
  type HttpPaymentStatusResponse,
} from "@aibtc/tx-schemas/http";
import type { TerminalReason } from "@aibtc/tx-schemas/core";

const IN_FLIGHT_STATUSES = new Set(["queued", "broadcasting", "mempool"]);
const SENDER_NONCE_REASONS = new Set([
  "sender_nonce_stale",
  "sender_nonce_gap",
  "sender_nonce_duplicate",
]);
const BOUNDED_RETRY_REASONS = new Set([
  "queue_unavailable",
  "sponsor_failure",
  "internal_error",
  "broadcast_failure",
  "chain_abort",
]);

type UnknownRecord = Record<string, unknown>;
type HeaderValue = string | string[] | number | undefined | null;
type HeaderBag = Record<string, HeaderValue> | undefined;

export type CanonicalPaymentAction =
  | "poll_same_payment"
  | "success"
  | "rebuild_sender"
  | "retry_bounded"
  | "stop_replaced"
  | "restart_payment"
  | "stop";

export interface CanonicalPaymentDecision {
  action: CanonicalPaymentAction;
  retryable: boolean;
  shouldReusePaymentId: boolean;
  shouldRebuild: boolean;
  shouldStopPollingOldPaymentId: boolean;
  summary: string;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function extractCandidateRecord(value: unknown): UnknownRecord | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (
    typeof record.paymentId === "string" ||
    typeof record.status === "string" ||
    typeof record.paymentStatus === "string"
  ) {
    return {
      ...record,
      ...(typeof record.status !== "string" && typeof record.paymentStatus === "string"
        ? { status: record.paymentStatus }
        : {}),
    };
  }

  const inbox = asRecord(record.inbox);
  if (
    inbox &&
    (typeof inbox.paymentId === "string" ||
      typeof inbox.paymentStatus === "string" ||
      typeof inbox.checkStatusUrl === "string")
  ) {
    return {
      paymentId: inbox.paymentId,
      status: inbox.paymentStatus,
      checkStatusUrl:
        (typeof inbox.checkStatusUrl === "string" ? inbox.checkStatusUrl : undefined) ??
        (typeof record.checkStatusUrl === "string" ? record.checkStatusUrl : undefined),
      txid: record.txid,
    };
  }

  const x402 = asRecord(record.x402);
  if (x402 && (typeof x402.paymentId === "string" || typeof x402.status === "string")) {
    return x402;
  }

  return null;
}

function getHeaderValue(headers: HeaderBag, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  const target = name.toLowerCase();
  for (const [headerName, rawValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== target || rawValue === undefined || rawValue === null) {
      continue;
    }
    if (Array.isArray(rawValue)) {
      return rawValue.find((value) => typeof value === "string" && value.length > 0);
    }
    return String(rawValue);
  }

  return undefined;
}

export function normalizeCallerFacingStatus(
  status: unknown
): HttpPaymentStatusResponse["status"] | undefined {
  if (typeof status !== "string") {
    return undefined;
  }

  if (status === "pending" || status === "submitted" || status === "queued_with_warning") {
    return "queued";
  }

  const parsed = HttpPaymentStatusResponseSchema.shape.status.safeParse(status);
  return parsed.success ? parsed.data : undefined;
}

function normalizeCheckStatusUrl(checkStatusUrl: string | undefined, baseUrl?: string): string | undefined {
  if (!checkStatusUrl) {
    return undefined;
  }

  try {
    if (baseUrl) {
      return new URL(checkStatusUrl, baseUrl).toString();
    }
    return new URL(checkStatusUrl).toString();
  } catch {
    return undefined;
  }
}

export function extractCanonicalPaymentHints(options: {
  payload?: unknown;
  paymentId?: string;
  responseHeaders?: HeaderBag;
  baseUrl?: string;
}): {
  paymentId?: string;
  status?: HttpPaymentStatusResponse["status"];
  checkStatusUrl?: string;
  txid?: string;
} {
  const candidate = extractCandidateRecord(options.payload);
  const headerPaymentId = getHeaderValue(options.responseHeaders, "x-payment-id");
  const headerCheckStatusUrl = getHeaderValue(options.responseHeaders, "x-payment-check-url");
  const headerStatus = getHeaderValue(options.responseHeaders, "x-payment-status");

  return {
    paymentId:
      (typeof candidate?.paymentId === "string" ? candidate.paymentId : undefined) ??
      headerPaymentId ??
      options.paymentId,
    status:
      normalizeCallerFacingStatus(candidate?.status) ??
      normalizeCallerFacingStatus(headerStatus),
    checkStatusUrl: normalizeCheckStatusUrl(
      (typeof candidate?.checkStatusUrl === "string" ? candidate.checkStatusUrl : undefined) ??
        headerCheckStatusUrl,
      options.baseUrl
    ),
    txid: typeof candidate?.txid === "string" ? candidate.txid : undefined,
  };
}

function tryParsePaymentStatus(candidate: UnknownRecord): HttpPaymentStatusResponse | null {
  const result = HttpPaymentStatusResponseSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

async function fetchPaymentStatus(
  checkStatusUrl: string,
  fetchImpl: typeof fetch
): Promise<HttpPaymentStatusResponse | null> {
  try {
    const response = await fetchImpl(checkStatusUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const body = await response.json().catch(() => null);
    const parsed = HttpPaymentStatusResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function resolveCanonicalPaymentStatus(options: {
  payload?: unknown;
  paymentId?: string;
  responseHeaders?: HeaderBag;
  baseUrl?: string;
  fallbackCheckStatusUrl?: string;
  fetchImpl?: typeof fetch;
  onPoll?: (details: {
    paymentId?: string;
    checkStatusUrl: string;
    source: "canonical_hint" | "compat_fallback";
  }) => void;
}): Promise<HttpPaymentStatusResponse | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const directCandidate = extractCandidateRecord(options.payload);
  if (directCandidate) {
    const parsed = tryParsePaymentStatus({
      ...directCandidate,
      ...(typeof directCandidate.paymentId !== "string" && options.paymentId
        ? { paymentId: options.paymentId }
        : {}),
      ...(typeof directCandidate.checkStatusUrl === "string"
        ? {
            checkStatusUrl:
              normalizeCheckStatusUrl(directCandidate.checkStatusUrl, options.baseUrl) ??
              directCandidate.checkStatusUrl,
          }
        : {}),
    });
    if (parsed) {
      return parsed;
    }
  }

  const hints = extractCanonicalPaymentHints(options);

  const canonicalCheckStatusUrl = hints.checkStatusUrl;
  const compatFallbackCheckStatusUrl = canonicalCheckStatusUrl
    ? undefined
    : normalizeCheckStatusUrl(options.fallbackCheckStatusUrl, options.baseUrl);
  const checkStatusUrl = canonicalCheckStatusUrl ?? compatFallbackCheckStatusUrl;
  if (checkStatusUrl) {
    options.onPoll?.({
      paymentId: hints.paymentId,
      checkStatusUrl,
      source: canonicalCheckStatusUrl ? "canonical_hint" : "compat_fallback",
    });
    const polled = await fetchPaymentStatus(checkStatusUrl, fetchImpl);
    if (polled) {
      return polled;
    }
  }

  if (hints.paymentId && hints.status) {
    const parsed = tryParsePaymentStatus({
      paymentId: hints.paymentId,
      status: hints.status,
      ...(hints.checkStatusUrl ? { checkStatusUrl: hints.checkStatusUrl } : {}),
      ...(hints.txid ? { txid: hints.txid } : {}),
    });
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function classifyCanonicalPaymentStatus(
  status: HttpPaymentStatusResponse
): CanonicalPaymentDecision {
  if (IN_FLIGHT_STATUSES.has(status.status)) {
    return {
      action: "poll_same_payment",
      retryable: true,
      shouldReusePaymentId: true,
      shouldRebuild: false,
      shouldStopPollingOldPaymentId: false,
      summary: `Payment ${status.paymentId} is still ${status.status}. Keep polling the same paymentId; do not rebuild or sign a second payment.`,
    };
  }

  if (status.status === "confirmed") {
    return {
      action: "success",
      retryable: false,
      shouldReusePaymentId: false,
      shouldRebuild: false,
      shouldStopPollingOldPaymentId: false,
      summary: `Payment ${status.paymentId} is confirmed.`,
    };
  }

  if (status.status === "failed" && status.terminalReason && SENDER_NONCE_REASONS.has(status.terminalReason)) {
    return {
      action: "rebuild_sender",
      retryable: true,
      shouldReusePaymentId: false,
      shouldRebuild: true,
      shouldStopPollingOldPaymentId: false,
      summary: `Payment ${status.paymentId} failed with sender-owned nonce reason ${status.terminalReason}. Rebuild and re-sign with a fresh sender nonce.`,
    };
  }

  if (status.status === "failed" && status.terminalReason && BOUNDED_RETRY_REASONS.has(status.terminalReason)) {
    return {
      action: "retry_bounded",
      retryable: status.retryable === true,
      shouldReusePaymentId: false,
      shouldRebuild: false,
      shouldStopPollingOldPaymentId: false,
      summary: `Payment ${status.paymentId} failed with relay/settlement reason ${status.terminalReason}. Use only bounded retry if the route allows it; otherwise stop.`,
    };
  }

  if (status.status === "replaced") {
    return {
      action: "stop_replaced",
      retryable: false,
      shouldReusePaymentId: false,
      shouldRebuild: false,
      shouldStopPollingOldPaymentId: true,
      summary: `Payment ${status.paymentId} was replaced${status.terminalReason ? ` (${status.terminalReason})` : ""}. Stop polling the old paymentId.`,
    };
  }

  if (status.status === "not_found") {
    return {
      action: "restart_payment",
      retryable: false,
      shouldReusePaymentId: false,
      shouldRebuild: false,
      shouldStopPollingOldPaymentId: true,
      summary: `Payment ${status.paymentId} is not_found${status.terminalReason ? ` (${status.terminalReason})` : ""}. Treat the old identity as gone or expired and restart only if the higher-level operation still wants to pay.`,
    };
  }

  const reason = status.terminalReason as TerminalReason | undefined;
  return {
    action: "stop",
    retryable: false,
    shouldReusePaymentId: false,
    shouldRebuild: false,
    shouldStopPollingOldPaymentId: status.status === "failed",
    summary: `Payment ${status.paymentId} reached terminal status ${status.status}${reason ? ` (${reason})` : ""}. Stop and decide next action explicitly.`,
  };
}

export function formatCanonicalPaymentStatus(status: HttpPaymentStatusResponse): string {
  const lines = [
    `paymentId: ${status.paymentId}`,
    `status: ${status.status}`,
  ];

  if (status.terminalReason) {
    lines.push(`terminalReason: ${status.terminalReason}`);
  }
  if (status.txid) {
    lines.push(`txid: ${status.txid}`);
  }
  if (status.checkStatusUrl) {
    lines.push(`checkStatusUrl: ${status.checkStatusUrl}`);
  }
  if (status.errorCode) {
    lines.push(`errorCode: ${status.errorCode}`);
  }
  if (status.error) {
    lines.push(`error: ${status.error}`);
  }
  if (status.retryable !== undefined) {
    lines.push(`retryable: ${status.retryable}`);
  }

  return lines.join("\n");
}
