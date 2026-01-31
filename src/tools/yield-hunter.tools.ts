import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cvToJSON, hexToCV, uintCV, contractPrincipalCV } from "@stacks/transactions";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getZestProtocolService } from "../services/defi.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { ZEST_ASSETS, MAINNET_CONTRACTS } from "../config/contracts.js";
import { createJsonResponse, createErrorResponse, getSbtcBalance } from "../utils/index.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Fee buffer to reserve for transaction costs (in satoshis).
 *
 * This buffer ensures the agent always has funds to pay for Stacks transaction
 * fees (~2-10 sats per transaction). The yield hunter only performs on-chain
 * supply transactions - it does not call any x402 endpoints.
 *
 * Default: 1,000 sats (0.00001 sBTC, ~$1 at $100k BTC)
 * - Covers 100-500 Stacks transactions
 *
 * Customize via yield_hunter_start or yield_hunter_configure feeBuffer parameter.
 */
const FEE_BUFFER_SATS = 1_000n;

/** Maximum retries for failed transactions */
const MAX_RETRIES = 3;

/** Delay between retries (ms) */
const RETRY_DELAY_MS = 5_000;

/** Timeout for waiting for tx confirmation (ms) */
const TX_CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Poll interval for tx confirmation (ms) */
const TX_POLL_INTERVAL_MS = 10_000; // 10 seconds

// ============================================================================
// Yield Hunter State
// ============================================================================

interface YieldHunterState {
  running: boolean;
  intervalId: NodeJS.Timeout | null;
  config: {
    minDepositThreshold: bigint;
    feeBuffer: bigint;
    checkIntervalMs: number;
    asset: string;
  };
  stats: {
    lastCheck: Date | null;
    totalDeposited: bigint;
    checksRun: number;
    depositsExecuted: number;
    lastError: string | null;
    currentApy: number | null;
    lastApyFetch: Date | null;
  };
  pendingTx: {
    txid: string;
    type: "deposit" | "withdraw";
    amount: bigint;
    startedAt: Date;
  } | null;
  logs: Array<{
    timestamp: string;
    type: "info" | "action" | "error" | "warning";
    message: string;
  }>;
}

const state: YieldHunterState = {
  running: false,
  intervalId: null,
  config: {
    minDepositThreshold: 10_000n, // 0.0001 sBTC
    feeBuffer: FEE_BUFFER_SATS,
    checkIntervalMs: 10 * 60 * 1000, // 10 minutes
    asset: "sBTC",
  },
  stats: {
    lastCheck: null,
    totalDeposited: 0n,
    checksRun: 0,
    depositsExecuted: 0,
    lastError: null,
    currentApy: null,
    lastApyFetch: null,
  },
  pendingTx: null,
  logs: [],
};

const MAX_LOGS = 100;

function addLog(type: "info" | "action" | "error" | "warning", message: string) {
  state.logs.unshift({
    timestamp: new Date().toISOString(),
    type,
    message,
  });
  // Keep only last N logs
  if (state.logs.length > MAX_LOGS) {
    state.logs = state.logs.slice(0, MAX_LOGS);
  }
  // Also log to stderr for debugging
  console.error(`[YieldHunter] [${type.toUpperCase()}] ${message}`);
}

function formatSats(sats: bigint): string {
  const btc = Number(sats) / 100_000_000;
  return `${btc.toFixed(8)} sBTC`;
}

function formatApy(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

// ============================================================================
// Core Yield Hunting Logic
// ============================================================================

/**
 * Fetch live APY from Zest Protocol on-chain
 * Reads from pool-0-reserve get-reserve-state
 */
async function fetchZestApy(): Promise<number> {
  try {
    const hiro = getHiroApi(NETWORK);
    const [reserveAddr, reserveName] = MAINNET_CONTRACTS.ZEST_POOL_RESERVE.split(".");
    const [sbtcAddr, sbtcName] = ZEST_ASSETS.sBTC.token.split(".");

    const result = await hiro.callReadOnlyFunction(
      MAINNET_CONTRACTS.ZEST_POOL_RESERVE,
      "get-reserve-state",
      [contractPrincipalCV(sbtcAddr, sbtcName)],
      reserveAddr
    );

    if (!result.okay || !result.result) {
      addLog("warning", "Could not fetch Zest APY from chain");
      return state.stats.currentApy || 0;
    }

    const decoded = cvToJSON(hexToCV(result.result));
    // Response is (response (tuple ...)) so we need .value.value to get the tuple fields
    const data = decoded?.value?.value || decoded?.value || decoded;

    // Extract liquidity rate (APY in 1e8 scale)
    // e.g., 5000000 = 5% APY
    const liquidityRate = data?.["current-liquidity-rate"]?.value;
    if (liquidityRate) {
      // Convert from 1e8 to basis points: rate / 1e8 * 10000 = rate / 1e4
      const apyBps = Number(BigInt(liquidityRate) / 10000n);
      state.stats.currentApy = apyBps;
      state.stats.lastApyFetch = new Date();
      return apyBps;
    }

    return state.stats.currentApy || 0;
  } catch (error: any) {
    addLog("warning", `Failed to fetch APY: ${error.message}`);
    return state.stats.currentApy || 0;
  }
}

/**
 * Wait for transaction confirmation with timeout
 */
async function waitForTxConfirmation(txid: string): Promise<{ success: boolean; error?: string }> {
  const hiro = getHiroApi(NETWORK);
  const startTime = Date.now();

  addLog("info", `Waiting for tx confirmation: ${txid}`);

  while (Date.now() - startTime < TX_CONFIRMATION_TIMEOUT_MS) {
    try {
      const status = await hiro.getTransactionStatus(txid);

      if (status.status === "success") {
        addLog("action", `Tx confirmed in block ${status.block_height}: ${txid}`);
        return { success: true };
      }

      if (status.status === "abort_by_response" || status.status === "abort_by_post_condition") {
        const error = `Tx failed: ${status.status}`;
        addLog("error", error);
        return { success: false, error };
      }

      // Still pending, wait and retry
      await sleep(TX_POLL_INTERVAL_MS);
    } catch (error: any) {
      // Network error, retry
      addLog("warning", `Tx status check failed, retrying: ${error.message}`);
      await sleep(TX_POLL_INTERVAL_MS);
    }
  }

  return { success: false, error: "Transaction confirmation timeout" };
}

/**
 * Execute with retry logic
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isLastAttempt) {
        addLog("error", `${operationName} failed after ${MAX_RETRIES} attempts: ${error.message}`);
        throw error;
      }

      addLog("warning", `${operationName} attempt ${attempt} failed: ${error.message}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runYieldCheck(): Promise<void> {
  // Skip if there's a pending transaction
  if (state.pendingTx) {
    addLog("info", `Skipping check - waiting for pending tx: ${state.pendingTx.txid}`);

    // Check if pending tx is confirmed
    const result = await waitForTxConfirmation(state.pendingTx.txid);
    if (result.success) {
      state.stats.totalDeposited += state.pendingTx.amount;
      state.stats.depositsExecuted++;
      state.pendingTx = null;
    } else if (result.error?.includes("timeout")) {
      addLog("warning", "Pending tx timed out, will retry on next check");
      state.pendingTx = null;
    } else {
      addLog("error", `Pending tx failed: ${result.error}`);
      state.pendingTx = null;
    }
    return;
  }

  try {
    const account = await getAccount();
    const zest = getZestProtocolService(NETWORK);

    // Fetch live APY
    const apy = await fetchZestApy();
    addLog("info", `Current Zest sBTC APY: ${formatApy(apy)}`);

    // Get current sBTC balance in wallet
    const walletBalance = await executeWithRetry(
      () => getSbtcBalance(account.address, NETWORK),
      "Fetch wallet balance"
    );
    addLog("info", `Wallet sBTC: ${formatSats(walletBalance)}`);

    // Get current Zest position
    const position = await executeWithRetry(
      () => zest.getUserPosition(ZEST_ASSETS.sBTC.token, account.address),
      "Fetch Zest position"
    );
    const zestSupplied = position ? BigInt(position.supplied) : 0n;
    addLog("info", `Zest supplied: ${formatSats(zestSupplied)}`);

    // Calculate amount to deposit (keep fee buffer)
    const effectiveThreshold = state.config.minDepositThreshold + state.config.feeBuffer;
    const depositAmount = walletBalance > state.config.feeBuffer
      ? walletBalance - state.config.feeBuffer
      : 0n;

    // Check if we should deposit
    if (walletBalance >= effectiveThreshold && depositAmount > 0n) {
      addLog(
        "action",
        `Balance (${formatSats(walletBalance)}) above threshold (${formatSats(effectiveThreshold)}). ` +
        `Depositing ${formatSats(depositAmount)}, keeping ${formatSats(state.config.feeBuffer)} as fee buffer...`
      );

      try {
        const result = await executeWithRetry(
          () => zest.supply(account, state.config.asset, depositAmount),
          "Supply to Zest"
        );

        addLog("action", `Deposit tx submitted: ${result.txid}`);

        // Track pending transaction
        state.pendingTx = {
          txid: result.txid,
          type: "deposit",
          amount: depositAmount,
          startedAt: new Date(),
        };

        // Wait for confirmation (non-blocking for next check)
        const confirmation = await waitForTxConfirmation(result.txid);
        if (confirmation.success) {
          state.stats.totalDeposited += depositAmount;
          state.stats.depositsExecuted++;
          state.pendingTx = null;
        } else {
          addLog("error", `Deposit confirmation failed: ${confirmation.error}`);
          state.stats.lastError = confirmation.error || "Unknown error";
          state.pendingTx = null;
        }
      } catch (error: any) {
        addLog("error", `Deposit failed: ${error.message}`);
        state.stats.lastError = error.message;
      }
    } else if (walletBalance > 0n && walletBalance < effectiveThreshold) {
      addLog(
        "info",
        `Balance (${formatSats(walletBalance)}) below threshold (${formatSats(effectiveThreshold)}), ` +
        `keeping for fees. Need ${formatSats(effectiveThreshold - walletBalance)} more to deposit.`
      );
    } else {
      addLog("info", `No sBTC in wallet, nothing to deposit`);
    }

    state.stats.lastCheck = new Date();
    state.stats.checksRun++;
    state.stats.lastError = null;
  } catch (error: any) {
    addLog("error", `Check failed: ${error.message}`);
    state.stats.lastError = error.message;
  }
}

// ============================================================================
// MCP Tools
// ============================================================================

export function registerYieldHunterTools(server: McpServer): void {
  // Start yield hunting
  server.registerTool(
    "yield_hunter_start",
    {
      description: `Start autonomous yield hunting.

This will:
1. Monitor your wallet for sBTC
2. Automatically deposit sBTC to Zest Protocol when balance exceeds threshold
3. Keep a fee buffer for x402 payments and transaction costs
4. Wait for transaction confirmations before proceeding
5. Retry failed transactions with exponential backoff
6. Run continuously until stopped

Requires an unlocked wallet (use wallet_unlock first).
Only works on mainnet (Zest Protocol is mainnet-only).

Default settings:
- Deposit threshold: 10,000 sats (0.0001 sBTC)
- Fee buffer: 1,000 sats (0.00001 sBTC) - kept for Stacks tx fees
- Check interval: 10 minutes`,
      inputSchema: {
        threshold: z
          .string()
          .optional()
          .describe(
            "Minimum sBTC balance (in sats) before depositing. Default: 10000"
          ),
        feeBuffer: z
          .string()
          .optional()
          .describe(
            "sBTC (in sats) to keep for fees, never deposited. Default: 1000"
          ),
        interval: z
          .number()
          .optional()
          .describe("Check interval in seconds. Default: 600 (10 minutes)"),
      },
    },
    async ({ threshold, feeBuffer, interval }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            success: false,
            error: "Yield hunting only available on mainnet (Zest Protocol)",
          });
        }

        if (state.running) {
          return createJsonResponse({
            success: false,
            error: "Yield hunter is already running",
            status: getStatusObject(),
          });
        }

        // Verify wallet is unlocked
        try {
          await getAccount();
        } catch {
          return createJsonResponse({
            success: false,
            error:
              "Wallet not unlocked. Use wallet_unlock first to enable transactions.",
          });
        }

        // Apply config
        if (threshold) {
          state.config.minDepositThreshold = BigInt(threshold);
        }
        if (feeBuffer) {
          state.config.feeBuffer = BigInt(feeBuffer);
        }
        if (interval) {
          state.config.checkIntervalMs = interval * 1000;
        }

        // Start the yield hunting loop
        state.running = true;
        addLog("info", "Yield hunter started");

        // Fetch initial APY
        const apy = await fetchZestApy();
        addLog("info", `Current Zest sBTC APY: ${formatApy(apy)}`);

        // Run first check immediately
        await runYieldCheck();

        // Schedule periodic checks
        state.intervalId = setInterval(async () => {
          if (state.running) {
            await runYieldCheck();
          }
        }, state.config.checkIntervalMs);

        return createJsonResponse({
          success: true,
          message: "Yield hunter started",
          config: {
            minDepositThreshold: state.config.minDepositThreshold.toString(),
            minDepositThresholdFormatted: formatSats(state.config.minDepositThreshold),
            feeBuffer: state.config.feeBuffer.toString(),
            feeBufferFormatted: formatSats(state.config.feeBuffer),
            effectiveThreshold: (state.config.minDepositThreshold + state.config.feeBuffer).toString(),
            effectiveThresholdFormatted: formatSats(state.config.minDepositThreshold + state.config.feeBuffer),
            checkIntervalMs: state.config.checkIntervalMs,
            asset: state.config.asset,
          },
          currentApy: apy ? formatApy(apy) : "unknown",
          nextCheckIn: `${state.config.checkIntervalMs / 1000} seconds`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Stop yield hunting
  server.registerTool(
    "yield_hunter_stop",
    {
      description: `Stop autonomous yield hunting.

Stops the background process that monitors and deposits sBTC.
Your existing Zest positions remain untouched.`,
      inputSchema: {},
    },
    async () => {
      try {
        if (!state.running) {
          return createJsonResponse({
            success: false,
            error: "Yield hunter is not running",
          });
        }

        // Stop the interval
        if (state.intervalId) {
          clearInterval(state.intervalId);
          state.intervalId = null;
        }
        state.running = false;
        addLog("info", "Yield hunter stopped");

        return createJsonResponse({
          success: true,
          message: "Yield hunter stopped",
          stats: {
            checksRun: state.stats.checksRun,
            depositsExecuted: state.stats.depositsExecuted,
            totalDeposited: state.stats.totalDeposited.toString(),
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get yield hunter status
  server.registerTool(
    "yield_hunter_status",
    {
      description: `Get current yield hunter status.

Shows:
- Whether yield hunting is active
- Current configuration
- Statistics (checks run, deposits made)
- Recent activity logs
- Current Zest position`,
      inputSchema: {},
    },
    async () => {
      try {
        const status = await getFullStatus();
        return createJsonResponse(status);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Configure yield hunter
  server.registerTool(
    "yield_hunter_configure",
    {
      description: `Configure yield hunter settings.

Adjust the deposit threshold, fee buffer, or check interval.
Changes take effect on the next check cycle.`,
      inputSchema: {
        threshold: z
          .string()
          .optional()
          .describe("Minimum sBTC balance (in sats) before depositing"),
        feeBuffer: z
          .string()
          .optional()
          .describe("sBTC (in sats) to keep for fees, never deposited"),
        interval: z
          .number()
          .optional()
          .describe("Check interval in seconds"),
      },
    },
    async ({ threshold, feeBuffer, interval }) => {
      try {
        const changes: string[] = [];

        if (threshold) {
          state.config.minDepositThreshold = BigInt(threshold);
          changes.push(
            `Deposit threshold set to ${formatSats(state.config.minDepositThreshold)}`
          );
        }

        if (feeBuffer) {
          state.config.feeBuffer = BigInt(feeBuffer);
          changes.push(
            `Fee buffer set to ${formatSats(state.config.feeBuffer)}`
          );
        }

        if (interval) {
          state.config.checkIntervalMs = interval * 1000;
          changes.push(`Check interval set to ${interval} seconds`);

          // If running, restart the interval with new timing
          if (state.running && state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = setInterval(async () => {
              if (state.running) {
                await runYieldCheck();
              }
            }, state.config.checkIntervalMs);
          }
        }

        if (changes.length === 0) {
          return createJsonResponse({
            success: false,
            error: "No configuration changes specified",
            currentConfig: getConfigObject(),
          });
        }

        addLog("info", `Config updated: ${changes.join(", ")}`);

        return createJsonResponse({
          success: true,
          changes,
          config: getConfigObject(),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}

function getConfigObject() {
  return {
    minDepositThreshold: state.config.minDepositThreshold.toString(),
    minDepositThresholdFormatted: formatSats(state.config.minDepositThreshold),
    feeBuffer: state.config.feeBuffer.toString(),
    feeBufferFormatted: formatSats(state.config.feeBuffer),
    effectiveThreshold: (state.config.minDepositThreshold + state.config.feeBuffer).toString(),
    effectiveThresholdFormatted: formatSats(state.config.minDepositThreshold + state.config.feeBuffer),
    checkIntervalMs: state.config.checkIntervalMs,
    checkIntervalFormatted: `${state.config.checkIntervalMs / 1000} seconds`,
    asset: state.config.asset,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusObject() {
  return {
    running: state.running,
    config: getConfigObject(),
    stats: {
      lastCheck: state.stats.lastCheck?.toISOString() || null,
      totalDeposited: state.stats.totalDeposited.toString(),
      totalDepositedFormatted: formatSats(state.stats.totalDeposited),
      checksRun: state.stats.checksRun,
      depositsExecuted: state.stats.depositsExecuted,
      lastError: state.stats.lastError,
      currentApy: state.stats.currentApy ? formatApy(state.stats.currentApy) : null,
      currentApyBps: state.stats.currentApy,
      lastApyFetch: state.stats.lastApyFetch?.toISOString() || null,
    },
    pendingTx: state.pendingTx ? {
      txid: state.pendingTx.txid,
      type: state.pendingTx.type,
      amount: state.pendingTx.amount.toString(),
      amountFormatted: formatSats(state.pendingTx.amount),
      startedAt: state.pendingTx.startedAt.toISOString(),
    } : null,
    recentLogs: state.logs.slice(0, 15),
  };
}

async function getFullStatus() {
  const status = getStatusObject();

  // Add current positions if on mainnet
  if (NETWORK === "mainnet") {
    try {
      const address = await getWalletAddress();
      const zest = getZestProtocolService(NETWORK);

      // Fetch all data in parallel
      const [position, walletBalance, apy] = await Promise.all([
        zest.getUserPosition(ZEST_ASSETS.sBTC.token, address),
        getSbtcBalance(address, NETWORK),
        fetchZestApy(),
      ]);

      const zestSupplied = BigInt(position?.supplied || "0");
      const availableToDeposit = walletBalance > state.config.feeBuffer
        ? walletBalance - state.config.feeBuffer
        : 0n;

      return {
        ...status,
        network: NETWORK,
        wallet: address,
        currentPosition: {
          walletSbtc: walletBalance.toString(),
          walletSbtcFormatted: formatSats(walletBalance),
          availableToDeposit: availableToDeposit.toString(),
          availableToDepositFormatted: formatSats(availableToDeposit),
          reservedForFees: state.config.feeBuffer.toString(),
          reservedForFeesFormatted: formatSats(state.config.feeBuffer),
          zestSupplied: position?.supplied || "0",
          zestSuppliedFormatted: formatSats(zestSupplied),
          zestBorrowed: position?.borrowed || "0",
        },
        currentApy: apy ? formatApy(apy) : "unknown",
        currentApyBps: apy,
        estimatedDailyYield: zestSupplied > 0n && apy
          ? formatSats((zestSupplied * BigInt(apy)) / (365n * 10000n))
          : "0",
        estimatedAnnualYield: zestSupplied > 0n && apy
          ? formatSats((zestSupplied * BigInt(apy)) / 10000n)
          : "0",
      };
    } catch (error: any) {
      return {
        ...status,
        network: NETWORK,
        walletError: error.message,
      };
    }
  }

  return {
    ...status,
    network: NETWORK,
    note: "Zest Protocol only available on mainnet",
  };
}
