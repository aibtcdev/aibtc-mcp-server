import axios, { type AxiosInstance } from "axios";
import {
  makeSTXTokenTransfer,
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
  PostConditionMode,
} from "@stacks/transactions";
import {
  decodePaymentRequired,
  encodePaymentPayload,
  generatePaymentId,
  buildPaymentIdentifierExtension,
  X402_HEADERS,
} from "../utils/x402-protocol.js";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import { NETWORK, API_URL, getStacksNetwork, type Network } from "../config/networks.js";
import { getNetworkFromStacksChainId } from "../config/caip.js";
import type { Account } from "../transactions/builder.js";
import { getWalletManager } from "./wallet-manager.js";
import { formatStx, formatSbtc } from "../utils/formatting.js";
import { getSbtcService } from "./sbtc.service.js";
import { getHiroApi } from "./hiro-api.js";
import { createHash } from "crypto";
import { InsufficientBalanceError } from "../utils/errors.js";
import { getContracts, parseContractId } from "../config/contracts.js";
import {
  classifyCanonicalPaymentStatus,
  formatCanonicalPaymentStatus,
  resolveCanonicalPaymentStatus,
} from "../utils/x402-payment-state.js";
import { extractPaymentIdFromPaymentSignature } from "../utils/x402-recovery.js";
import {
  emitCanonicalPaymentDecisionLogs,
  emitCanonicalPaymentPollLogs,
  emitPaymentLog,
} from "../utils/x402-payment-logging.js";
import {
  parseL402Challenge,
  buildL402AuthHeader,
  getCachedL402Auth,
  cacheL402Auth,
  invalidateL402Auth,
} from "../utils/l402-protocol.js";
import { getLightningManager } from "./lightning-manager.js";
import { decode as decodeBolt11 } from "light-bolt11-decoder";

/**
 * Maximum Lightning invoice amount (in sats) the L402 interceptor will pay
 * without user confirmation. Overridable via the L402_MAX_SATS_PER_INVOICE env
 * var. Defaults to 10_000 sats (~$5 at $50k/BTC) — a malicious server can
 * return a BOLT-11 invoice for an arbitrary amount, so this cap bounds the
 * blast radius when the Lightning wallet is unlocked.
 *
 * If the env var is set to a non-numeric, non-finite, or non-positive value,
 * we log a warning to stderr and fall back to the default — `Number(undefined)`
 * is NaN, and `amountSats > NaN` is always false, which would silently disable
 * the cap and allow arbitrary-amount invoices through.
 */
const DEFAULT_L402_MAX_SATS = 10000;
function parseSatsCap(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `[L402] Invalid ${envName}="${raw}", falling back to ${fallback}`
    );
    return fallback;
  }
  return parsed;
}
const L402_MAX_SATS_PER_INVOICE = parseSatsCap(
  "L402_MAX_SATS_PER_INVOICE",
  DEFAULT_L402_MAX_SATS
);

// Track payment attempts per client instance (auto-cleanup via WeakMap)
const paymentAttempts: WeakMap<AxiosInstance, number> = new WeakMap();

// Track 429 retry counts per client instance
const rateLimitRetries: WeakMap<AxiosInstance, number> = new WeakMap();

// Track L402 payment attempts per {client, request URL} so a retry limit for
// endpoint A doesn't bleed into endpoint B. A single WeakMap<AxiosInstance,
// Map<string, number>> is sufficient because the per-instance map is garbage
// collected with the axios client.
const l402Attempts: WeakMap<AxiosInstance, Map<string, number>> = new WeakMap();

/**
 * Look up the per-URL L402 attempt count for a client instance.
 */
function getL402AttemptCount(instance: AxiosInstance, key: string): number {
  return l402Attempts.get(instance)?.get(key) ?? 0;
}

/**
 * Increment the per-URL L402 attempt count for a client instance.
 */
function incrementL402AttemptCount(
  instance: AxiosInstance,
  key: string
): number {
  let map = l402Attempts.get(instance);
  if (!map) {
    map = new Map();
    l402Attempts.set(instance, map);
  }
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
}

/**
 * Clear the per-URL L402 attempt count for a client instance on successful
 * response, so a later retry (e.g. from an expired cache entry) gets a fresh
 * budget.
 */
function clearL402AttemptCount(instance: AxiosInstance, key: string): void {
  const map = l402Attempts.get(instance);
  if (!map) return;
  map.delete(key);
}

/**
 * Error thrown when an x402 endpoint returns 429 Too Many Requests and all retries are exhausted.
 */
export class X402RateLimitError extends Error {
  constructor(message: string, public readonly retryAfterSeconds: number) {
    super(message);
    this.name = "X402RateLimitError";
  }
}

// Transaction deduplication cache: {dedupKey -> {txid, timestamp}}
const dedupCache: Map<string, { txid: string; timestamp: number }> = new Map();

// Cleanup expired dedup entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of dedupCache) {
    if (now - value.timestamp > 60000) {
      dedupCache.delete(key);
    }
  }
}, 300000).unref();

/**
 * Safe JSON transform - parses string responses without throwing
 */
function safeJsonTransform(data: unknown): unknown {
  if (typeof data !== "string") {
    return data;
  }
  const trimmed = data.trim();
  if (!trimmed) {
    return data;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
}

/**
 * Create a plain axios instance with JSON parsing for both success and error responses.
 * Used as the base for both payment-wrapped clients and probe requests.
 * Timeout is 120 seconds to accommodate sBTC contract-call settlements which can take 60+ seconds.
 */
function createBaseAxiosInstance(baseURL?: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 120000,
    transformResponse: [safeJsonTransform],
  });

  // Ensure error response bodies (especially 402 payloads) are also parsed as JSON
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.data) {
        error.response.data = safeJsonTransform(error.response.data);
      }
      return Promise.reject(error);
    }
  );

  // Handle 429 Too Many Requests with Retry-After header parsing and exponential backoff.
  // Max 2 retries with minimum delays [2s, 5s]. If Retry-After exceeds the cap (30s),
  // skip retries and immediately surface the error so interactive calls aren't blocked.
  // Runs before payment interceptors (response interceptors are FIFO) so payment flows
  // benefit automatically.
  const MAX_RETRY_DELAYS_MS = [2000, 5000];
  const MAX_RETRY_AFTER_CAP_S = 30;
  instance.interceptors.response.use(
    (response) => {
      // Reset retry counter on success so later 429s get the full retry budget
      rateLimitRetries.delete(instance);
      return response;
    },
    async (error) => {
      if (error?.response?.status !== 429) {
        return Promise.reject(error);
      }

      // Never retry 429s once a payment has been attempted on this instance.
      // Without this guard, a spiral forms: the 429 retry re-enters the full
      // interceptor chain, triggers a new 402 → payment → 429 → retry loop
      // that fires onBeforePayment repeatedly and drains the rate-limit budget.
      if (paymentAttempts.get(instance)) {
        return Promise.reject(error);
      }

      const retries = rateLimitRetries.get(instance) ?? 0;

      // Parse Retry-After header; default to 0 when absent so the backoff delay governs
      const parsed = parseInt(error.response.headers?.["retry-after"] ?? "", 10);
      const retryAfterSeconds = isNaN(parsed) ? 0 : parsed;

      // If the server says to wait longer than our cap, don't block — fail immediately
      if (retryAfterSeconds > MAX_RETRY_AFTER_CAP_S) {
        return Promise.reject(
          new X402RateLimitError(
            `x402 endpoint rate limit exceeded. Server requested ${retryAfterSeconds}s wait (exceeds ${MAX_RETRY_AFTER_CAP_S}s cap). ` +
              `Retry after ${retryAfterSeconds}s.`,
            retryAfterSeconds
          )
        );
      }

      if (retries >= MAX_RETRY_DELAYS_MS.length) {
        const reportSeconds = retryAfterSeconds > 0 ? retryAfterSeconds : 10;
        return Promise.reject(
          new X402RateLimitError(
            `x402 endpoint rate limit exceeded. All retries exhausted. ` +
              `Retry after ${reportSeconds}s.`,
            reportSeconds
          )
        );
      }

      rateLimitRetries.set(instance, retries + 1);

      const delay = Math.max(retryAfterSeconds * 1000, MAX_RETRY_DELAYS_MS[retries]);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return instance.request(error.config);
    }
  );

  return instance;
}

/**
 * Convert mnemonic to account
 */
export async function mnemonicToAccount(
  mnemonic: string,
  network: Network
): Promise<Account> {
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });

  const account = wallet.accounts[0];
  const address = getStxAddress(account, network);

  return {
    address,
    privateKey: account.stxPrivateKey,
    network,
  };
}

/**
 * Payment requirements passed to the onBeforePayment callback.
 * Includes the account so callers can validate balance without a redundant getAccount() call.
 */
export interface PaymentRequirements {
  amount: string;
  asset: string;
  recipient: string;
  network: string;
  account: Account;
}

/**
 * Options for createApiClient
 */
export interface CreateApiClientOptions {
  /**
   * Optional callback invoked after a 402 is received and payment requirements are
   * parsed, but BEFORE the transaction is signed/broadcast. Throwing from this
   * callback aborts the payment (e.g. insufficient balance check).
   */
  onBeforePayment?: (requirements: PaymentRequirements) => Promise<void>;
  toolName?: string;
}

/**
 * Build a canonical absolute URL for a request so that the L402 attempt
 * counter and macaroon cache are keyed by the actual endpoint, not the
 * relative path. Without this, two `createApiClient(differentBaseURL)`
 * instances both 402-ing on `/foo` would collide on the same cache entry.
 *
 * `URL` constructor would be cleaner but throws on inputs that aren't valid
 * absolute URLs — paths like `/foo` are exactly the case we need to handle,
 * so a forgiving string concat is the right shape here.
 */
function canonicalUrl(config: {
  baseURL?: string;
  url?: string;
}): string {
  const url = config.url ?? "";
  const baseURL = config.baseURL ?? "";
  if (!baseURL || /^https?:\/\//i.test(url)) {
    return url;
  }
  if (baseURL.endsWith("/") && url.startsWith("/")) {
    return baseURL + url.slice(1);
  }
  if (!baseURL.endsWith("/") && !url.startsWith("/")) {
    return baseURL + "/" + url;
  }
  return baseURL + url;
}

/**
 * Resolve the canonical request URL from an axios config, returning an empty
 * string when the config or url is missing. Wrapper around `canonicalUrl`
 * for the common axios-config shape.
 */
function canonicalRequestUrl(config: unknown): string {
  if (!config || typeof config !== "object") return "";
  const c = config as { baseURL?: string; url?: string };
  return canonicalUrl({ baseURL: c.baseURL, url: c.url });
}

/**
 * Create an API client with x402 payment interceptor.
 * Creates a fresh client instance per call with max-1-payment-attempt guard.
 */
export async function createApiClient(baseUrl?: string, options?: CreateApiClientOptions): Promise<AxiosInstance> {
  const url = baseUrl || API_URL;
  const toolName = options?.toolName ?? "createApiClient";

  // Account is lazy-loaded on first 402 so free endpoints work without a wallet.
  let account: Account | null = null;
  const ensureAccount = async (): Promise<Account> => {
    if (!account) {
      account = await getAccount();
    }
    return account;
  };

  const axiosInstance = createBaseAxiosInstance(url);

  // L402 rail interceptor (registered before the x402 chain so it can inspect
  // the raw 402 response). Preference rule:
  //   - If the response advertises a Stacks x402 payment-required header AND a
  //     Stacks wallet is unlocked, pass through and let the x402 chain handle
  //     it (x402-stacks is preferred).
  //   - Otherwise, if the response advertises an L402 challenge AND an LN
  //     wallet is unlocked, pay the invoice and retry with the L402
  //     Authorization header.
  //   - Otherwise, pass through (the x402 chain will reject if it can't pay).
  axiosInstance.interceptors.response.use(
    (response) => {
      // Reset the per-URL L402 attempt counter on any success so the next
      // unrelated 402 on the same client gets a full retry budget.
      const method = (response.config?.method ?? "get").toUpperCase();
      const canonical = canonicalRequestUrl(response.config);
      if (canonical) {
        clearL402AttemptCount(axiosInstance, `${method}:${canonical}`);
      }
      return response;
    },
    async (error) => {
      if (error.response?.status !== 402) {
        return Promise.reject(error);
      }

      // Check for an L402 challenge FIRST. If there isn't one, there is
      // nothing for this interceptor to do — pass through to the x402
      // chain without touching the wallet manager. This keeps tests that
      // mock only the x402-stacks surface area from tripping over
      // wallet-manager methods they didn't stub.
      const wwwAuth =
        error.response?.headers?.["www-authenticate"] ??
        error.response?.headers?.["WWW-Authenticate"];
      const challenge = parseL402Challenge(
        typeof wwwAuth === "string" ? wwwAuth : null
      );
      if (!challenge) {
        // No L402 header — nothing we can do, pass through.
        return Promise.reject(error);
      }

      // We have an L402 challenge. Decide whether x402-stacks is a
      // preferred rail for this response — only now do we need to touch
      // the wallet manager.
      const x402HeaderValue = error.response?.headers?.[X402_HEADERS.PAYMENT_REQUIRED];
      const x402PaymentRequired = decodePaymentRequired(x402HeaderValue);
      const hasStacksOption = !!x402PaymentRequired?.accepts?.some(
        (opt) => opt.network?.startsWith("stacks:")
      );
      const stacksWalletUnlocked = getWalletManager().isUnlocked();

      if (hasStacksOption && stacksWalletUnlocked) {
        // Let the x402 interceptor chain handle it.
        return Promise.reject(error);
      }

      const lnProvider = getLightningManager().getProvider();
      if (!lnProvider) {
        return Promise.reject(
          new Error(
            "L402 payment required but Lightning wallet is not unlocked. " +
              "Run lightning_unlock (or lightning_create) first."
          )
        );
      }

      const method = (error.config?.method ?? "get").toUpperCase();
      const canonicalUrlKey = canonicalRequestUrl(error.config);
      const attemptKey = `${method}:${canonicalUrlKey}`;

      // Guard against L402 retry loops — counted per-URL so paying endpoint A
      // doesn't poison endpoint B.
      const attempts = getL402AttemptCount(axiosInstance, attemptKey);
      if (attempts >= 1) {
        return Promise.reject(
          new Error(
            "L402 retry limit exceeded (max 1 attempt). Server returned 402 again after preimage was submitted."
          )
        );
      }
      incrementL402AttemptCount(axiosInstance, attemptKey);

      // Cache hit: reuse the macaroon+preimage without paying. If the server
      // rejects the retry with 401 / 402 / 403, the cached entry is stale —
      // drop it so subsequent calls re-pay instead of looping on a dead
      // macaroon. Many servers signal stale credentials with non-402 status
      // codes (401 Unauthorized for missing/expired auth, 403 Forbidden for
      // caveat violations).
      const cached = getCachedL402Auth(method, canonicalUrlKey);
      if (cached) {
        const originalRequest = error.config;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers["Authorization"] = buildL402AuthHeader(
          cached.macaroon,
          cached.preimage
        );
        return axiosInstance.request(originalRequest).catch((retryErr) => {
          const status = retryErr?.response?.status;
          if (status === 401 || status === 402 || status === 403) {
            invalidateL402Auth(method, canonicalUrlKey);
          }
          return Promise.reject(retryErr);
        });
      }

      // Validate the invoice amount BEFORE paying. A malicious server can
      // issue a BOLT-11 invoice for an arbitrary amount; Spark's maxFeeSats
      // only caps routing fees, not the payable amount itself.
      let decoded: ReturnType<typeof decodeBolt11>;
      try {
        decoded = decodeBolt11(challenge.invoice);
      } catch (decodeErr) {
        return Promise.reject(
          new Error(
            `L402 invoice could not be decoded: ${decodeErr instanceof Error ? decodeErr.message : String(decodeErr)}`
          )
        );
      }

      // light-bolt11-decoder returns the amount in millisats as a string on
      // the "amount" section. Amountless invoices have no amount section (or
      // a zero/missing value). Convert to sats for the cap comparison.
      const amountSection = decoded.sections.find(
        (s): s is { name: "amount"; letters: string; value: string } =>
          s.name === "amount"
      );
      const amountMsat = amountSection?.value
        ? BigInt(amountSection.value)
        : 0n;
      const amountSats = Number(amountMsat / 1000n);
      if (amountSats === 0) {
        return Promise.reject(
          new Error(
            "L402 invoice has no amount; refusing to pay amountless invoices for safety."
          )
        );
      }
      if (amountSats > L402_MAX_SATS_PER_INVOICE) {
        return Promise.reject(
          new Error(
            `L402 invoice amount (${amountSats} sats) exceeds the configured cap ` +
              `of ${L402_MAX_SATS_PER_INVOICE} sats (L402_MAX_SATS_PER_INVOICE). ` +
              `Refusing to pay.`
          )
        );
      }

      // Pay the Lightning invoice.
      let payment: { preimage: string; feesPaid: number };
      try {
        payment = await lnProvider.payInvoice(challenge.invoice);
      } catch (payErr) {
        return Promise.reject(
          new Error(
            `L402 payment failed: ${payErr instanceof Error ? payErr.message : String(payErr)}`
          )
        );
      }

      cacheL402Auth(
        method,
        canonicalUrlKey,
        challenge.macaroon,
        payment.preimage
      );

      const originalRequest = error.config;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers["Authorization"] = buildL402AuthHeader(
        challenge.macaroon,
        payment.preimage
      );
      // Mirror the cache-hit path: if the freshly-paid retry is itself
      // rejected with 401 / 402 / 403 (e.g. the server rejected the preimage
      // due to a macaroon caveat violation, IP binding, expired auth, etc.),
      // the just-cached entry is dead — drop it so subsequent calls re-pay
      // instead of looping on a poisoned cache entry.
      return axiosInstance.request(originalRequest).catch((retryErr) => {
        const status = retryErr?.response?.status;
        if (status === 401 || status === 402 || status === 403) {
          invalidateL402Auth(method, canonicalUrlKey);
        }
        return Promise.reject(retryErr);
      });
    }
  );

  // Interceptor 1 (FIFO): max-1-payment-attempt guard.
  // On the first 402, increments the counter and re-rejects so Interceptor 2 can handle it.
  // On a second 402 (would-be retry loop), rejects with a user-facing error.
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Only intercept 402 payment errors
      if (error.response?.status !== 402) {
        return Promise.reject(error);
      }

      // Check attempt counter
      const attempts = paymentAttempts.get(axiosInstance) || 0;

      if (attempts >= 1) {
        const paymentSignature = error.config?.headers?.[X402_HEADERS.PAYMENT_SIGNATURE];
        const paymentId = typeof paymentSignature === "string"
          ? extractPaymentIdFromPaymentSignature(paymentSignature)
          : null;
        let compatShimUsed = false;
        const canonicalStatus = await resolveCanonicalPaymentStatus({
          payload: error.response?.data,
          paymentId: paymentId ?? undefined,
          responseHeaders: error.response?.headers,
          baseUrl: url,
          onPoll: ({ paymentId: polledPaymentId, checkStatusUrl, source }) => {
            compatShimUsed = emitCanonicalPaymentPollLogs({
              tool: toolName,
              paymentId: polledPaymentId ?? paymentId,
              checkStatusUrl,
              source,
            });
          },
        });

        let retryError: Error;
        if (canonicalStatus) {
          const decision = classifyCanonicalPaymentStatus(canonicalStatus);
          emitCanonicalPaymentDecisionLogs({
            tool: toolName,
            status: canonicalStatus,
            decision,
            compatShimUsed,
          });
          retryError = new Error(
            `Payment retry limit exceeded (max 1 attempt).\n` +
              `${decision.summary}\n` +
              `${formatCanonicalPaymentStatus(canonicalStatus)}`
          );
          (retryError as any).x402PaymentStatus = canonicalStatus;
          (retryError as any).x402PaymentDecision = decision;
        } else {
          const settleDetails = error.response?.data
            ? ` Settlement response: ${JSON.stringify(error.response.data)}`
            : "";
          retryError = new Error(
            `Payment retry limit exceeded (max 1 attempt). The endpoint returned 402 again after payment, and no canonical payment status was available.${settleDetails}`
          );
        }

        (retryError as any).config = error.config;
        return Promise.reject(retryError);
      }

      // Increment counter and pass through to the native payment interceptor
      paymentAttempts.set(axiosInstance, attempts + 1);
      return Promise.reject(error);
    }
  );

  // Interceptor 2 (FIFO): native x402 payment handler.
  // Decodes payment requirements, builds a sponsored signed transaction, encodes the
  // PaymentPayloadV2 into the payment-signature header, and retries the original request.
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status !== 402) {
        return Promise.reject(error);
      }

      try {
        // Decode payment requirements from header
        const headerValue = error.response?.headers?.[X402_HEADERS.PAYMENT_REQUIRED];
        const paymentRequired = decodePaymentRequired(headerValue);

        if (!paymentRequired || !paymentRequired.accepts || paymentRequired.accepts.length === 0) {
          return Promise.reject(
            new Error("Invalid x402 402 response: missing or empty payment-required header")
          );
        }

        // Select first Stacks-compatible payment option
        const selectedOption = paymentRequired.accepts.find(
          (opt) => opt.network?.startsWith("stacks:")
        );

        if (!selectedOption) {
          const networks = paymentRequired.accepts.map((a) => a.network).join(", ");
          return Promise.reject(
            new Error(`No compatible Stacks payment option found. Available networks: ${networks}`)
          );
        }

        // Lazy-load account on first 402 — free endpoints never reach here
        const acct = await ensureAccount();

        // Verify the payment network matches our configured network
        const paymentNetwork = getNetworkFromStacksChainId(selectedOption.network);
        if (paymentNetwork && paymentNetwork !== acct.network) {
          return Promise.reject(
            new Error(
              `Network mismatch: endpoint requires ${paymentNetwork} but wallet is configured for ${acct.network}. ` +
              `Switch to a ${paymentNetwork} wallet or use a ${acct.network} endpoint.`
            )
          );
        }

        // Invoke pre-payment callback (e.g. balance check) before signing/broadcasting.
        // If the callback throws, the payment is aborted and the error propagates to the caller.
        if (options?.onBeforePayment) {
          await options.onBeforePayment({
            amount: selectedOption.amount,
            asset: selectedOption.asset,
            recipient: selectedOption.payTo,
            network: paymentNetwork ?? acct.network,
            account: acct,
          });
        }

        // Build a sponsored signed transaction (relay pays gas; fee: 0n)
        const tokenType = detectTokenType(selectedOption.asset);
        const amount = BigInt(selectedOption.amount);
        const networkName = getStacksNetwork(acct.network);

        let transaction;
        if (tokenType === "sBTC") {
          const contracts = getContracts(acct.network);
          const { address: contractAddress, name: contractName } = parseContractId(
            contracts.SBTC_TOKEN
          );

          transaction = await makeContractCall({
            contractAddress,
            contractName,
            functionName: "transfer",
            functionArgs: [
              uintCV(amount),
              principalCV(acct.address),
              principalCV(selectedOption.payTo),
              noneCV(),
            ],
            senderKey: acct.privateKey,
            network: networkName,
            postConditionMode: PostConditionMode.Allow,
            sponsored: true,
            fee: 0n,
          });
        } else {
          transaction = await makeSTXTokenTransfer({
            recipient: selectedOption.payTo,
            amount,
            senderKey: acct.privateKey,
            network: networkName,
            memo: "",
            sponsored: true,
            fee: 0n,
          });
        }

        const txHex = "0x" + transaction.serialize();

        // Generate a stable idempotency key for this logical request.
        // The relay uses it to deduplicate retries without requiring tx hex variation.
        const paymentId = generatePaymentId();

        // Encode PaymentPayloadV2 into payment-signature header
        const encodedPayload = encodePaymentPayload({
          x402Version: 2,
          resource: paymentRequired.resource,
          accepted: selectedOption,
          payload: { transaction: txHex },
          extensions: buildPaymentIdentifierExtension(paymentId),
        });
        emitPaymentLog("payment.accepted", {
          tool: toolName,
          paymentId,
          action: "payment_submitted",
          compatShimUsed: false,
        });

        // Retry the original request with the payment header
        const originalRequest = error.config;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers[X402_HEADERS.PAYMENT_SIGNATURE] = encodedPayload;

        return axiosInstance.request(originalRequest);
      } catch (paymentError) {
        return Promise.reject(
          new Error(
            `x402 payment failed: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`
          )
        );
      }
    }
  );

  return axiosInstance;
}

/**
 * Create a plain axios client without payment interceptor.
 * Used for known-free endpoints where 402 responses should fail, not auto-pay.
 */
export function createPlainClient(baseUrl?: string): AxiosInstance {
  return createBaseAxiosInstance(baseUrl);
}

/**
 * Get wallet address - checks managed wallet first, then env mnemonic
 */
export async function getWalletAddress(): Promise<string> {
  const account = await getAccount();
  return account.address;
}

/**
 * Get account - checks managed wallet first, then env mnemonic
 */
export async function getAccount(): Promise<Account> {
  // Check managed wallet session first
  const walletManager = getWalletManager();
  const sessionAccount = walletManager.getActiveAccount();

  if (sessionAccount) {
    return sessionAccount;
  }

  // Fall back to environment mnemonic
  const mnemonic = process.env.CLIENT_MNEMONIC || "";
  if (!mnemonic) {
    throw new Error(
      "No wallet available. Either unlock a managed wallet (wallet_unlock) " +
        "or set CLIENT_MNEMONIC environment variable."
    );
  }
  return mnemonicToAccount(mnemonic, NETWORK);
}

/**
 * Probe result types
 */
export type ProbeResultFree = {
  type: 'free';
  data: unknown;
};

export type ProbeResultPaymentRequired = {
  type: 'payment_required';
  amount: string;
  asset: string;
  recipient: string;
  network: string;
  endpoint: string;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  maxTimeoutSeconds?: number;
};

export type ProbeResult = ProbeResultFree | ProbeResultPaymentRequired;

/**
 * Detect token type from asset identifier
 * @param asset - Full contract identifier or token name
 * @returns 'STX' for native STX, 'sBTC' for sBTC token
 */
export function detectTokenType(asset: string): 'STX' | 'sBTC' {
  const assetLower = asset.trim().toLowerCase();
  // Treat as sBTC if the asset is exactly "sbtc" (token name),
  // a full contract identifier ending with "::token-sbtc",
  // or a contract identifier ending with ".sbtc-token"
  if (assetLower === 'sbtc' || assetLower.endsWith('::token-sbtc') || assetLower.endsWith('.sbtc-token')) {
    return 'sBTC';
  }
  return 'STX';
}

/**
 * Format payment amount into human-readable string with token symbol
 * @param amount - Raw amount string (microSTX or satoshis)
 * @param asset - Token asset identifier
 * @returns Formatted string like "0.000001 sBTC" or "0.001 STX"
 */
export function formatPaymentAmount(amount: string, asset: string): string {
  const tokenType = detectTokenType(asset);
  if (tokenType === 'sBTC') {
    return formatSbtc(amount);
  }
  return formatStx(amount);
}

/**
 * Probe an endpoint without payment interceptor
 * Returns either free response data or payment requirements
 */
export async function probeEndpoint(options: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  params?: Record<string, string>;
  data?: Record<string, unknown>;
}): Promise<ProbeResult> {
  const { method, url, params, data } = options;
  const axiosInstance = createBaseAxiosInstance();

  try {
    const response = await axiosInstance.request({ method, url, params, data });

    // 200 response - free endpoint
    return {
      type: 'free',
      data: response.data,
    };
  } catch (error) {
    const axiosError = error as { response?: { status?: number; data?: unknown; headers?: Record<string, string> } };

    // 402 Payment Required - parse payment info
    if (axiosError.response?.status === 402) {
      // Try to parse v2 payment-required header first
      const headerValue = axiosError.response.headers?.[X402_HEADERS.PAYMENT_REQUIRED];
      const paymentRequired = decodePaymentRequired(headerValue);

      // If v2 header is successfully parsed, use it
      if (paymentRequired?.accepts?.length) {
        const acceptedPayment = paymentRequired.accepts[0];

        // Convert CAIP-2 network identifier to human-readable format
        const network = getNetworkFromStacksChainId(acceptedPayment.network) ?? NETWORK;

        return {
          type: 'payment_required',
          amount: acceptedPayment.amount,
          asset: acceptedPayment.asset,
          recipient: acceptedPayment.payTo,
          network,
          endpoint: url,
          resource: paymentRequired.resource,
          maxTimeoutSeconds: acceptedPayment.maxTimeoutSeconds,
        };
      }

      // Fall back to v1 body parsing
      const paymentData = axiosError.response.data as {
        amount?: string;
        asset?: string;
        recipient?: string;
        network?: string;
      };

      if (!paymentData.amount || !paymentData.asset || !paymentData.recipient || !paymentData.network) {
        const headerDebug = headerValue !== undefined && headerValue !== null
          ? `present (length=${String(headerValue).length})`
          : 'missing';
        throw new Error(
          `Invalid 402 response from ${url}: missing payment fields in both v2 header and v1 body. ` +
          `v2 header: ${headerDebug}; v1 body keys: ${Object.keys(paymentData as object).join(', ') || 'none'}`
        );
      }

      return {
        type: 'payment_required',
        amount: paymentData.amount,
        asset: paymentData.asset,
        recipient: paymentData.recipient,
        network: paymentData.network,
        endpoint: url,
      };
    }

    // Other errors - propagate
    if (axiosError.response) {
      throw new Error(
        `HTTP ${axiosError.response.status} from ${url}: ${JSON.stringify(axiosError.response.data)}`
      );
    }

    throw error;
  }
}

/**
 * Generate a stable deduplication key for a request
 */
export function generateDedupKey(
  method: string,
  url: string,
  params?: Record<string, string>,
  data?: Record<string, unknown>
): string {
  const payload = JSON.stringify({ method, url, params, data });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Check if a request was recently processed (within 60s)
 * @returns txid if duplicate found, null otherwise
 */
export function checkDedupCache(key: string): string | null {
  const cached = dedupCache.get(key);
  if (!cached) {
    return null;
  }
  const now = Date.now();
  if (now - cached.timestamp > 60000) {
    dedupCache.delete(key);
    return null;
  }
  return cached.txid;
}

/**
 * Record a transaction in the dedup cache
 */
export function recordTransaction(key: string, txid: string): void {
  dedupCache.set(key, { txid, timestamp: Date.now() });
}

/**
 * Check if account has sufficient balance to pay for x402 endpoint.
 * @throws InsufficientBalanceError if balance is too low
 */
export async function checkSufficientBalance(
  account: Account,
  amount: string,
  asset: string,
  sponsored = false
): Promise<void> {
  const tokenType = detectTokenType(asset);
  const requiredAmount = BigInt(amount);

  if (tokenType === 'sBTC') {
    const sbtcService = getSbtcService(account.network);
    const balanceInfo = await sbtcService.getBalance(account.address);
    const balance = BigInt(balanceInfo.balance);

    if (balance < requiredAmount) {
      const shortfall = requiredAmount - balance;
      throw new InsufficientBalanceError(
        `Insufficient sBTC balance: need ${formatSbtc(amount)}, have ${formatSbtc(balanceInfo.balance)} (shortfall: ${formatSbtc(shortfall.toString())}). ` +
        `Deposit more sBTC via the bridge at https://bridge.stx.eco or use a different wallet.`,
        'sBTC',
        balanceInfo.balance,
        amount,
        shortfall.toString()
      );
    }

    // sBTC transfers are contract calls that also require STX for gas fees,
    // unless the transaction is sponsored (relay pays gas; fee: 0n).
    if (!sponsored) {
      const hiroApiForSbtc = getHiroApi(account.network);
      const stxInfoForSbtc = await hiroApiForSbtc.getStxBalance(account.address);
      const stxBalanceForSbtc = BigInt(stxInfoForSbtc.balance);
      const sbtcFees = await hiroApiForSbtc.getMempoolFees();
      const estimatedSbtcFee = BigInt(sbtcFees.contract_call.high_priority);

      if (stxBalanceForSbtc < estimatedSbtcFee) {
        const stxShortfall = estimatedSbtcFee - stxBalanceForSbtc;
        throw new InsufficientBalanceError(
          `Insufficient STX balance to cover sBTC transfer fee: need ${formatStx(estimatedSbtcFee.toString())} estimated fee, ` +
          `have ${formatStx(stxInfoForSbtc.balance)} (shortfall: ${formatStx(stxShortfall.toString())}). ` +
          `Deposit more STX or use a different wallet.`,
          'STX',
          stxInfoForSbtc.balance,
          estimatedSbtcFee.toString(),
          stxShortfall.toString()
        );
      }
    }

    return;
  }

  // STX: include estimated fee in the required amount
  const hiroApi = getHiroApi(account.network);
  const balanceInfo = await hiroApi.getStxBalance(account.address);
  const balance = BigInt(balanceInfo.balance);

  let totalRequired = requiredAmount;
  if (!sponsored) {
    const mempoolFees = await hiroApi.getMempoolFees();
    const estimatedFee = BigInt(mempoolFees.contract_call.high_priority);
    totalRequired = requiredAmount + estimatedFee;
  }

  if (balance >= totalRequired) return;

  const shortfall = totalRequired - balance;
  throw new InsufficientBalanceError(
    `Insufficient STX balance: need ${formatStx(totalRequired.toString())} (${formatStx(amount)} payment${!sponsored ? ` + estimated fee` : ''}), ` +
    `have ${formatStx(balanceInfo.balance)} (shortfall: ${formatStx(shortfall.toString())}). ` +
    `Deposit more STX or use a different wallet.`,
    'STX',
    balanceInfo.balance,
    totalRequired.toString(),
    shortfall.toString()
  );
}

export { NETWORK, API_URL };
