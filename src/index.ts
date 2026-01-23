#!/usr/bin/env node
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAllTools } from "./tools/index.js";
import { NETWORK, API_URL } from "./config/index.js";

// =============================================================================
// AUTO-INSTALL FOR CLAUDE CODE
// =============================================================================

async function installToClaudeCode(): Promise<void> {
  const claudeConfigPath = path.join(os.homedir(), ".claude.json");
  const network = process.argv.includes("--testnet") ? "testnet" : "mainnet";

  console.log("🔧 Installing @aibtc/mcp-server to Claude Code...\n");

  // Read existing config or create new one
  let config: { mcpServers?: Record<string, unknown> } = {};
  try {
    const content = await fs.readFile(claudeConfigPath, "utf8");
    config = JSON.parse(content);
  } catch {
    // File doesn't exist, start fresh
  }

  // Add MCP server config
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

  // Write config
  await fs.writeFile(claudeConfigPath, JSON.stringify(config, null, 2));

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
      console.error("❌ Yield Hunter error:", error.message);
      process.exit(1);
    });
}
// Check for --install flag
else if (process.argv.includes("--install") || process.argv.includes("install")) {
  installToClaudeCode()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Installation failed:", error.message);
      process.exit(1);
    });
} else {
  // Normal MCP server mode
  const server = new McpServer({
    name: "aibtc-mcp-server",
    version: "1.0.0",
  });

  // Register all tools from the modular registry
  registerAllTools(server);

  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("aibtc-mcp-server running on stdio");
    console.error(`Network: ${NETWORK}`);
    console.error(`API URL: ${API_URL}`);
  }

  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
