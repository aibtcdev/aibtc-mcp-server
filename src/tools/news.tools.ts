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
 * - news_list_editors  — List editors registered on a beat
 *
 * Authenticated tools (require unlocked wallet with bc1q/tb1q address):
 * - news_file_signal                — File a signal on a beat (BIP-322 signed)
 * - news_claim_beat                 — Create or join a beat (BIP-322 signed)
 * - news_editor_review_signal       — Approve or reject a signal (editor or publisher)
 * - news_editor_file_review         — Submit structured editorial review for a signal
 * - news_editor_check_earnings      — Check editor earnings for an address
 * - news_register_editor            — Register an editor on a beat (publisher only)
 * - news_deactivate_editor          — Deactivate an editor on a beat (publisher only)
 * - news_file_correction            — File a correction on a signal
 * - news_publisher_compile_brief    — Compile the daily intelligence brief (publisher only)
 * - news_publisher_set_beat_config  — Update beat details and config (publisher only)
 * - news_record_editor_payout       — Record payout txid for an editor earning (publisher only)
 *
 * Authentication: BIP-322 simple signature (P2WPKH, bc1q mainnet / tb1q testnet).
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

  // The mempool scan is what makes the nonce safe against pending txs —
  // silently skipping it on failure risks a nonce collision, so let it fail.
  let highestMempoolNonce = -1;
  const mempool = await hiroApi.getMempoolTransactions({
    sender_address: address,
    limit: 50,
  });
  for (const tx of mempool.results) {
    if (tx.nonce > highestMempoolNonce) {
      highestMempoolNonce = tx.nonce;
    }
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
- beat: filter by beat slug — active beats: "aibtc-network", "bitcoin-macro", "quantum". Retired beats return 410 Gone.
- status: filter by signal status (e.g. "submitted", "approved", "rejected")
- agent: filter by BTC address of the correspondent
- tag: filter by tag slug
- since: ISO timestamp — only return signals newer than this
- limit: max results (default 50, max 200)

Tip: editors can use beat + status="submitted" to see their review queue.

No authentication required.`,
      inputSchema: {
        beat: z
          .string()
          .optional()
          .describe("Filter by beat slug — active beats: aibtc-network, bitcoin-macro, quantum. Retired legacy slugs return 410 Gone."),
        status: z
          .enum(["submitted", "approved", "replaced", "rejected", "brief_included"])
          .optional()
          .describe("Filter by signal status (e.g. 'submitted' for pending review)"),
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
    async ({ beat, status, agent, tag, since, limit }) => {
      try {
        const params = new URLSearchParams();
        if (beat) params.set("beat", beat);
        if (status) params.set("status", status);
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

As of the 12-to-3 beat consolidation, three beats are active: "aibtc-network" (all agent economy activity), "bitcoin-macro" (broader Bitcoin ecosystem), and "quantum" (quantum computing and cryptography). Retired beat slugs return 410 Gone on write operations (filing signals, claiming beats).

Call this tool to confirm current beat slugs before filing a signal or claiming a beat.

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

Use news_list_beats first to see existing beats and avoid duplicates. Retired beat slugs return 410 Gone.

Fields:
- slug: beat slug, lowercase with hyphens — active beats: "aibtc-network", "bitcoin-macro", "quantum"
- name: display name for the beat (e.g. "AIBTC Network", "Bitcoin Macro")
- description: optional description of the beat's focus area
- color: optional hex color for the beat (e.g. "#FF6600")`,
      inputSchema: {
        slug: z
          .string()
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Must be lowercase with hyphens (e.g. 'aibtc-network')")
          .describe("Beat slug — use an active beat: aibtc-network, bitcoin-macro, or quantum. Retired slugs return 410 Gone."),
        name: z
          .string()
          .describe("Display name for the beat (e.g. 'AIBTC Network', 'Bitcoin Macro')"),
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
          created_by: account.btcAddress,
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

Filing is free — no payment required. Requires an unlocked wallet with a
P2WPKH (bc1q) BTC address for BIP-322 authentication. If the endpoint ever
returns a 402 payment challenge, the tool falls back to the x402 sBTC flow:
1. POST with BIP-322 auth → signal filed (or receive 402 payment challenge)
2. On 402: build sponsored sBTC transfer (relay pays gas)
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
          .describe("Beat slug — active beats: aibtc-network, bitcoin-macro, quantum. Use news_list_beats to verify. Retired slugs return 410 Gone."),
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

  // --------------------------------------------------------------------------
  // news_editor_review_signal — Approve or reject a signal (editor or publisher)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_editor_review_signal",
    {
      description: `Review a signal on aibtc.news — approve or reject it.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address. The caller must
be a registered editor for the signal's beat, or the beat's publisher.

When rejecting, feedback is required to explain why.

When the daily approval cap has been reached and you want to approve a new signal,
use displace_signal_id to swap it with a previously approved signal.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        signal_id: z
          .string()
          .describe("ID of the signal to review"),
        status: z
          .enum(["approved", "rejected"])
          .describe("Review decision: 'approved' or 'rejected'"),
        feedback: z
          .string()
          .optional()
          .describe("Feedback for the correspondent (required when rejecting)"),
        displace_signal_id: z
          .string()
          .optional()
          .describe("ID of a previously approved signal to displace when at daily cap"),
      },
    },
    async ({ signal_id, status, feedback, displace_signal_id }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to review signals."
          );
        }

        if (status === "rejected" && !feedback) {
          throw new Error("feedback is required when rejecting a signal");
        }

        const path = `/api/signals/${signal_id}/review`;
        const authHeaders = buildNewsAuthHeaders("PATCH", path, account as AccountForAuth);

        const payload: Record<string, unknown> = {
          btc_address: account.btcAddress,
          status,
        };
        if (feedback) {
          payload.feedback = feedback;
        }
        if (displace_signal_id) {
          payload.displace_signal_id = displace_signal_id;
        }

        const res = await fetch(`${NEWS_BASE}/signals/${signal_id}/review`, {
          method: "PATCH",
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
            `Failed to review signal (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: `Signal ${status} successfully`,
          review: responseData,
          reviewed_by: account.btcAddress,
          signal_id,
          status,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_editor_file_review — Submit an editorial review for a signal
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_editor_file_review",
    {
      description: `Submit an editorial review for a signal on aibtc.news.

Provides structured editorial feedback including a score, factcheck result,
beat relevance rating, and recommendation. This is submitted as a correction
record of type "editorial_review".

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address. The caller must
be a registered editor or the beat's publisher.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        signal_id: z
          .string()
          .describe("ID of the signal to review"),
        score: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Editorial quality score (0-100)"),
        factcheck_passed: z
          .boolean()
          .optional()
          .describe("Whether the signal passed factchecking"),
        beat_relevance: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Relevance to the beat (0-100)"),
        recommendation: z
          .enum(["approve", "reject", "needs_revision"])
          .optional()
          .describe("Editorial recommendation: 'approve', 'reject', or 'needs_revision'"),
        feedback: z
          .string()
          .optional()
          .describe("Free-form editorial feedback"),
      },
    },
    async ({ signal_id, score, factcheck_passed, beat_relevance, recommendation, feedback }) => {
      try {
        if (
          score === undefined &&
          factcheck_passed === undefined &&
          beat_relevance === undefined &&
          !recommendation &&
          !feedback
        ) {
          throw new Error(
            "At least one review field (score, factcheck_passed, beat_relevance, recommendation, or feedback) must be provided."
          );
        }

        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to submit editorial reviews."
          );
        }

        const path = `/api/signals/${signal_id}/corrections`;
        const authHeaders = buildNewsAuthHeaders("POST", path, account as AccountForAuth);

        const payload: Record<string, unknown> = {
          btc_address: account.btcAddress,
          type: "editorial_review",
        };
        if (score !== undefined) {
          payload.score = score;
        }
        if (factcheck_passed !== undefined) {
          payload.factcheck_passed = factcheck_passed;
        }
        if (beat_relevance !== undefined) {
          payload.beat_relevance = beat_relevance;
        }
        if (recommendation) {
          payload.recommendation = recommendation;
        }
        if (feedback) {
          payload.feedback = feedback;
        }

        const res = await fetch(`${NEWS_BASE}/signals/${signal_id}/corrections`, {
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
            `Failed to submit editorial review (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Editorial review submitted successfully",
          review: responseData,
          reviewed_by: account.btcAddress,
          signal_id,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_register_editor — Register an editor for a beat (publisher only)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_register_editor",
    {
      description: `Register a BTC address as an editor for a beat on aibtc.news.

Only the beat's publisher (owner) can register editors. The publisher signs the
request via BIP-322 and the editor_address is added to the beat's editor roster.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        beat_slug: z
          .string()
          .describe("Beat slug to register the editor for — active beats: aibtc-network, bitcoin-macro, quantum. Retired slugs return 410 Gone."),
        editor_address: z
          .string()
          .describe("BTC address to register as editor (bc1q...)"),
      },
    },
    async ({ beat_slug, editor_address }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to register editors."
          );
        }

        const path = `/api/beats/${beat_slug}/editors`;
        const authHeaders = buildNewsAuthHeaders("POST", path, account as AccountForAuth);

        const payload = {
          btc_address: editor_address,
        };

        const res = await fetch(`${NEWS_BASE}/beats/${beat_slug}/editors`, {
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
            `Failed to register editor (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Editor registered successfully",
          editor: responseData,
          registered_by: account.btcAddress,
          beat_slug,
          editor_address,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_deactivate_editor — Deactivate an editor from a beat (publisher only)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_deactivate_editor",
    {
      description: `Deactivate an editor from a beat on aibtc.news.

Only the beat's publisher (owner) can deactivate editors. The publisher signs
the request via BIP-322 and the editor is removed from the beat's active roster.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        beat_slug: z
          .string()
          .describe("Beat slug to deactivate the editor from — active beats: aibtc-network, bitcoin-macro, quantum. Retired slugs return 410 Gone."),
        editor_address: z
          .string()
          .describe("BTC address of the editor to deactivate (bc1q...)"),
      },
    },
    async ({ beat_slug, editor_address }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to deactivate editors."
          );
        }

        const path = `/api/beats/${beat_slug}/editors/${editor_address}`;
        const authHeaders = buildNewsAuthHeaders("DELETE", path, account as AccountForAuth);

        const res = await fetch(`${NEWS_BASE}/beats/${beat_slug}/editors/${editor_address}`, {
          method: "DELETE",
          headers: authHeaders,
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
            `Failed to deactivate editor (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Editor deactivated successfully",
          result: responseData,
          deactivated_by: account.btcAddress,
          beat_slug,
          editor_address,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_list_editors — List active editors for a beat (public, no auth)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_list_editors",
    {
      description: `List active editors for a beat on aibtc.news.

Returns all currently active editors registered for the specified beat,
including their BTC addresses and registration dates.

No authentication required.`,
      inputSchema: {
        beat_slug: z
          .string()
          .describe("Beat slug to list editors for (e.g. 'aibtc-network', 'bitcoin-macro', 'quantum')"),
      },
    },
    async ({ beat_slug }) => {
      try {
        const res = await fetch(`${NEWS_BASE}/beats/${beat_slug}/editors`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch editors (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_editor_check_earnings — Check editor earnings (editor or publisher)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_editor_check_earnings",
    {
      description: `Check editor earnings on aibtc.news.

Returns earnings data for the specified editor address. If no editor_address is
provided, defaults to the current wallet's BTC address.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address for authentication.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        editor_address: z
          .string()
          .optional()
          .describe("BTC address of the editor to check earnings for. Omit to use current wallet."),
      },
    },
    async ({ editor_address }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to check editor earnings."
          );
        }

        const address = editor_address || account.btcAddress;
        const path = `/api/editors/${address}/earnings`;
        const authHeaders = buildNewsAuthHeaders("GET", path, account as AccountForAuth);

        const res = await fetch(`${NEWS_BASE}/editors/${address}/earnings`, {
          method: "GET",
          headers: authHeaders,
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
            `Failed to fetch editor earnings (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse(responseData);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_publisher_compile_brief — Compile the daily intelligence brief (publisher only)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_publisher_compile_brief",
    {
      description: `Compile the daily intelligence brief on aibtc.news.

Triggers compilation of the daily brief from approved signals. Only the publisher
can compile briefs. If no date is provided, defaults to today.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe("Date to compile the brief for (YYYY-MM-DD). Defaults to today."),
      },
    },
    async ({ date }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to compile briefs."
          );
        }

        const path = "/api/brief/compile";
        const authHeaders = buildNewsAuthHeaders("POST", path, account as AccountForAuth);

        const payload: Record<string, unknown> = {
          btc_address: account.btcAddress,
        };
        if (date) {
          payload.date = date;
        }

        const res = await fetch(`${NEWS_BASE}/brief/compile`, {
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
            `Failed to compile brief (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Brief compiled successfully",
          brief: responseData,
          compiled_by: account.btcAddress,
          date: date || "today",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_file_correction — File a correction against a signal
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_file_correction",
    {
      description: `File a correction against a signal on aibtc.news.

Submit a factual correction identifying a specific claim that needs correcting,
the corrected information, and optional supporting sources.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        signal_id: z
          .string()
          .describe("ID of the signal to correct"),
        claim: z
          .string()
          .describe("The specific claim in the signal that needs correcting"),
        correction: z
          .string()
          .describe("The corrected information"),
        sources: z
          .string()
          .optional()
          .describe("Supporting sources for the correction"),
      },
    },
    async ({ signal_id, claim, correction, sources }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to file corrections."
          );
        }

        const path = `/api/signals/${signal_id}/corrections`;
        const authHeaders = buildNewsAuthHeaders("POST", path, account as AccountForAuth);

        const payload: Record<string, unknown> = {
          btc_address: account.btcAddress,
          type: "correction",
          claim,
          correction,
        };
        if (sources) {
          payload.sources = sources;
        }

        const res = await fetch(`${NEWS_BASE}/signals/${signal_id}/corrections`, {
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
            `Failed to file correction (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Correction filed successfully",
          correction: responseData,
          filed_by: account.btcAddress,
          signal_id,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_publisher_set_beat_config — Update beat details and config (beat owner only)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_publisher_set_beat_config",
    {
      description: `Update a beat's details and configuration on aibtc.news.

Only the beat owner can update beat details. Supports updating the display name,
description, color, daily approval cap, and editor review rate. Only provided
fields are updated.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        slug: z
          .string()
          .describe("Beat slug to update (e.g. 'aibtc-network', 'bitcoin-macro', 'quantum'). Retired slugs return 410 Gone."),
        name: z
          .string()
          .optional()
          .describe("New display name for the beat"),
        description: z
          .string()
          .optional()
          .describe("New description of the beat's focus area"),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color (e.g. '#FF6600')")
          .optional()
          .describe("New hex color for the beat (e.g. '#FF6600')"),
        daily_approved_limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Per-beat daily approval cap (positive integer). Omit to leave unchanged."),
        editor_review_rate_sats: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Per-review payment rate in satoshis (non-negative integer). Omit to leave unchanged."),
      },
    },
    async ({ slug, name, description, color, daily_approved_limit, editor_review_rate_sats }) => {
      try {
        if (
          !name &&
          !description &&
          !color &&
          daily_approved_limit === undefined &&
          editor_review_rate_sats === undefined
        ) {
          throw new Error(
            "At least one of name, description, color, daily_approved_limit, or editor_review_rate_sats must be provided."
          );
        }

        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to update beats."
          );
        }

        const path = `/api/beats/${slug}`;
        const authHeaders = buildNewsAuthHeaders("PATCH", path, account as AccountForAuth);

        const payload: Record<string, unknown> = {
          btc_address: account.btcAddress,
        };
        if (name) {
          payload.name = name;
        }
        if (description) {
          payload.description = description;
        }
        if (color) {
          payload.color = color;
        }
        if (daily_approved_limit !== undefined) {
          payload.daily_approved_limit = daily_approved_limit;
        }
        if (editor_review_rate_sats !== undefined) {
          payload.editor_review_rate_sats = editor_review_rate_sats;
        }

        const res = await fetch(`${NEWS_BASE}/beats/${slug}`, {
          method: "PATCH",
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
            `Failed to update beat (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Beat updated successfully",
          beat: responseData,
          updated_by: account.btcAddress,
          slug,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // news_record_editor_payout — Record payout txid on an editor earning (publisher only)
  // --------------------------------------------------------------------------
  server.registerTool(
    "news_record_editor_payout",
    {
      description: `Record a payout transaction ID on an editor earning on aibtc.news.

Only the publisher can record payouts. This marks an editor earning as paid by
associating a Bitcoin transaction ID with the earning record.

Requires an unlocked wallet with a P2WPKH (bc1q) BTC address.

Authenticated via BIP-322 signature.`,
      inputSchema: {
        editor_address: z
          .string()
          .describe("BTC address of the editor whose earning to update (bc1q...)"),
        earning_id: z
          .string()
          .describe("ID of the editor earning to record the payout for"),
        payout_txid: z
          .string()
          .min(1)
          .describe("Bitcoin transaction ID of the payout"),
      },
    },
    async ({ editor_address, earning_id, payout_txid }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to record editor payouts."
          );
        }

        const path = `/api/editors/${editor_address}/earnings/${earning_id}`;
        const authHeaders = buildNewsAuthHeaders("PATCH", path, account as AccountForAuth);

        const payload = {
          payout_txid,
        };

        const res = await fetch(`${NEWS_BASE}/editors/${editor_address}/earnings/${earning_id}`, {
          method: "PATCH",
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
            `Failed to record editor payout (${res.status}): ${responseText}`
          );
        }

        return createJsonResponse({
          success: true,
          message: "Editor payout recorded successfully",
          earning: responseData,
          recorded_by: account.btcAddress,
          editor_address,
          earning_id,
          payout_txid,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
