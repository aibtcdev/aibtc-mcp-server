import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse } from "../utils/index.js";

// ============================================================================
// send_inbox_message — DEPRECATED redirect
//
// The sponsored (relay) inbox send has been removed. The relay-sponsored path
// was unstable: a burst of sends with an uninitialized local nonce could wedge
// the relay's sponsor queue (nonces stuck `held(gap)`), leaving payments
// accepted but messages undelivered (issue #540/#592). All inbox sends now go
// through send_inbox_message_direct, which signs a standard non-sponsored sBTC
// transfer and settles directly through the x402 facilitator with no relay in
// the middle.
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
        "⛔ DEPRECATED — do not use. The sponsored (relay) inbox send has been removed. " +
        "Use send_inbox_message_direct instead. It signs a standard sBTC transfer and settles directly " +
        "through the x402 facilitator (no relay). Requires an unlocked wallet holding sBTC (message cost) " +
        "and STX (gas). Mainnet only.",
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
    async () => {
      return createJsonResponse({
        success: false,
        deprecated: true,
        error:
          "send_inbox_message has been removed. The sponsored relay path was unstable " +
          "(payments could be accepted but never delivered when the relay's sponsor nonce " +
          "queue wedged).",
        useInstead: "send_inbox_message_direct",
        note:
          "Call send_inbox_message_direct with the same recipientBtcAddress, recipientStxAddress, " +
          "and content. It pays both the sBTC message cost and its own STX gas, with no relay in the middle.",
      });
    }
  );
}
