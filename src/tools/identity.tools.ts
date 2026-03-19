/**
 * Identity Tools (ERC-8004)
 *
 * MCP tools for on-chain agent identity management via the ERC-8004 identity registry.
 *
 * Read Tools (no wallet required):
 * - identity_get_last_id       - Get most recently minted agent ID
 * - identity_get               - Get agent identity info (owner, URI, wallet)
 * - identity_get_metadata      - Read a single metadata value by key
 *
 * Write Tools (wallet required):
 * - identity_register          - Register new agent identity on-chain
 * - identity_set_uri           - Update agent identity URI
 * - identity_set_metadata      - Set metadata key-value pair
 * - identity_set_approval      - Approve or revoke operator
 * - identity_set_wallet        - Link active wallet to agent identity
 * - identity_unset_wallet      - Remove agent wallet association
 * - identity_transfer          - Transfer identity NFT to new owner
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

export function registerIdentityTools(server: McpServer): void {
  const service = new Erc8004Service(NETWORK);

  // ==========================================================================
  // Read Tools (no wallet required)
  // ==========================================================================

  server.registerTool(
    "identity_get_last_id",
    {
      description:
        "Get the most recently minted agent ID from the ERC-8004 identity registry. " +
        "Returns null if no agents have been registered.",
      inputSchema: {},
    },
    async () => {
      try {
        const callerAddress = getCallerAddress();
        const lastId = await service.getLastId(callerAddress);

        return createJsonResponse({
          success: true,
          lastId,
          message:
            lastId !== null
              ? `Last minted agent ID: ${lastId}`
              : "No agents registered yet",
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "identity_get",
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

  server.registerTool(
    "identity_get_metadata",
    {
      description:
        "Read a single metadata value by key from an agent's ERC-8004 identity. " +
        "Returns the raw buffer value as a hex string.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to query"),
        key: z.string().max(MAX_METADATA_KEY_LENGTH).describe("Metadata key to read"),
      },
    },
    async ({ agentId, key }) => {
      try {
        const callerAddress = getCallerAddress();
        const value = await service.getMetadata(agentId, key, callerAddress);

        if (value === null) {
          return createJsonResponse({
            success: false,
            agentId,
            key,
            message: `No metadata found for key "${key}" on agent ${agentId}`,
          });
        }

        return createJsonResponse({
          success: true,
          agentId,
          key,
          value,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Write Tools (wallet required)
  // ==========================================================================

  server.registerTool(
    "identity_register",
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

        let parsedMetadata: Array<{ key: string; value: Buffer }> | undefined;
        if (metadata && metadata.length > 0) {
          parsedMetadata = metadata.map((m) => {
            const normalized = normalizeHex(m.value, `metadata value for key "${m.key}"`);
            const buf = Buffer.from(normalized, "hex");
            if (buf.length > MAX_METADATA_VALUE_BYTES) {
              throw new Error(
                `metadata value for key "${m.key}" exceeds ${MAX_METADATA_VALUE_BYTES} bytes (got ${buf.length})`
              );
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

  server.registerTool(
    "identity_set_uri",
    {
      description:
        "Update the URI for an agent identity in the ERC-8004 identity registry. " +
        "Requires an unlocked wallet. Must be called by agent owner or approved operator.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to update"),
        uri: z.string().describe("New URI pointing to agent metadata (IPFS, HTTP, etc.)"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, uri, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.updateIdentityUri(account, agentId, uri, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: `URI update transaction submitted for agent ${agentId}`,
          agentId,
          uri,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "identity_set_metadata",
    {
      description:
        "Set a metadata key-value pair on an agent identity in the ERC-8004 identity registry. " +
        "Value must be a hex-encoded buffer (max 512 bytes). " +
        'The key "agentWallet" is reserved — use identity_set_wallet instead. ' +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to update"),
        key: z.string().max(MAX_METADATA_KEY_LENGTH).describe("Metadata key (max 128 chars)"),
        value: z
          .string()
          .describe(
            'Metadata value as hex-encoded buffer (e.g., "616c696365" for "alice"). Max 512 bytes.'
          ),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, key, value, fee, sponsored }) => {
      try {
        if (key === "agentWallet") {
          throw new Error(
            'The "agentWallet" key is reserved. Use identity_set_wallet or identity_unset_wallet instead.'
          );
        }

        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const normalized = normalizeHex(value, "metadata value");
        const buf = Buffer.from(normalized, "hex");
        if (buf.length > MAX_METADATA_VALUE_BYTES) {
          throw new Error(
            `metadata value exceeds ${MAX_METADATA_VALUE_BYTES} bytes (got ${buf.length})`
          );
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.setMetadata(account, agentId, key, buf, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: `Metadata update transaction submitted for agent ${agentId}, key "${key}"`,
          agentId,
          key,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "identity_set_approval",
    {
      description:
        "Approve or revoke an operator for an agent identity in the ERC-8004 identity registry. " +
        "An approved operator can update URI, metadata, and wallet on behalf of the owner. " +
        "Only the NFT owner can call this. Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to update"),
        operator: z.string().describe("Stacks address of the operator to approve or revoke"),
        approved: z
          .boolean()
          .optional()
          .default(true)
          .describe("Grant approval (true) or revoke (false). Defaults to true."),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, operator, approved, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.setApproval(account, agentId, operator, approved, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: `Operator ${approved ? "approved" : "revoked"} for agent ${agentId}`,
          agentId,
          operator,
          approved,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "identity_set_wallet",
    {
      description:
        "Link the active Stacks wallet address to an agent identity in the ERC-8004 identity registry. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to update"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.setWallet(account, agentId, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: `Wallet link transaction submitted for agent ${agentId}`,
          agentId,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "identity_unset_wallet",
    {
      description:
        "Remove the agent wallet association from an agent identity in the ERC-8004 identity registry. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID to update"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.unsetWallet(account, agentId, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message: `Wallet unlink transaction submitted for agent ${agentId}`,
          agentId,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "identity_transfer",
    {
      description:
        "Transfer an agent identity NFT to a new owner in the ERC-8004 identity registry. " +
        "This clears the agent wallet association — run identity_set_wallet after if needed. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        agentId: z.number().int().min(0).describe("Agent ID (token ID) to transfer"),
        recipient: z.string().describe("Stacks address of the new owner"),
        fee: z
          .string()
          .optional()
          .describe('Fee preset ("low", "medium", "high") or micro-STX amount. Optional.'),
        sponsored: sponsoredSchema,
      },
    },
    async ({ agentId, recipient, fee, sponsored }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("No active wallet. Please unlock your wallet first.");
        }

        const feeAmount = fee ? await resolveFee(fee, NETWORK, "contract_call") : undefined;
        const result = await service.transferIdentity(account, agentId, recipient, feeAmount, sponsored);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          message:
            `Identity transfer transaction submitted for agent ${agentId} to ${recipient}. ` +
            "Note: agent wallet association is cleared on transfer.",
          agentId,
          recipient,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
