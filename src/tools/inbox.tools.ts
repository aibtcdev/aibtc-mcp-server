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
import { decodePaymentRequired, decodePaymentResponse, encodePaymentPayload, X402_HEADERS } from "../utils/x402-protocol.js";
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
// Nonce Manager
// Per-address nonce cache with 120s TTL. Prevents ConflictingNonceInMempool
// by tracking the highest known next-nonce across confirmed + mempool + local.
// ============================================================================

interface NonceCacheEntry {
  nextNonce: number;
  expiresAt: number;
}

const nonceCache: Map<string, NonceCacheEntry> = new Map();
const NONCE_TTL_MS = 120_000;

/**
 * Compute the next safe nonce for a sender address.
 * Takes the max of:
 *   - confirmed account nonce (on-chain)
 *   - highest pending mempool nonce + 1
 *   - locally cached next nonce (from a recent send)
 */
async function getNextNonce(address: string): Promise<number> {
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

  const cached = nonceCache.get(address);
  const fromCache = (cached && Date.now() < cached.expiresAt) ? cached.nextNonce : 0;

  return Math.max(confirmedNonce, highestMempoolNonce + 1, fromCache);
}

/**
 * Record that we used a nonce for an address so subsequent calls use a higher value.
 */
function advanceNonceCache(address: string, usedNonce: number): void {
  const now = Date.now();
  nonceCache.set(address, {
    nextNonce: usedNonce + 1,
    expiresAt: now + NONCE_TTL_MS,
  });
}

// ============================================================================
// Transaction Builder
// ============================================================================

/**
 * Build a sponsored sBTC transfer transaction (signed, not broadcast).
 * The inbox API handles settlement via the x402 relay.
 * Explicit nonce avoids ConflictingNonceInMempool; optional memo (max 34 bytes)
 * varies the tx hex to bypass relay dedup cache on retries.
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

/**
 * Check if a response body / error indicates a retryable nonce conflict.
 */
function isRetryableError(status: number, body: unknown): boolean {
  // Duplicate-message 409 from the inbox API must NOT be retried —
  // the message was already delivered and retrying would re-pay.
  if (status === 409) {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    if (/already exists|duplicate/i.test(bodyStr)) {
      return false;
    }
  }

  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    // Relay returns retryable: true for SETTLEMENT_BROADCAST_FAILED (issue #157)
    if (b["retryable"] === true) {
      return true;
    }
    // Relay returns HTTP 409 with code: "NONCE_CONFLICT"
    if (status === 409 && b["code"] === "NONCE_CONFLICT") {
      return true;
    }
  }
  if (typeof body === "string") {
    return body.includes("ConflictingNonceInMempool") || body.includes("BadNonce");
  }
  return false;
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      },
    },
    async ({ recipientBtcAddress, recipientStxAddress, content }) => {
      try {
        const account = await getAccount();

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
        // Max 3 total attempts (1 initial + 2 retries)
        const MAX_ATTEMPTS = 3;
        const RETRY_DELAYS_MS = [1000, 2000];

        let lastError: string = "";
        let paymentSignature: string | null = null;

        // Track relay txids across failed attempts to detect stale dedup.
        const seenRelayTxids = new Set<string>();

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (attempt > 0) {
            const delay = RETRY_DELAYS_MS[attempt - 1];
            console.error(
              `[send_inbox_message] Retry attempt ${attempt}/${MAX_ATTEMPTS - 1} after ${delay}ms`
            );
            await sleep(delay);
          }

          // Step 3: Fetch fresh nonce and build sponsored sBTC transfer.
          // Memo suffix on retries varies the tx hex to bypass relay dedup cache.
          const nonce = await getNextNonce(account.address);
          const memo = attempt > 0 ? `r${attempt}` : undefined;
          const txHex = await buildSponsoredSbtcTransfer(
            account.privateKey,
            account.address,
            accept.payTo,
            amount,
            BigInt(nonce),
            memo
          );

          // Step 4: Encode PaymentPayloadV2
          paymentSignature = encodePaymentPayload({
            x402Version: 2,
            resource: paymentRequired.resource,
            accepted: accept,
            payload: { transaction: txHex },
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
            // Advance local nonce cache on success
            advanceNonceCache(account.address, nonce);

            // Extract payment response header for txid
            const settlement = decodePaymentResponse(
              finalRes.headers.get(X402_HEADERS.PAYMENT_RESPONSE)
            );
            const txid = settlement?.transaction;

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

          // Check if the error is retryable
          const retryable = isRetryableError(finalRes.status, parsed);

          if (retryable && attempt < MAX_ATTEMPTS - 1) {
            console.error(
              `[send_inbox_message] Retryable error on attempt ${attempt + 1}: status=${finalRes.status} body=${responseData}`
            );
            // Advance nonce cache even on failure so the next attempt uses a
            // strictly higher nonce. Without this, getNextNonce could return the
            // same value if the rejected tx never reached the mempool.
            advanceNonceCache(account.address, nonce);
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

        // Retries exhausted -- check if any relay txid confirmed on-chain.
        // If so, the message was delivered and we can recover.
        if (seenRelayTxids.size > 0) {
          console.error(
            `[send_inbox_message] Checking on-chain status of ${seenRelayTxids.size} seen txid(s) before giving up.`
          );
          for (const seenTxid of seenRelayTxids) {
            try {
              const confirmation = await pollTransactionConfirmation(seenTxid, NETWORK, 5_000);
              if (confirmation.status === "success" || confirmation.status === "confirmed") {
                console.error(
                  `[send_inbox_message] Recovery: txid ${seenTxid} confirmed on-chain. Treating as success.`
                );
                return createJsonResponse({
                  success: true,
                  message: "Message delivered (recovered from stale dedup)",
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
