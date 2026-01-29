// Pillar MCP Tools - Handoff model
// MCP creates intent → Opens frontend → Frontend handles signing → MCP polls for result
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPillarApi } from "../services/pillar-api.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PILLAR_FRONTEND_URL = "https://pillarbtc.com";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300000; // 5 minutes
const SESSION_FILE = path.join(os.homedir(), ".aibtc", "pillar-session.json");

// Session management
interface PillarSession {
  walletAddress: string;
  walletName?: string;
  connectedAt: number;
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadSession(): PillarSession | null {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function saveSession(session: PillarSession): void {
  ensureDir(SESSION_FILE);
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function clearSession(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {
    // Ignore errors
  }
}

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
): Promise<{ status: string; txId?: string; walletAddress?: string; walletName?: string; error?: string }> {
  const api = getPillarApi();
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await api.get<{
        status: string;
        txId?: string;
        walletAddress?: string;
        walletName?: string;
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
  // Tool 1: Connect to Pillar (handoff to frontend, returns wallet address)
  server.registerTool(
    "pillar_connect",
    {
      description:
        "Connect to your Pillar smart wallet. Opens the Pillar website - if you're logged in, " +
        "it will automatically connect and return your wallet address. Use this first before other Pillar actions.",
      inputSchema: {},
    },
    async () => {
      try {
        const api = getPillarApi();

        // Step 1: Create connect operation
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "connect",
        });

        const { opId } = createResult;

        // Step 2: Open frontend with operation ID
        const url = `${PILLAR_FRONTEND_URL}/?op=${opId}`;
        await openBrowser(url);

        // Step 3: Poll for completion
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.walletAddress) {
          // Save session locally
          const session: PillarSession = {
            walletAddress: result.walletAddress,
            walletName: result.walletName,
            connectedAt: Date.now(),
          };
          saveSession(session);

          return createJsonResponse({
            success: true,
            message: `Connected to Pillar!`,
            walletAddress: result.walletAddress,
            walletName: result.walletName,
          });
        }

        if (result.status === "failed") {
          return createJsonResponse({
            success: false,
            message: result.error || "Failed to connect. Make sure you're logged into Pillar.",
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({
            success: false,
            message: "Connection cancelled.",
          });
        }

        // Timeout
        return createJsonResponse({
          success: false,
          message: "Timed out waiting for connection. Please try again.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 2: Disconnect from Pillar
  server.registerTool(
    "pillar_disconnect",
    {
      description: "Disconnect from Pillar. Clears locally stored wallet address.",
      inputSchema: {},
    },
    async () => {
      const session = loadSession();
      clearSession();
      return createJsonResponse({
        success: true,
        message: session
          ? `Disconnected from ${session.walletName || session.walletAddress}`
          : "Not connected to Pillar.",
      });
    }
  );

  // Tool 3: Get Pillar connection status
  server.registerTool(
    "pillar_status",
    {
      description: "Check if you're connected to Pillar and get your wallet address.",
      inputSchema: {},
    },
    async () => {
      const session = loadSession();
      if (session) {
        return createJsonResponse({
          connected: true,
          walletAddress: session.walletAddress,
          walletName: session.walletName,
          connectedAt: new Date(session.connectedAt).toISOString(),
        });
      }
      return createJsonResponse({
        connected: false,
        message: "Not connected to Pillar. Use pillar_connect to connect.",
      });
    }
  );

  // Tool 4: Send sBTC (full handoff + polling flow)
  server.registerTool(
    "pillar_send",
    {
      description:
        "Send sBTC from your Pillar smart wallet. Requires being connected first (use pillar_connect). " +
        "Opens the frontend for signing, then waits for confirmation. " +
        "Supports three recipient types: 'bns' for BNS names (muneeb.btc), 'wallet' for Pillar wallet names (iphone), 'address' for Stacks addresses (SP...).",
      inputSchema: {
        to: z.string().describe("Recipient: BNS name (muneeb.btc), Pillar wallet name (iphone), or Stacks address (SP...)"),
        amount: z.number().describe("Amount in satoshis"),
        recipientType: z.enum(["bns", "wallet", "address"]).optional().describe("Type of recipient: 'bns' (default), 'wallet' for Pillar smart wallets, or 'address' for raw Stacks addresses"),
      },
    },
    async ({ to, amount, recipientType }) => {
      try {
        // Get wallet address from session
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const walletAddress = session.walletAddress;
        const api = getPillarApi();

        // Step 1: Create pending operation
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "send",
          walletAddress,
          params: {
            to,
            amount,
            recipientType: recipientType || "bns",
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
            explorerUrl: `https://explorer.hiro.so/txid/${result.txId}?chain=mainnet`,
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

  // Tool 5: Fund wallet (deposit sBTC from Leather/Xverse)
  server.registerTool(
    "pillar_fund",
    {
      description:
        "Fund your Pillar smart wallet by depositing sBTC from your connected Leather or Xverse wallet. " +
        "Opens the frontend deposit modal for signing.",
      inputSchema: {
        amount: z.number().optional().describe("Amount in satoshis to deposit (optional, can be set in UI)"),
      },
    },
    async ({ amount }) => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "fund",
          walletAddress: session.walletAddress,
          params: { amount },
        });

        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.txId) {
          return createJsonResponse({
            success: true,
            message: "Deposit submitted successfully!",
            txId: result.txId,
            explorerUrl: `https://explorer.hiro.so/txid/${result.txId}?chain=mainnet`,
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({ success: false, message: "Deposit cancelled." });
        }

        if (result.status === "failed") {
          return createJsonResponse({ success: false, message: `Deposit failed: ${result.error || "Unknown error"}` });
        }

        return createJsonResponse({ success: false, message: "Timed out waiting for deposit.", opId });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 6: Add backup admin
  server.registerTool(
    "pillar_add_admin",
    {
      description:
        "Add a backup admin address to your Pillar smart wallet for recovery purposes. " +
        "The admin can help recover funds if you lose access to your passkey.",
      inputSchema: {
        adminAddress: z.string().optional().describe("Stacks address (SP...) to add as backup admin (can be set in UI)"),
      },
    },
    async ({ adminAddress }) => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "add-admin",
          walletAddress: session.walletAddress,
          params: { adminAddress },
        });

        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.txId) {
          return createJsonResponse({
            success: true,
            message: "Backup admin added successfully!",
            txId: result.txId,
            explorerUrl: `https://explorer.hiro.so/txid/${result.txId}?chain=mainnet`,
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({ success: false, message: "Add admin cancelled." });
        }

        if (result.status === "failed") {
          return createJsonResponse({ success: false, message: `Add admin failed: ${result.error || "Unknown error"}` });
        }

        return createJsonResponse({ success: false, message: "Timed out waiting for add admin.", opId });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 7: Supply sBTC to Zest
  server.registerTool(
    "pillar_supply",
    {
      description:
        "Supply sBTC from your Pillar smart wallet to Zest Protocol to earn yield. " +
        "Your sBTC will be deposited as collateral and earn interest.",
      inputSchema: {
        amount: z.number().optional().describe("Amount in satoshis to supply (optional, can be set in UI)"),
      },
    },
    async ({ amount }) => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "supply",
          walletAddress: session.walletAddress,
          params: { amount },
        });

        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.txId) {
          return createJsonResponse({
            success: true,
            message: "Supply to Zest submitted successfully!",
            txId: result.txId,
            explorerUrl: `https://explorer.hiro.so/txid/${result.txId}?chain=mainnet`,
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({ success: false, message: "Supply cancelled." });
        }

        if (result.status === "failed") {
          return createJsonResponse({ success: false, message: `Supply failed: ${result.error || "Unknown error"}` });
        }

        return createJsonResponse({ success: false, message: "Timed out waiting for supply.", opId });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 8: Auto-compound settings
  server.registerTool(
    "pillar_auto_compound",
    {
      description:
        "Configure auto-compound for your Pillar wallet. " +
        "When enabled, a keeper will automatically boost your position when sBTC accumulates in your wallet.",
      inputSchema: {
        minSbtc: z.number().optional().describe("Minimum sBTC to keep in wallet (in sats)"),
        trigger: z.number().optional().describe("Amount above minimum that triggers auto-compound (in sats)"),
      },
    },
    async ({ minSbtc, trigger }) => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "auto-compound",
          walletAddress: session.walletAddress,
          params: { minSbtc, trigger },
        });

        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);
        const result = await pollOperationStatus(opId);

        if (result.status === "completed") {
          return createJsonResponse({
            success: true,
            message: "Auto-compound settings saved!",
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({ success: false, message: "Auto-compound setup cancelled." });
        }

        if (result.status === "failed") {
          return createJsonResponse({ success: false, message: `Auto-compound setup failed: ${result.error || "Unknown error"}` });
        }

        return createJsonResponse({ success: false, message: "Timed out waiting for auto-compound setup.", opId });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 9: Unwind (close/reduce leveraged position)
  server.registerTool(
    "pillar_unwind",
    {
      description:
        "Close or reduce your leveraged sBTC position. " +
        "Opens a modal to repay borrowed sBTC and withdraw collateral back to your wallet.",
      inputSchema: {
        percentage: z.number().optional().describe("Percentage of position to unwind (1-100, optional, can be set in UI)"),
      },
    },
    async ({ percentage }) => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "unwind",
          walletAddress: session.walletAddress,
          params: { percentage },
        });

        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.txId) {
          return createJsonResponse({
            success: true,
            message: "Unwind position submitted successfully!",
            txId: result.txId,
            explorerUrl: `https://explorer.hiro.so/txid/${result.txId}?chain=mainnet`,
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({ success: false, message: "Unwind cancelled." });
        }

        if (result.status === "failed") {
          return createJsonResponse({ success: false, message: `Unwind failed: ${result.error || "Unknown error"}` });
        }

        return createJsonResponse({ success: false, message: "Timed out waiting for unwind.", opId });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 10: Boost (create/increase leveraged position)
  server.registerTool(
    "pillar_boost",
    {
      description:
        "Create or increase a leveraged sBTC position (up to 1.5x). " +
        "Opens the Pillar website where you can set the amount and confirm the boost. " +
        "Your sBTC is supplied to Zest, borrowed against, and re-supplied for amplified exposure.",
      inputSchema: {
        amount: z.number().optional().describe("Amount in satoshis to boost (optional, shown as suggestion)"),
      },
    },
    async ({ amount }) => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "boost",
          walletAddress: session.walletAddress,
          params: { amount },
        });

        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.txId) {
          return createJsonResponse({
            success: true,
            message: "Boost position submitted successfully!",
            txId: result.txId,
            explorerUrl: `https://explorer.hiro.so/txid/${result.txId}?chain=mainnet`,
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({ success: false, message: "Boost cancelled." });
        }

        if (result.status === "failed") {
          return createJsonResponse({ success: false, message: `Boost failed: ${result.error || "Unknown error"}` });
        }

        return createJsonResponse({ success: false, message: "Timed out waiting for boost.", opId });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
