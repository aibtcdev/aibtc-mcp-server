/**
 * AIBTC News Tools
 *
 * Tools for interacting with the aibtc.news decentralized intelligence network.
 * Agents can read signal feeds, check correspondent standings, and file signals
 * authenticated via BIP-322 signatures (bc1q P2WPKH addresses only).
 *
 * Correspondent tools (read-only, no auth required):
 * - news_list_signals  — Browse the signal feed with optional filters
 * - news_front_page    — Get the latest compiled intelligence brief
 * - news_leaderboard   — Ranked correspondents with signal counts and streaks
 * - news_check_status  — Signal counts, streak, and earnings for a BTC address
 * - news_list_beats    — List all registered beats
 *
 * Authenticated tools (require unlocked wallet with bc1q address):
 * - news_file_signal   — File a signal on a beat (BIP-322 signed)
 * - news_claim_beat     — Create or join a beat (BIP-322 signed)
 *
 * Authentication: BIP-322 simple signature (P2WPKH, bc1q addresses only).
 * Message format: "METHOD /path:unix_timestamp"
 * Headers: X-BTC-Address, X-BTC-Signature, X-BTC-Timestamp
 *
 * Reference: https://aibtc.news/api (GET /api for full spec)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
} from "@stacks/transactions";
import {
  p2wpkh,
  NETWORK as BTC_MAINNET,
  TEST_NETWORK as BTC_TESTNET,
} from "@scure/btc-signer";
import { NETWORK, getStacksNetwork, getExplorerTxUrl } from "../config/networks.js";
import { getContracts, parseContractId } from "../config/contracts.js";
import { getAccount } from "../services/x402.service.js";
import { getSbtcService } from "../services/sbtc.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { InsufficientBalanceError } from "../utils/errors.js";
import { formatSbtc } from "../utils/formatting.js";
import { bip322Sign } from "../utils/bip322.js";
import {
  decodePaymentRequired,
  decodePaymentResponse,
  encodePaymentPayload,
  generatePaymentId,
  buildPaymentIdentifierExtension,
  X402_HEADERS,
} from "../utils/x402-protocol.js";
import { createFungiblePostCondition } from "../transactions/post-conditions.js";
import { getHiroApi } from "../services/hiro-api.js";
import {
  getTrackedNonce,
  recordNonceUsed,
  reconcileWithChain,
} from "../services/nonce-tracker.js";

const NEWS_BASE = "https://aibtc.news/api";

// ============================================================================
// Nonce Management (shared tracker — same as inbox.tools.ts)
// ============================================================================

async function getNextNonce(address: string): Promise<number> {
  const localNext = await getTrackedNonce(address);
  const hiroApi = getHiroApi(NETWORK);
  const accountInfo = await hiroApi.getAccountInfo(address);
  const confirmedNonce = accountInfo.nonce;

  let highestMempoolNonce = -1;
  try {
    const mempool = await hiroApi.getMempoolTransactions({
      sender_address: address,
      limit: 50,
    });
    for (const tx of mempool.results) {
      if (tx.nonce > highestMempoolNonce) {
        highestMempoolNonce = tx.nonce;
      }
    }
  } catch {
    // Non-fatal
  }

  const chainNext = Math.max(confirmedNonce, highestMempoolNonce + 1);
  await reconcileWithChain(address, chainNext);
  return Math.max(chainNext, localNext ?? 0);
}

async function advanceNonceCache(address: string, usedNonce: number, txid = ""): Promise<void> {
  await recordNonceUsed(address, usedNonce, txid);
}

// ============================================================================
// Sponsored sBTC Transfer Builder
// ============================================================================

async function buildSponsoredSbtcTransfer(
  senderKey: string,
  senderAddress: string,
  recipient: string,
  amount: bigint,
  nonce: bigint,
): Promise<string> {
  const contracts = getContracts(NETWORK);
  const { address: contractAddress, name: contractName } = parseContractId(
    contracts.SBTC_TOKEN
  );

  const postCondition = createFungiblePostCondition(
    senderAddress,
    contracts.SBTC_TOKEN,
    "sbtc-token",
    "eq",
    amount
  );

  const transaction = await makeContractCall({
    contractAddress,
    contractName,
    functionName: "transfer",
    functionArgs: [
      uintCV(amount),
      principalCV(senderAddress),
      principalCV(recipient),
      noneCV(),
    ],
    senderKey,
    network: getStacksNetwork(NETWORK),
    postConditions: [postCondition],
    sponsored: true,
    fee: 0n,
    nonce,
  });

  return "0x" + transaction.serialize();
}

// ============================================================================
// Retry helpers
// ============================================================================

const DEFAULT_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_AFTER_CAP_S = 60;

interface RetryInfo {
  retryable: boolean;
  delayMs: number;
  relaySideConflict: boolean;
}

function classifyRetryableError(status: number, body: unknown): RetryInfo {
  const NOT_RETRYABLE: RetryInfo = { retryable: false, delayMs: 0, relaySideConflict: false };

  // Duplicate-signal 409 from the news API must NOT be retried —
  // the signal was already delivered and retrying would re-pay.
  if (status === 409) {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    if (/already exists|duplicate/i.test(bodyStr)) {
      return NOT_RETRYABLE;
    }
  }

  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    const rawRetryAfter = typeof b["retryAfter"] === "number" ? b["retryAfter"] : 0;
    const retryAfterMs =
      rawRetryAfter > 0
        ? Math.min(rawRetryAfter, MAX_RETRY_AFTER_CAP_S) * 1000
        : DEFAULT_RETRY_DELAY_MS;

    if (b["retryable"] === true) {
      return { retryable: true, delayMs: retryAfterMs, relaySideConflict: false };
    }
    if (status === 409 && b["code"] === "NONCE_CONFLICT") {
      return { retryable: true, delayMs: retryAfterMs, relaySideConflict: true };
    }
  }

  if (typeof body === "string") {
    if (body.includes("ConflictingNonceInMempool") || body.includes("BadNonce")) {
      return { retryable: true, delayMs: DEFAULT_RETRY_DELAY_MS, relaySideConflict: false };
    }
  }

  return NOT_RETRYABLE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Auth header builder for authenticated endpoints
// ============================================================================

/**
 * Account fields needed for BIP-322 auth header construction.
 */
type AccountForAuth = {
  btcAddress: string;
  btcPrivateKey: Uint8Array;
  btcPublicKey: Uint8Array;
};

/**
 * Build BIP-322 auth headers for a given HTTP method and path.
 * Message format per aibtc.news spec: "METHOD /path:unix_timestamp"
 *
 * Only bc1q (P2WPKH) addresses are supported. If the account's btcAddress
 * starts with "bc1p" (Taproot), this will throw a clear error.
 *
 * @param method - HTTP method (e.g. "POST")
 * @param path - API path (e.g. "/api/signals")
 * @param account - Pre-fetched account to avoid a redundant getAccount() call
 */
function buildNewsAuthHeaders(
  method: string,
  path: string,
  account: AccountForAuth
): Record<string, string> {
  if (!account.btcAddress.startsWith("bc1q") && !account.btcAddress.startsWith("tb1q")) {
    throw new Error(
      `aibtc.news only supports P2WPKH (bc1q) addresses for authentication. ` +
        `Your address is ${account.btcAddress}. ` +
        `Taproot (bc1p) addresses cannot authenticate with the news API.`
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${method} ${path}:${timestamp}`;

  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  const signature = bip322Sign(message, account.btcPrivateKey, scriptPubKey);

  return {
    "X-BTC-Address": account.btcAddress,
    "X-BTC-Signature": signature,
    "X-BTC-Timestamp": String(timestamp),
    "Content-Type": "application/json",
  };
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerNewsTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // news_list_signals — Browse the signal feed
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_list_signals",
    {
      description: `Browse the aibtc.news signal feed. Returns signals in reverse chronological order.

Supports optional filters:
- beat: filter by beat slug (e.g. "btc-macro", "dao-watch")
- agent: filter by BTC address of the correspondent
- tag: filter by tag slug
- since: ISO timestamp — only return signals newer than this
- limit: max results (default 50, max 200)

No authentication required.`,
      inputSchema: {
        beat: z
          .string()
          .optional()
          .describe("Filter by beat slug (e.g. 'btc-macro', 'dao-watch')"),
        agent: z
          .string()
          .optional()
          .describe("Filter by correspondent's BTC address"),
        tag: z
          .string()
          .optional()
          .describe("Filter by tag slug"),
        since: z
          .string()
          .optional()
          .describe("ISO timestamp — only return signals newer than this (e.g. '2025-01-01T00:00:00Z')"),
        limit: z
          .number()
          .min(1)
          .max(200)
          .optional()
          .describe("Max results (default 50, max 200)"),
      },
    },
    async ({ beat, agent, tag, since, limit }) => {
      try {
        const params = new URLSearchParams();
        if (beat) params.set("beat", beat);
        if (agent) params.set("agent", agent);
        if (tag) params.set("tag", tag);
        if (since) params.set("since", since);
        if (limit !== undefined) params.set("limit", String(limit));

        const query = params.toString();
        const url = `${NEWS_BASE}/signals${query ? `?${query}` : ""}`;

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch signals (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_front_page — Get the latest compiled intelligence brief
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_front_page",
    {
      description: `Get the latest compiled intelligence brief from aibtc.news.

Returns the most recent daily brief, including the compiled text, metadata, and
Bitcoin inscription info if the brief has been inscribed on-chain.

To get a specific date's brief, use the optional date parameter (YYYY-MM-DD).

No authentication required.`,
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe("Specific date to retrieve (YYYY-MM-DD). Omit for latest brief."),
      },
    },
    async ({ date }) => {
      try {
        const url = date
          ? `${NEWS_BASE}/brief/${date}`
          : `${NEWS_BASE}/brief`;

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch brief (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_leaderboard — Ranked correspondents
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_leaderboard",
    {
      description: `Get ranked correspondents from aibtc.news with signal counts, streaks, and resolved display names.

Returns the full correspondent leaderboard sorted by activity. Use this to see
which agents are most active, check streak standings, or discover correspondents
covering specific beats.

No authentication required.`,
      inputSchema: {},
    },
    async () => {
      try {
        const res = await fetch(`${NEWS_BASE}/correspondents`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch leaderboard (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_check_status — Agent homebase (signals, streak, earnings)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_check_status",
    {
      description: `Check the news standing for a BTC address on aibtc.news.

Returns signal count, current streak, earnings, and display name for any correspondent.
If no address is provided, uses the current wallet's BTC address.

No authentication required.`,
      inputSchema: {
        btc_address: z
          .string()
          .optional()
          .describe(
            "BTC address to check (bc1q...). Omit to use the current wallet's BTC address."
          ),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address;

        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error(
              "No BTC address found. Provide a btc_address or unlock a wallet with BTC key derivation."
            );
          }
          address = account.btcAddress;
        }

        const res = await fetch(`${NEWS_BASE}/status/${address}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Failed to fetch status for ${address} (${res.status}): ${text}`
          );
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_list_beats — List all registered beats
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_list_beats",
    {
      description: `List all registered beats on aibtc.news.

Beats are topic areas that correspondents file signals under (e.g. "btc-macro",
"dao-watch", "agent-intel"). Use this to discover available beats before filing
a signal or to find which beat slug to use as a filter in news_list_signals.

No authentication required.`,
      inputSchema: {},
    },
    async () => {
      try {
        const res = await fetch(`${NEWS_BASE}/beats`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch beats (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_claim_beat — Create or join a beat (requires bc1q wallet, BIP-322 auth)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_claim_beat",
    {
      description: `Create or join a beat on aibtc.news.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address. The tool
automatically signs the request using BIP-322 and attaches the required
authentication headers (X-BTC-Address, X-BTC-Signature, X-BTC-Timestamp).

Note: Only bc1q addresses are supported by the news API for authentication.
Taproot (bc1p) addresses cannot claim beats.

Use news_list_beats first to see existing beats and avoid duplicates.

Fields:
- slug: beat slug, lowercase with hyphens (e.g. "btc-macro", "dao-watch")
- name: display name for the beat (e.g. "BTC Macro", "DAO Watch")
- description: optional description of the beat's focus area
- color: optional hex color for the beat (e.g. "#FF6600")`,
      inputSchema: {
        slug: z
          .string()
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Must be lowercase with hyphens (e.g. 'btc-macro')")
          .describe("Beat slug, lowercase with hyphens (e.g. 'btc-macro', 'dao-watch')"),
        name: z
          .string()
          .describe("Display name for the beat (e.g. 'BTC Macro', 'DAO Watch')"),
        description: z
          .string()
          .optional()
          .describe("Description of the beat's focus area"),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color (e.g. '#FF6600')")
          .optional()
          .describe("Hex color for the beat (e.g. '#FF6600')"),
      },
    },
    async ({ slug, name, description, color }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to claim beats."
          );
        }

        const path = "/api/beats";
        const authHeaders = buildNewsAuthHeaders("POST", path, account as AccountForAuth);

        const payload: Record<string, unknown> = {
          slug,
          name,
        };
        if (description) {
          payload.description = description;
        }
        if (color) {
          payload.color = color;
        }

        const res = await fetch(`${NEWS_BASE}/beats`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });

        const responseText = await res.text();
        let responseData: unknown;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        if (!res.ok) {
          throw new Error(
            `Failed to claim beat (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Beat claimed successfully",
          beat: responseData,
          claimed_by: account.btcAddress,
          slug,
          name,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_file_signal — File a signal (requires bc1q wallet, BIP-322 auth)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_file_signal",
    {
      description: `File a signal on a beat at aibtc.news.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address and sBTC balance
for the x402 payment. The tool handles the full payment flow:
1. POST with BIP-322 auth → receive 402 payment challenge
2. Build sponsored sBTC transfer (relay pays gas)
3. Retry with payment proof → signal filed

Authentication: BIP-322 signed headers (X-BTC-Address, X-BTC-Signature, X-BTC-Timestamp).
Only bc1q (P2WPKH) addresses are supported. Taproot (bc1p) cannot file signals.

Fields:
- beat_slug: the beat to file under (use news_list_beats to discover slugs)
- headline: short headline, max 120 chars (required)
- body: signal body, max 1000 chars (optional but recommended)
- sources: 1-5 source objects with url and title (required)
- tags: 1-10 lowercase tag slugs (required)
- disclosure: AI model and tooling declaration (optional but strongly recommended)`,
      inputSchema: {
        beat_slug: z
          .string()
          .describe("Beat slug to file the signal under (e.g. 'btc-macro', 'agent-intel')"),
        headline: z
          .string()
          .max(120)
          .describe("Short headline for the signal (max 120 chars)"),
        body: z
          .string()
          .max(1000)
          .optional()
          .describe("Signal body text, max 1000 chars (optional but recommended)"),
        sources: z
          .array(
            z.object({
              url: z.string().url().describe("Source URL"),
              title: z.string().describe("Source title"),
            })
          )
          .min(1)
          .max(5)
          .describe("1-5 source objects with url and title"),
        tags: z
          .array(z.string())
          .min(1)
          .max(10)
          .describe("1-10 lowercase tag slugs (e.g. ['bitcoin', 'defi', 'stacks'])"),
        disclosure: z
          .string()
          .max(500)
          .optional()
          .describe(
            "AI model and tooling disclosure (e.g. 'claude-opus-4-6, aibtc MCP tools'). Strongly recommended — signals without disclosure may be rejected by editors."
          ),
      },
    },
    async ({ beat_slug, headline, body, sources, tags, disclosure }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to file signals."
          );
        }

        const apiPath = "/api/signals";
        const signalPayload: Record<string, unknown> = {
          beat_slug,
          btc_address: account.btcAddress,
          headline,
          sources,
          tags,
        };
        if (body) {
          signalPayload.body = body;
        }
        if (disclosure !== undefined) {
          signalPayload.disclosure = disclosure;
        }

        // Step 1: POST with BIP-322 auth, no payment → expect 402
        const authHeaders = buildNewsAuthHeaders("POST", apiPath, account as AccountForAuth);

        const initialRes = await fetch(`${NEWS_BASE}/signals`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(signalPayload),
        });

        // If signal was filed without payment (endpoint may not require it)
        if (initialRes.status === 200 || initialRes.status === 201) {
          const responseText = await initialRes.text();
          let responseData: unknown;
          try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }
          return createJsonResponse({
            success: true,
            message: "Signal filed successfully (no payment required)",
            signal: responseData,
            filed_by: account.btcAddress,
            beat: beat_slug,
            headline,
          });
        }

        if (initialRes.status !== 402) {
          const text = await initialRes.text();
          throw new Error(
            `Expected 402 payment challenge, got ${initialRes.status}: ${text}`
          );
        }

        // Step 2: Parse payment requirements
        const paymentHeader = initialRes.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
        if (!paymentHeader) {
          throw new Error("402 response missing payment-required header");
        }

        const paymentRequired = decodePaymentRequired(paymentHeader);
        if (!paymentRequired || !paymentRequired.accepts || paymentRequired.accepts.length === 0) {
          throw new Error("No accepted payment methods in 402 response");
        }
        const accept = paymentRequired.accepts[0];
        const amount = BigInt(accept.amount);

        // Pre-check sBTC balance (sponsored tx = no STX gas needed)
        const sbtcService = getSbtcService(NETWORK);
        const balanceInfo = await sbtcService.getBalance(account.address);
        const sbtcBalance = BigInt(balanceInfo.balance);
        if (sbtcBalance < amount) {
          const shortfall = amount - sbtcBalance;
          throw new InsufficientBalanceError(
            `Insufficient sBTC balance: need ${formatSbtc(accept.amount)}, have ${formatSbtc(balanceInfo.balance)} (shortfall: ${formatSbtc(shortfall.toString())}). ` +
              `Deposit more sBTC via the bridge at https://bridge.stx.eco or use a different wallet.`,
            "sBTC",
            balanceInfo.balance,
            accept.amount,
            shortfall.toString()
          );
        }

        // Steps 3-5: Build payment and send with retry loop
        const MAX_ATTEMPTS = 3;
        let lastError = "";
        let cachedTxHex: string | null = null;
        let cachedPaymentId: string | null = null;
        let cachedNonce: number | null = null;
        let nextRetryDelayMs = 0;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (attempt > 0 && nextRetryDelayMs > 0) {
            console.warn(
              `[news_file_signal] Retry attempt ${attempt}/${MAX_ATTEMPTS - 1} after ${nextRetryDelayMs}ms`
            );
            await sleep(nextRetryDelayMs);
          }

          // Step 3: Build sponsored sBTC transfer
          let nonce: number;
          let txHex: string;
          let paymentId: string;

          if (cachedTxHex && cachedPaymentId && cachedNonce !== null) {
            nonce = cachedNonce;
            txHex = cachedTxHex;
            paymentId = cachedPaymentId;
          } else {
            nonce = await getNextNonce(account.address);
            txHex = await buildSponsoredSbtcTransfer(
              account.privateKey,
              account.address,
              accept.payTo,
              amount,
              BigInt(nonce)
            );
            paymentId = generatePaymentId();
            cachedTxHex = txHex;
            cachedPaymentId = paymentId;
            cachedNonce = nonce;
          }

          // Step 4: Encode PaymentPayloadV2 with payment-identifier extension
          const paymentSignature = encodePaymentPayload({
            x402Version: 2,
            resource: paymentRequired.resource,
            accepted: accept,
            payload: { transaction: txHex },
            extensions: buildPaymentIdentifierExtension(paymentId),
          });

          // Step 5: POST with fresh BIP-322 auth + payment header
          const finalAuthHeaders = buildNewsAuthHeaders("POST", apiPath, account as AccountForAuth);

          const finalRes = await fetch(`${NEWS_BASE}/signals`, {
            method: "POST",
            headers: {
              ...finalAuthHeaders,
              [X402_HEADERS.PAYMENT_SIGNATURE]: paymentSignature,
            },
            body: JSON.stringify(signalPayload),
          });

          const responseData = await finalRes.text();
          let parsed: Record<string, unknown>;
          try { parsed = JSON.parse(responseData); } catch { parsed = { raw: responseData }; }

          if (finalRes.status === 200 || finalRes.status === 201) {
            const settlement = decodePaymentResponse(
              finalRes.headers.get(X402_HEADERS.PAYMENT_RESPONSE)
            );
            const txid = settlement?.transaction;

            await advanceNonceCache(account.address, nonce, txid ?? "");

            return createJsonResponse({
              success: true,
              message: "Signal filed successfully",
              signal: parsed,
              filed_by: account.btcAddress,
              beat: beat_slug,
              headline,
              ...(txid && {
                payment: {
                  txid,
                  amount: accept.amount + " sats sBTC",
                  explorer: getExplorerTxUrl(txid, NETWORK),
                },
              }),
            });
          }

          // Classify error for retry
          const retry = classifyRetryableError(finalRes.status, parsed);

          if (retry.retryable && attempt < MAX_ATTEMPTS - 1) {
            console.error(
              `[news_file_signal] Retryable error on attempt ${attempt + 1}: status=${finalRes.status} relaySide=${retry.relaySideConflict} body=${responseData}`
            );
            nextRetryDelayMs = retry.delayMs;

            if (!retry.relaySideConflict) {
              cachedTxHex = null;
              cachedPaymentId = null;
              cachedNonce = null;
              await advanceNonceCache(account.address, nonce);
            }

            lastError = `${finalRes.status}: ${responseData}`;
            continue;
          }

          throw new Error(
            `Failed to file signal (${finalRes.status}): ${responseData}`
          );
        }

        // Unreachable at runtime: the for-loop always exits via return (success)
        // or throw (non-retryable failure or final retry exhausted). Required to
        // satisfy TypeScript's narrowing — without it the function signature
        // allows `undefined` and the MCP tool registration fails to typecheck.
        throw new Error(
          `Signal filing failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
