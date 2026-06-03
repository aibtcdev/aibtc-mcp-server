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

// Standard MCP server entry shared by every JSON-based client config.
function serverEntry(network: string): Record<string, unknown> {
  return {
    command: "npx",
    args: ["-y", SERVER_NPM],
    env: { NETWORK: network },
  };
}

// Most clients (Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI) use
// the same `{ "mcpServers": { "aibtc": {...} } }` JSON shape.
async function writeMcpServersJson(configPath: string, network: string): Promise<void> {
  const config = await readJsonConfig(configPath);
  const servers = (config.mcpServers ??= {}) as Record<string, unknown>;
  servers["aibtc"] = serverEntry(network);
  await writeJsonConfig(configPath, config);
}

// VS Code (.vscode/mcp.json) uses a `servers` key and a typed stdio entry.
async function writeVsCodeJson(configPath: string, network: string): Promise<void> {
  const config = await readJsonConfig(configPath);
  const servers = (config.servers ??= {}) as Record<string, unknown>;
  servers["aibtc"] = {
    type: "stdio",
    command: "npx",
    args: ["-y", SERVER_NPM],
    env: { NETWORK: network },
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

async function writeCodexToml(configPath: string, network: string): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(configPath, "utf8");
  } catch {
    existing = "";
  }
  const preserved = stripCodexSection(existing).replace(/\s+$/, "");
  const block = [
    "[mcp_servers.aibtc]",
    'command = "npx"',
    `args = ["-y", "${SERVER_NPM}"]`,
    "",
    "[mcp_servers.aibtc.env]",
    `NETWORK = "${network}"`,
  ].join("\n");
  const content = (preserved ? `${preserved}\n\n` : "") + block + "\n";
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, content);
}

interface InstallTarget {
  flag: string | null; // null = default target (Claude Code)
  label: string;
  configPath: () => string;
  write: (configPath: string, network: string) => Promise<void>;
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

async function runInstall(): Promise<void> {
  const network = process.argv.includes("--testnet") ? "testnet" : "mainnet";
  const target = resolveInstallTarget();
  const configPath = target.configPath();

  console.log(`🔧 Installing @aibtc/mcp-server to ${target.label}...\n`);

  await target.write(configPath, network);

  console.log("✅ Successfully installed!\n");
  console.log(`   Client:  ${target.label}`);
  console.log(`   Config:  ${configPath}`);
  console.log(`   Network: ${network}`);
  console.log("\n📋 Next steps:");
  console.log(`   1. ${target.restart}`);
  console.log("   2. Ask the agent: \"What's your wallet address?\"");
  console.log("   3. The agent will guide you through wallet setup\n");

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
  runInstall()
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
