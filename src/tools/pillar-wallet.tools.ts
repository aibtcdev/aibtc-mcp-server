import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPillarApi } from "../services/pillar-api.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

export function registerPillarWalletTools(server: McpServer): void {
  // Deploy a new smart wallet
  server.registerTool(
    "pillar_deploy_wallet",
    {
      description:
        "Deploy a new Pillar smart wallet. Returns the deployment transaction details.",
      inputSchema: {
        ownerAddress: z.string().describe("Stacks address of the wallet owner"),
      },
    },
    async ({ ownerAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.post("/api/smart-wallet/deploy", { ownerAddress });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // List smart wallets
  server.registerTool(
    "pillar_list_wallets",
    {
      description:
        "List all Pillar smart wallets. Optionally filter by owner address.",
      inputSchema: {
        ownerAddress: z.string().optional().describe("Filter by owner address"),
      },
    },
    async ({ ownerAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/smart-wallet/list", {
          ownerAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get a specific smart wallet
  server.registerTool(
    "pillar_get_wallet",
    {
      description: "Get details of a specific Pillar smart wallet by ID.",
      inputSchema: {
        walletId: z.string().describe("Smart wallet ID"),
      },
    },
    async ({ walletId }) => {
      try {
        const api = getPillarApi();
        const result = await api.get(`/api/smart-wallet/${walletId}`);
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Add admin to smart wallet
  server.registerTool(
    "pillar_add_admin",
    {
      description:
        "Add an admin address to a Pillar smart wallet. Returns the transaction to be signed.",
      inputSchema: {
        walletId: z.string().describe("Smart wallet ID"),
        adminAddress: z.string().describe("Stacks address of the new admin"),
      },
    },
    async ({ walletId, adminAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.post("/api/smart-wallet/add-admin", {
          walletId,
          adminAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Transfer sBTC (SIP-010) from smart wallet
  server.registerTool(
    "pillar_transfer_sbtc",
    {
      description:
        "Transfer sBTC from a Pillar smart wallet using SIP-010 transfer. Returns the transaction to be signed.",
      inputSchema: {
        walletId: z.string().describe("Smart wallet ID"),
        recipient: z.string().describe("Recipient Stacks address"),
        amount: z.string().describe("Amount in smallest unit (sats for sBTC)"),
      },
    },
    async ({ walletId, recipient, amount }) => {
      try {
        const api = getPillarApi();
        const result = await api.post("/api/smart-wallet/sip010-transfer", {
          walletId,
          recipient,
          amount,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get balances for an address
  server.registerTool(
    "pillar_get_balances",
    {
      description:
        "Get token balances for a Stacks address via Pillar backend.",
      inputSchema: {
        address: z.string().describe("Stacks address to check balances for"),
      },
    },
    async ({ address }) => {
      try {
        const api = getPillarApi();
        const result = await api.get(`/api/stacks/address/${address}/balances`);
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get transaction status
  server.registerTool(
    "pillar_get_tx_status",
    {
      description: "Get the status of a Stacks transaction via Pillar backend.",
      inputSchema: {
        txid: z.string().describe("Transaction ID to check"),
      },
    },
    async ({ txid }) => {
      try {
        const api = getPillarApi();
        const result = await api.get(`/api/stacks/tx/${txid}`);
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
