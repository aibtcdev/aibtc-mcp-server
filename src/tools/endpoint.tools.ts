import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createApiClient, API_URL } from "../services/x402.service.js";
import {
  ALL_ENDPOINTS,
  searchEndpoints,
  formatEndpointsTable,
  getEndpointsBySource,
  getCategories,
} from "../endpoints/registry.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

const ALL_SOURCES = "x402.biwas.xyz, x402.aibtc.com, stx402.com, aibtc.com";

export function registerEndpointTools(server: McpServer): void {
  // List x402 endpoints
  server.registerTool(
    "list_x402_endpoints",
    {
      description: `List known x402 API endpoints from ${ALL_SOURCES}.

The agent can:
1. Execute x402 endpoints from these sources (paid API calls with automatic payment handling)
2. Execute direct Stacks transactions (transfer STX, call contracts, deploy contracts)

Sources:
- x402.biwas.xyz: DeFi analytics, market data, wallet analysis, Zest/ALEX protocols
- x402.aibtc.com: AI inference, OpenRouter integration, Stacks utilities, hashing, storage
- stx402.com: AI services, cryptography, storage, utilities, agent registry
- aibtc.com: Inbox messaging system`,
      inputSchema: {
        source: z
          .enum(["x402.biwas.xyz", "x402.aibtc.com", "stx402.com", "aibtc.com", "all"])
          .optional()
          .default("all")
          .describe("Filter by API source"),
        category: z
          .string()
          .optional()
          .describe("Filter by category (use without value to see available categories)"),
        search: z
          .string()
          .optional()
          .describe("Search endpoints by keyword (searches path, description, category)"),
        showFreeOnly: z
          .boolean()
          .optional()
          .describe("Only show free endpoints (no payment required)"),
        showPaidOnly: z
          .boolean()
          .optional()
          .describe("Only show paid endpoints (require x402 payment)"),
      },
    },
    async ({ source, category, search, showFreeOnly, showPaidOnly }) => {
      try {
        let endpoints = ALL_ENDPOINTS;

        if (source && source !== "all") {
          endpoints = getEndpointsBySource(source);
        }

        if (showFreeOnly) {
          endpoints = endpoints.filter((ep) => ep.cost === "FREE");
        } else if (showPaidOnly) {
          endpoints = endpoints.filter((ep) => ep.cost !== "FREE");
        }

        if (category) {
          endpoints = endpoints.filter(
            (ep) => ep.category.toLowerCase() === category.toLowerCase()
          );
        }

        if (search) {
          const searchResults = searchEndpoints(search);
          endpoints = endpoints.filter((ep) => searchResults.includes(ep));
        }

        if (endpoints.length === 0) {
          const categories = getCategories();
          return {
            content: [
              {
                type: "text" as const,
                text: `No endpoints found matching your criteria.

Available categories: ${categories.join(", ")}

Sources: ${ALL_SOURCES}

If you're looking to perform a direct blockchain action (transfer STX, call a contract), those are available via separate tools.`,
              },
            ],
          };
        }

        const formatted = formatEndpointsTable(endpoints);
        const sourceInfo =
          source === "all"
            ? `Sources: ${ALL_SOURCES}`
            : `Source: ${source}`;
        return {
          content: [
            {
              type: "text" as const,
              text: `# Available x402 Endpoints (${endpoints.length} total)\n\n${sourceInfo}\nDefault API: ${API_URL}\n${formatted}\n\n---\nUse execute_x402_endpoint to call any of these endpoints.`,
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Execute x402 endpoint
  server.registerTool(
    "execute_x402_endpoint",
    {
      description: `Execute an x402 API endpoint. Payment is handled automatically.

Supported sources:
- x402.biwas.xyz (default): Use path like "/api/pools/trending"
- x402.aibtc.com: Use apiUrl="https://x402.aibtc.com" with path like "/inference/openrouter/chat"
- stx402.com: Use apiUrl="https://stx402.com" with path like "/api/ai/dad-joke"
- aibtc.com: Use apiUrl="https://aibtc.com" with path like "/api/inbox/{address}"
- Any x402-compatible URL: Use url parameter with full endpoint URL

Use list_x402_endpoints to discover available endpoints.`,
      inputSchema: {
        method: z
          .enum(["GET", "POST", "PUT", "DELETE"])
          .default("GET")
          .describe("HTTP method"),
        url: z
          .string()
          .url()
          .optional()
          .describe("Full endpoint URL (e.g., 'https://stx402.com/api/ai/dad-joke'). Takes precedence over path+apiUrl."),
        path: z
          .string()
          .optional()
          .describe("API endpoint path (e.g., '/api/pools/trending'). Required if url is not provided."),
        apiUrl: z
          .string()
          .url()
          .optional()
          .describe("API base URL. Known sources: x402.biwas.xyz, x402.aibtc.com, stx402.com, aibtc.com. Defaults to configured API_URL."),
        params: z
          .record(z.string(), z.string())
          .optional()
          .describe("Query parameters for GET requests"),
        data: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Request body for POST/PUT requests"),
      },
    },
    async ({ method, url, path, apiUrl, params, data }) => {
      let baseUrl = "";
      let requestPath = "";

      try {
        if (url) {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:") {
            throw new Error("Only HTTPS URLs are allowed for x402 endpoints");
          }
          baseUrl = `${parsed.protocol}//${parsed.host}`;
          requestPath = parsed.pathname;
          // Merge URL query params into params to avoid duplication
          if (parsed.search) {
            const urlParams = Object.fromEntries(parsed.searchParams);
            params = { ...urlParams, ...params };
          }
        } else if (path) {
          baseUrl = apiUrl || API_URL;
          requestPath = path;
        } else {
          throw new Error("Either 'url' or 'path' parameter must be provided");
        }

        if (apiUrl && !apiUrl.startsWith("https://")) {
          throw new Error("Only HTTPS URLs are allowed for x402 endpoints");
        }

        const api = await createApiClient(baseUrl);
        const response = await api.request({ method, url: requestPath, params, data });
        const endpoint = `${baseUrl}${requestPath}`;

        return createJsonResponse({
          endpoint: `${method} ${endpoint}`,
          response: response.data,
        });
      } catch (error) {
        const endpoint = baseUrl ? `${baseUrl}${requestPath}` : (url || path || "unknown");
        let message = "Unknown error";
        if (error instanceof Error) {
          message = error.message;
        }
        const axiosError = error as { response?: { status?: number; data?: unknown } };
        if (axiosError.response) {
          if (axiosError.response.status === 404) {
            message = `Endpoint not found: ${endpoint}. Use list_x402_endpoints to see available endpoints.`;
          } else {
            message = `HTTP ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`;
          }
        }
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true as const,
        };
      }
    }
  );
}
