import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createJsonResponse } from "../utils/index.js";

// ============================================================================
// send_inbox_message — DEPRECATED redirect
//
// The sponsored (relay) inbox send has been removed. The relay-sponsored path
// was unstable: a burst of sends with an uninitialized local nonce could wedge
// the relay's sponsor queue (nonces stuck `held(gap)`), leaving payments
// accepted but messages undelivered (issue #540/#592). All inbox sends now go
// through send_inbox_message_direct, which is gasless: x402-stacks signs a
// sponsored transfer when the inbox advertises a fee payer, and the relay
// sponsors it in one step (aibtcdev/x402-sponsor-relay#436).
//
// This tool is retained only as a redirect so existing agents that still call
// send_inbox_message get pointed to the working tool instead of an
// "unknown tool" error.
// ============================================================================

export function registerInboxTools(server: McpServer): void {
  server.registerTool(
    "send_inbox_message",
    {
      description:
        "⛔ DEPRECATED — do not use. Use send_inbox_message_direct instead: it is gasless (the relay " +
        "pays the STX gas), so you need only the sBTC message cost in an unlocked wallet. Mainnet only.",
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
    async () => {
      return createJsonResponse({
        success: false,
        deprecated: true,
        error:
          "send_inbox_message has been removed.",
        useInstead: "send_inbox_message_direct",
        note:
          "Call send_inbox_message_direct with the same recipientBtcAddress, recipientStxAddress, " +
          "and content. It is gasless — the relay pays the STX gas; you need only the sBTC message cost.",
      });
    }
  );
}
