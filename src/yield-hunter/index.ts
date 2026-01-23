#!/usr/bin/env node
/**
 * Yield Hunter - Autonomous sBTC yield farming daemon
 *
 * Automatically deposits sBTC to Zest Protocol and compounds earnings.
 * Uses the wallet configured in ~/.aibtc/
 */

import { getWalletManager } from "../services/wallet-manager.js";
import { getZestProtocolService } from "../services/defi.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { ZEST_ASSETS } from "../config/contracts.js";
import { NETWORK } from "../config/networks.js";
import type { Account } from "../transactions/builder.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

// ============================================================================
// Configuration
// ============================================================================

interface YieldHunterConfig {
  /** Minimum sBTC balance (in sats) before depositing to Zest */
  minDepositThreshold: bigint;
  /** Check interval in milliseconds */
  checkIntervalMs: number;
  /** Whether to actually execute transactions (false = dry run) */
  execute: boolean;
  /** Asset to deposit (default: sBTC) */
  asset: string;
}

const DEFAULT_CONFIG: YieldHunterConfig = {
  minDepositThreshold: 10_000n, // 0.0001 sBTC (~$10 at $100k BTC)
  checkIntervalMs: 10 * 60 * 1000, // 10 minutes
  execute: false,
  asset: "sBTC",
};

interface YieldHunterState {
  lastCheck: string | null;
  totalDeposited: string;
  totalEarned: string;
  transactions: Array<{
    type: "deposit" | "withdraw" | "compound";
    amount: string;
    txid: string;
    timestamp: string;
  }>;
}

const STATE_FILE = path.join(os.homedir(), ".aibtc", "yield-hunter-state.json");

// ============================================================================
// State Management
// ============================================================================

async function loadState(): Promise<YieldHunterState> {
  try {
    const content = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return {
      lastCheck: null,
      totalDeposited: "0",
      totalEarned: "0",
      transactions: [],
    };
  }
}

async function saveState(state: YieldHunterState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================================
// Helpers
// ============================================================================

function formatSats(sats: bigint): string {
  const btc = Number(sats) / 100_000_000;
  return `${btc.toFixed(8)} sBTC (${sats.toString()} sats)`;
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// ============================================================================
// Core Logic
// ============================================================================

async function getSbtcBalance(address: string): Promise<bigint> {
  const hiro = getHiroApi(NETWORK);
  const balances = await hiro.getAccountBalances(address);

  // Find sBTC in fungible tokens
  const sbtcToken = ZEST_ASSETS.sBTC.token;
  const sbtcKey = Object.keys(balances.fungible_tokens || {}).find(
    (key) => key.startsWith(sbtcToken)
  );

  if (sbtcKey && balances.fungible_tokens[sbtcKey]) {
    return BigInt(balances.fungible_tokens[sbtcKey].balance);
  }

  return 0n;
}

async function runCheck(account: Account, config: YieldHunterConfig, state: YieldHunterState): Promise<void> {
  const zest = getZestProtocolService(NETWORK);

  // Get current sBTC balance in wallet
  const walletBalance = await getSbtcBalance(account.address);
  log(`Wallet sBTC balance: ${formatSats(walletBalance)}`);

  // Get current Zest position
  const position = await zest.getUserPosition(ZEST_ASSETS.sBTC.token, account.address);
  const zestSupplied = position ? BigInt(position.supplied) : 0n;
  log(`Zest supplied: ${formatSats(zestSupplied)}`);

  // Check if we should deposit
  if (walletBalance >= config.minDepositThreshold) {
    log(`Balance above threshold (${formatSats(config.minDepositThreshold)}), depositing...`);

    if (config.execute) {
      try {
        const result = await zest.supply(account, config.asset, walletBalance);
        log(`Deposited ${formatSats(walletBalance)} to Zest. TxID: ${result.txid}`);

        // Update state
        state.totalDeposited = (BigInt(state.totalDeposited) + walletBalance).toString();
        state.transactions.push({
          type: "deposit",
          amount: walletBalance.toString(),
          txid: result.txid,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        log(`Failed to deposit: ${error.message}`);
      }
    } else {
      log(`[DRY RUN] Would deposit ${formatSats(walletBalance)} to Zest`);
    }
  } else {
    log(`Balance below threshold, no action needed`);
  }

  // Update state
  state.lastCheck = new Date().toISOString();
  await saveState(state);
}

// ============================================================================
// CLI Commands
// ============================================================================

async function startDaemon(config: YieldHunterConfig): Promise<void> {
  log("Starting Yield Hunter daemon...");
  log(`Network: ${NETWORK}`);
  log(`Min deposit threshold: ${formatSats(config.minDepositThreshold)}`);
  log(`Check interval: ${config.checkIntervalMs / 1000}s`);
  log(`Execute mode: ${config.execute ? "LIVE" : "DRY RUN"}`);

  if (NETWORK !== "mainnet") {
    log("WARNING: Zest Protocol is only available on mainnet");
    process.exit(1);
  }

  // Get wallet
  const walletManager = getWalletManager();
  const wallets = await walletManager.listWallets();

  if (wallets.length === 0) {
    log("No wallets found. Create one with: npx @aibtc/mcp-server");
    log("Then use wallet_create or wallet_import via Claude");
    process.exit(1);
  }

  const activeWalletId = await walletManager.getActiveWalletId();
  if (!activeWalletId) {
    log("No active wallet. Set one with wallet_switch");
    process.exit(1);
  }

  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  log(`Using wallet: ${activeWallet?.name} (${activeWallet?.address})`);

  // Prompt for password
  const password = await promptPassword();

  let account: Account;
  try {
    account = await walletManager.unlock(activeWalletId, password);
    log(`Wallet unlocked: ${account.address}`);
  } catch (error: any) {
    log(`Failed to unlock wallet: ${error.message}`);
    process.exit(1);
  }

  // Disable auto-lock for daemon mode
  await walletManager.setAutoLockTimeout(0);

  // Load state
  const state = await loadState();

  // Run initial check
  await runCheck(account, config, state);

  // Schedule periodic checks
  log(`\nDaemon running. Press Ctrl+C to stop.\n`);

  const intervalId = setInterval(async () => {
    try {
      await runCheck(account, config, state);
    } catch (error: any) {
      log(`Error during check: ${error.message}`);
    }
  }, config.checkIntervalMs);

  // Handle shutdown
  process.on("SIGINT", () => {
    log("\nShutting down...");
    clearInterval(intervalId);
    walletManager.lock();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("\nShutting down...");
    clearInterval(intervalId);
    walletManager.lock();
    process.exit(0);
  });
}

async function showStatus(): Promise<void> {
  log("Yield Hunter Status");
  log("=".repeat(50));

  const state = await loadState();
  const walletManager = getWalletManager();
  const wallets = await walletManager.listWallets();
  const activeWalletId = await walletManager.getActiveWalletId();
  const activeWallet = wallets.find((w) => w.id === activeWalletId);

  log(`Network: ${NETWORK}`);
  log(`Wallet: ${activeWallet?.name || "None"} (${activeWallet?.address || "N/A"})`);
  log(`Last check: ${state.lastCheck || "Never"}`);
  log(`Total deposited: ${formatSats(BigInt(state.totalDeposited))}`);
  log(`Total earned: ${formatSats(BigInt(state.totalEarned))}`);
  log(`Transaction count: ${state.transactions.length}`);

  if (activeWallet && NETWORK === "mainnet") {
    const zest = getZestProtocolService(NETWORK);
    const position = await zest.getUserPosition(ZEST_ASSETS.sBTC.token, activeWallet.address);
    if (position) {
      log(`\nCurrent Zest Position:`);
      log(`  Supplied: ${formatSats(BigInt(position.supplied))}`);
      log(`  Borrowed: ${formatSats(BigInt(position.borrowed))}`);
    }

    const walletBalance = await getSbtcBalance(activeWallet.address);
    log(`\nWallet sBTC: ${formatSats(walletBalance)}`);
  }
}

async function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write("Enter wallet password: ");

    // Disable echo for password input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let password = "";

    const onData = (chunk: Buffer) => {
      const char = chunk.toString();

      if (char === "\n" || char === "\r" || char === "\u0003") {
        process.stdin.removeListener("data", onData);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.log(); // New line after password

        if (char === "\u0003") {
          process.exit(0);
        }

        resolve(password);
      } else if (char === "\u007F" || char === "\b") {
        // Backspace
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function main(args: string[]): Promise<void> {
  const command = args[0] || "help";

  const config: YieldHunterConfig = { ...DEFAULT_CONFIG };

  // Parse flags
  for (const arg of args) {
    if (arg === "--execute" || arg === "-e") {
      config.execute = true;
    } else if (arg.startsWith("--threshold=")) {
      config.minDepositThreshold = BigInt(arg.split("=")[1]);
    } else if (arg.startsWith("--interval=")) {
      config.checkIntervalMs = parseInt(arg.split("=")[1]) * 1000;
    }
  }

  switch (command) {
    case "start":
      await startDaemon(config);
      break;

    case "status":
      await showStatus();
      break;

    case "help":
    default:
      console.log(`
Yield Hunter - Autonomous sBTC yield farming

Usage:
  npx @aibtc/mcp-server yield-hunter <command> [options]

Commands:
  start     Start the yield hunting daemon
  status    Show current status and positions
  help      Show this help message

Options:
  --execute, -e         Actually execute transactions (default: dry run)
  --threshold=<sats>    Minimum sBTC (in sats) before depositing (default: 10000)
  --interval=<seconds>  Check interval in seconds (default: 600)

Examples:
  npx @aibtc/mcp-server yield-hunter start
  npx @aibtc/mcp-server yield-hunter start --execute
  npx @aibtc/mcp-server yield-hunter start --execute --threshold=100000
  npx @aibtc/mcp-server yield-hunter status

Note: Requires a wallet created via the MCP server. Run:
  npx @aibtc/mcp-server --install

Then use Claude to create a wallet with wallet_create or wallet_import.
`);
      break;
  }
}
