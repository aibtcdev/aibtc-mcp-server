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
const POLL_TIMEOUT_MS = parseInt(process.env.PILLAR_POLL_TIMEOUT_MS || "300000", 10); // 5 minutes default
const MCP_DEFAULT_REFERRAL = process.env.PILLAR_DEFAULT_REFERRAL || "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.beta-v2-wallet";
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
        amount: z.number().positive().describe("Amount in satoshis"),
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

  // Tool 5: Fund wallet (multiple methods)
  server.registerTool(
    "pillar_fund",
    {
      description:
        "Fund your Pillar smart wallet. Supports multiple methods:\n" +
        "- 'exchange': Deposit BTC from an exchange (Coinbase, Binance, etc.) - generates a deposit address\n" +
        "- 'btc': Deposit BTC from your Leather/Xverse wallet - auto-converts to sBTC\n" +
        "- 'sbtc': Deposit sBTC directly from your Leather/Xverse wallet\n" +
        "Opens the frontend with the appropriate deposit flow.",
      inputSchema: {
        method: z.enum(["exchange", "btc", "sbtc"]).describe(
          "Funding method: 'exchange' (deposit from Coinbase/Binance), 'btc' (from Leather/Xverse BTC), 'sbtc' (from Leather/Xverse sBTC)"
        ),
        amount: z.number().positive().optional().describe("Amount in satoshis to deposit (optional, can be set in UI)"),
      },
    },
    async ({ method, amount }) => {
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
          params: { method, amount },
        });

        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.txId) {
          const methodLabels: Record<string, string> = {
            exchange: "Exchange deposit",
            btc: "BTC deposit",
            sbtc: "sBTC deposit",
          };
          return createJsonResponse({
            success: true,
            message: `${methodLabels[method] || "Deposit"} submitted successfully!`,
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
        amount: z.number().positive().optional().describe("Amount in satoshis to supply (optional, can be set in UI)"),
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
        minSbtc: z.number().nonnegative().optional().describe("Minimum sBTC to keep in wallet (in sats)"),
        trigger: z.number().positive().optional().describe("Amount above minimum that triggers auto-compound (in sats)"),
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
        percentage: z.number().min(1).max(100).optional().describe("Percentage of position to unwind (1-100, optional, can be set in UI)"),
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
        "Your sBTC is supplied to Zest, borrowed against, and re-supplied for amplified exposure. " +
        "Amounts over 100,000 sats automatically enter DCA mode — split into daily 100k-sat chunks " +
        "(max 700k sats per schedule). The first chunk executes immediately, the rest follow daily.",
      inputSchema: {
        amount: z.number().positive().optional().describe("Amount in satoshis to boost (optional, shown as suggestion)"),
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

  // Tool 11: Get position and balance (opens modal + returns data)
  server.registerTool(
    "pillar_position",
    {
      description:
        "View your Pillar wallet balance and Zest position. " +
        "Opens the Position modal in the browser AND returns the data (sBTC balance, collateral, borrowed, LTV, liquidation price).",
      inputSchema: {},
    },
    async () => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const walletAddress = session.walletAddress;

        // Fetch balances directly from Hiro API
        const balanceRes = await fetch(
          `https://api.hiro.so/extended/v1/address/${walletAddress}/balances`
        );

        let sbtcBalance = 0;
        let zsbtcBalance = 0;

        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();

          // sBTC balance (wallet balance)
          const sbtcKey = Object.keys(balanceData.fungible_tokens || {}).find(
            (k: string) => k.includes("sbtc-token")
          );
          if (sbtcKey) {
            sbtcBalance = parseInt(balanceData.fungible_tokens[sbtcKey].balance) || 0;
          }

          // zsBTC balance (collateral in Zest)
          const zsbtcKey = Object.keys(balanceData.fungible_tokens || {}).find(
            (k: string) => k.includes("zsbtc")
          );
          if (zsbtcKey) {
            zsbtcBalance = parseInt(balanceData.fungible_tokens[zsbtcKey].balance) || 0;
          }
        }

        // Fetch BTC price for USD values
        let btcPrice = 0;
        try {
          const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            btcPrice = priceData.bitcoin?.usd || 0;
          }
        } catch {
          // Price fetch failed, continue without USD values
        }

        // Calculate display values
        const formatBtc = (sats: number) => (sats / 1e8).toFixed(8).replace(/\.?0+$/, "");
        const formatUsd = (usd: number) => `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const sbtcUsd = (sbtcBalance / 1e8) * btcPrice;
        const collateralUsd = (zsbtcBalance / 1e8) * btcPrice;
        const hasPosition = zsbtcBalance > 0;

        // Open the Position modal in frontend for accurate details
        const api = getPillarApi();
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "position",
          walletAddress,
        });
        const { opId } = createResult;
        await openBrowser(`${PILLAR_FRONTEND_URL}/?op=${opId}`);

        // Return only accurate data - borrowed/LTV/liq price are shown in modal
        return createJsonResponse({
          success: true,
          walletAddress,
          walletName: session.walletName,
          walletBalance: {
            sbtc: sbtcBalance,
            sbtcFormatted: `${formatBtc(sbtcBalance)} sBTC`,
            sbtcUsd: btcPrice > 0 ? formatUsd(sbtcUsd) : null,
          },
          position: hasPosition ? {
            collateral: zsbtcBalance,
            collateralFormatted: `${formatBtc(zsbtcBalance)} BTC (zsBTC in Zest)`,
            collateralUsd: btcPrice > 0 ? formatUsd(collateralUsd) : null,
          } : null,
          message: hasPosition
            ? `Wallet: ${formatBtc(sbtcBalance)} sBTC | Collateral: ${formatBtc(zsbtcBalance)} BTC. See modal for borrowed, LTV, and liquidation price.`
            : `Wallet: ${formatBtc(sbtcBalance)} sBTC | No active position`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 12: Create a new Pillar wallet
  server.registerTool(
    "pillar_create_wallet",
    {
      description:
        "Create a new Pillar smart wallet. Opens the Pillar website to complete registration. " +
        "You'll need to enter your email to receive updates. " +
        "If the user doesn't have a referral link, tell them they can DM @pillar_btc on X (https://x.com/pillar_btc) to request one before signing up.",
      inputSchema: {
        referral: z.string().optional().describe("Referral wallet address (optional, defaults to MCP referral)"),
      },
    },
    async ({ referral }) => {
      try {
        // Check if already connected
        const existingSession = loadSession();
        if (existingSession) {
          return createJsonResponse({
            success: false,
            message: `Already connected to wallet ${existingSession.walletName || existingSession.walletAddress}. Use pillar_disconnect first if you want to create a new wallet.`,
          });
        }

        const api = getPillarApi();

        // Create operation
        const createResult = await api.post<{ opId: string }>("/api/mcp/create-op", {
          action: "create-wallet",
          params: { referral: referral || MCP_DEFAULT_REFERRAL },
        });

        const { opId } = createResult;

        // Open frontend with referral
        const ref = referral || MCP_DEFAULT_REFERRAL;
        const url = `${PILLAR_FRONTEND_URL}/?op=${opId}&ref=${ref}`;
        await openBrowser(url);

        // Poll for completion
        const result = await pollOperationStatus(opId);

        if (result.status === "completed" && result.walletAddress) {
          // Save session
          const session: PillarSession = {
            walletAddress: result.walletAddress,
            walletName: result.walletName,
            connectedAt: Date.now(),
          };
          saveSession(session);

          return createJsonResponse({
            success: true,
            message: "Wallet created successfully!",
            walletAddress: result.walletAddress,
            walletName: result.walletName,
          });
        }

        if (result.status === "cancelled") {
          return createJsonResponse({ success: false, message: "Wallet creation cancelled." });
        }

        if (result.status === "failed") {
          return createJsonResponse({ success: false, message: `Wallet creation failed: ${result.error || "Unknown error"}` });
        }

        return createJsonResponse({ success: false, message: "Timed out waiting for wallet creation.", opId });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 13: Get referral/invite link
  server.registerTool(
    "pillar_invite",
    {
      description:
        "Get your Pillar referral link to invite friends. Share this link and earn rewards when friends sign up.",
      inputSchema: {},
    },
    async () => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const referralLink = `${PILLAR_FRONTEND_URL}/?ref=${session.walletAddress}`;

        return createJsonResponse({
          success: true,
          referralLink,
          walletAddress: session.walletAddress,
          message: `Share this link to invite friends: ${referralLink}`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 14: Invite a DCA partner (direct API, no handoff)
  server.registerTool(
    "pillar_dca_invite",
    {
      description:
        "Invite a DCA partner by email or wallet address. " +
        "DCA partners hold each other accountable — both must boost each week to keep the streak alive.",
      inputSchema: {
        partner: z.string().describe("Partner's email address or Stacks wallet address (SP...)"),
      },
    },
    async ({ partner }) => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const isEmail = partner.includes("@");
        const api = getPillarApi();
        const result = await api.post<{
          partnershipId: string;
          status: string;
          inviteLink?: string;
        }>("/api/dca-partner/invite", {
          walletAddress: session.walletAddress,
          ...(isEmail ? { partnerEmail: partner } : { partnerWalletAddress: partner }),
        });

        return createJsonResponse({
          success: true,
          partnershipId: result.partnershipId,
          status: result.status,
          message: isEmail
            ? `Invite sent to ${partner}. They'll receive an email with a link to accept.`
            : `Partnership invite sent to ${partner}.`,
          ...(result.inviteLink ? { inviteLink: result.inviteLink } : {}),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 15: View DCA partners and weekly status (direct API)
  server.registerTool(
    "pillar_dca_partners",
    {
      description:
        "View your DCA partners and weekly status. " +
        "Shows active partnerships with streak, PnL, and weekly status badges, plus any pending invites.",
      inputSchema: {},
    },
    async () => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const result = await api.get<{
          partnerships: Array<{
            partnershipId: string;
            partnerName?: string;
            partnerAddress: string;
            streak: number;
            pnl?: number;
            myStatus: string;
            partnerStatus: string;
            status: string;
          }>;
          pendingInvites: Array<{
            partnershipId: string;
            partnerEmail?: string;
            partnerAddress?: string;
            direction: string;
          }>;
        }>("/api/dca-partner/my-partners", { walletAddress: session.walletAddress });

        const active = result.partnerships.filter(p => p.status === "active");
        const pending = result.pendingInvites || [];

        return createJsonResponse({
          success: true,
          activePartnerships: active.map(p => ({
            partnershipId: p.partnershipId,
            partner: p.partnerName || p.partnerAddress,
            streak: p.streak,
            pnl: p.pnl,
            myStatus: p.myStatus,
            partnerStatus: p.partnerStatus,
          })),
          pendingInvites: pending.length,
          pendingDetails: pending.map(p => ({
            partnershipId: p.partnershipId,
            partner: p.partnerEmail || p.partnerAddress,
            direction: p.direction,
          })),
          message: active.length > 0
            ? `${active.length} active partnership${active.length > 1 ? "s" : ""}, ${pending.length} pending invite${pending.length !== 1 ? "s" : ""}`
            : `No active partnerships. ${pending.length} pending invite${pending.length !== 1 ? "s" : ""}. Use pillar_dca_invite to invite a partner.`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 16: DCA streak leaderboard (direct API)
  server.registerTool(
    "pillar_dca_leaderboard",
    {
      description:
        "View the DCA streak leaderboard. Shows top partnerships by streak length, and highlights your entry if you have one.",
      inputSchema: {},
    },
    async () => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();
        const result = await api.get<{
          leaderboard: Array<{
            rank: number;
            partnerNames: string[];
            streak: number;
            pnl?: number;
            isUser?: boolean;
          }>;
          userEntry?: {
            rank: number;
            partnerName: string;
            streak: number;
            pnl?: number;
          };
        }>("/api/dca-partner/leaderboard", { walletAddress: session.walletAddress });

        return createJsonResponse({
          success: true,
          leaderboard: result.leaderboard.map(entry => ({
            rank: entry.rank,
            partners: entry.partnerNames.join(" & "),
            streak: entry.streak,
            pnl: entry.pnl,
            isYou: entry.isUser || false,
          })),
          yourRank: result.userEntry ? {
            rank: result.userEntry.rank,
            partner: result.userEntry.partnerName,
            streak: result.userEntry.streak,
            pnl: result.userEntry.pnl,
          } : null,
          message: result.userEntry
            ? `You're ranked #${result.userEntry.rank} with a ${result.userEntry.streak}-week streak with ${result.userEntry.partnerName}.`
            : "You don't have an active partnership on the leaderboard yet. Use pillar_dca_invite to get started.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Tool 17: Check DCA schedule status (direct API)
  server.registerTool(
    "pillar_dca_status",
    {
      description:
        "Check your DCA schedule status. Shows all active DCA schedules (up to 10) with chunk progress " +
        "(completed, pending, failed) and next execution time.",
      inputSchema: {},
    },
    async () => {
      try {
        const session = loadSession();
        if (!session) {
          return createJsonResponse({
            success: false,
            message: "Not connected to Pillar. Please use pillar_connect first.",
          });
        }

        const api = getPillarApi();

        interface DcaScheduleInfo {
          id: string;
          totalSbtcAmount: number;
          chunkSizeSats: number;
          totalChunks: number;
          completedChunks: number;
          failedChunks: number;
          status: string;
          btcPriceAtCreation: number | null;
          createdAt: number;
          completedAt: number | null;
        }

        interface DcaChunkInfo {
          id: string;
          chunkIndex: number;
          sbtcAmount: number;
          status: string;
          scheduledAt: number;
          executedAt: number | null;
          txId: string | null;
          retryCount: number;
          errorMessage: string | null;
        }

        interface DcaStatusResult {
          schedule: DcaScheduleInfo;
          chunks: DcaChunkInfo[];
          allSchedules?: { schedule: DcaScheduleInfo; chunks: DcaChunkInfo[] }[];
          activeCount?: number;
          maxSchedules?: number;
        }

        const raw = await api.get<{ success: boolean; data: DcaStatusResult | null }>(
          "/api/pillar/dca-status",
          { walletAddress: session.walletAddress }
        );

        const result = raw.data;

        if (!result) {
          return createJsonResponse({
            success: true,
            hasSchedule: false,
            activeCount: 0,
            maxSchedules: 10,
            message: "No active DCA schedule. Use pillar_boost with an amount over 100,000 sats to start one.",
          });
        }

        const allSchedules = result.allSchedules || [{ schedule: result.schedule, chunks: result.chunks }];
        const activeCount = result.activeCount ?? (result.schedule.status === "active" ? 1 : 0);
        const maxSchedules = result.maxSchedules ?? 10;

        const formatSchedule = (s: DcaScheduleInfo, chunks: DcaChunkInfo[]) => {
          const pendingChunks = chunks.filter((c) => c.status === "pending" || c.status === "executing").length;
          const nextPending = chunks
            .filter((c) => c.status === "pending")
            .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
          const nextExecution = nextPending
            ? new Date(nextPending.scheduledAt).toISOString()
            : null;

          return {
            id: s.id,
            status: s.status,
            totalSbtcAmount: s.totalSbtcAmount,
            chunkSizeSats: s.chunkSizeSats,
            progress: `${s.completedChunks}/${s.totalChunks} chunks completed`,
            completedChunks: s.completedChunks,
            pendingChunks,
            failedChunks: s.failedChunks,
            nextExecution,
            createdAt: new Date(s.createdAt).toISOString(),
          };
        };

        const schedules = allSchedules.map((entry) =>
          formatSchedule(entry.schedule, entry.chunks)
        );

        const activeSchedules = schedules.filter((s) => s.status === "active");

        if (activeSchedules.length === 0) {
          // No active, show most recent
          const latest = schedules[0];
          return createJsonResponse({
            success: true,
            hasSchedule: true,
            activeCount: 0,
            maxSchedules,
            schedule: latest,
            message: `DCA ${latest.status}: ${latest.progress}.`,
          });
        }

        if (activeSchedules.length === 1) {
          const s = activeSchedules[0];
          return createJsonResponse({
            success: true,
            hasSchedule: true,
            activeCount,
            maxSchedules,
            schedule: s,
            message: `DCA active: ${s.progress} (${s.chunkSizeSats} sats/chunk). Next: ${s.nextExecution || "pending"}.`,
          });
        }

        // Multiple active schedules
        const summaries = activeSchedules.map(
          (s) => `Schedule ${s.id.slice(0, 8)}: ${s.progress}, next: ${s.nextExecution || "pending"}`
        );
        return createJsonResponse({
          success: true,
          hasSchedule: true,
          activeCount,
          maxSchedules,
          schedules: activeSchedules,
          message: `${activeCount} active DCA schedules (max ${maxSchedules}):\n${summaries.join("\n")}`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
