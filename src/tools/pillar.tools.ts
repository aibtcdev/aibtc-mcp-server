// Pillar MCP Tools - Handoff model
// MCP creates intent → Opens frontend → Frontend handles signing → MCP polls for result
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPillarApi } from "../services/pillar-api.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { exec } from "child_process";

const PILLAR_FRONTEND_URL = "https://pillarbtc.com";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300000; // 5 minutes

// Open URL in default browser (cross-platform)
function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let cmd: string;

    if (platform === "darwin") {
      cmd = `open "${url}"`;
    } else if (platform === "win32") {
      cmd = `start "" "${url}"`;
    } else {
      cmd = `xdg-open "${url}"`;
    }

    exec(cmd, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// Poll for operation status
async function pollOperationStatus(
  opId: string,
  timeoutMs: number = POLL_TIMEOUT_MS
): Promise<{ status: string; txId?: string; error?: string }> {
  const api = getPillarApi();
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await api.get<{
        status: string;
        txId?: string;
        error?: string;
      }>(`/api/mcp/op-status/${opId}`);

      if (result.status === "completed") {
        return result;
      }

      if (result.status === "failed" || result.status === "cancelled") {
        return result;
      }

      // Still pending, wait and retry
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      // API error, wait and retry
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  return { status: "timeout", error: "Operation timed out waiting for completion" };
}

export function registerPillarTools(server: McpServer): void {
  // Tool 1: Open Pillar frontend (for wallet creation, general access)
  server.registerTool(
    "pillar_open",
    {
      description:
        "Open Pillar frontend in browser. Use this when user wants to create a smart wallet, " +
        "view their dashboard, or access Pillar directly. No smart wallet required.",
      inputSchema: {
        action: z
          .enum(["home", "create-wallet", "missions", "leaderboard"])
          .optional()
          .describe("Optional: specific page to open (default: home)"),
      },
    },
    async ({ action }) => {
      try {
        const paths: Record<string, string> = {
          home: "/",
          "create-wallet": "/", // Main page handles wallet creation
          missions: "/missions",
          leaderboard: "/leaderboard",
        };
        const path = paths[action || "home"] || "/";
        const url = `${PILLAR_FRONTEND_URL}${path}`;

        await openBrowser(url);

        return createJsonResponse({
          success: true,
          message: `Opened ${url} in browser. Complete the action there.`,
          url,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 2: Send sBTC (full handoff + polling flow)
  server.registerTool(
    "pillar_send",
    {
      description:
        "Send sBTC from your Pillar smart wallet to a BNS name or Stacks address. " +
        "Opens the frontend for signing, then waits for confirmation. " +
        "Example: 'send 1000 sats to muneeb.btc' or 'send 0.001 sBTC to SP...'",
      inputSchema: {
        to: z.string().describe("Recipient: BNS name (e.g., muneeb.btc) or Stacks address (SP...)"),
        amount: z.number().describe("Amount in satoshis"),
        walletAddress: z.string().describe("Your Pillar smart wallet address (SP...)"),
      },
    },
    async ({ to, amount, walletAddress }) => {
      try {
        const api = getPillarApi();

        // Step 1: Create pending operation
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "send",
          walletAddress,
          params: {
            to,
            amount,
          },
        });

        const { opId } = createResult;

        // Step 2: Open frontend with operation ID
        const url = `${PILLAR_FRONTEND_URL}/?op=${opId}`;
        await openBrowser(url);

        // Step 3: Poll for completion
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.txId) {
          return createJsonResponse({
            success: true,
            message: `Transaction submitted successfully!`,
            txId: result.txId,
            explorerUrl: `https://explorer.stacks.co/txid/${result.txId}?chain=mainnet`,
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({
            success: false,
            message: "Transaction was cancelled by user.",
          });
        }

        if (result.status === "failed") {
          return createJsonResponse({
            success: false,
            message: `Transaction failed: ${result.error || "Unknown error"}`,
          });
        }

        // Timeout
        return createJsonResponse({
          success: false,
          message: "Timed out waiting for transaction. Check the frontend to see if it completed.",
          opId,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
