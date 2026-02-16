import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  getHiroApiKey,
  setHiroApiKey,
  clearHiroApiKey,
  initializeStorage,
} from "../utils/storage.js";

/**
 * Register settings tools for API key management
 */
export function registerSettingsTools(server: McpServer): void {
  /**
   * Set Hiro API key
   */
  server.registerTool(
    "set_hiro_api_key",
    {
      description: `Save a Hiro API key to ~/.aibtc/config.json for authenticated Hiro API requests.
Authenticated requests get higher rate limits than public (unauthenticated) requests.
Get a free API key at https://platform.hiro.so/`,
      inputSchema: {
        apiKey: z
          .string()
          .min(1)
          .describe("Your Hiro API key - WARNING: sensitive value"),
      },
    },
    async ({ apiKey }) => {
      try {
        await initializeStorage();
        await setHiroApiKey(apiKey);

        const masked =
          apiKey.length > 8
            ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
            : "****";

        return createJsonResponse({
          success: true,
          message: "Hiro API key saved. All subsequent Hiro API requests will use this key.",
          maskedKey: masked,
          storedIn: "~/.aibtc/config.json",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Get Hiro API key status
   */
  server.registerTool(
    "get_hiro_api_key",
    {
      description:
        "Check whether a Hiro API key is configured. Shows the key source (stored file or environment variable) and a masked preview.",
      inputSchema: {},
    },
    async () => {
      try {
        await initializeStorage();
        const storedKey = await getHiroApiKey();
        const envKey = process.env.HIRO_API_KEY || "";

        // Determine which key is active (stored takes priority)
        const activeKey = storedKey || envKey;
        const source = storedKey
          ? "~/.aibtc/config.json"
          : envKey
            ? "HIRO_API_KEY environment variable"
            : "none";

        const masked = activeKey.length > 8
          ? `${activeKey.slice(0, 4)}...${activeKey.slice(-4)}`
          : activeKey
            ? "****"
            : "";

        return createJsonResponse({
          configured: !!activeKey,
          source,
          maskedKey: masked || "(not set)",
          hint: activeKey
            ? "API key is active. Hiro API requests use authenticated rate limits."
            : "No API key configured. Using public rate limits. Get a key at https://platform.hiro.so/",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Delete Hiro API key
   */
  server.registerTool(
    "delete_hiro_api_key",
    {
      description:
        "Remove the stored Hiro API key from ~/.aibtc/config.json. If HIRO_API_KEY is set in the environment, that will still be used as a fallback.",
      inputSchema: {},
    },
    async () => {
      try {
        await initializeStorage();
        const hadKey = !!(await getHiroApiKey());
        await clearHiroApiKey();

        const envFallback = !!process.env.HIRO_API_KEY;

        return createJsonResponse({
          success: true,
          message: hadKey
            ? "Hiro API key removed from ~/.aibtc/config.json."
            : "No stored Hiro API key to remove.",
          envFallbackActive: envFallback,
          hint: envFallback
            ? "HIRO_API_KEY environment variable is still set and will be used."
            : "No API key configured. Requests will use public rate limits.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
