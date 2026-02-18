import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
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

const INBOX_BASE = "https://aibtc.com/api/inbox";

/**
 * Build a sponsored sBTC transfer transaction (signed, not broadcast).
 * The inbox API handles settlement via the x402 relay.
 */
async function buildSponsoredSbtcTransfer(
  senderKey: string,
  senderAddress: string,
  recipient: string,
  amount: bigint
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
    network: networkName,
    postConditions: [postCondition],
    sponsored: true,
    fee: 0n,
  });

  // serialize() returns Hex string (no 0x prefix) in @stacks/transactions v7+
  return "0x" + transaction.serialize();
}

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

        // Step 3: Build sponsored sBTC transfer
        const txHex = await buildSponsoredSbtcTransfer(
          account.privateKey,
          account.address,
          accept.payTo,
          amount
        );

        // Step 4: Encode PaymentPayloadV2
        const paymentSignature = encodePaymentPayload({
          x402Version: 2,
          resource: paymentRequired.resource,
          accepted: accept,
          payload: { transaction: txHex },
        });

        // Step 5: Retry with payment
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

        throw new Error(
          `Message delivery failed (${finalRes.status}): ${responseData}`
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
