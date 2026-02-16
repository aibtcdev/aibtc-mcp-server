import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  getHiroApiKey,
  setHiroApiKey,
  clearHiroApiKey,
  getStacksApiUrl,
  setStacksApiUrl,
  clearStacksApiUrl,
  initializeStorage,
} from "../utils/storage.js";
import { getApiBaseUrl, NETWORK } from "../config/networks.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");

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

  // ==========================================================================
  // Stacks API URL (custom node)
  // ==========================================================================

  /**
   * Set custom Stacks API URL
   */
  server.registerTool(
    "set_stacks_api_url",
    {
      description: `Point all Stacks API requests at a custom node instead of the default Hiro API.
Use this if you run your own stacks-blockchain-api node (default port 3999) or use a third-party provider.
The URL should serve the same /v2/ and /extended/v1/ endpoints as api.hiro.so.
Example: http://localhost:3999`,
      inputSchema: {
        url: z
          .string()
          .url()
          .describe("Base URL of your Stacks API node (e.g. http://localhost:3999)"),
      },
    },
    async ({ url }) => {
      try {
        await initializeStorage();
        // Strip trailing slash for consistency
        const cleanUrl = url.replace(/\/+$/, "");
        await setStacksApiUrl(cleanUrl);

        return createJsonResponse({
          success: true,
          message: "Custom Stacks API URL saved. All subsequent Stacks API requests will use this node.",
          url: cleanUrl,
          storedIn: "~/.aibtc/config.json",
          tip: "Use get_stacks_api_url to verify, or delete_stacks_api_url to revert to the default Hiro API.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Get current Stacks API URL
   */
  server.registerTool(
    "get_stacks_api_url",
    {
      description:
        "Show the current Stacks API URL being used for blockchain queries. Indicates whether it's a custom node or the default Hiro API.",
      inputSchema: {},
    },
    async () => {
      try {
        await initializeStorage();
        const customUrl = await getStacksApiUrl();
        const defaultUrl = getApiBaseUrl(NETWORK);

        return createJsonResponse({
          activeUrl: customUrl || defaultUrl,
          isCustom: !!customUrl,
          source: customUrl ? "~/.aibtc/config.json" : "default (Hiro API)",
          defaultUrl,
          network: NETWORK,
          hint: customUrl
            ? "Using custom Stacks API node. Use delete_stacks_api_url to revert to the default Hiro API."
            : "Using default Hiro API. Use set_stacks_api_url to point to your own node.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Delete custom Stacks API URL
   */
  server.registerTool(
    "delete_stacks_api_url",
    {
      description:
        "Remove the custom Stacks API URL and revert to the default Hiro API (api.mainnet.hiro.so or api.testnet.hiro.so).",
      inputSchema: {},
    },
    async () => {
      try {
        await initializeStorage();
        const hadUrl = !!(await getStacksApiUrl());
        await clearStacksApiUrl();
        const defaultUrl = getApiBaseUrl(NETWORK);

        return createJsonResponse({
          success: true,
          message: hadUrl
            ? `Custom Stacks API URL removed. Reverted to default: ${defaultUrl}`
            : "No custom Stacks API URL was set.",
          activeUrl: defaultUrl,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Server Version
  // ==========================================================================

  /**
   * Get server version and check for updates
   */
  server.registerTool(
    "get_server_version",
    {
      description: `Check the currently running MCP server version and compare with the latest published version on npm.
Use this to detect if you're running a stale cached version (common with npx).
If your version is outdated, clear the npx cache and reinstall: npx clear-npx-cache && npx @aibtc/mcp-server@latest --install`,
      inputSchema: {},
    },
    async () => {
      try {
        const currentVersion = packageJson.version;

        // Fetch latest version from npm registry
        let latestVersion = "unknown";

        try {
          const response = await fetch("https://registry.npmjs.org/@aibtc/mcp-server/latest");
          if (response.ok) {
            const data = await response.json() as { version: string };
            latestVersion = data.version;
          }
        } catch (fetchError) {
          // Network error or npm registry unavailable - non-fatal
          console.error("Failed to fetch latest version from npm:", fetchError);
        }

        // Compare versions numerically (handles dev > published correctly)
        const compare = (a: string, b: string): number => {
          const pa = a.split(".").map(Number);
          const pb = b.split(".").map(Number);
          for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] ?? 0, nb = pb[i] ?? 0;
            if (na !== nb) return na - nb;
          }
          return 0;
        };

        const fetched = latestVersion !== "unknown";
        const updateAvailable = fetched && compare(currentVersion, latestVersion) < 0;
        const isLatest = fetched && compare(currentVersion, latestVersion) >= 0;

        return createJsonResponse({
          currentVersion,
          latestVersion,
          isLatest,
          updateAvailable,
          package: "@aibtc/mcp-server",
          hint: updateAvailable
            ? "⚠️  Update available! Clear npx cache and reinstall: npx clear-npx-cache && npx @aibtc/mcp-server@latest --install"
            : fetched
              ? "✅ Running the latest version"
              : "Unable to verify latest version (network error)",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
