#!/usr/bin/env node
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createRequire } from "module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAllTools } from "./tools/index.js";
import { NETWORK, API_URL } from "./config/index.js";
import { redactSensitive } from "./utils/redact.js";
import { initializeStorage } from "./utils/storage.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

// =============================================================================
// AUTO-INSTALL FOR CLAUDE CODE, CLAUDE DESKTOP, AND CODEX
// =============================================================================

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

function getCodexConfigPath(): string {
  return path.join(os.homedir(), ".codex", "config.toml");
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function removeTomlTable(content: string, tableName: string): string {
  const target = `[${tableName}]`;
  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const startsTable = /^\[[^\]]+\]$/.test(trimmed);

    if (trimmed === target) {
      skipping = true;
      continue;
    }

    if (skipping && startsTable) {
      skipping = false;
    }

    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join("\n").trimEnd();
}

function upsertCodexConfig(content: string, network: string): string {
  let next = removeTomlTable(content, "mcp_servers.aibtc");
  next = removeTomlTable(next, "mcp_servers.aibtc.env");

  const block = [
    "[mcp_servers.aibtc]",
    'command = "npx"',
    'args = ["-y", "@aibtc/mcp-server@latest"]',
    "",
    "[mcp_servers.aibtc.env]",
    `NETWORK = "${escapeTomlString(network)}"`,
  ].join("\n");

  return `${next}${next ? "\n\n" : ""}${block}\n`;
}

async function readJsonConfig(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    // File doesn't exist or isn't valid JSON, start fresh
    return {};
  }
}

async function writeJsonConfig(filePath: string, config: Record<string, unknown>): Promise<void> {
  // Ensure the parent directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}

async function readTextConfig(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function writeTextConfig(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
}

async function installToClaudeCode(): Promise<void> {
  const claudeConfigPath = path.join(os.homedir(), ".claude.json");
  const network = process.argv.includes("--testnet") ? "testnet" : "mainnet";

  console.log("🔧 Installing @aibtc/mcp-server to Claude Code...\n");

  const config = await readJsonConfig(claudeConfigPath) as { mcpServers?: Record<string, unknown> };

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers["aibtc"] = {
    command: "npx",
    args: ["@aibtc/mcp-server@latest"],
    env: {
      NETWORK: network,
    },
  };

  await writeJsonConfig(claudeConfigPath, config);

  console.log("✅ Successfully installed!\n");
  console.log(`   Config: ${claudeConfigPath}`);
  console.log(`   Network: ${network}`);
  console.log("\n📋 Next steps:");
  console.log("   1. Restart Claude Code (close and reopen terminal)");
  console.log("   2. Ask Claude: \"What's your wallet address?\"");
  console.log("   3. Claude will guide you through wallet setup\n");

  if (network === "testnet") {
    console.log("💡 Tip: Get testnet STX at https://explorer.hiro.so/sandbox/faucet?chain=testnet\n");
  }
}

async function installToClaudeDesktop(): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();
  const network = process.argv.includes("--testnet") ? "testnet" : "mainnet";

  console.log("🔧 Installing @aibtc/mcp-server to Claude Desktop...\n");

  const config = await readJsonConfig(configPath) as { mcpServers?: Record<string, unknown> };

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers["aibtc"] = {
    command: "npx",
    args: ["-y", "@aibtc/mcp-server@latest"],
    env: {
      NETWORK: network,
    },
  };

  await writeJsonConfig(configPath, config);

  console.log("✅ Successfully installed!\n");
  console.log(`   Config: ${configPath}`);
  console.log(`   Network: ${network}`);
  console.log("\n📋 Next steps:");
  console.log("   1. Restart Claude Desktop (quit and reopen the app)");
  console.log("   2. Ask Claude: \"What's your wallet address?\"");
  console.log("   3. Claude will guide you through wallet setup\n");

  if (network === "testnet") {
    console.log("💡 Tip: Get testnet STX at https://explorer.hiro.so/sandbox/faucet?chain=testnet\n");
  }
}

async function installToCodex(): Promise<void> {
  const configPath = getCodexConfigPath();
  const network = process.argv.includes("--testnet") ? "testnet" : "mainnet";

  console.log("🔧 Installing @aibtc/mcp-server to Codex...\n");

  const config = await readTextConfig(configPath);
  await writeTextConfig(configPath, upsertCodexConfig(config, network));

  console.log("✅ Successfully installed!\n");
  console.log(`   Config: ${configPath}`);
  console.log(`   Network: ${network}`);
  console.log("\n📋 Next steps:");
  console.log("   1. Restart Codex or reload MCP configuration");
  console.log("   2. Run `codex mcp list` or use `/mcp` in the Codex TUI to verify `aibtc` is enabled");
  console.log("   3. Ask Codex: \"What's your wallet address?\"");
  console.log("   4. Codex will guide you through wallet setup\n");

  if (network === "testnet") {
    console.log("💡 Tip: Get testnet STX at https://explorer.hiro.so/sandbox/faucet?chain=testnet\n");
  }
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
// Check for --install flag
else if (process.argv.includes("--install") || process.argv.includes("install")) {
  const isDesktop = process.argv.includes("--desktop");
  const isCodex = process.argv.includes("--codex");
  const installFn = isCodex ? installToCodex : isDesktop ? installToClaudeDesktop : installToClaudeCode;
  installFn()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Installation failed:", redactSensitive(error.message));
      process.exit(1);
    });
} else {
  // Normal MCP server mode
  const server = new McpServer({
    name: "aibtc-mcp-server",
    version: packageJson.version,
  });

  // Register all tools from the modular registry
  registerAllTools(server);

  async function main() {
    await initializeStorage();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("aibtc-mcp-server running on stdio");
    console.error(`Network: ${NETWORK}`);
    console.error(`API URL: ${API_URL}`);
  }

  main().catch((error) => {
    console.error("Fatal error:", redactSensitive(String(error)));
    process.exit(1);
  });
}
