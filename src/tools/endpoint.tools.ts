import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createApiClient, API_URL, probeEndpoint, formatPaymentAmount, type ProbeResult, checkSufficientBalance, generateDedupKey, checkDedupCache, recordTransaction, NETWORK } from "../services/x402.service.js";
import { getSponsorRelayUrl } from "../config/sponsor.js";
import {
  ALL_ENDPOINTS,
  searchEndpoints,
  formatEndpointsTable,
  getEndpointsBySource,
  getCategories,
} from "../endpoints/registry.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { X402_HEADERS } from "../utils/x402-protocol.js";
import type { HttpPaymentStatusResponse } from "@aibtc/tx-schemas/http";
import {
  extractPaymentIdFromPaymentSignature,
  extractTxidFromPaymentSignature,
  pollTransactionConfirmation,
} from "../utils/x402-recovery.js";
import {
  formatCanonicalPaymentStatus,
  resolveCanonicalPaymentStatus,
} from "../utils/x402-payment-state.js";
import { emitPaymentLog } from "../utils/x402-payment-logging.js";

const ALL_SOURCES = "x402.biwas.xyz, x402.aibtc.com, stx402.com, aibtc.com";

interface ParsedEndpointUrl {
  baseUrl: string;
  requestPath: string;
  fullUrl: string;
  params?: Record<string, string>;
}

/**
 * Parse and validate endpoint URL from either a full URL or path+apiUrl combination.
 * Merges any query parameters from the URL into the provided params.
 */
function parseEndpointUrl(options: {
  url?: string;
  path?: string;
  apiUrl?: string;
  params?: Record<string, string>;
}): ParsedEndpointUrl {
  const { url, path, apiUrl } = options;
  let params = options.params;

  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed for x402 endpoints");
    }
    if (parsed.search) {
      const urlParams = Object.fromEntries(parsed.searchParams);
      params = { ...urlParams, ...params };
    }
    return {
      baseUrl: `${parsed.protocol}//${parsed.host}`,
      requestPath: parsed.pathname,
      fullUrl: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
      params,
    };
  }

  if (path) {
    if (apiUrl && !apiUrl.startsWith("https://")) {
      throw new Error("Only HTTPS URLs are allowed for x402 endpoints");
    }
    const baseUrl = apiUrl || API_URL;
    return {
      baseUrl,
      requestPath: path,
      fullUrl: `${baseUrl}${path}`,
      params,
    };
  }

  throw new Error("Either 'url' or 'path' parameter must be provided");
}

/**
 * Build the callWith object that echoes back original request params,
 * allowing the LLM to copy them into a follow-up execute_x402_endpoint call.
 */
function buildCallWith(options: {
  method: string;
  url?: string;
  path?: string;
  apiUrl?: string;
  params?: Record<string, string>;
  data?: Record<string, unknown>;
}): Record<string, unknown> {
  const callWith: Record<string, unknown> = { method: options.method, autoApprove: true };
  if (options.url) callWith.url = options.url;
  if (options.path) callWith.path = options.path;
  if (options.apiUrl) callWith.apiUrl = options.apiUrl;
  if (options.params && Object.keys(options.params).length > 0) callWith.params = options.params;
  if (options.data && Object.keys(options.data).length > 0) callWith.data = options.data;
  return callWith;
}

/**
 * Format an endpoint error into an MCP error response.
 * Provides a helpful hint for 404s and includes HTTP status for other errors.
 */
function formatEndpointError(
  error: unknown,
  endpointLabel: string
): { content: Array<{ type: "text"; text: string }>; isError: true } {
  let message = "Unknown error";
  const axiosError = error as { response?: { status?: number; data?: unknown } };
  if (axiosError.response) {
    if (axiosError.response.status === 404) {
      message = `Endpoint not found: ${endpointLabel}. Use list_x402_endpoints to see available endpoints.`;
    } else {
      message = `HTTP ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Format a probe result into an MCP JSON response.
 * Shared by execute_x402_endpoint (safe mode) and probe_x402_endpoint.
 */
function formatProbeResponse(
  result: ProbeResult,
  method: string,
  fullUrl: string,
  callWithOptions: Parameters<typeof buildCallWith>[0],
  messagePrefix?: string
): ReturnType<typeof createJsonResponse> {
  if (result.type === 'free') {
    return createJsonResponse({
      type: 'free',
      endpoint: `${method} ${fullUrl}`,
      message: 'This endpoint is free (no payment required)',
      response: result.data,
    });
  }

  const formattedCost = formatPaymentAmount(result.amount, result.asset);
  const prefix = messagePrefix ?? 'No payment made. ';
  return createJsonResponse({
    type: 'payment_required',
    endpoint: `${method} ${fullUrl}`,
    message: `${prefix}This endpoint costs ${formattedCost}. To execute and pay, call execute_x402_endpoint with autoApprove: true and the parameters shown in callWith below.`,
    payment: {
      amount: result.amount,
      asset: result.asset,
      recipient: result.recipient,
      network: result.network,
    },
    callWith: buildCallWith(callWithOptions),
  });
}

/**
 * Caller-facing structured payment block surfaced when a paid x402 endpoint
 * returns 202 with a `paymentId` + `checkStatusUrl` in the body.
 *
 * Field names follow the canonical `HttpPaymentStatusResponse` schema from
 * `@aibtc/tx-schemas/http` rather than the ad-hoc shape (`relayState`,
 * `holdReason`, etc.) shown in some relay reference payloads — the canonical
 * schema is the only contract enforced across MCP tooling, so we stick to it.
 *
 * The `held` semantics from the original #487 report map to:
 *   - canonical `status` = "queued" | "broadcasting" | "mempool" (still in-flight)
 *   - canonical `terminalReason` = "sender_nonce_gap" / "sender_nonce_stale"
 *     / "sender_nonce_duplicate" / "sender_hand_expired" (the "why is it held"
 *     signal, populated when the relay decides it is terminal)
 *
 * NOTE FOR FUTURE REFACTOR (post-Gap-2 merge): once Gap 2 lands a shared
 * `payment` block helper in `x402.service.ts`, this inline helper should be
 * extracted alongside it. Both code paths (success-with-202 and 4xx-after-payment)
 * benefit from a single shared shape.
 */
interface SuccessPathPaymentBlock {
  paymentId: string;
  checkStatusUrl: string;
  polledAt: string;
  pollOutcome: "terminal" | "still-held" | "still-pending" | "fallback";
  status?: HttpPaymentStatusResponse["status"];
  terminalReason?: NonNullable<HttpPaymentStatusResponse["terminalReason"]>;
  txid?: string;
  pollCount: number;
  nextStep?: string;
}

const HELD_POLL_BACKOFFS_MS = [2_000, 5_000, 13_000];
const HELD_POLL_TOTAL_BUDGET_MS = 30_000;

const TERMINAL_STATUSES = new Set<HttpPaymentStatusResponse["status"]>([
  "confirmed",
  "failed",
  "replaced",
  "not_found",
]);

const SENDER_NONCE_REASONS = new Set([
  "sender_nonce_stale",
  "sender_nonce_gap",
  "sender_nonce_duplicate",
]);

/**
 * SSRF guard for the `checkStatusUrl` returned in a 202 success-path response
 * body. The URL comes from third-party data — without this check, a malicious
 * endpoint could trick us into polling internal hosts (or any host of its
 * choice) via the `resolveCanonicalPaymentStatus` helper.
 *
 * Accept the URL when its origin is either:
 *   (a) the called endpoint's own origin (co-located relay), OR
 *   (b) the canonical x402 sponsor relay for the current network
 *       (`getSponsorRelayUrl(NETWORK)` — `https://x402-relay.aibtc.com` on
 *       mainnet, `https://x402-relay.aibtc.dev` on testnet) — this is the
 *       typical production case where the relay is a separate aibtc-owned host.
 *
 * Reject anything else (different unrelated hosts, internal IPs, attacker-
 * controlled hosts, etc.).
 */
function isTrustedCheckStatusUrl(checkStatusUrl: string, endpointBaseUrl: string): boolean {
  try {
    const checkOrigin = new URL(checkStatusUrl).origin;
    const endpointOrigin = new URL(endpointBaseUrl).origin;
    const relayOrigin = new URL(getSponsorRelayUrl(NETWORK)).origin;
    return checkOrigin === endpointOrigin || checkOrigin === relayOrigin;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveNextStep(
  status: HttpPaymentStatusResponse | null,
  paymentId: string
): string | undefined {
  if (!status) {
    return undefined;
  }

  const reason = status.terminalReason;

  if (status.status === "confirmed") {
    return undefined;
  }

  if (reason && SENDER_NONCE_REASONS.has(reason)) {
    return `Held on sender-nonce reason (${reason}). Run nonce_health to confirm chain-side state, then check_relay_health to verify the relay can refresh; if both green at the relay-reported hand expiry, file a relay bug citing paymentId ${paymentId}.`;
  }

  if (reason === "sender_hand_expired" || reason === "expired") {
    return `Relay hand expired (${reason}). Payment ${paymentId} will not settle; restart the operation with a fresh payment if still desired.`;
  }

  if (reason === "queue_unavailable" || reason === "sponsor_failure" || reason === "internal_error") {
    return `Relay-side issue (${reason}) — bounded retry only if route allows; otherwise file a relay bug citing paymentId ${paymentId}.`;
  }

  if (status.status === "failed" || status.status === "not_found" || status.status === "replaced") {
    return `Payment ${paymentId} reached terminal status ${status.status}${reason ? ` (${reason})` : ""}. Do not retry under the same paymentId.`;
  }

  // Still in-flight (queued / broadcasting / mempool) after our polling budget.
  return `Payment ${paymentId} is still ${status.status} after auto-poll budget exhausted. Continue polling ${status.checkStatusUrl ?? "the checkStatusUrl"} until terminal; if it remains non-terminal beyond the relay-reported hand expiry, run nonce_health and check_relay_health.`;
}

/**
 * Poll `checkStatusUrl` for an in-flight 202+paymentId response and produce a
 * caller-facing summary. Bounded by 3 polls and a 30s total budget, with
 * exponential backoff (2s, 5s, 13s) between attempts. Returns a "fallback"
 * outcome on any unrecoverable poll error rather than throwing — the original
 * 202 body is still surfaced to the caller, just without held-state detail.
 */
async function pollHeldStateForSuccessPath(options: {
  paymentId: string;
  checkStatusUrl: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<SuccessPathPaymentBlock> {
  const startedAt = Date.now();
  let lastStatus: HttpPaymentStatusResponse | null = null;
  let pollCount = 0;
  let pollError: unknown = undefined;

  for (let i = 0; i < HELD_POLL_BACKOFFS_MS.length; i++) {
    if (Date.now() - startedAt + HELD_POLL_BACKOFFS_MS[i] > HELD_POLL_TOTAL_BUDGET_MS) {
      break;
    }
    await sleep(HELD_POLL_BACKOFFS_MS[i]);

    pollCount++;
    try {
      const polled = await resolveCanonicalPaymentStatus({
        paymentId: options.paymentId,
        fallbackCheckStatusUrl: options.checkStatusUrl,
        baseUrl: options.baseUrl,
        fetchImpl: options.fetchImpl,
      });
      lastStatus = polled;
      if (polled && TERMINAL_STATUSES.has(polled.status)) {
        break;
      }
    } catch (err) {
      pollError = err;
      break;
    }
  }

  const polledAt = new Date().toISOString();

  if (pollError !== undefined || !lastStatus) {
    return {
      paymentId: options.paymentId,
      checkStatusUrl: options.checkStatusUrl,
      polledAt,
      pollOutcome: "fallback",
      pollCount,
    };
  }

  // pollOutcome semantics:
  //   "terminal"       — `status` is in TERMINAL_STATUSES (confirmed/failed/replaced/not_found)
  //   "still-held"     — non-terminal `status`, BUT relay populated a `terminalReason`
  //                      (sender-nonce family, queue_unavailable, sponsor_failure, etc.) —
  //                      i.e. relay knows it's stuck and has a reason
  //   "still-pending"  — non-terminal `status`, no `terminalReason` — genuinely in-flight
  //                      without any held-state signal
  let pollOutcome: SuccessPathPaymentBlock["pollOutcome"];
  if (TERMINAL_STATUSES.has(lastStatus.status)) {
    pollOutcome = "terminal";
  } else if (lastStatus.terminalReason) {
    pollOutcome = "still-held";
  } else {
    pollOutcome = "still-pending";
  }

  const nextStep = deriveNextStep(lastStatus, options.paymentId);

  return {
    paymentId: options.paymentId,
    checkStatusUrl: options.checkStatusUrl,
    polledAt,
    pollOutcome,
    status: lastStatus.status,
    ...(lastStatus.terminalReason ? { terminalReason: lastStatus.terminalReason } : {}),
    ...(lastStatus.txid ? { txid: lastStatus.txid } : {}),
    pollCount,
    ...(nextStep ? { nextStep } : {}),
  };
}

export function registerEndpointTools(server: McpServer): void {
  // List x402 endpoints
  server.registerTool(
    "list_x402_endpoints",
    {
      description: `List known x402 API endpoints from ${ALL_SOURCES}.

The agent can:
1. Execute x402 endpoints from these sources (paid API calls with automatic payment handling)
2. Execute direct Stacks transactions (transfer STX, call contracts, deploy contracts)

Sources:
- x402.biwas.xyz: DeFi analytics, market data, wallet analysis, Zest/ALEX protocols
- x402.aibtc.com: AI inference, OpenRouter integration, Stacks utilities, hashing, storage
- stx402.com: AI services, cryptography, storage, utilities, agent registry
- aibtc.com: Inbox messaging system`,
      inputSchema: {
        source: z
          .enum(["x402.biwas.xyz", "x402.aibtc.com", "stx402.com", "aibtc.com", "all"])
          .optional()
          .default("all")
          .describe("Filter by API source"),
        category: z
          .string()
          .optional()
          .describe("Filter by category (use without value to see available categories)"),
        search: z
          .string()
          .optional()
          .describe("Search endpoints by keyword (searches path, description, category)"),
        showFreeOnly: z
          .boolean()
          .optional()
          .describe("Only show free endpoints (no payment required)"),
        showPaidOnly: z
          .boolean()
          .optional()
          .describe("Only show paid endpoints (require x402 payment)"),
      },
    },
    async ({ source, category, search, showFreeOnly, showPaidOnly }) => {
      try {
        let endpoints = ALL_ENDPOINTS;

        if (source && source !== "all") {
          endpoints = getEndpointsBySource(source);
        }

        if (showFreeOnly) {
          endpoints = endpoints.filter((ep) => ep.cost === "FREE");
        } else if (showPaidOnly) {
          endpoints = endpoints.filter((ep) => ep.cost !== "FREE");
        }

        if (category) {
          endpoints = endpoints.filter(
            (ep) => ep.category.toLowerCase() === category.toLowerCase()
          );
        }

        if (search) {
          const searchResults = searchEndpoints(search);
          endpoints = endpoints.filter((ep) => searchResults.includes(ep));
        }

        if (endpoints.length === 0) {
          const categories = getCategories();
          return {
            content: [
              {
                type: "text" as const,
                text: `No endpoints found matching your criteria.

Available categories: ${categories.join(", ")}

Sources: ${ALL_SOURCES}

If you're looking to perform a direct blockchain action (transfer STX, call a contract), those are available via separate tools.`,
              },
            ],
          };
        }

        const formatted = formatEndpointsTable(endpoints);
        const sourceInfo =
          source === "all"
            ? `Sources: ${ALL_SOURCES}`
            : `Source: ${source}`;
        return {
          content: [
            {
              type: "text" as const,
              text: `# Available x402 Endpoints (${endpoints.length} total)\n\n${sourceInfo}\nDefault API: ${API_URL}\n${formatted}\n\n---\nUse execute_x402_endpoint to call any of these endpoints.`,
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Execute x402 endpoint
  server.registerTool(
    "execute_x402_endpoint",
    {
      description: `Execute an x402 API endpoint. Payment is handled automatically.

Supported sources:
- x402.biwas.xyz (default): Use path like "/api/pools/trending"
- x402.aibtc.com (mainnet) / x402.aibtc.dev (testnet): Use apiUrl="https://x402.aibtc.com" with path like "/inference/openrouter/chat"
- stx402.com: Use apiUrl="https://stx402.com" with path like "/ai/dad-joke"
- aibtc.com (mainnet) / aibtc.dev (testnet): Use apiUrl="https://aibtc.com" with path like "/api/inbox/{address}"
- Any x402-compatible URL: Use url parameter with full endpoint URL

Use list_x402_endpoints to discover available endpoints.

For aibtc.com inbox messages, use send_inbox_message instead — it uses sponsored transactions to avoid sBTC settlement timeout issues.`,
      inputSchema: {
        method: z
          .enum(["GET", "POST", "PUT", "DELETE"])
          .default("GET")
          .describe("HTTP method"),
        url: z
          .string()
          .url()
          .optional()
          .describe("Full endpoint URL (e.g., 'https://stx402.com/ai/dad-joke'). Takes precedence over path+apiUrl."),
        path: z
          .string()
          .optional()
          .describe("API endpoint path (e.g., '/api/pools/trending'). Required if url is not provided."),
        apiUrl: z
          .string()
          .url()
          .optional()
          .describe("API base URL. Known sources: x402.biwas.xyz, x402.aibtc.com, stx402.com, aibtc.com. Defaults to configured API_URL."),
        params: z
          .record(z.string(), z.string())
          .optional()
          .describe("Query parameters for GET requests"),
        data: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Request body for POST/PUT requests"),
        autoApprove: z
          .boolean()
          .optional()
          .default(false)
          .describe("Skip cost probe and execute immediately. When false (default), probes first and returns cost info for paid endpoints. When true, executes atomically like before. Free endpoints always execute transparently."),
      },
    },
    async ({ method, url, path, apiUrl, params, data, autoApprove }) => {
      let fullUrl = "";

      try {
        const parsed = parseEndpointUrl({ url, path, apiUrl, params });
        fullUrl = parsed.fullUrl;
        params = parsed.params;

        if (!autoApprove) {
          const probeResult = await probeEndpoint({ method, url: fullUrl, params, data });
          return formatProbeResponse(probeResult, method, fullUrl, { method, url, path, apiUrl, params, data });
        }

        // autoApprove=true: check dedup cache before any network request, then execute
        // with a single request. Balance validation happens inside the onBeforePayment
        // callback when the interceptor receives the 402, eliminating the separate probe.
        const dedupKey = generateDedupKey(method, fullUrl, params, data);
        const existingTxid = checkDedupCache(dedupKey);
        if (existingTxid) {
          return createJsonResponse({
            endpoint: `${method} ${fullUrl}`,
            message: 'Request already processed within the last 60 seconds. This prevents accidental duplicate payments.',
            txid: existingTxid,
            note: 'Wait 60s or use different endpoint/params to force a new transaction.',
          });
        }

        const api = await createApiClient(parsed.baseUrl, {
          toolName: "execute_x402_endpoint",
          onBeforePayment: async (requirements) => {
            await checkSufficientBalance(requirements.account, requirements.amount, requirements.asset, true);
          },
        });
        const response = await api.request({ method, url: parsed.requestPath, params, data });

        const rawTxid = (response.data as { txid?: string; payment_txid?: string })?.txid ||
                     (response.data as { payment_txid?: string })?.payment_txid ||
                     response.headers?.['x-transaction-id'] ||
                     undefined;

        // Detect whether a payment was made by checking for the payment-signature
        // header added by the x402 interceptor. This is more reliable than checking
        // for a txid, which some endpoints may not return.
        const paymentSigHeader = (response as { config?: { headers?: Record<string, string> } })
          .config?.headers?.[X402_HEADERS.PAYMENT_SIGNATURE];
        const paymentAttempted = Boolean(paymentSigHeader);

        // Never invent a placeholder txid when payment was attempted but the
        // response doesn't expose one — a fake string actively misleads
        // downstream tooling and operators (see #487). Surface txid: null
        // with an explicit recovery hint so the caller can discover the
        // real txid via get_account_transactions.
        const txid: string | null = rawTxid ?? null;

        // Keep dedup tracking active even when the txid is not yet
        // observable, using a synthetic pending marker that cannot be
        // confused for a real chain txid.
        if (paymentAttempted) {
          recordTransaction(dedupKey, txid ?? `pending:${dedupKey}`);
        }

        // Gap 3 (issue #487): when the upstream returns 202 with a paymentId +
        // checkStatusUrl, poll the relay's canonical status briefly so the
        // caller sees held-state / terminal-reason detail rather than the
        // ambiguous "queued" + "pending" body. Failures here are non-fatal —
        // we always return the original response, optionally enriched.
        const responseBody = response.data as
          | { paymentId?: unknown; checkStatusUrl?: unknown }
          | undefined;
        const sniffedPaymentId =
          typeof responseBody?.paymentId === "string" ? responseBody.paymentId : undefined;
        // SSRF guard: the `checkStatusUrl` comes from a third-party response body.
        // Only accept it when it points at the endpoint's own origin or the canonical
        // x402 sponsor relay (see `isTrustedCheckStatusUrl` JSDoc). A malicious
        // endpoint could otherwise trick us into polling internal hosts.
        const sniffedCheckStatusUrl =
          typeof responseBody?.checkStatusUrl === "string" &&
          isTrustedCheckStatusUrl(responseBody.checkStatusUrl, parsed.baseUrl)
            ? responseBody.checkStatusUrl
            : undefined;
        let paymentBlock: SuccessPathPaymentBlock | undefined;
        if (response.status === 202 && sniffedPaymentId && sniffedCheckStatusUrl) {
          paymentBlock = await pollHeldStateForSuccessPath({
            paymentId: sniffedPaymentId,
            checkStatusUrl: sniffedCheckStatusUrl,
            baseUrl: parsed.baseUrl,
          });
        }

        // Gap 1 (issue #487, #504): build txid response fields per the behavior matrix:
        //   payment attempted + observable txid → { txid: "0x..." }
        //   payment attempted + unobservable     → { txid: null, txidNote: "..." }
        //   no payment + observable txid         → { txid: "0x..." }
        //   no payment + no txid                 → {}
        const txidFields = paymentAttempted
          ? {
              txid,
              ...(txid === null && {
                txidNote:
                  "Payment broadcast; real txid not yet observable in response. " +
                  "Query get_account_transactions to discover the settled txid for verification or recovery.",
              }),
            }
          : txid !== null
            ? { txid }
            : {};

        return createJsonResponse({
          endpoint: `${method} ${fullUrl}`,
          response: response.data,
          ...txidFields,
          ...(paymentBlock && { payment: paymentBlock }),
        });
      } catch (error) {
        const label = fullUrl || url || path || "unknown";

        // Txid recovery: when payment was attempted but settlement failed,
        // extract the txid from the payment-signature header (set by the axios
        // interceptor in x402.service.ts) and return it so the agent can verify.
        const axiosError = error as {
          config?: { headers?: Record<string, string> };
          response?: { status?: number; data?: unknown };
          x402PaymentStatus?: unknown;
          x402PaymentDecision?: { summary?: string };
        };
        const canonicalStatus = axiosError.x402PaymentStatus as
          | HttpPaymentStatusResponse
          | undefined;
        if (canonicalStatus) {
          const baseError = formatEndpointError(error, label);
          const paymentSigHeader = axiosError.config?.headers?.[X402_HEADERS.PAYMENT_SIGNATURE];
          const fallbackTxid = paymentSigHeader
            ? extractTxidFromPaymentSignature(paymentSigHeader)
            : null;
          const fallbackPaymentId = paymentSigHeader
            ? extractPaymentIdFromPaymentSignature(paymentSigHeader)
            : null;

          let text =
            baseError.content[0].text +
            `\n\nCanonical payment status:\n${formatCanonicalPaymentStatus(canonicalStatus)}`;

          if (axiosError.x402PaymentDecision?.summary) {
            text += `\n\nGuidance: ${axiosError.x402PaymentDecision.summary}`;
          }

          if (fallbackPaymentId && fallbackPaymentId !== canonicalStatus.paymentId) {
            text += `\n\nRequest paymentId: ${fallbackPaymentId}`;
          }

          if (fallbackTxid && fallbackTxid !== canonicalStatus.txid) {
            const confirmation = await pollTransactionConfirmation(fallbackTxid, NETWORK);
            text +=
              `\n\nOperational fallback only:\n` +
              `  txid: ${confirmation.txid}\n` +
              `  status: ${confirmation.status}\n` +
              `  explorer: ${confirmation.explorer}`;
          }

          return {
            ...baseError,
            content: [{ type: "text" as const, text }],
          };
        }

        const paymentSigHeader = axiosError.config?.headers?.[X402_HEADERS.PAYMENT_SIGNATURE];
        if (paymentSigHeader) {
          const txid = extractTxidFromPaymentSignature(paymentSigHeader);
          const fallbackPaymentId = extractPaymentIdFromPaymentSignature(paymentSigHeader);
          if (txid) {
            // Poll briefly to get current status
            const confirmation = await pollTransactionConfirmation(txid, NETWORK);
            emitPaymentLog("payment.fallback_used", {
              tool: "execute_x402_endpoint",
              paymentId: fallbackPaymentId,
              status: confirmation.status,
              action: "txid_recovery",
              compatShimUsed: false,
            });
            const baseError = formatEndpointError(error, label);
            return {
              ...baseError,
              content: [
                {
                  type: "text" as const,
                  text: baseError.content[0].text +
                    `\n\nCanonical payment status was unavailable, so only txid recovery fallback is available.\n` +
                    `Transaction recovery info:\n` +
                    `  txid: ${confirmation.txid}\n` +
                    `  status: ${confirmation.status}\n` +
                    `  explorer: ${confirmation.explorer}`,
                },
              ],
            };
          }
        }

        return formatEndpointError(error, label);
      }
    }
  );

  // Probe x402 endpoint (discover cost without paying)
  server.registerTool(
    "probe_x402_endpoint",
    {
      description: `Probe an x402 API endpoint to discover its cost WITHOUT making payment.

This tool is useful for:
- Discovering the cost of a paid endpoint before executing
- Checking if an endpoint is free or requires payment
- Presenting costs to users for approval before paying

For free endpoints, returns the response data directly.
For paid endpoints, returns payment details (amount, asset, recipient) without executing payment.

After probing a paid endpoint, use execute_x402_endpoint to actually execute and pay.

Supported sources:
- x402.biwas.xyz (default): Use path like "/api/pools/trending"
- x402.aibtc.com (mainnet) / x402.aibtc.dev (testnet): Use apiUrl="https://x402.aibtc.com" with path like "/inference/openrouter/chat"
- stx402.com: Use apiUrl="https://stx402.com" with path like "/ai/dad-joke"
- aibtc.com (mainnet) / aibtc.dev (testnet): Use apiUrl="https://aibtc.com" with path like "/api/inbox/{address}"
- Any x402-compatible URL: Use url parameter with full endpoint URL`,
      inputSchema: {
        method: z
          .enum(["GET", "POST", "PUT", "DELETE"])
          .default("GET")
          .describe("HTTP method"),
        url: z
          .string()
          .url()
          .optional()
          .describe("Full endpoint URL (e.g., 'https://stx402.com/ai/dad-joke'). Takes precedence over path+apiUrl."),
        path: z
          .string()
          .optional()
          .describe("API endpoint path (e.g., '/api/pools/trending'). Required if url is not provided."),
        apiUrl: z
          .string()
          .url()
          .optional()
          .describe("API base URL. Known sources: x402.biwas.xyz, x402.aibtc.com, stx402.com, aibtc.com. Defaults to configured API_URL."),
        params: z
          .record(z.string(), z.string())
          .optional()
          .describe("Query parameters for GET requests"),
        data: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Request body for POST/PUT requests"),
      },
    },
    async ({ method, url, path, apiUrl, params, data }) => {
      let fullUrl = "";

      try {
        const parsed = parseEndpointUrl({ url, path, apiUrl, params });
        fullUrl = parsed.fullUrl;
        params = parsed.params;

        const result = await probeEndpoint({ method, url: fullUrl, params, data });
        return formatProbeResponse(result, method, fullUrl, { method, url, path, apiUrl, params, data });
      } catch (error) {
        return formatEndpointError(error, fullUrl || "unknown");
      }
    }
  );
}
