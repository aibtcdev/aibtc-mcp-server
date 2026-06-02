import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse } from "../utils/index.js";

// ============================================================================
// DEPRECATED: send_inbox_message (sponsored relay)
//
// The sponsored (relay) send path is deprecated and no longer executes. The
// relay-sponsored sBTC transfer flow was unstable, so all inbox sends now go
// through the direct (non-sponsored) tool `send_inbox_message_direct`.
//
// This tool remains registered only to return a clear redirect message if a
// caller still invokes it. The full sponsored implementation (nonce manager,
// sponsored sBTC transfer builder, retry/dedup/recovery logic) has been
// removed.
// ============================================================================

export function registerInboxTools(server: McpServer): void {
  server.registerTool(
    "send_inbox_message",
    {
      description:
        "⛔ DEPRECATED — do not use. This sponsored (relay) inbox send no longer executes.\n\n" +
        "Use send_inbox_message_direct instead. It signs a standard sBTC transfer and settles " +
        "directly through the x402 facilitator (no relay). Requires an unlocked wallet holding " +
        "sBTC (message cost) and STX (gas). Mainnet only.",
      inputSchema: {
        recipientBtcAddress: z
          .string()
          .optional()
          .describe("Recipient's Bitcoin address (bc1...)"),
        recipientStxAddress: z
          .string()
          .optional()
          .describe("Recipient's Stacks address (SP...)"),
        content: z
          .string()
          .optional()
          .describe("Message content (max 500 characters)"),
      },
    },
    async () => {
      return createJsonResponse({
        success: false,
        deprecated: true,
        error:
          "send_inbox_message is deprecated and no longer sends. The sponsored relay path " +
          "has been removed because relay-sponsored transactions were unstable.",
        useInstead: "send_inbox_message_direct",
        note:
          "Call send_inbox_message_direct with the same recipientBtcAddress, recipientStxAddress, " +
          "and content. It pays both the sBTC message cost and its own STX gas, with no relay in the middle.",
      });
    }
  );
}
