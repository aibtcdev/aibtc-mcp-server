/**
 * Reputation Tools (ERC-8004)
 *
 * Dedicated MCP tools for on-chain agent reputation management via the
 * ERC-8004 reputation registry. Covers the full feedback lifecycle:
 *
 * Read Tools (no wallet required):
 * - reputation_get_summary       - Aggregated reputation score for an agent
 * - reputation_read_feedback     - Specific feedback entry by agent + index
 * - reputation_read_all_feedback - Paginated all-feedback with tag filtering
 * - reputation_get_clients       - Paginated list of clients who gave feedback
 * - reputation_get_feedback_count - Total feedback count for an agent
 * - reputation_get_approved_limit - Approved index limit for a client
 * - reputation_get_last_index    - Last feedback index for a client
 *
 * Write Tools (wallet required):
 * - reputation_give_feedback     - Submit feedback for an agent
 * - reputation_revoke_feedback   - Revoke own feedback by index
 * - reputation_append_response   - Append a response to received feedback
 * - reputation_approve_client    - Approve a client with index limit
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK, getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { Erc8004Service } from "../services/erc8004.service.js";
import { resolveFee } from "../utils/fee.js";
import { sponsoredSchema } from "./schemas.js";
import { normalizeHex, getCallerAddress } from "../utils/erc8004-helpers.js";

/** Zod schema for a Stacks principal address (mainnet SP... or testnet ST...) */
const stacksAddressSchema = z
  .string()
  .regex(/^S[PT][0-9A-Z]{38,39}$/)
  .describe("Stacks address of the client (SP... mainnet or ST... testnet)");

export function registerReputationTools(server: McpServer): void {
  const service = new Erc8004Service(NETWORK);

  // ==========================================================================
  // Read Tools — no wallet required
  // ==========================================================================

  // reputation_get_summary
  server.registerTool(
    "reputation_get_summary",
    {
      description:
        "Get aggregated reputation summary for an agent from the ERC-8004 reputation registry. " +
        "Returns average rating as a WAD string (18 decimals) and total feedback count. " +
        "No wallet required.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to get reputation summary for"),
      },
    },
    async ({ agentId }) => {
      try {
        const callerAddress = getCallerAddress();
        const reputation = await service.getReputation(agentId, callerAddress);

        if (reputation.totalFeedback === 0) {
          return createJsonResponse({
            success: true,
            agentId,
            totalFeedback: 0,
            summaryValue: "0",
            summaryValueDecimals: 0,
            message: "No feedback yet for this agent",
            network: NETWORK,
          });
        }

        return createJsonResponse({
          success: true,
          agentId: reputation.agentId,
          totalFeedback: reputation.totalFeedback,
          summaryValue: reputation.summaryValue,
          summaryValueDecimals: reputation.summaryValueDecimals,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_read_feedback
  server.registerTool(
    "reputation_read_feedback",
    {
      description:
        "Read a specific feedback entry for an agent by index from the ERC-8004 reputation registry. " +
        "Returns client address, value, decimals, tags, and timestamp. " +
        "No wallet required.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to read feedback for"),
        index: z.number().int().min(0).describe("Feedback index to read"),
      },
    },
    async ({ agentId, index }) => {
      try {
        const callerAddress = getCallerAddress();
        const feedback = await service.getFeedback(agentId, index, callerAddress);

        if (!feedback) {
          return createJsonResponse({
            success: false,
            agentId,
            index,
            message: "Feedback entry not found",
            network: NETWORK,
          });
        }

        return createJsonResponse({
          success: true,
          agentId,
          index,
          client: feedback.client,
          value: feedback.value,
          valueDecimals: feedback.valueDecimals,
          wadValue: feedback.wadValue,
          tag1: feedback.tag1 || "(none)",
          tag2: feedback.tag2 || "(none)",
          timestamp: feedback.timestamp,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_read_all_feedback
  server.registerTool(
    "reputation_read_all_feedback",
    {
      description:
        "Read all feedback entries for an agent with optional tag filtering and pagination. " +
        "Returns up to 20 entries per page. Pass nextCursor from the previous response to page. " +
        "WARNING: Uses one RPC call per entry (N+1 pattern) — avoid calling for agents with " +
        "large feedback sets without using cursor-based pagination. " +
        "No wallet required.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to read all feedback for"),
        tag1: z.string().optional().describe("Filter by tag1 (exact match). Optional."),
        tag2: z.string().optional().describe("Filter by tag2 (exact match). Optional."),
        includeRevoked: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include revoked feedback entries. Default false."),
        cursor: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination cursor (index to start from). Default 0."),
      },
    },
    async ({ agentId, tag1, tag2, includeRevoked, cursor }) => {
      try {
        const callerAddress = getCallerAddress();
        const page = await service.readAllFeedback(
          agentId,
          callerAddress,
          tag1,
          tag2,
          includeRevoked ?? false,
          cursor ?? 0
        );

        return createJsonResponse({
          success: true,
          agentId,
          count: page.entries.length,
          entries: page.entries,
          nextCursor: page.nextCursor ?? null,
          hasMore: page.nextCursor !== undefined,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_get_clients
  server.registerTool(
    "reputation_get_clients",
    {
      description:
        "Get a paginated list of clients who gave feedback to an agent. " +
        "Returns client addresses and a nextCursor for pagination. " +
        "No wallet required.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to get clients for"),
        cursor: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination cursor. Default 0."),
      },
    },
    async ({ agentId, cursor }) => {
      try {
        const callerAddress = getCallerAddress();
        const page = await service.getClients(agentId, callerAddress, cursor ?? 0);

        return createJsonResponse({
          success: true,
          agentId,
          count: page.clients.length,
          clients: page.clients,
          nextCursor: page.nextCursor ?? null,
          hasMore: page.nextCursor !== undefined,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_get_feedback_count
  server.registerTool(
    "reputation_get_feedback_count",
    {
      description:
        "Get the total number of feedback entries for an agent from the ERC-8004 reputation registry. " +
        "No wallet required.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to get feedback count for"),
      },
    },
    async ({ agentId }) => {
      try {
        const callerAddress = getCallerAddress();
        const count = await service.getFeedbackCount(agentId, callerAddress);

        return createJsonResponse({
          success: true,
          agentId,
          feedbackCount: count,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_get_approved_limit
  server.registerTool(
    "reputation_get_approved_limit",
    {
      description:
        "Get the approved feedback index limit for a specific client of an agent. " +
        "Returns the maximum index up to which the client is approved to submit feedback. " +
        "No wallet required.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID"),
        client: stacksAddressSchema,
      },
    },
    async ({ agentId, client }) => {
      try {
        const callerAddress = getCallerAddress();
        const limit = await service.getApprovedLimit(agentId, client, callerAddress);

        return createJsonResponse({
          success: true,
          agentId,
          client,
          approvedLimit: limit,
          notFound: limit === null,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_get_last_index
  server.registerTool(
    "reputation_get_last_index",
    {
      description:
        "Get the last feedback index submitted by a specific client for an agent. " +
        "No wallet required.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID"),
        client: stacksAddressSchema,
      },
    },
    async ({ agentId, client }) => {
      try {
        const callerAddress = getCallerAddress();
        const lastIndex = await service.getLastIndex(agentId, client, callerAddress);

        return createJsonResponse({
          success: true,
          agentId,
          client,
          lastIndex,
          notFound: lastIndex === null,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Write Tools — wallet required
  // ==========================================================================

  // reputation_give_feedback
  server.registerTool(
    "reputation_give_feedback",
    {
      description:
        "Submit feedback for an agent using the ERC-8004 reputation registry. " +
        "Value is normalized to 18 decimals (WAD) internally for aggregation. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to give feedback for"),
        value: z
          .number()
          .int()
          .min(0)
          .describe("Feedback value (e.g., 5 for a 5-star rating)"),
        valueDecimals: z
          .number()
          .int()
          .min(0)
          .max(18)
          .describe("Decimals for the value (e.g., 0 for integer ratings)"),
        tag1: z.string().max(64).optional().describe("Optional tag 1 (max 64 chars)"),
        tag2: z.string().max(64).optional().describe("Optional tag 2 (max 64 chars)"),
        endpoint: z.string().optional().describe("Optional endpoint URL"),
        feedbackUri: z.string().optional().describe("Optional URI pointing to off-chain feedback details"),
        feedbackHash: z
          .string()
          .optional()
          .describe("Optional feedback hash as hex string (32 bytes)"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackUri, feedbackHash, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const hashBuffer = feedbackHash
          ? Buffer.from(normalizeHex(feedbackHash, "feedbackHash", 32), "hex")
          : undefined;
        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;

        const result = await service.giveFeedback(
          account,
          agentId,
          value,
          valueDecimals,
          tag1,
          tag2,
          endpoint,
          feedbackUri,
          hashBuffer,
          feeAmount,
          sponsored
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: "Feedback submitted successfully",
          agentId,
          value,
          valueDecimals,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_revoke_feedback
  server.registerTool(
    "reputation_revoke_feedback",
    {
      description:
        "Revoke a previously submitted feedback entry by index. " +
        "Only the original submitter can revoke their feedback. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID the feedback was given for"),
        index: z.number().int().min(0).describe("Feedback index to revoke"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, index, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.revokeFeedback(account, agentId, index, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: "Feedback revocation submitted successfully",
          agentId,
          index,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_append_response
  server.registerTool(
    "reputation_append_response",
    {
      description:
        "Append a response to feedback received from a client. " +
        "Must be called by the agent that received the feedback. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID that received the feedback"),
        client: stacksAddressSchema,
        index: z.number().int().min(0).describe("Feedback index to respond to"),
        responseUri: z.string().describe("URI pointing to the response content"),
        responseHash: z.string().describe("Response hash as hex string (32 bytes)"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, client, index, responseUri, responseHash, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const hashBuffer = Buffer.from(normalizeHex(responseHash, "responseHash", 32), "hex");
        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;

        const result = await service.appendResponse(
          account,
          agentId,
          client,
          index,
          responseUri,
          hashBuffer,
          feeAmount,
          sponsored
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: "Response appended successfully",
          agentId,
          client,
          index,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // reputation_approve_client
  server.registerTool(
    "reputation_approve_client",
    {
      description:
        "Approve a client to submit feedback up to a specified index limit. " +
        "Must be called by the agent owner. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to approve a client for"),
        client: stacksAddressSchema,
        indexLimit: z
          .number()
          .int()
          .min(0)
          .describe("Maximum feedback index the client is approved for"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, client, indexLimit, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.approveClient(
          account,
          agentId,
          client,
          indexLimit,
          feeAmount,
          sponsored
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: "Client approved successfully",
          agentId,
          client,
          indexLimit,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
