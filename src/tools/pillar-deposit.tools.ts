import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPillarApi } from "../services/pillar-api.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

export function registerPillarDepositTools(server: McpServer): void {
  // Generate a deposit address
  server.registerTool(
    "pillar_generate_deposit_address",
    {
      description:
        "Generate a Bitcoin deposit address for sBTC deposits into a Pillar smart wallet.",
      inputSchema: {
        walletAddress: z.string().describe("Smart wallet Stacks address to receive the sBTC"),
      },
    },
    async ({ walletAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.post("/api/sbtc/generate-deposit-address", {
          walletAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get deposit status
  server.registerTool(
    "pillar_get_deposit_status",
    {
      description:
        "Check the status of an sBTC deposit by Bitcoin transaction ID or deposit address.",
      inputSchema: {
        txid: z.string().optional().describe("Bitcoin transaction ID"),
        depositAddress: z.string().optional().describe("Bitcoin deposit address"),
      },
    },
    async ({ txid, depositAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/sbtc/deposit-status", {
          txid,
          depositAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // List deposits
  server.registerTool(
    "pillar_get_deposits",
    {
      description:
        "List sBTC deposits for a wallet address. Shows deposit history and statuses.",
      inputSchema: {
        walletAddress: z.string().describe("Smart wallet address to list deposits for"),
      },
    },
    async ({ walletAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/sbtc/deposits", {
          walletAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get wallet activity
  server.registerTool(
    "pillar_get_wallet_activity",
    {
      description:
        "Get activity history for a Pillar wallet. Shows boosts, unwinds, deposits, transfers, etc.",
      inputSchema: {
        walletAddress: z.string().describe("Smart wallet address"),
        limit: z.number().optional().describe("Max number of activities to return"),
        offset: z.number().optional().describe("Offset for pagination"),
      },
    },
    async ({ walletAddress, limit, offset }) => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/wallet-activity", {
          walletAddress,
          limit,
          offset,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
