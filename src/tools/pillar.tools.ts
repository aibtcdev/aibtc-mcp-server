import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPillarApi } from "../services/pillar-api.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

export function registerPillarTools(server: McpServer): void {
  // Get a leverage quote
  server.registerTool(
    "pillar_get_quote",
    {
      description:
        "Get a quick leverage quote from Pillar. Shows estimated position details for a given sBTC amount at 1.5x leverage.",
      inputSchema: {
        amount: z.string().describe("sBTC amount in sats"),
        walletAddress: z.string().describe("Smart wallet address"),
      },
    },
    async ({ amount, walletAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/pillar/quote", {
          amount,
          walletAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get a refined preview with swap data
  server.registerTool(
    "pillar_get_preview",
    {
      description:
        "Get a refined leverage preview with actual swap data. Use after getting a quote to see exact transaction details before boosting.",
      inputSchema: {
        amount: z.string().describe("sBTC amount in sats"),
        walletAddress: z.string().describe("Smart wallet address"),
      },
    },
    async ({ amount, walletAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/pillar/preview", {
          amount,
          walletAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Execute boost (leverage up)
  server.registerTool(
    "pillar_boost",
    {
      description:
        "Execute a Pillar boost (leverage position). Requires a user signature obtained out-of-band (e.g. via Telegram/WhatsApp). " +
        "Flow: get quote → get preview → user signs → boost with signature.",
      inputSchema: {
        walletAddress: z.string().describe("Smart wallet address"),
        amount: z.string().describe("sBTC amount in sats"),
        signature: z.string().describe("User's transaction signature (hex)"),
        publicKey: z.string().describe("User's public key (hex)"),
      },
    },
    async ({ walletAddress, amount, signature, publicKey }) => {
      try {
        const api = getPillarApi();
        const result = await api.post("/api/pillar/boost", {
          walletAddress,
          amount,
          signature,
          publicKey,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get unwind quote
  server.registerTool(
    "pillar_get_unwind_quote",
    {
      description:
        "Get a quote for unwinding (closing) a Pillar leverage position. Shows estimated output and fees.",
      inputSchema: {
        walletAddress: z.string().describe("Smart wallet address"),
      },
    },
    async ({ walletAddress }) => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/pillar/unwind-quote", {
          walletAddress,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Execute unwind (close position)
  server.registerTool(
    "pillar_unwind",
    {
      description:
        "Execute a Pillar unwind (close leverage position). Requires a user signature obtained out-of-band. " +
        "Flow: get unwind quote → user signs → unwind with signature.",
      inputSchema: {
        walletAddress: z.string().describe("Smart wallet address"),
        signature: z.string().describe("User's transaction signature (hex)"),
        publicKey: z.string().describe("User's public key (hex)"),
      },
    },
    async ({ walletAddress, signature, publicKey }) => {
      try {
        const api = getPillarApi();
        const result = await api.post("/api/pillar/unwind", {
          walletAddress,
          signature,
          publicKey,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get BTC price
  server.registerTool(
    "pillar_get_btc_price",
    {
      description: "Get the current BTC price from Pillar backend.",
    },
    async () => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/price/btc");
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get Zest reserve parameters
  server.registerTool(
    "pillar_get_zest_params",
    {
      description:
        "Get Zest Protocol lending reserve parameters from Pillar backend. Includes interest rates, collateral factors, etc.",
    },
    async () => {
      try {
        const api = getPillarApi();
        const result = await api.get("/api/zest/reserve-params");
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
