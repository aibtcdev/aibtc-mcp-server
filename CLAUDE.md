# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

aibtc-mcp-server is an MCP (Model Context Protocol) server that enables Claude to:
1. **Discover and execute x402 API endpoints** - Paid API calls for DeFi analytics, AI services, market data
2. **Execute Stacks blockchain transactions** - Transfer STX, call smart contracts, deploy contracts

The plugin automatically handles x402 payment challenges when accessing paid endpoints.

## API Sources

The agent supports two x402 API sources:

| Source | URL | Endpoints |
|--------|-----|-----------|
| x402.biwas.xyz | https://x402.biwas.xyz | DeFi analytics, market data, wallet analysis |
| stx402.com | https://stx402.com | AI services, cryptography, storage, utilities, agent registry |

## Build Commands

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript to dist/
npm run dev       # Run in development mode with tsx
npm start         # Run compiled server
```

## Publishing & Releases

**After major changes or version updates, publish a new release:**

```bash
npm version patch   # or minor/major depending on changes
git push && git push --tags
```

This triggers GitHub Actions to automatically:
1. Build the project
2. Publish to npm
3. Create a GitHub release with changelog

**Version Guidelines:**
- `patch` (2.6.0 → 2.6.1): Bug fixes, CI changes, docs
- `minor` (2.6.0 → 2.7.0): New features, new tools
- `major` (2.6.0 → 3.0.0): Breaking changes

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
┌─────────────────────────────────────────────────────────┐
│  x402 Endpoints                          Stacks TX      │
│  (via api.ts)                         (via wallet.ts)   │
│  ┌─────────────┐  ┌─────────────┐                       │
│  │x402.biwas.xyz│  │ stx402.com  │                       │
│  └─────────────┘  └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
   x402 API Server     x402 API Server     Stacks Blockchain
```

### Key Files

- `src/index.ts` - MCP server with all tool definitions
- `src/api.ts` - Axios client with x402-stacks payment interceptor (supports multiple API sources)
- `src/wallet.ts` - Wallet operations and transaction signing using @stacks/transactions
- `src/services/wallet-manager.ts` - Managed wallet creation, encryption, and session management
- `src/services/defi.service.ts` - ALEX DEX (via alex-sdk) and Zest Protocol integrations
- `src/services/bitflow.service.ts` - Bitflow DEX integration (via @bitflowlabs/core-sdk)
- `src/services/mempool-api.ts` - mempool.space API client for Bitcoin UTXO, fee, and broadcast
- `src/transactions/bitcoin-builder.ts` - Bitcoin transaction building and signing (P2WPKH)
- `src/endpoints/registry.ts` - Known x402 endpoint registry from both API sources
- `src/services/bns.service.ts` - BNS name resolution (supports both V1 and V2)
- `src/services/hiro-api.ts` - Hiro API client + BNS V2 API client
- `src/config/contracts.ts` - Contract addresses and Zest asset configuration (LP tokens, oracles, decimals)
- `src/services/scaffold.service.ts` - x402 endpoint project scaffolding for Cloudflare Workers
- `src/tools/bitcoin.tools.ts` - Bitcoin L1 tools (balance, fees, UTXOs, transfer)
- `src/tools/news.tools.ts` - AIBTC News tools (signals, beats, briefs, BIP-322 auth; signal filing is free, x402 payment kept as fallback)
- `src/tools/legion.tools.ts` - AIBTC News Legion governance (inscribe → propose → vote → conclude, contribute, sponsor)
- `src/services/legion.service.ts` - Legion chain reads, network-pinned account, phase/outcome derivation
- `src/config/legion.ts` - Legion mainnet contract ids (constants), network derivation, contract error codes
- `src/tools/competition.tools.ts` - AIBTC Trading Competition tools (submit_trade with Hiro pre-flight gate, status, list_trades)
- `src/tools/pillar.tools.ts` - Pillar smart wallet tools (handoff model)
- `src/services/pillar-api.service.ts` - Pillar API client
- `src/config/pillar.ts` - Pillar configuration (API URL, API key)

### BNS V1 vs V2

The agent supports both BNS naming systems:

| System | API | Usage |
|--------|-----|-------|
| BNS V1 | `api.hiro.so/v1/names/{name}` | Legacy names (older registrations) |
| BNS V2 | `api.bnsv2.com/names/{name}` | Current system (most .btc names) |

BNS tools automatically check V2 first for `.btc` names, falling back to V1 for legacy support.

### x402 Payment Flow

1. Client makes request to x402 endpoint
2. Endpoint returns HTTP 402 with payment requirements
3. `withPaymentInterceptor` from x402-stacks intercepts the 402
4. Interceptor signs and broadcasts payment transaction
5. Request is retried with payment proof
6. Endpoint returns actual response

## Configuration

Set environment variables in `.env`:
- `CLIENT_MNEMONIC` - 24-word Stacks wallet mnemonic (optional - can use managed wallets instead)
- `NETWORK` - "mainnet" or "testnet" (default: mainnet)
- `API_URL` - Default x402 API base URL (default: https://x402.biwas.xyz)
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` - Only used by the `bridge` subcommand (drive tools via an OpenRouter model)
- `SPEND_LIMIT_ENABLED` - Wallet spending limit on/off (default: true)
- `SPEND_LIMIT_DAILY_USTX` / `SPEND_LIMIT_SESSION_USTX` - STX spend cap per day / per unlock in micro-STX (default: 10000000 = 10 STX)
- `SPEND_LIMIT_DAILY_SATS` / `SPEND_LIMIT_SESSION_SATS` - BTC spend cap per day / per unlock in sats (default: 50000)

### Spending Limit

A default-on safety rail (`src/services/spend-limiter.ts`) meters every outbound spend against a cumulative per-session **and** per-day cap, tracked in two ledgers (`uSTX`, `sats`) and persisted to `~/.aibtc/spend-state.json`. Enforced at the spend chokepoints: `transferStx` (`builder.ts`), `transfer_btc` (`bitcoin.tools.ts`), the x402/L402 auto-payment paths (`x402.service.ts`), and manual `lightning_pay_invoice` (`lightning.tools.ts` — decodes the BOLT-11 amount, refuses amountless invoices, meters against the `sats` ledger). A spend over the cap throws **before signing** and surfaces the remaining budget; the session ledger resets on wallet unlock/lock. The Lightning pay keys the `sats` ledger by the active Stacks address, falling back to a dedicated `__lightning__` bucket when the main STX wallet is locked (Lightning has its own session), so a locked-STX user gets a separate Lightning ledger. Contract calls are metered at the shared `callContract` chokepoint (`builder.ts`), which reads the spend ceiling out of the call's own post-conditions: an `eq`/`lt`/`lte` condition owned by the caller is a cap in native units, so no price oracle is needed inside the safety rail. STX conditions bill the `ustx` ledger, sBTC conditions the `sats` ledger; lower-bound (`gt`/`gte`) conditions and non-sBTC tokens are **not** caps and are left unmetered by design. This covers the Legion sBTC spends (`legion_contribute` / `legion_sponsor`), which sign an exact `willSendEq` post-condition and therefore must not meter again at the tool, and it covers swaps/lending (ALEX/Bitflow/Zest/Jing/Styx) to the extent those paths sign a bounded caller-owned post-condition.

### Wallet Storage

Managed wallets are stored encrypted in `~/.aibtc/`:
```
~/.aibtc/
├── wallets.json       # Wallet index (metadata only)
├── config.json        # Active wallet, settings
└── wallets/
    └── [wallet-id]/
        └── keystore.json  # Encrypted mnemonic (AES-256-GCM)
```

## Adding to an MCP Client

This is a standard stdio MCP server, so it works with any MCP-compatible client. The `--install` helper writes the right config for a target; Claude Code is the default, others are selected with a flag. The install registry lives in `src/index.ts` (`INSTALL_TARGETS`).

```bash
npx @aibtc/mcp-server@latest --install              # Claude Code (default)
npx @aibtc/mcp-server@latest --install --desktop    # Claude Desktop (OS-detected path)
npx @aibtc/mcp-server@latest --install --cursor     # Cursor
npx @aibtc/mcp-server@latest --install --windsurf   # Windsurf
npx @aibtc/mcp-server@latest --install --gemini     # Gemini CLI
npx @aibtc/mcp-server@latest --install --codex      # OpenAI Codex CLI (TOML)
npx @aibtc/mcp-server@latest --install --vscode     # VS Code (./.vscode/mcp.json)
```

Each installer merges into the existing config rather than overwriting it. Zed and Cline are manual-config only (their schemas/paths vary by version) — see README for snippets. The `@latest` tag ensures users always get the newest features.

**For testnet:** Add `--testnet` to any install command, e.g. `npx @aibtc/mcp-server@latest --install --cursor --testnet`

**Note:** `CLIENT_MNEMONIC` is optional. Users can either:
1. **Managed wallets (recommended)**: Use `wallet_create` or `wallet_import` to generate/import wallets with password protection
2. **Environment mnemonic**: Set `CLIENT_MNEMONIC` in env (for power users)

## OpenRouter Bridge

`bridge` is a CLI subcommand (`src/bridge/index.ts`, routed in `src/index.ts` next to `yield-hunter`) that lets an [OpenRouter](https://openrouter.ai) model drive the tools without an MCP host. It spawns this same binary in server mode over stdio, lists tools, converts each to an OpenAI function-tool schema (verbatim `inputSchema` passthrough), and runs the tool-call loop against `https://openrouter.ai/api/v1/chat/completions`. This is OpenRouter's own client-side MCP pattern ([cookbook](https://openrouter.ai/docs/cookbook/coding-agents/mcp-servers)) ported to Node — the client connects to MCP; there is no OpenRouter-side MCP hosting.

```bash
export OPENROUTER_API_KEY=sk-or-...
npx @aibtc/mcp-server@latest bridge "what's the STX balance of SP3..."
```

Safety flags (default exposes all tools; constrain with these):
- `--read-only` — heuristic allowlist; never includes a transfer/swap/deploy/spend tool
- `--allow a,b` / `--block a,b` — explicit overrides (`--block` wins)
- `--max-spend-ustx <n>` / `--max-spend-sats <n>` — forwarded to the spawned server's `SPEND_LIMIT_SESSION_*` rail
- `--list-tools` — preview exposed set, no API key needed
- `--model` / `--network` / `--max-turns`

The allowlist is re-enforced at `tools/call` time, so the model can't reach a tool outside the exposed set. Frameworks with native MCP support (`@openrouter/agent`, OpenAI/Claude Agents SDKs) can point at the server directly instead.

## Available Tools

> **Full tool reference:** [`docs/TOOLS.md`](docs/TOOLS.md) — per-tool parameters,
> examples, contract addresses, asset tables, the competition allowlist, and P&L
> methodology. The MCP server also exposes each tool's description at runtime, so the
> table below is just a discovery map. Read the reference doc before working on a tool's
> behavior.

| Domain | Key tools | Notes |
|--------|-----------|-------|
| Discovery | `list_x402_endpoints` | Start here to find x402 actions |
| Earning | `earning_opportunities` | Static "how to put your assets to work" menu; surface after `identity_register` |
| Bounties | `bounty_list/get/submissions` (read) + `bounty_submit/create/accept/paid/cancel` (BIP-322 auth) + `bounty_my_posted/my_submissions` | aibtc.com sBTC bounty board; most direct way to earn. Submit needs Registered (L1+); create needs Genesis (L2+); bc1q/P2WPKH signing; accepted submission paid in sBTC |
| Wallet & balance | `get_wallet_info`, `get_stx_balance` | |
| Wallet mgmt | `wallet_create/import/unlock/lock/list/switch/delete/export/status` | On mainnet, create/import also derive a Spark Lightning wallet from the same mnemonic |
| Bitcoin L1 | `get_btc_balance/fees/utxos`, `transfer_btc` | mempool.space; P2WPKH; sats |
| Mempool watch | `get_btc_mempool_info`, `get_btc_transaction_status`, `get_btc_address_txs` | |
| Lightning (L402) | `lightning_create/import/unlock/lock/status/fund_from_btc/claim_deposit/pay_invoice/create_invoice` | Mainnet only; Spark SDK; `L402_MAX_SATS_PER_INVOICE` cap |
| Stacks tx | `transfer_stx`, `call_contract`, `deploy_contract`, `get_transaction_status`, `broadcast_transaction` | |
| x402 | `execute_x402_endpoint` | Any x402 URL, auto-payment |
| Scaffolding | `scaffold_x402_endpoint`, `scaffold_x402_ai_endpoint` | Cloudflare Worker projects |
| OpenRouter | `openrouter_integration_guide`, `openrouter_models` | AI feature integration |
| ALEX DEX | `alex_list_pools/get_swap_quote/swap/get_pool_info` | Mainnet only; `alex-sdk` |
| Zest | `zest_list_assets/get_position/supply/withdraw/borrow/repay` | Mainnet only; 10 assets |
| Bitflow DEX | `bitflow_get_ticker/tokens/swap_targets/quote/routes/swap` + Keeper tools | Mainnet only; ticker is public, rest need `BITFLOW_API_KEY` |
| Competition | `competition_submit_trade/status/list_trades/allowlist` | Mainnet only; requires identity registration; Bitflow swaps only score today |
| Pillar | `pillar_connect/disconnect/status/send/fund/supply/boost/unwind/auto_compound/position/create_wallet/add_admin/invite` | Browser handoff for passkey signing |
| AIBTC News | `news_list_signals/front_page/leaderboard/check_status/list_beats` (read) + `news_file_signal/claim_beat` (BIP-322 auth) | bc1q addresses only |
| News Legion | `legion_status/list_stories/get_story/my_position` (read) + `legion_contribute/sponsor/propose_story/vote/conclude` + `legion_inscribe_story/inscribe_reveal` | **Stacks mainnet, real sBTC**, pinned by contract address — never follows global `NETWORK`. No veto, no quorum, no faucet. Proposals blocked until 21 members join (`u441`); a story also needs yes weight ≥ 20× its payout. `contribute`/`sponsor` meter the `SPEND_LIMIT_*` sats rail. Inscription is the exception: native L1 BTC on whatever `NETWORK` names, gated by `confirmMainnetSpend` |
| Inbox | `send_inbox_message_direct` | Mainnet only; non-sponsored sBTC transfer, sender pays STX gas. `send_inbox_message` (sponsored relay path) is **deprecated** — it no longer sends and just redirects here (relay queue could wedge, #540/#592) |

## Agent Behavior Guidelines

When a user asks for something:

1. **For "transfer X STX to Y"** → Use `transfer_stx` directly
2. **For "send X BTC to Y"** → Use `transfer_btc` (wallet must be unlocked)
3. **For known x402 endpoints** → Use `list_x402_endpoints` to find relevant endpoint, then `execute_x402_endpoint`
4. **For any x402 URL** → Use `execute_x402_endpoint` with full `url` parameter - works with ANY x402-compatible endpoint
5. **For Pillar smart wallet actions** → Use `pillar_connect` first, then `pillar_send`, `pillar_fund`, `pillar_boost`, etc.
6. **For aibtc.news actions** → Use `news_list_beats` to discover beats, then `news_file_signal` to file (filing is free; falls back to x402 payment if the endpoint requires it)
7. **For News Legion governance** → Start with `legion_status` (check `membership.activated` — proposals are blocked until the legion activates), then `legion_list_stories`. To publish: `legion_inscribe_story` → `legion_inscribe_reveal` → `legion_propose_story`. To judge: `legion_get_story` (open its `contentUrl` and read the piece) → `legion_vote` with a rationale → `legion_conclude`
8. **For unknown actions** → Ask user for the x402 endpoint URL or check if it's a direct blockchain action

See [`docs/TOOLS.md`](docs/TOOLS.md) for the full example-request → tool mapping.

---

## Knowledge Base References

Use the local knowledge base for Stacks/Clarity and protocol guidance: `/Users/biwas/claudex402/claude-knowledge`

### Quick Reference (Nuggets)
Fast lookups for common facts and gotchas:

- `nuggets/stacks.md` - Tenero API, SIWS, SIP-018 signing standards quick reference
- `nuggets/clarity.md` - Core principles, gotchas, error handling, testing commands
- `nuggets/cloudflare.md` - Worker deployment best practices (prefer CI/CD over direct deploy)
- `nuggets/github.md` - GitHub API, Actions, and Pages workflows

### Deep Reference (Context)
Comprehensive documentation for detailed guidance:

- `context/clarity-reference.md` - Complete Clarity language reference
- `context/siws-guide.md` and `context/sip-siws.md` - SIWS auth flows and implementation
- `context/sip-018.md` - Signed Structured Data standard for on-chain verification
- `context/tenero-api.md` and `downloads/2025-01-06-tenero-openapi-spec.json` - Market data APIs

### Patterns & Best Practices
Reusable code patterns and architectural guidance:

- `patterns/clarity-patterns.md` - Comprehensive Clarity code patterns (public functions, events, error handling, bit flags, multi-send, whitelisting, DAO proposals, fixed-point math, treasury patterns)
- `patterns/clarity-testing.md` - Testing tooling and patterns for Clarity contracts
- `patterns/skill-organization.md` - Three-layer pattern (SKILL → RUNBOOK → HELPERS) for maintainable workflows

### Architectural Decisions
Design principles and workflow patterns:

- `decisions/0002-clarity-design-principles.md` - Contract design rules, security patterns, Clarity 4 features
- `decisions/0001-workflow-component-design.md` - Development workflow component patterns (OODA loop, planning flows, composable workflows)

### Runbooks
Step-by-step operational guides:

- `runbook/clarity-development.md` - Clarity dev workflows and checklists
- `runbook/cloudflare-scaffold.md` - Cloudflare Worker setup, wrangler config, credentials, deployment patterns
- `runbook/aibtc-shared-logger.md` - Shared logging utilities for AIBTC services
- `runbook/daily-summary.md` - Daily summary generation workflow
- `runbook/setup-github-pat.md` - GitHub Personal Access Token setup
- `runbook/setup-sprout-cron.md` - Sprout documentation cron job setup
- `runbook/sprout-docs-inline.md` - Sprout documentation system overview
- `runbook/sprout-docs-github-pages.md` - Documentation site deployment with GitHub Pages
- `runbook/updating-claude-knowledge.md` - Knowledge base maintenance and sanitization guidelines
