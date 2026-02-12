# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

aibtc-mcp-server is a **Bitcoin-first** MCP (Model Context Protocol) server that enables Claude to:
1. **Bitcoin L1 operations** - Check balances, send BTC, manage UTXOs (primary)
2. **Stacks L2 operations** - Transfer STX, call smart contracts, DeFi protocols
3. **x402 paid APIs** - AI services, analytics, storage with micropayments

The server automatically handles x402 payment challenges when accessing paid endpoints.

## API Sources

| Source | URL | Endpoints |
|--------|-----|-----------|
| x402.biwas.xyz | https://x402.biwas.xyz | DeFi analytics, market data, wallet analysis |
| x402.aibtc.com | https://x402.aibtc.com | Inference, Stacks utilities, hashing, storage |
| stx402.com | https://stx402.com | AI services, cryptography, storage, utilities, agent registry |

## Build Commands

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript to dist/
npm run dev       # Run in development mode with tsx
npm start         # Run compiled server
```

## Publishing & Releases

**This repo uses [Release Please](https://github.com/googleapis/release-please) for automated releases.**

1. Merge PRs to main with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
2. Release Please auto-creates/updates a "Release PR" with pending changelog
3. Merge the Release PR when ready to ship
4. GitHub Actions automatically bumps version, generates changelog, creates tag, publishes to npm/GitHub Packages, and publishes skill to ClawHub

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `fix:` | Patch (1.7.0 → 1.7.1) | Bug fixes |
| `feat:` | Minor (1.7.0 → 1.8.0) | New features, new tools |
| `feat!:` or `BREAKING CHANGE:` | Major (1.7.0 → 2.0.0) | Breaking changes |
| `docs:`, `chore:`, `ci:` | No bump | Non-code changes |

## Code Principles

**CRITICAL: Follow these principles when writing code in this repository:**

1. **No Dummy Implementations** - Never write placeholder/stub code that returns fake data. If a feature can't be fully implemented, don't implement it at all. Remove the feature rather than shipping non-functional code.

2. **No Defensive Programming with Fallback Dummies** - Do not catch errors and return default/dummy values. If an operation fails, let it fail. Don't hide failures behind fake success responses.

3. **Real Implementation or Nothing** - Every function must do real work. If you can't make a real API call, contract call, or data fetch, don't write the function.

4. **Delete Over Stub** - When removing functionality, delete it completely. Don't leave behind commented code, stub methods, or "TODO" implementations.

5. **Errors Should Surface** - Let errors propagate to the user. Don't swallow exceptions or return fallback values that mask failures.

## Architecture

```
Claude Code
    ↓ (MCP stdio transport)
aibtc-mcp-server MCP Server (src/index.ts)
    ↓
┌──────────────────────────────────────────────────────────────────────┐
│  x402 Endpoints                                       Stacks TX      │
│  (via api.ts)                                      (via wallet.ts)   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐                 │
│  │x402.biwas.xyz│  │x402.aibtc.com│  │ stx402.com  │                 │
│  └──────────────┘  └──────────────┘  └─────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
         ↓                   ↓                  ↓                ↓
   x402 API Server    x402 API Server    x402 API Server   Stacks Blockchain
```

## Configuration

Set environment variables in `.env`:
- `CLIENT_MNEMONIC` - 24-word Stacks wallet mnemonic (optional - can use managed wallets instead)
- `NETWORK` - "mainnet" or "testnet" (default: mainnet)
- `API_URL` - Default x402 API base URL (default: https://x402.biwas.xyz)

Optional integrations:
- `PILLAR_API_URL`, `PILLAR_API_KEY` - Pillar smart wallet
- `BITFLOW_API_KEY`, `BITFLOW_API_HOST` - Bitflow DEX

## Agent Behavior Guidelines

**Bitcoin-First Principle**: When users ask about "their wallet" or "their balance" without specifying a chain, default to Bitcoin (L1). Only use Stacks L2 operations when users explicitly mention STX, Stacks, or L2-specific features.

**Ordinal Safety Principle**: `transfer_btc` and `sbtc_deposit` automatically use only cardinal UTXOs (safe to spend) by default on mainnet. Never suggest `includeOrdinals=true` unless the user explicitly wants to spend ordinal UTXOs.

**Fee Presets**: All Stacks write operations accept an optional `fee` parameter: `"low"` | `"medium"` | `"high"` (fetches current estimates) or a numeric string in micro-STX. Bitcoin operations use `feeRate`: `"fast"` | `"medium"` | `"slow"` or custom sat/vB.

## Tools

Tool definitions and parameters are self-documented in the MCP tool descriptions. Tools are organized by category:

- **Bitcoin L1** - Balance, fees, UTXOs, transfers, inscriptions
- **Wallet** - Create, import, unlock, lock, switch, export, status
- **Stacks L2** - STX transfers, contract calls, deployment, transaction status
- **Message Signing** - SIP-018 (on-chain), SIWS (web auth), BIP-137 (Bitcoin)
- **Tokens & NFTs** - sBTC, SIP-010 tokens, SIP-009 NFTs, BNS domains
- **DeFi** - ALEX DEX, Zest Protocol, Bitflow DEX (all mainnet only)
- **Pillar** - Smart wallet (handoff mode via browser, direct mode for agents)
- **x402** - Execute paid endpoints, scaffold new endpoint projects
- **Yield Hunter** - Autonomous sBTC yield monitoring and Zest deposits
- **ERC-8004** - Agent identity and reputation on-chain

## Agent Skill

This package includes an Agent Skills-compatible skill at `skill/SKILL.md` with structured workflows and reference guides following the [agentskills.io](https://agentskills.io) spec.
