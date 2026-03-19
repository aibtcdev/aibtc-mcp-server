import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import credentials from "../services/credentials.js";

/**
 * Ensure the credential store is unlocked before operations.
 * Uses ARC_CREDS_PASSWORD env var.
 */
async function ensureUnlocked(): Promise<void> {
  if (!credentials.isUnlocked()) {
    await credentials.unlock();
  }
}

/**
 * Register credential management tools with the MCP server.
 *
 * Provides encrypted credential storage (AES-256-GCM + scrypt KDF)
 * at ~/.aibtc/credentials.enc. Password from ARC_CREDS_PASSWORD env var.
 */
export function registerCredentialsTools(server: McpServer): void {
  /**
   * List stored credentials (service/key names only, no values)
   */
  server.registerTool(
    "credentials_list",
    {
      description:
        "List all stored credentials. Shows service names, key names, and last-updated timestamps. Does NOT reveal credential values.",
      inputSchema: {},
    },
    async () => {
      try {
        await ensureUnlocked();
        const entries = credentials.list();

        return createJsonResponse({
          count: entries.length,
          credentials: entries,
          storePath: credentials.storePath(),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Get a credential value
   */
  server.registerTool(
    "credentials_get",
    {
      description:
        "Retrieve a stored credential value by service and key. Returns the decrypted value. WARNING: The returned value is sensitive — do not log or display it unnecessarily.",
      inputSchema: {
        service: z.string().min(1).describe("Service name (e.g. 'github', 'openrouter')"),
        key: z.string().min(1).describe("Key name within the service (e.g. 'api_key', 'token')"),
      },
    },
    async ({ service, key }) => {
      try {
        await ensureUnlocked();
        const value = credentials.get(service, key);

        if (value === null) {
          return createJsonResponse({
            found: false,
            service,
            key,
            message: `No credential found for ${service}/${key}`,
          });
        }

        return createJsonResponse({
          found: true,
          service,
          key,
          value,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Set or update a credential
   */
  server.registerTool(
    "credentials_set",
    {
      description:
        "Store or update a credential. Encrypts the value with AES-256-GCM and saves to ~/.aibtc/credentials.enc. If the service/key pair already exists, it is updated.",
      inputSchema: {
        service: z.string().min(1).describe("Service name (e.g. 'github', 'openrouter')"),
        key: z.string().min(1).describe("Key name within the service (e.g. 'api_key', 'token')"),
        value: z
          .string()
          .min(1)
          .describe("The credential value to store — WARNING: sensitive"),
      },
    },
    async ({ service, key, value }) => {
      try {
        await ensureUnlocked();

        const existed = credentials.get(service, key) !== null;
        await credentials.set(service, key, value);

        return createJsonResponse({
          success: true,
          action: existed ? "updated" : "created",
          service,
          key,
          storedIn: credentials.storePath(),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Delete a credential
   */
  server.registerTool(
    "credentials_delete",
    {
      description:
        "Remove a stored credential by service and key. The encrypted store file is rewritten without the deleted entry.",
      inputSchema: {
        service: z.string().min(1).describe("Service name (e.g. 'github', 'openrouter')"),
        key: z.string().min(1).describe("Key name within the service (e.g. 'api_key', 'token')"),
      },
    },
    async ({ service, key }) => {
      try {
        await ensureUnlocked();
        const deleted = await credentials.del(service, key);

        return createJsonResponse({
          success: deleted,
          service,
          key,
          message: deleted
            ? `Credential ${service}/${key} deleted`
            : `No credential found for ${service}/${key}`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Unlock / verify credential store
   */
  server.registerTool(
    "credentials_unlock",
    {
      description:
        "Verify that the credential store password works and show store info. Uses ARC_CREDS_PASSWORD env var. Creates a new empty store if none exists.",
      inputSchema: {},
    },
    async () => {
      try {
        await credentials.unlock();
        const entries = credentials.list();

        return createJsonResponse({
          success: true,
          unlocked: true,
          credentialCount: entries.length,
          storePath: credentials.storePath(),
          message: "Credential store unlocked and verified",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
