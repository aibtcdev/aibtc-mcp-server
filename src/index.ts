#!/usr/bin/env node
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createRequire } from "module";
import { randomBytes } from "crypto";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { McpServer } from "@modelcontextprotocol/server";

import { registerAllTools } from "./tools/index.js";
import { describeSelection, resolveToolSelection, type ToolSelection } from "./tools/profiles.js";
import { installBountyHint } from "./tools/bounty-hint.js";
import { NETWORK, API_URL } from "./config/index.js";
import { redactSensitive } from "./utils/redact.js";
import { initializeStorage } from "./utils/storage.js";
import { getWalletManager } from "./services/wallet-manager.js";
import { getLightningManager } from "./services/lightning-manager.js";
import type { Network } from "./config/networks.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

// =============================================================================
// AUTO-INSTALL FOR MCP CLIENTS
//
// The server is a standard stdio MCP server, so it works with any MCP client.
// `--install` writes the correct config for a target client. Claude Code is the
// default; other clients are selected with a flag (e.g. --cursor, --codex).
// =============================================================================

const SERVER_NPM = "@aibtc/mcp-server@latest";

function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  const home = os.homedir();

  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  } else {
    // Linux and other Unix-like systems
    return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

async function readJsonConfig(filePath: string): Promise<Record<string, unknown>> {
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {}; // No config yet - fresh install
    }
    throw error;
  }
  try {
    return JSON.parse(content);
  } catch {
    // Never silently replace an unparseable config: it may hold the user's
    // other MCP servers, and "merging" into {} would discard them on write.
    throw new Error(
      `Existing config at ${filePath} is not valid JSON. ` +
        `Fix or remove it, then re-run the install.`
    );
  }
}

async function writeJsonConfig(filePath: string, config: Record<string, unknown>): Promise<void> {
  // Ensure the parent directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}

// Standard MCP server entry shared by every JSON-based client config.
function serverEntry(env: Record<string, string>): Record<string, unknown> {
  return {
    command: "npx",
    args: ["-y", SERVER_NPM],
    env,
  };
}

// Most clients (Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI) use
// the same `{ "mcpServers": { "aibtc": {...} } }` JSON shape.
async function writeMcpServersJson(configPath: string, env: Record<string, string>): Promise<void> {
  const config = await readJsonConfig(configPath);
  const servers = (config.mcpServers ??= {}) as Record<string, unknown>;
  servers["aibtc"] = serverEntry(env);
  await writeJsonConfig(configPath, config);
}

// VS Code (.vscode/mcp.json) uses a `servers` key and a typed stdio entry.
async function writeVsCodeJson(configPath: string, env: Record<string, string>): Promise<void> {
  const config = await readJsonConfig(configPath);
  const servers = (config.servers ??= {}) as Record<string, unknown>;
  servers["aibtc"] = {
    type: "stdio",
    command: "npx",
    args: ["-y", SERVER_NPM],
    env,
  };
  await writeJsonConfig(configPath, config);
}

// Codex uses TOML, not JSON. Rewrite only the `[mcp_servers.aibtc]` section so
// the rest of the user's config.toml (including comments) is preserved.
function stripCodexSection(content: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of content.split("\n")) {
    const header = line.trim();
    if (header.startsWith("[")) {
      skipping = header === "[mcp_servers.aibtc]" || header.startsWith("[mcp_servers.aibtc.");
    }
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}

async function writeCodexToml(configPath: string, env: Record<string, string>): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error; // Unreadable existing config must not be clobbered
    }
  }
  const preserved = stripCodexSection(existing).replace(/\s+$/, "");
  const block = [
    "[mcp_servers.aibtc]",
    'command = "npx"',
    `args = ["-y", "${SERVER_NPM}"]`,
    "",
    "[mcp_servers.aibtc.env]",
    ...Object.entries(env).map(([key, value]) => `${key} = "${value}"`),
  ].join("\n");
  const content = (preserved ? `${preserved}\n\n` : "") + block + "\n";
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, content);
}

interface InstallTarget {
  flag: string | null; // null = default target (Claude Code)
  label: string;
  configPath: () => string;
  write: (configPath: string, env: Record<string, string>) => Promise<void>;
  restart: string;
}

const INSTALL_TARGETS: InstallTarget[] = [
  {
    flag: "--desktop",
    label: "Claude Desktop",
    configPath: getClaudeDesktopConfigPath,
    write: writeMcpServersJson,
    restart: "Restart Claude Desktop (quit and reopen the app)",
  },
  {
    flag: "--cursor",
    label: "Cursor",
    configPath: () => path.join(os.homedir(), ".cursor", "mcp.json"),
    write: writeMcpServersJson,
    restart: "Restart Cursor",
  },
  {
    flag: "--windsurf",
    label: "Windsurf",
    configPath: () => path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
    write: writeMcpServersJson,
    restart: "Restart Windsurf",
  },
  {
    flag: "--gemini",
    label: "Gemini CLI",
    configPath: () => path.join(os.homedir(), ".gemini", "settings.json"),
    write: writeMcpServersJson,
    restart: "Restart the Gemini CLI",
  },
  {
    flag: "--vscode",
    label: "VS Code",
    configPath: () => path.join(process.cwd(), ".vscode", "mcp.json"),
    write: writeVsCodeJson,
    restart: "Reload VS Code, then start the MCP server from the .vscode/mcp.json gutter",
  },
  {
    flag: "--codex",
    label: "Codex CLI",
    configPath: () => path.join(os.homedir(), ".codex", "config.toml"),
    write: writeCodexToml,
    restart: "Restart the Codex CLI",
  },
  {
    flag: null,
    label: "Claude Code",
    configPath: () => path.join(os.homedir(), ".claude.json"),
    write: writeMcpServersJson,
    restart: "Restart Claude Code (close and reopen terminal)",
  },
];

function resolveInstallTarget(): InstallTarget {
  const matched = INSTALL_TARGETS.filter((t) => t.flag && process.argv.includes(t.flag));
  if (matched.length > 1) {
    console.warn(
      `⚠️  Multiple client flags passed (${matched.map((t) => t.flag).join(", ")}); using ${matched[0].label}.`,
    );
  }
  // Default to the entry explicitly marked as default (flag === null) — Claude Code.
  return matched[0] ?? INSTALL_TARGETS.find((t) => t.flag === null)!;
}

/**
 * Create the agent's wallet during install so a fresh user can fund it right
 * away. The generated password and the mnemonic are printed once and not
 * stored in plain text; the password can be changed with wallet_rotate_password.
 * Returns the Stacks address of the new or already-existing wallet.
 */
async function ensureInstallWallet(network: Network): Promise<string> {
  await initializeStorage();
  const walletManager = getWalletManager();

  const existing = (await walletManager.listWallets()).find((w) => w.network === network);
  if (existing) {
    console.log(`\n👛 Existing ${network} wallet kept: ${existing.name} (${existing.address})`);
    return existing.address;
  }

  const password = randomBytes(18).toString("base64url");
  const wallet = await walletManager.createWallet("main", password, network);

  // Print the credentials before anything else can fail: the wallet is already
  // on disk, and without the password it can never be unlocked.
  console.log(`\n👛 Wallet created (${network}), stored encrypted in ~/.aibtc/`);
  console.log(`   Stacks:    ${wallet.address}`);
  if (wallet.btcAddress) console.log(`   Bitcoin:   ${wallet.btcAddress}`);
  console.log(`\n   Password:  ${password}`);
  console.log(`   Mnemonic:  ${wallet.mnemonic}`);
  console.log("\n⚠️  Write both down now. They are shown once and the password is not saved anywhere.");
  console.log("   The password unlocks the wallet; change it any time by asking your agent to rotate it.");
  console.log("   The mnemonic is the only way to recover the wallet and its funds.");

  // Same unified setup as wallet_create: a Lightning wallet derived from the
  // same mnemonic (mainnet only). Its failure is reported, the main wallet stands.
  try {
    const lightning = await getLightningManager().setupFromMainMnemonic(
      wallet.mnemonic,
      password,
      "main",
      network
    );
    if (lightning.kind === "setup") {
      console.log(`   Lightning: ${lightning.depositAddress} (deposit address, same mnemonic)`);
    }
  } catch (error) {
    console.error(
      `   Lightning setup failed: ${redactSensitive(error instanceof Error ? error.message : String(error))}. ` +
        "Ask your agent to run lightning_create later."
    );
  }
  return wallet.address;
}

async function runInstall(): Promise<void> {
  const network = process.argv.includes("--testnet") ? "testnet" : "mainnet";
  // Only --profile full installs everything; resolving against AIBTC_TOOLS=core
  // also validates the flag.
  const fullProfile = resolveToolSelection(process.argv, { AIBTC_TOOLS: "core" }).all;
  const target = resolveInstallTarget();
  const configPath = target.configPath();

  console.log(`🔧 Installing @aibtc/mcp-server to ${target.label}...\n`);

  const env: Record<string, string> = { NETWORK: network };
  env.AIBTC_TOOLS = fullProfile ? "all" : "core";
  await target.write(configPath, env);

  console.log("✅ Successfully installed!\n");
  console.log(`   Client:  ${target.label}`);
  console.log(`   Config:  ${configPath}`);
  console.log(`   Network: ${network}`);
  console.log(
    `   Tools:   ${fullProfile ? "all" : "lean core (set AIBTC_TOOLS=core,defi,ordinals,... in the env, or re-run with --profile full)"}`
  );

  // The wallet's password and mnemonic are printed once, so only create it when
  // a person is reading the terminal, never into a pipe, file or CI log.
  let address: string | null = null;
  if (process.argv.includes("--no-wallet")) {
    // Explicitly skipped
  } else if (!process.stdout.isTTY) {
    console.log("\n👛 Wallet not created: output is not a terminal, and the password and mnemonic");
    console.log("   are only ever printed to one. Re-run --install in a terminal, or ask the agent to create one.");
  } else {
    address = await ensureInstallWallet(network);
  }

  console.log(`\n📋 ${target.restart}, then try:`);
  const fund = network === "testnet"
    ? "testnet STX from https://explorer.hiro.so/sandbox/faucet?chain=testnet"
    : "0.01 STX";
  console.log(
    address
      ? `   1. Send ${fund} to ${address}`
      : `   1. Ask your agent: "What's your wallet address?" and send it ${fund}`
  );
  console.log(`   2. Ask your agent: "Unlock my wallet" and give it the password`);
  const x402Host = network === "testnet" ? "x402.aibtc.dev" : "x402.aibtc.com";
  console.log(`   3. Ask it: "Make a paid inference call on ${x402Host}" (0.001 STX per call)\n`);
}

// =============================================================================
// YIELD HUNTER DAEMON
// =============================================================================

async function runYieldHunter(): Promise<void> {
  // Dynamic import to avoid loading yield-hunter code unless needed
  const { main } = await import("./yield-hunter/index.js");
  // Pass remaining args after "yield-hunter"
  const yieldHunterArgs = process.argv.slice(3);
  await main(yieldHunterArgs);
}

// =============================================================================
// MAIN ROUTING
// =============================================================================

// Check for yield-hunter command
if (process.argv[2] === "yield-hunter") {
  runYieldHunter()
    .then(() => {
      // Don't exit - daemon runs until interrupted
    })
    .catch((error) => {
      console.error("❌ Yield Hunter error:", redactSensitive(error.message));
      process.exit(1);
    });
}
// Check for bridge command (OpenRouter <-> MCP)
else if (process.argv[2] === "bridge") {
  import("./bridge/index.js")
    .then(({ runBridge }) => runBridge(process.argv.slice(3)))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Bridge error:", redactSensitive(String(error)));
      process.exit(1);
    });
}
// Check for --install flag
else if (process.argv.includes("--install") || process.argv.includes("install")) {
  runInstall()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Installation failed:", redactSensitive(error.message));
      process.exit(1);
    });
} else {
  // Normal MCP server mode
  // One instance per connection. serveStdio picks the protocol era from the
  // opening message (2025-era `initialize` or a 2026-07-28 envelope) and pins
  // the instance built by this factory to the connection.
  function createServer(toolSelection: ToolSelection): McpServer {
    const server = new McpServer(
      {
        name: "aibtc-mcp-server",
        version: packageJson.version,
      },
      {
        instructions: [
          "This server lets an agent earn and move real Bitcoin/sBTC on Stacks.",
          "",
          "Hunt bounties. The most direct way to earn here is the sBTC bounty board:",
          "call bounty_list to see open bounties, bounty_get for the task detail, do",
          "the work, then bounty_submit your deliverable. Accepted submissions are paid",
          "in sBTC. Check periodically for new open bounties.",
          "",
          "For the full menu of ways to put assets to work (stacking, DeFi yield,",
          "trading, paid endpoints), call earning_opportunities. Submitting to a bounty",
          "requires a Registered (L1+) on-chain identity — see identity_register.",
          "",
          describeSelection(toolSelection),
        ].join("\n"),
      }
    );

    // Append a bounty-board hint to spend/onboarding-tool output.
    // Must wrap registerTool before registration; restore it after.
    const restoreBountyHint = installBountyHint(server);

    // Register all tools from the modular registry
    registerAllTools(server, toolSelection);
    restoreBountyHint();

    return server;
  }

  async function main() {
    const toolSelection = resolveToolSelection();
    await initializeStorage();
    serveStdio(() => createServer(toolSelection), { onerror: (error) => console.error("MCP error:", redactSensitive(String(error))) });
    console.error("aibtc-mcp-server running on stdio");
    console.error(`Network: ${NETWORK}`);
    console.error(`API URL: ${API_URL}`);
    console.error(`Tools: ${toolSelection.all ? "all" : ["core", ...toolSelection.groups].join(", ")}`);
  }

  main().catch((error) => {
    console.error("Fatal error:", redactSensitive(String(error)));
    process.exit(1);
  });
}
