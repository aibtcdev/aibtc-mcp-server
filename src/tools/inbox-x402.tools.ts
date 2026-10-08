import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import axios, { AxiosError } from "axios";
import {
  wrapAxiosWithPayment,
  decodePaymentRequired,
  decodePaymentResponse,
  X402_HEADERS,
  type StacksAccount,
} from "x402-stacks";
import { createApiClient, getAccount, NETWORK } from "../services/x402.service.js";
import { getSpendLimiter } from "../services/spend-limiter.js";
import { getSbtcService } from "../services/sbtc.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { InsufficientBalanceError } from "../utils/errors.js";
import { formatSbtc, formatStx } from "../utils/formatting.js";

const INBOX_BASE = "https://aibtc.com/api/inbox";

/**
 * Realistic gas ceiling for a single sBTC contract-call transfer (µSTX).
 *
 * Hiro's mempool `high_priority` estimate is frequently a degenerate outlier
 * (e.g. 2.5 STX) skewed by a few huge-fee txs, which would falsely block a
 * legitimately-funded wallet. stacks.js auto-estimates the real fee at ~250 µSTX.
 * We budget against `medium_priority`, capped at this ceiling, so the pre-flight
 * reflects what the transaction will actually cost.
 */
const MAX_REALISTIC_FEE_USTX = 3_000n; // 0.003 STX — the sbtc_transfer fee ceiling

/**
 * Pre-flight balance check for an sBTC inbox payment.
 * Verifies the wallet holds enough sBTC for the message, and — unless the
 * payment is sponsored — enough STX for a realistic transfer fee.
 */
export async function checkDirectInboxBalance(
  address: string,
  amount: string,
  sponsored = false
): Promise<void> {
  const sbtcService = getSbtcService(NETWORK);
  const sbtcBalance = BigInt((await sbtcService.getBalance(address)).balance);
  const required = BigInt(amount);
  if (sbtcBalance < required) {
    const shortfall = required - sbtcBalance;
    throw new InsufficientBalanceError(
      `Insufficient sBTC balance: need ${formatSbtc(amount)}, have ${formatSbtc(sbtcBalance.toString())} (shortfall: ${formatSbtc(shortfall.toString())}). ` +
        `Deposit more sBTC via the bridge at https://bridge.stx.eco or use a different wallet.`,
      "sBTC",
      sbtcBalance.toString(),
      amount,
      shortfall.toString()
    );
  }

  // Sponsored: the facilitator pays the gas, so no STX is needed.
  if (sponsored) return;

  const hiro = getHiroApi(NETWORK);
  const stxBalance = BigInt((await hiro.getStxBalance(address)).balance);
  const fees = await hiro.getMempoolFees();
  // getMempoolFees() casts the Hiro response without runtime validation, so
  // guard the field before BigInt() to surface a clear error rather than a
  // confusing TypeError if the shape is unexpected (missing/null fee).
  const rawFee = fees?.contract_call?.medium_priority;
  if (rawFee == null || !Number.isFinite(Number(rawFee))) {
    throw new Error(
      "Could not read medium_priority contract_call fee from the Hiro API — cannot pre-flight STX gas."
    );
  }
  // Use medium_priority but never trust a value above the realistic ceiling.
  const mediumFee = BigInt(rawFee);
  const feeBudget =
    mediumFee > MAX_REALISTIC_FEE_USTX ? MAX_REALISTIC_FEE_USTX : mediumFee;
  if (stxBalance < feeBudget) {
    const shortfall = feeBudget - stxBalance;
    throw new InsufficientBalanceError(
      `Insufficient STX for gas: need ~${formatStx(feeBudget.toString())} for the transfer fee, have ${formatStx(stxBalance.toString())} (shortfall: ${formatStx(shortfall.toString())}). ` +
        `This send requires STX for gas — deposit STX to cover the transfer fee.`,
      "STX",
      stxBalance.toString(),
      feeBudget.toString(),
      shortfall.toString()
    );
  }
}

/**
 * x402 inbox messaging. The transaction is signed but not broadcast; the
 * inbox endpoint settles it through its x402 facilitator.
 *
 * The inbox decides who pays gas. When its 402 advertises `extra.feePayer`,
 * the `x402-stacks` interceptor (`wrapAxiosWithPayment`, >=2.1.0) signs a
 * sponsored sBTC transfer with fee 0 and the facilitator co-signs and pays the
 * STX gas. Without it, the payment goes through `createApiClient`, which signs
 * a standard transfer at the `sbtc_transfer` fee clamp (max 0.003 STX) with an
 * exact-amount post-condition. The SDK's standard path leaves the fee to
 * stacks.js auto-estimation, which has no ceiling (#700).
 *
 * Server side: `lib/inbox/x402-verify.ts` deserializes the payment tx and
 * branches on `tx.auth.authType` (sponsored → relay sponsors; standard →
 * relay `/settle` broadcasts as-is).
 */
export function registerInboxX402Tools(server: McpServer): void {
  server.registerTool(
    "send_inbox_message_direct",
    {
      description:
        "Send a paid x402 message to another agent's inbox on aibtc.com. This is the canonical inbox " +
        "send tool (the older sponsored send_inbox_message is deprecated).\n\n" +
        "It signs an sBTC transfer with the x402-stacks client interceptor and the inbox settles it via its " +
        "x402 facilitator. When the inbox offers sponsorship (402 `extra.feePayer`), the transfer is gasless — " +
        "you pay only the sBTC message cost. Otherwise you also pay your own STX gas fee.\n\n" +
        "Requires an unlocked wallet holding sBTC (message cost), plus STX for gas when the inbox does not " +
        "sponsor. Mainnet only.",
      inputSchema: z.object({
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
      }),
    },
    async ({ recipientBtcAddress, recipientStxAddress, content }) => {
      try {
        // Network mismatch guard: the inbox at aibtc.com is mainnet-only.
        // Match the parsed hostname exactly (not a substring) so lookalike
        // hosts can't slip past the check.
        const inboxHost = new URL(INBOX_BASE).hostname;
        if (NETWORK === "testnet" && inboxHost === "aibtc.com") {
          throw new Error(
            "Network mismatch: MCP server is configured for testnet but the inbox service at aibtc.com requires mainnet. " +
              "Set NETWORK=mainnet or use a testnet inbox endpoint."
          );
        }

        const account = await getAccount();
        const inboxUrl = `${INBOX_BASE}/${recipientBtcAddress}`;
        const body = {
          toBtcAddress: recipientBtcAddress,
          toStxAddress: recipientStxAddress,
          content,
        };

        // Step 1: Probe for the 402 challenge (no payment) so we can pre-check
        // balance before signing. A bare POST never charges — it just returns
        // the payment requirements. We use plain fetch here so the x402-stacks
        // interceptor does not auto-pay this probe.
        const probe = await fetch(inboxUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });

        if (probe.status !== 402) {
          const text = await probe.text();
          if (probe.ok) {
            return createJsonResponse({
              success: true,
              message: "Message sent (no payment required)",
              response: text,
            });
          }
          throw new Error(
            `Expected 402 payment challenge, got ${probe.status}: ${text}`
          );
        }

        const paymentRequired = decodePaymentRequired(
          probe.headers.get(X402_HEADERS.PAYMENT_REQUIRED)
        );
        if (!paymentRequired?.accepts?.length) {
          throw new Error("402 response missing or empty payment-required header");
        }
        const accept = paymentRequired.accepts[0];

        // The SDK signs a sponsored (fee 0) transfer exactly when the
        // requirement names a fee payer — mirror its check.
        const sponsored = typeof accept.extra?.feePayer === "string";

        // Step 2: Pre-flight balance check — sBTC for the message, plus a
        // realistic STX gas budget when the sender pays its own fee.
        await checkDirectInboxBalance(account.address, accept.amount, sponsored);

        // Step 3: Send. Either interceptor handles 402 -> sign -> retry.
        let response;
        if (sponsored) {
          // The message cost is a signed sBTC spend: book it before signing.
          const spendLimiter = getSpendLimiter();
          const reservation = await spendLimiter.reserve(
            [{ unit: "sats", amount: BigInt(accept.amount) }],
            account.address
          );

          const stacksAccount: StacksAccount = {
            address: account.address,
            privateKey: account.privateKey,
            network: NETWORK,
          };
          const api = wrapAxiosWithPayment(
            axios.create({ timeout: 120_000 }),
            stacksAccount
          );
          try {
            response = await api.post(inboxUrl, body, {
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            await spendLimiter.release(reservation);
            throw error;
          }
        } else {
          // Self-paid: createApiClient clamps the fee and meters the spend.
          const api = await createApiClient(INBOX_BASE, {
            toolName: "send_inbox_message_direct",
            asset: accept.asset,
          });
          response = await api.post(inboxUrl, body, {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Step 4: Decode the settlement (txid + payer) from the response header.
        const settlement = decodePaymentResponse(
          response.headers[X402_HEADERS.PAYMENT_RESPONSE]
        );
        const txid = settlement?.transaction;
        const payer = settlement?.payer;

        return createJsonResponse({
          success: true,
          message: sponsored
            ? "Message delivered (x402, gas sponsored)"
            : "Message delivered (x402, sender paid gas)",
          recipient: {
            btcAddress: recipientBtcAddress,
            stxAddress: recipientStxAddress,
          },
          contentLength: content.length,
          inbox: response.data,
          payment: {
            mode: sponsored ? "x402-sponsored" : "direct-x402-nonsponsored",
            amount: accept.amount + " sats sBTC",
            ...(payer && { payer }),
            ...(txid && {
              txid,
              explorer: getExplorerTxUrl(txid, NETWORK),
            }),
            note: sponsored
              ? `STX gas paid by the inbox facilitator (${accept.extra?.feePayer}).`
              : "Sender paid its own STX gas — no relay sponsorship.",
          },
        });
      } catch (error) {
        // Surface the server's settlement detail if the retried request failed.
        if (error instanceof AxiosError && error.response) {
          const detail =
            typeof error.response.data === "string"
              ? error.response.data
              : JSON.stringify(error.response.data);
          return createErrorResponse(
            new Error(
              `Direct inbox delivery failed (${error.response.status}): ${detail}`
            )
          );
        }
        return createErrorResponse(error);
      }
    }
  );
}
