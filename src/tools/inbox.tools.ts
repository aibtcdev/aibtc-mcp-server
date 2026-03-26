import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
  someCV,
  bufferCV,
} from "@stacks/transactions";
import { decodePaymentRequired, decodePaymentResponse, encodePaymentPayload, generatePaymentId, buildPaymentIdentifierExtension, X402_HEADERS } from "../utils/x402-protocol.js";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { getSbtcService } from "../services/sbtc.service.js";
import { getStacksNetwork, getExplorerTxUrl } from "../config/networks.js";
import { getContracts, parseContractId } from "../config/contracts.js";
import { createFungiblePostCondition } from "../transactions/post-conditions.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { InsufficientBalanceError } from "../utils/errors.js";
import { formatSbtc } from "../utils/formatting.js";
import { getHiroApi } from "../services/hiro-api.js";
import { extractTxidFromPaymentSignature, pollTransactionConfirmation } from "../utils/x402-recovery.js";

const INBOX_BASE = "https://aibtc.com/api/inbox";

// ============================================================================
// Nonce Manager (delegated to SharedNonceTracker — issue #413)
//
// All nonce tracking is now handled by the shared tracker, which persists to
// ~/.aibtc/nonce-state.json and is shared across MCP tools and CLI skills.
// ============================================================================

import {
  getTrackedNonce,
  recordNonceUsed,
  reconcileWithChain,
} from "../services/nonce-tracker.js";

/**
 * Compute the next safe nonce for a sender address.
 *
 * Always fetches chain state and reconciles with the shared tracker,
 * consistent with the builder path (both take max of local vs chain).
 */
async function getNextNonce(address: string): Promise<number> {
  // 1. Check shared tracker (fast, no network)
  const localNext = await getTrackedNonce(address);

  // 2. Fetch chain state for reconciliation
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
    // Non-fatal: fall back to confirmed nonce only
  }

  const chainNext = Math.max(confirmedNonce, highestMempoolNonce + 1);

  // 3. Reconcile tracker with chain state
  await reconcileWithChain(address, chainNext);

  // 4. Return max(chain, local) — same logic as builder path
  return Math.max(chainNext, localNext ?? 0);
}

/**
 * Record that we used a nonce for an address so subsequent calls use a higher value.
 */
async function advanceNonceCache(address: string, usedNonce: number, txid = ""): Promise<void> {
  await recordNonceUsed(address, usedNonce, txid);
}

// ============================================================================
// Transaction Builder
// ============================================================================

/**
 * Build a sponsored sBTC transfer transaction (signed, not broadcast).
 * The inbox API handles settlement via the x402 relay.
 * Explicit nonce avoids ConflictingNonceInMempool; optional memo (max 34 bytes)
 * can be used for on-chain labeling.
 */
async function buildSponsoredSbtcTransfer(
  senderKey: string,
  senderAddress: string,
  recipient: string,
  amount: bigint,
  nonce: bigint,
  memo?: string
): Promise<string> {
  const contracts = getContracts(NETWORK);
  const { address: contractAddress, name: contractName } = parseContractId(
    contracts.SBTC_TOKEN
  );
  const networkName = getStacksNetwork(NETWORK);

  const postCondition = createFungiblePostCondition(
    senderAddress,
    contracts.SBTC_TOKEN,
    "sbtc-token",
    "eq",
    amount
  );

  // Encode memo as (optional (buff 34)): some(buff) if provided, none() otherwise.
  const memoArg = memo
    ? someCV(bufferCV(Buffer.from(memo).slice(0, 34)))
    : noneCV();

  const transaction = await makeContractCall({
    contractAddress,
    contractName,
    functionName: "transfer",
    functionArgs: [
      uintCV(amount),
      principalCV(senderAddress),
      principalCV(recipient),
      memoArg,
    ],
    senderKey,
    network: networkName,
    postConditions: [postCondition],
    sponsored: true,
    fee: 0n,
    nonce,
  });

  // serialize() returns Hex string (no 0x prefix) in @stacks/transactions v7+
  return "0x" + transaction.serialize();
}

// ============================================================================
// Retry helpers
// ============================================================================

interface RetryInfo {
  retryable: boolean;
  /** Delay in ms before next retry. Honors relay's retryAfter when present. */
  delayMs: number;
  /** Whether the error is a relay-side nonce conflict (safe to reuse same tx). */
  relaySideConflict: boolean;
}

/** Default delay when no retryAfter hint is provided. */
const DEFAULT_RETRY_DELAY_MS = 2_000;
/** Cap retryAfter to avoid blocking too long (seconds). */
const MAX_RETRY_AFTER_CAP_S = 60;

/**
 * Classify a response as retryable and extract retry timing.
 */
function classifyRetryableError(status: number, body: unknown): RetryInfo {
  const NOT_RETRYABLE: RetryInfo = { retryable: false, delayMs: 0, relaySideConflict: false };

  // Duplicate-message 409 from the inbox API must NOT be retried —
  // the message was already delivered and retrying would re-pay.
  if (status === 409) {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    if (/already exists|duplicate/i.test(bodyStr)) {
      return NOT_RETRYABLE;
    }
  }

  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;

    // Parse relay's retryAfter hint (seconds → ms), capped.
    const rawRetryAfter = typeof b["retryAfter"] === "number" ? b["retryAfter"] : 0;
    const retryAfterMs =
      rawRetryAfter > 0
        ? Math.min(rawRetryAfter, MAX_RETRY_AFTER_CAP_S) * 1000
        : DEFAULT_RETRY_DELAY_MS;

    // Relay returns retryable: true for SETTLEMENT_BROADCAST_FAILED (issue #157)
    if (b["retryable"] === true) {
      return { retryable: true, delayMs: retryAfterMs, relaySideConflict: false };
    }
    // Relay returns HTTP 409 with code: "NONCE_CONFLICT" — relay-side conflict,
    // safe to resubmit the same transaction for dedup.
    if (status === 409 && b["code"] === "NONCE_CONFLICT") {
      return { retryable: true, delayMs: retryAfterMs, relaySideConflict: true };
    }
  }

  // Sender-side nonce conflict from the Stacks node (not relay) — needs fresh tx.
  if (typeof body === "string") {
    if (body.includes("ConflictingNonceInMempool") || body.includes("BadNonce")) {
      return { retryable: true, delayMs: DEFAULT_RETRY_DELAY_MS, relaySideConflict: false };
    }
  }

  return NOT_RETRYABLE;
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Recovery Helper
// ============================================================================

interface RecoveryResult {
  ok: boolean;
  status: number;
  body: string;
}

/**
 * POST a message to the inbox using a confirmed txid as payment proof.
 * Returns a structured result so callers can decide how to handle failure
 * (manual recovery throws, auto-recovery tries the next txid).
 */
async function submitWithPaymentTxid(
  recipientBtcAddress: string,
  recipientStxAddress: string,
  content: string,
  txid: string
): Promise<RecoveryResult> {
  const url = `${INBOX_BASE}/${recipientBtcAddress}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toBtcAddress: recipientBtcAddress,
      toStxAddress: recipientStxAddress,
      content,
      paymentTxid: txid,
    }),
  });
  const body = await res.text();
  const ok = res.status === 200 || res.status === 201 || res.status === 409;
  return { ok, status: res.status, body };
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerInboxTools(server: McpServer): void {
  server.registerTool(
    "send_inbox_message",
    {
      description: `Send a paid x402 message to another agent's inbox on aibtc.com.

Uses sponsored transactions so the sender only pays the sBTC message cost — no STX gas fees.

This tool handles the full 5-step x402 payment flow:
1. POST to inbox → receive 402 payment challenge
2. Parse payment requirements from response
3. Build sponsored sBTC transfer (relay pays gas)
4. Encode payment payload
5. Retry with payment proof → message delivered

Use this instead of execute_x402_endpoint for inbox messages — the generic tool has known settlement timeout issues with sBTC contract calls.`,
      inputSchema: {
        recipientBtcAddress: z
          .string()
          .describe("Recipient's Bitcoin address (bc1...)"),
        recipientStxAddress: z
          .string()
          .describe("Recipient's Stacks address (SP...)"),
        content: z
          .string()
          .max(500)
          .describe("Message content (max 500 characters)"),
        paymentTxid: z
          .string()
          .optional()
          .describe(
            "Optional: a confirmed on-chain sBTC transfer txid to use as payment proof. " +
            "When provided, skips the x402 payment flow and resubmits the message directly. " +
            "Use for manual recovery after a settlement timeout left the payment confirmed but the message undelivered."
          ),
      },
    },
    async ({ recipientBtcAddress, recipientStxAddress, content, paymentTxid }) => {
      try {
        // Network mismatch guard: fail early if testnet MCP server targets mainnet inbox
        if (NETWORK === "testnet" && INBOX_BASE.includes("aibtc.com")) {
          throw new Error(
            "Network mismatch: MCP server is configured for testnet but the inbox service at aibtc.com requires mainnet. " +
            "Set NETWORK=mainnet or use a testnet inbox endpoint."
          );
        }

        const account = await getAccount();

        // Manual recovery: skip x402 flow and POST with the provided txid as proof
        if (paymentTxid) {
          const result = await submitWithPaymentTxid(
            recipientBtcAddress, recipientStxAddress, content, paymentTxid
          );
          if (!result.ok) {
            throw new Error(`paymentTxid recovery failed (${result.status}): ${result.body}`);
          }
          return createJsonResponse({
            success: true,
            message: result.status === 409
              ? "Message already delivered"
              : "Message delivered (manual txid recovery)",
            recipient: {
              btcAddress: recipientBtcAddress,
              stxAddress: recipientStxAddress,
            },
            contentLength: content.length,
            payment: {
              txid: paymentTxid,
              recovered: true,
              explorer: getExplorerTxUrl(paymentTxid, NETWORK),
            },
          });
        }

        // Step 1: POST without payment → get 402 challenge
        const inboxUrl = `${INBOX_BASE}/${recipientBtcAddress}`;
        const body = {
          toBtcAddress: recipientBtcAddress,
          toStxAddress: recipientStxAddress,
          content,
        };

        const initialRes = await fetch(inboxUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (initialRes.status !== 402) {
          const text = await initialRes.text();
          if (initialRes.ok) {
            return createJsonResponse({
              success: true,
              message: "Message sent (no payment required)",
              response: text,
            });
          }
          throw new Error(
            `Expected 402 payment challenge, got ${initialRes.status}: ${text}`
          );
        }

        // Step 2: Parse payment requirements
        const paymentHeader = initialRes.headers.get(
          X402_HEADERS.PAYMENT_REQUIRED
        );
        if (!paymentHeader) {
          throw new Error("402 response missing payment-required header");
        }

        const paymentRequired = decodePaymentRequired(paymentHeader);
        if (!paymentRequired || !paymentRequired.accepts || paymentRequired.accepts.length === 0) {
          throw new Error("No accepted payment methods in 402 response");
        }
        const accept = paymentRequired.accepts[0];
        const amount = BigInt(accept.amount);

        // Pre-check sBTC balance only — sponsored txs have fee: 0n so STX gas is not required
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
        // Up to 3 attempts, waiting nextRetryDelayMs (or retryAfter) before each retry.
        const MAX_ATTEMPTS = 3;

        let lastError: string = "";
        let paymentSignature: string | null = null;

        // Track relay txids across failed attempts to detect stale dedup.
        const seenRelayTxids = new Set<string>();

        // Stash first attempt's tx + paymentId for reuse on relay-side conflicts.
        let cachedTxHex: string | null = null;
        let cachedPaymentId: string | null = null;
        let cachedNonce: number | null = null;
        let nextRetryDelayMs = 0;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (attempt > 0 && nextRetryDelayMs > 0) {
            console.error(
              `[send_inbox_message] Retry attempt ${attempt}/${MAX_ATTEMPTS - 1} after ${nextRetryDelayMs}ms`
            );
            await sleep(nextRetryDelayMs);
          }

          // Step 3: Build sponsored sBTC transfer.
          // Reuse the cached transaction on relay-side nonce conflicts (the relay
          // deduplicates by paymentId so we avoid consuming additional nonce slots).
          let nonce: number;
          let txHex: string;
          let paymentId: string;

          if (cachedTxHex && cachedPaymentId && cachedNonce !== null) {
            // Relay-side conflict: resubmit the same tx for dedup
            nonce = cachedNonce;
            txHex = cachedTxHex;
            paymentId = cachedPaymentId;
            console.error(
              `[send_inbox_message] Reusing cached tx (nonce=${nonce}) for relay-side dedup`
            );
          } else {
            // Fresh tx: sender-side conflict or first attempt
            nonce = await getNextNonce(account.address);
            txHex = await buildSponsoredSbtcTransfer(
              account.privateKey,
              account.address,
              accept.payTo,
              amount,
              BigInt(nonce)
            );
            paymentId = generatePaymentId();

            // Cache for potential reuse on relay-side conflicts
            cachedTxHex = txHex;
            cachedPaymentId = paymentId;
            cachedNonce = nonce;
          }

          // Step 4: Encode PaymentPayloadV2 with payment-identifier extension.
          paymentSignature = encodePaymentPayload({
            x402Version: 2,
            resource: paymentRequired.resource,
            accepted: accept,
            payload: { transaction: txHex },
            extensions: buildPaymentIdentifierExtension(paymentId),
          });

          // Step 5: Send with payment header
          const finalRes = await fetch(inboxUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              [X402_HEADERS.PAYMENT_SIGNATURE]: paymentSignature,
            },
            body: JSON.stringify(body),
          });

          const responseData = await finalRes.text();
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(responseData);
          } catch {
            parsed = { raw: responseData };
          }

          if (finalRes.status === 201 || finalRes.status === 200) {
            // Extract payment response header for txid
            const settlement = decodePaymentResponse(
              finalRes.headers.get(X402_HEADERS.PAYMENT_RESPONSE)
            );
            const txid = settlement?.transaction;

            // Advance shared nonce tracker on success
            await advanceNonceCache(account.address, nonce, txid ?? "");

            return createJsonResponse({
              success: true,
              message: "Message delivered",
              recipient: {
                btcAddress: recipientBtcAddress,
                stxAddress: recipientStxAddress,
              },
              contentLength: content.length,
              inbox: parsed,
              ...(txid && {
                payment: {
                  txid,
                  amount: accept.amount + " sats sBTC",
                  explorer: getExplorerTxUrl(txid, NETWORK),
                },
              }),
            });
          }

          // Extract relay txid from payment-response header (forwarded even on failure).
          // If we have seen it before, the relay is serving a stale cached result.
          const failedTxid = decodePaymentResponse(
            finalRes.headers.get(X402_HEADERS.PAYMENT_RESPONSE)
          )?.transaction;
          if (failedTxid && seenRelayTxids.has(failedTxid)) {
            console.error(
              `[send_inbox_message] Stale dedup: relay returned previously-seen txid ${failedTxid} on attempt ${attempt + 1}`
            );
          } else if (failedTxid) {
            seenRelayTxids.add(failedTxid);
          }

          // Classify the error and extract retry timing
          const retry = classifyRetryableError(finalRes.status, parsed);

          if (retry.retryable && attempt < MAX_ATTEMPTS - 1) {
            console.error(
              `[send_inbox_message] Retryable error on attempt ${attempt + 1}: status=${finalRes.status} relaySide=${retry.relaySideConflict} delayMs=${retry.delayMs} body=${responseData}`
            );

            nextRetryDelayMs = retry.delayMs;

            if (retry.relaySideConflict) {
              // Keep cached tx/paymentId — relay will dedup on resubmit
            } else {
              // Sender-side conflict: need a fresh tx with new nonce
              cachedTxHex = null;
              cachedPaymentId = null;
              cachedNonce = null;
              // Advance nonce cache so the next attempt uses a strictly higher nonce.
              await advanceNonceCache(account.address, nonce);
            }

            lastError = `${finalRes.status}: ${responseData}`;
            continue;
          }

          // Non-retryable or last attempt — build error with txid recovery info
          const txid = paymentSignature
            ? extractTxidFromPaymentSignature(paymentSignature)
            : null;

          const errorBase = `Message delivery failed (${finalRes.status}): ${responseData}`;
          if (txid) {
            // Poll briefly for on-chain status so the error includes actionable info
            const confirmation = await pollTransactionConfirmation(txid, NETWORK);
            throw new Error(
              `${errorBase}\n\nPayment transaction was submitted but settlement failed. ` +
              `Transaction recovery info:\n  txid: ${confirmation.txid}\n  status: ${confirmation.status}\n  explorer: ${confirmation.explorer}`
            );
          }
          throw new Error(errorBase);
        }

        // Retries exhausted -- check if any relay txid confirmed on-chain and
        // resubmit with the confirmed txid as payment proof.
        if (seenRelayTxids.size > 0) {
          console.error(
            `[send_inbox_message] Checking on-chain status of ${seenRelayTxids.size} seen txid(s) before giving up.`
          );
          for (const seenTxid of seenRelayTxids) {
            try {
              const confirmation = await pollTransactionConfirmation(seenTxid, NETWORK, 5_000);
              if (confirmation.status !== "success" && confirmation.status !== "confirmed") {
                continue;
              }
              console.error(
                `[send_inbox_message] Auto-recovery: txid ${seenTxid} confirmed on-chain. Resubmitting.`
              );
              const result = await submitWithPaymentTxid(
                recipientBtcAddress, recipientStxAddress, content, seenTxid
              );
              if (result.ok) {
                return createJsonResponse({
                  success: true,
                  message: result.status === 409
                    ? "Message already delivered"
                    : "Message delivered (auto-recovered with confirmed txid)",
                  recipient: {
                    btcAddress: recipientBtcAddress,
                    stxAddress: recipientStxAddress,
                  },
                  contentLength: content.length,
                  payment: {
                    txid: seenTxid,
                    amount: accept.amount + " sats sBTC",
                    explorer: getExplorerTxUrl(seenTxid, NETWORK),
                    recovered: true,
                  },
                });
              }
              console.error(
                `[send_inbox_message] Auto-recovery resubmission failed for txid ${seenTxid}: ${result.status} ${result.body}`
              );
            } catch {
              // Non-fatal: move on to the next txid
            }
          }
        }

        // Include all seen txids in the error for diagnostics
        const txidSummary = seenRelayTxids.size > 0
          ? `\n\nSeen relay txids (all failed or pending):\n${[...seenRelayTxids].map((id) => `  ${id}`).join("\n")}`
          : "";

        throw new Error(
          `Message delivery failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}${txidSummary}`
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
