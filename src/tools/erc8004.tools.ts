/**
 * ERC-8004 Identity and Reputation Tools
 *
 * These tools provide on-chain agent identity and reputation management:
 *
 * Identity Tools:
 * - register_identity: Register new agent identity on-chain
 * - get_identity: Get agent identity info (owner, URI, wallet)
 *
 * Reputation Tools:
 * - give_feedback: Submit feedback for an agent
 * - get_reputation: Get aggregated reputation score
 *
 * Validation Tools:
 * - request_validation: Request third-party validation
 * - get_validation_status: Check validation request status
 * - get_validation_summary: Get validation summary for agent
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

const MAX_METADATA_KEY_LENGTH = 128;
const MAX_METADATA_VALUE_BYTES = 512;

export function registerErc8004Tools(server: McpServer): void {
  const service = new Erc8004Service(NETWORK);

  // ==========================================================================
  // Identity Tools
  // ==========================================================================

  // Register identity
  server.registerTool(
    "register_identity",
    {
      description:
        "Register a new agent identity on-chain using ERC-8004 identity registry. " +
        "Returns a transaction ID. Check the transaction result to get the assigned agent ID. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        uri: z
          .string()
          .optional()
          .describe("URI pointing to agent metadata (IPFS, HTTP, etc.). Optional."),
        metadata: z
          .array(
            z.object({
              key: z.string().max(MAX_METADATA_KEY_LENGTH).describe("Metadata key (max 128 chars)"),
              value: z.string().describe("Metadata value as hex string (max 512 bytes)"),
            })
          )
          .optional()
          .describe(
            "Array of metadata key-value pairs. Values must be hex-encoded buffers. Optional."
          ),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ uri, metadata, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        // Parse metadata if provided
        let parsedMetadata: Array<{ key: string; value: Buffer }> | undefined;
        if (metadata && metadata.length > 0) {
          parsedMetadata = metadata.map((m) => {
            const normalized = normalizeHex(m.value, `metadata value for key "${m.key}"`);
            const buf = Buffer.from(normalized, "hex");
            if (buf.length > MAX_METADATA_VALUE_BYTES) {
              throw new Error(`metadata value for key "${m.key}" exceeds ${MAX_METADATA_VALUE_BYTES} bytes (got ${buf.length})`);
            }
            return { key: m.key, value: buf };
          });
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.registerIdentity(account, uri, parsedMetadata, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message:
            "Identity registration transaction submitted. " +
            "Check transaction result to get your agent ID.",
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get identity
  server.registerTool(
    "get_identity",
    {
      description:
        "Get agent identity information from ERC-8004 identity registry. " +
        "Returns owner address, URI, and wallet address if set.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to look up"),
      },
    },
    async ({ agentId }) => {
      try {
        const callerAddress = getCallerAddress();
        const identity = await service.getIdentity(agentId, callerAddress);

        if (!identity) {
          return createJsonResponse({
            success: false,
            agentId,
            message: "Agent ID not found",
          });
        }

        return createJsonResponse({
          success: true,
          agentId: identity.agentId,
          owner: identity.owner,
          uri: identity.uri || "(no URI set)",
          wallet: identity.wallet || "(no wallet set)",
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Reputation Tools
  // ==========================================================================

  // Give feedback
  server.registerTool(
    "give_feedback",
    {
      description:
        "Submit feedback for an agent using ERC-8004 reputation registry. " +
        "Value is normalized to 18 decimals (WAD) internally for aggregation. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to give feedback for"),
        value: z
          .number()
          .int()
          .min(0)
          .describe("Feedback value (e.g., 5 for 5-star rating)"),
        decimals: z
          .number()
          .int()
          .min(0)
          .max(18)
          .describe("Decimals for the value (e.g., 0 for integer ratings)"),
        tag1: z.string().optional().describe("Optional tag 1 (max 64 chars)"),
        tag2: z.string().optional().describe("Optional tag 2 (max 64 chars)"),
        endpoint: z.string().optional().describe("Optional endpoint URL"),
        feedbackUri: z.string().optional().describe("Optional feedback URI"),
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
    async ({ agentId, value, decimals, tag1, tag2, endpoint, feedbackUri, feedbackHash, fee, sponsored }) => {
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
          decimals,
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
          decimals,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get reputation
  server.registerTool(
    "get_reputation",
    {
      description:
        "Get aggregated reputation summary for an agent from ERC-8004 reputation registry. " +
        "Returns average rating as a raw WAD string (18 decimals) and total feedback count.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to get reputation for"),
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

  // ==========================================================================
  // Validation Tools
  // ==========================================================================

  // Request validation
  server.registerTool(
    "request_validation",
    {
      description:
        "Request third-party validation for an agent using ERC-8004 validation registry. " +
        "The validator will be notified and can respond with a 0-100 score. " +
        "Requires an unlocked wallet and must be called by agent owner or approved operator.",
      inputSchema: {
        validator: z.string().describe("Stacks address of the validator"),
        agentId: z.number().int().min(0).describe("Agent ID to request validation for"),
        requestUri: z.string().describe("URI with validation request details"),
        requestHash: z.string().describe("Unique request hash as hex string (32 bytes)"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ validator, agentId, requestUri, requestHash, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const normalizedHash = normalizeHex(requestHash, "requestHash", 32);
        const hashBuffer = Buffer.from(normalizedHash, "hex");

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.requestValidation(
          account,
          validator,
          agentId,
          requestUri,
          hashBuffer,
          feeAmount,
          sponsored
        );

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: "Validation request submitted successfully",
          validator,
          agentId,
          requestHash,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get validation status
  server.registerTool(
    "get_validation_status",
    {
      description:
        "Get the status of a validation request using ERC-8004 validation registry. " +
        "Returns validator, agent ID, response score (0-100), and response metadata.",
      inputSchema: {
        requestHash: z.string().describe("Request hash as hex string (32 bytes)"),
      },
    },
    async ({ requestHash }) => {
      try {
        const callerAddress = getCallerAddress();
        const normalizedHash = normalizeHex(requestHash, "requestHash", 32);
        const hashBuffer = Buffer.from(normalizedHash, "hex");

        const status = await service.getValidationStatus(hashBuffer, callerAddress);

        if (!status) {
          return createJsonResponse({
            success: false,
            requestHash,
            message: "Validation request not found",
            network: NETWORK,
          });
        }

        return createJsonResponse({
          success: true,
          requestHash,
          validator: status.validator,
          agentId: status.agentId,
          response: status.response,
          responseHash: status.responseHash,
          tag: status.tag || "(no tag)",
          lastUpdate: status.lastUpdate,
          hasResponse: status.hasResponse,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get validation summary
  server.registerTool(
    "get_validation_summary",
    {
      description:
        "Get validation summary for an agent using ERC-8004 validation registry. " +
        "Returns total validation count and average response score (0-100).",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to get validation summary for"),
      },
    },
    async ({ agentId }) => {
      try {
        const callerAddress = getCallerAddress();
        const summary = await service.getValidationSummary(agentId, callerAddress);

        return createJsonResponse({
          success: true,
          agentId,
          count: summary.count,
          averageResponse: summary.avgResponse,
          message:
            summary.count === 0
              ? "No validations yet for this agent"
              : `${summary.count} validation(s) with average score ${summary.avgResponse}/100`,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
