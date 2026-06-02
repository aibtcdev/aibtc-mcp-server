import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios, { AxiosError } from "axios";
import {
  wrapAxiosWithPayment,
  decodePaymentRequired,
  decodePaymentResponse,
  X402_HEADERS,
  type StacksAccount,
} from "x402-stacks";
import { getAccount, NETWORK } from "../services/x402.service.js";
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
const MAX_REALISTIC_FEE_USTX = 50_000n; // 0.05 STX — generous headroom

/**
 * Pre-flight balance check for a non-sponsored sBTC inbox payment.
 * Verifies the wallet holds enough sBTC for the message AND enough STX for a
 * realistic transfer fee (the sender pays its own gas).
 */
export async function checkDirectInboxBalance(
  address: string,
  amount: string
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
 * Direct (non-sponsored) x402 inbox messaging.
 *
 * Unlike `send_inbox_message` — which builds a *sponsored* sBTC transfer
 * (`sponsored: true`, `fee: 0n`) so the aibtc relay co-signs and pays the STX
 * gas — this tool uses the standard `x402-stacks` client interceptor
 * (`wrapAxiosWithPayment`). That signs a normal standard-auth sBTC transfer
 * where the *sender pays its own STX gas*. The transaction is signed but not
 * broadcast; the inbox endpoint settles it via the x402 facilitator's
 * `/settle` flow (no relay sponsorship).
 *
 * Server side: `lib/inbox/x402-verify.ts` deserializes the payment tx and
 * branches on `tx.auth.authType`. A standard-auth tx (what x402-stacks signs)
 * takes the non-sponsored `X402PaymentVerifier.settle()` path — the relay never
 * adds a sponsor signature or pays gas.
 *
 * Trade-off vs the sponsored tool: the sender must hold STX to cover the
 * transfer fee (the pre-flight check enforces this). In exchange there is no
 * relay in the middle of the payment authorization.
 */
export function registerInboxX402Tools(server: McpServer): void {
  server.registerTool(
    "send_inbox_message_direct",
    {
      description:
        "Send a paid x402 message to another agent's inbox on aibtc.com. This is the canonical inbox " +
        "send tool (the older sponsored send_inbox_message is deprecated).\n\n" +
        "It signs a standard sBTC transfer with the x402-stacks client interceptor — you pay BOTH the sBTC " +
        "message cost AND your own STX gas fee. No relay sits in the middle of the payment; the inbox settles " +
        "the signed transaction via the x402 facilitator.\n\n" +
        "Requires an unlocked wallet holding sBTC (message cost) and STX (gas). Mainnet only.",
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

        // Step 2: Pre-flight balance check — sBTC for the message AND a
        // realistic STX gas budget (sender pays its own fee).
        await checkDirectInboxBalance(account.address, accept.amount);

        // Step 3: Build a payment-enabled axios client. wrapAxiosWithPayment
        // installs the x402-stacks interceptor: on a 402 it signs a standard
        // (non-sponsored) sBTC transfer and retries with the payment-signature
        // header. The sender's wallet pays the gas.
        const stacksAccount: StacksAccount = {
          address: account.address,
          privateKey: account.privateKey,
          network: NETWORK,
        };
        const api = wrapAxiosWithPayment(
          axios.create({ timeout: 120_000 }),
          stacksAccount
        );

        // Step 4: Send. The interceptor handles 402 -> sign -> retry.
        const response = await api.post(inboxUrl, body, {
          headers: { "Content-Type": "application/json" },
        });

        // Step 5: Decode the settlement (txid + payer) from the response header.
        const settlement = decodePaymentResponse(
          response.headers[X402_HEADERS.PAYMENT_RESPONSE]
        );
        const txid = settlement?.transaction;
        const payer = settlement?.payer;

        return createJsonResponse({
          success: true,
          message: "Message delivered (direct non-sponsored x402)",
          recipient: {
            btcAddress: recipientBtcAddress,
            stxAddress: recipientStxAddress,
          },
          contentLength: content.length,
          inbox: response.data,
          payment: {
            mode: "direct-x402-nonsponsored",
            amount: accept.amount + " sats sBTC",
            ...(payer && { payer }),
            ...(txid && {
              txid,
              explorer: getExplorerTxUrl(txid, NETWORK),
            }),
            note: "Sender paid its own STX gas — no relay sponsorship.",
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
