# ClawHub Skill Publishing for aibtc-bitcoin-wallet

Publish an Agent Skills-compatible skill to ClawHub that teaches any LLM how to use the `@aibtc/mcp-server` Bitcoin wallet capabilities.

Status: completed
Created: 2026-01-30
Completed: 2026-01-30
Repos: aibtcdev/aibtc-mcp-server

## Goal

Create a standalone, LLM-agnostic skill package that:

1. **Teaches agents** how to use Bitcoin L1 wallet tools effectively
2. **Modular structure** with references for Pillar smart wallets and Stacks L2
3. **Auto-publishes** to ClawHub on npm release tags
4. **Installs via npm** alongside the MCP server or standalone

The skill focuses on Bitcoin L1 as the primary capability, with Pillar (sBTC smart wallet) and Stacks DeFi as progressive layers. Each section stays light with links for LLMs to follow for deeper context.

## Target Audience

- Developers experimenting with Bitcoin/Stacks agent capabilities
- Any LLM agent (not Claude-specific)
- Anyone who wants consistent agent behavior when using these tools

## Naming

- **Skill name**: `aibtc-bitcoin-wallet`
- **NPM package**: `@aibtc/mcp-server` (unchanged)
- **GitHub repo**: `aibtcdev/aibtc-mcp-server` (unchanged)

## Technical Context

### Agent Skills Standard
- Follows [agentskills.io](https://agentskills.io) open specification
- Compatible with Claude Code, Cursor, Codex, Gemini CLI, 20+ other tools

### ClawHub Publishing
- CLI: `npm i -g clawhub`
- Publish: `clawhub publish ./skill --slug aibtc-bitcoin-wallet --name "AIBTC Bitcoin Wallet" --version 1.0.0`
- Registry: [clawhub.ai/skills](https://www.clawhub.ai/skills)

### Skill Location
- Lives in repo at `skill/` (not `.claude/`)
- Distributed with npm package
- Can be used standalone or with MCP server
