# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

aibtc-mcp-server is an MCP (Model Context Protocol) server that enables Claude to:
1. **Discover and execute x402 API endpoints** - Paid API calls for DeFi analytics, AI services, market data
2. **Execute Stacks blockchain transactions** - Transfer STX, call smart contracts, deploy contracts

The plugin automatically handles x402 payment challenges when accessing paid endpoints.

## API Sources

The agent supports three x402 API sources:

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
- `src/tools/pillar.tools.ts` - Pillar smart wallet tools (handoff model)
- `src/tools/pillar-direct.tools.ts` - Pillar direct tools (agent-signed, no browser)
- `src/services/pillar-api.service.ts` - Pillar API client
- `src/services/signing-key.service.ts` - Local signing key management for Pillar direct mode
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

## Adding to Claude Code

**One-command install:**
```bash
npx @aibtc/mcp-server@latest --install
```

This automatically configures `~/.claude.json` with the MCP server. The `@latest` tag ensures users always get the newest features.

**For testnet:** `npx @aibtc/mcp-server@latest --install --testnet`

**Note:** `CLIENT_MNEMONIC` is optional. Users can either:
1. **Managed wallets (recommended)**: Use `wallet_create` or `wallet_import` to generate/import wallets with password protection
2. **Environment mnemonic**: Set `CLIENT_MNEMONIC` in env (for power users)

## Available Tools

### Endpoint Discovery
- `list_x402_endpoints` - List all available x402 endpoints with search/filter by source, category, or keyword. **Use this first** to discover what actions are available.

### Wallet & Balance
- `get_wallet_info` - Get configured wallet address, network, and API URL
- `get_stx_balance` - Get STX balance for any address

### Wallet Management
- `wallet_create` - Generate a new wallet with BIP39 mnemonic (encrypted locally)
- `wallet_import` - Import an existing wallet from mnemonic
- `wallet_unlock` - Unlock a wallet for transactions (requires password)
- `wallet_lock` - Lock the wallet (clear from memory)
- `wallet_list` - List all available wallets
- `wallet_switch` - Switch active wallet
- `wallet_delete` - Permanently delete a wallet
- `wallet_export` - Export mnemonic (with security warning)
- `wallet_status` - Get current wallet/session status

### Bitcoin L1 Transactions

Tools for Bitcoin L1 blockchain operations via mempool.space API:

**Read Operations:**
- `get_btc_balance` - Get BTC balance for any Bitcoin address (total, confirmed, unconfirmed)
- `get_btc_fees` - Get current fee estimates (fast ~10min, medium ~30min, slow ~1hr) in sat/vB
- `get_btc_utxos` - List UTXOs for a Bitcoin address (useful for debugging/transparency)

**Write Operations:**
- `transfer_btc` - Transfer BTC to a recipient address (requires unlocked wallet)
  - `recipient`: Bitcoin address (bc1... for mainnet, tb1... for testnet)
  - `amount`: Amount in satoshis (1 BTC = 100,000,000 satoshis)
  - `feeRate`: "fast" | "medium" | "slow" or custom sat/vB number (default: "medium")

**Notes:**
- All tools work on mainnet (`bc1...` addresses) or testnet (`tb1...` addresses) based on NETWORK config
- Read operations can use any address or fall back to wallet's Bitcoin address
- Write operations require an unlocked wallet with BTC balance
- Uses P2WPKH (native SegWit) transactions for optimal fees
- Change is sent back to the sender address

**Example Usage:**
| Request | Action |
|---------|--------|
| "What's my BTC balance?" | `get_btc_balance` (uses wallet's btcAddress) |
| "Check BTC fees" | `get_btc_fees` |
| "Show UTXOs for bc1q..." | `get_btc_utxos` with address |
| "Send 50000 sats to tb1q..." | `transfer_btc` with recipient, amount=50000 |
| "Transfer 0.001 BTC with fast fees" | `transfer_btc` with amount=100000, feeRate="fast" |

### Direct Stacks Transactions
- `transfer_stx` - Transfer STX tokens to a recipient (signs and broadcasts)
- `call_contract` - Call a smart contract function (signs and broadcasts)
- `deploy_contract` - Deploy a Clarity smart contract
- `get_transaction_status` - Check transaction status by txid
- `broadcast_transaction` - Broadcast a pre-signed transaction

### x402 API Endpoints
- `execute_x402_endpoint` - Execute ANY x402 endpoint URL with automatic payment handling. Can use full URL or path+apiUrl.

### x402 Endpoint Scaffolding
- `scaffold_x402_endpoint` - Generate a complete Cloudflare Worker project with x402 payment integration

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `outputDir` | Yes | Absolute path to output directory |
| `projectName` | Yes | Project name (lowercase, hyphens) |
| `endpoints` | Yes | Array of endpoint configs |
| `recipientAddress` | Yes | Stacks address to receive payments |
| `network` | No | "mainnet" or "testnet" (default: mainnet) |
| `facilitatorUrl` | No | Custom facilitator URL |

**Endpoint Config:**
```typescript
{
  path: "/api/premium",       // Endpoint path
  method: "GET" | "POST",     // HTTP method
  description: "...",         // For docs
  amount: "0.001",            // Payment amount
  tokenType: "STX" | "sBTC" | "USDCx"
}
```

**Generated Project Structure:**
```
{projectName}/
├── src/
│   ├── index.ts              # Hono app with routes
│   └── x402-middleware.ts    # Payment verification
├── wrangler.jsonc            # Cloudflare config
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

**Example:**
```
scaffold_x402_endpoint({
  outputDir: "/Users/me/projects",
  projectName: "my-paid-api",
  endpoints: [{
    path: "/api/joke",
    method: "GET",
    description: "Generate a joke",
    amount: "0.001",
    tokenType: "STX"
  }],
  recipientAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  network: "testnet"
})
```

### x402 AI Endpoint Scaffolding (OpenRouter)
- `scaffold_x402_ai_endpoint` - Generate x402 endpoint project with OpenRouter AI integration

**AI Types:**
| Type | Description |
|------|-------------|
| `chat` | General chat/Q&A endpoint |
| `completion` | Text completion/continuation |
| `summarize` | Summarize provided text |
| `translate` | Translate text to target language |
| `custom` | Custom system prompt |

**AI Endpoint Config:**
```typescript
{
  path: "/api/chat",
  description: "Chat with AI",
  amount: "0.01",
  tokenType: "STX" | "sBTC" | "USDCx",
  aiType: "chat" | "completion" | "summarize" | "translate" | "custom",
  model?: "anthropic/claude-3-haiku",  // Optional, uses defaultModel
  systemPrompt?: "You are..."          // Optional, for custom prompts
}
```

**Example:**
```
scaffold_x402_ai_endpoint({
  outputDir: "/Users/me/projects",
  projectName: "my-ai-api",
  endpoints: [{
    path: "/api/chat",
    description: "Chat with AI",
    amount: "0.01",
    tokenType: "STX",
    aiType: "chat"
  }, {
    path: "/api/summarize",
    description: "Summarize text",
    amount: "0.005",
    tokenType: "STX",
    aiType: "summarize"
  }],
  recipientAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  defaultModel: "anthropic/claude-3-haiku"
})
```

**Popular OpenRouter Models:**
- `anthropic/claude-sonnet-4.5` - Best overall, 1M context
- `anthropic/claude-3.5-haiku` - Fast and affordable
- `openai/gpt-4o-mini` - Fast and cheap
- `google/gemini-2.5-flash` - 1M context, fast
- `x-ai/grok-4` - xAI flagship, real-time knowledge
- `deepseek/deepseek-r1` - Excellent reasoning
- `meta-llama/llama-3.3-70b-instruct` - Best open source value

### OpenRouter Integration (AI Features)

Tools for implementing AI features using OpenRouter in any project:

- `openrouter_integration_guide` - Get code examples and patterns for integrating OpenRouter
- `openrouter_models` - List available models with capabilities

**Usage:** When implementing AI features:
1. Call `openrouter_integration_guide` to get code examples for the target environment
2. If documentation is incomplete or outdated, search the web for latest OpenRouter docs
3. Use the returned code templates to implement the feature

**Example Workflow:**
1. User: "Add AI chat to my Cloudflare Worker"
2. Claude calls `openrouter_integration_guide` with `environment: "cloudflare-worker"`
3. If needed, Claude searches web for latest OpenRouter API docs
4. Claude implements the feature using the templates

### DeFi - ALEX DEX (Mainnet Only)

Uses the official `alex-sdk` for swap operations. The SDK handles:
- Token resolution (symbols like "STX", "ALEX" → Currency enum)
- Route optimization
- STX wrapping/unwrapping
- Post conditions

Tools:
- `alex_list_pools` - **Start here!** Discover all available trading pools
- `alex_get_swap_quote` - Get expected output for a token swap (uses `sdk.getAmountTo()`)
- `alex_swap` - Execute a token swap (uses `sdk.runSwap()`)
- `alex_get_pool_info` - Get liquidity pool reserves and details

**Token symbols supported:** STX, WSTX, ALEX, or any token name from `fetchSwappableCurrency()`

### DeFi - Zest Protocol (Mainnet Only)

Uses the `pool-borrow-v2-3` contract with proper function signatures. Asset configuration in `src/config/contracts.ts` includes LP tokens and oracles for all 10 supported assets.

**Supported Assets:**
| Symbol | Token | Decimals |
|--------|-------|----------|
| sBTC | SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token | 8 |
| aeUSDC | SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc | 6 |
| stSTX | SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token | 6 |
| wSTX | SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx | 6 |
| USDH | SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1 | 8 |
| sUSDT | SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt | 6 |
| USDA | SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token | 6 |
| DIKO | SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token | 6 |
| ALEX | SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex | 8 |
| stSTX-BTC | SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2 | 6 |

**Contract Function Signatures:**
- `supply(lp, pool-reserve, asset, amount, owner)`
- `withdraw(pool-reserve, asset, lp, oracle, assets-list, amount, owner)`
- `borrow(pool-reserve, oracle, asset, lp, assets-list, amount, fee-calc, rate-mode, owner)`
- `repay(asset, amount, on-behalf-of, payer)`

Tools:
- `zest_list_assets` - **Start here!** Lists all supported assets with metadata
- `zest_get_position` - Get user's lending position (supplied/borrowed amounts)
- `zest_supply` - Supply assets to earn interest
- `zest_withdraw` - Withdraw supplied assets
- `zest_borrow` - Borrow assets against collateral
- `zest_repay` - Repay borrowed assets

All Zest tools accept asset symbols (e.g., 'stSTX', 'aeUSDC') or full contract IDs.

### DeFi - Bitflow DEX (Mainnet Only)

Uses the official `@bitflowlabs/core-sdk` for swap operations. Bitflow is a DEX aggregator that routes trades across multiple liquidity sources for best prices.

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `BITFLOW_API_KEY` | For SDK features | Bitflow API key (contact Bitflow team to obtain) |
| `BITFLOW_API_HOST` | For SDK features | Bitflow API host URL |
| `BITFLOW_READONLY_API_HOST` | Optional | Read-only API host (default: https://api.hiro.so) |
| `BITFLOW_KEEPER_API_KEY` | For Keeper features | Keeper automation API key |
| `BITFLOW_KEEPER_API_HOST` | For Keeper features | Keeper API host URL |

**Contract Addresses:**
| Network | Primary | XYK Pools |
|---------|---------|-----------|
| Mainnet | `SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M` | `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR` |
| Testnet | `STRP7MYBHSMFH5EGN3HGX6KNQ7QBHVTBPF1669DW` | N/A |

**Tools (Public - No API Key):**
- `bitflow_get_ticker` - Get market data for all trading pairs (prices, volumes, liquidity)

**Tools (Requires BITFLOW_API_KEY):**
- `bitflow_get_tokens` - List all available tokens for swapping
- `bitflow_get_swap_targets` - Get possible swap destinations for a token
- `bitflow_get_quote` - Get swap quote with expected output
- `bitflow_get_routes` - Get all available swap routes between tokens
- `bitflow_swap` - Execute a token swap

**Tools (Requires BITFLOW_KEEPER_API_KEY):**
- `bitflow_get_keeper_contract` - Get or create Keeper contract for automated swaps
- `bitflow_create_order` - Create automated swap order
- `bitflow_get_order` - Get order details
- `bitflow_cancel_order` - Cancel pending order
- `bitflow_get_keeper_user` - Get user's Keeper info and orders

**Keeper Action Types:**
- `SWAP_XYK_SWAP_HELPER` - XYK pool swap
- `SWAP_XYK_STABLESWAP_SWAP_HELPER` - Combined XYK + StableSwap
- `SWAP_STABLESWAP_SWAP_HELPER` - StableSwap only

**TODO - Bitflow API Key Integration:**
- [ ] Contact Bitflow team via Discord to request API keys
- [ ] Set `BITFLOW_API_KEY` and `BITFLOW_API_HOST` environment variables
- [ ] Test SDK features (quotes, tokens, swaps)
- [ ] Optionally configure Keeper API keys for automation features
- [ ] Move API keys to Cloudflare Worker proxy for secure npm distribution

### Pillar Smart Wallet

Pillar tools use a **handoff model**: the MCP server creates an operation intent, opens the Pillar frontend in the browser for passkey signing, then polls for completion. This design is required because Privy embedded wallets use WebAuthn passkeys that can only sign in a browser context.

**Handoff Flow:**
1. MCP calls `/api/mcp/create-op` → returns `opId`
2. Opens `https://pillarbtc.com/?op={opId}` in the user's browser
3. Polls `/api/mcp/op-status/{opId}` every 3s until completed, failed, cancelled, or timeout

**Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `PILLAR_API_URL` | No | Pillar API base URL (default: `https://pillarbtc.com`) |
| `PILLAR_API_KEY` | No | Bearer token for Pillar API authentication |
| `PILLAR_POLL_TIMEOUT_MS` | No | Max polling wait in ms (default: `300000` / 5 min) |
| `PILLAR_DEFAULT_REFERRAL` | No | Default referral address for new wallets (default: `SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.beta-v2-wallet`) |

**Session Storage:**
Pillar sessions are stored in `~/.aibtc/pillar-session.json` containing the connected wallet address and name.

**Tools - Connection:**
- `pillar_connect` - **Start here!** Connect to existing Pillar wallet (opens browser, returns wallet address)
- `pillar_disconnect` - Disconnect and clear local session
- `pillar_status` - Check connection status and wallet address

**Tools - Transactions:**
- `pillar_send` - Send sBTC to BNS names, Pillar wallet names, or Stacks addresses
- `pillar_fund` - Fund wallet via exchange deposit, BTC (auto-converts to sBTC), or sBTC transfer

**Tools - DeFi (Zest Protocol):**
- `pillar_supply` - Supply sBTC to Zest Protocol for yield
- `pillar_boost` - Create/increase leveraged sBTC position (up to 1.5x)
- `pillar_unwind` - Close or reduce leveraged positions
- `pillar_auto_compound` - Configure automatic compounding settings
- `pillar_position` - View wallet balance, collateral, and Zest position details

**Tools - Wallet Management:**
- `pillar_create_wallet` - Create a new Pillar smart wallet with referral
- `pillar_add_admin` - Add backup admin address for recovery
- `pillar_invite` - Get referral link to share with friends

**Tools - DCA Partnerships:**
- `pillar_dca_invite` - Invite a DCA partner by email or wallet address
- `pillar_dca_partners` - View DCA partners and weekly status
- `pillar_dca_leaderboard` - View DCA streak leaderboard
- `pillar_dca_status` - Check DCA schedule status

### Pillar Direct Mode (Agent-Signed)

For autonomous agents that need to operate without browser interaction. Uses local signing keys with SIP-018 structured data signing. Keys auto-unlock using a password derived from `PILLAR_API_KEY`.

**Key Management:**
- `pillar_key_generate` - Generate a new secp256k1 signing keypair
- `pillar_key_unlock` - Unlock a signing key (usually auto-unlocks)
- `pillar_key_lock` - Lock the signing key, clear from memory
- `pillar_key_info` - Show signing key status and all stored keys

**Direct Operations (no browser needed):**
- `pillar_direct_create_wallet` - Create wallet + generate key in one step
- `pillar_direct_send` - Send sBTC (supports BNS names, wallet names, addresses)
- `pillar_direct_supply` - Supply sBTC to Zest Protocol
- `pillar_direct_boost` - Create/increase leveraged position
- `pillar_direct_unwind` - Close or reduce leveraged position
- `pillar_direct_withdraw_collateral` - Withdraw sBTC collateral from Zest
- `pillar_direct_auto_compound` - Configure auto-compound settings
- `pillar_direct_add_admin` - Add backup admin address
- `pillar_direct_position` - View wallet balances and Zest position
- `pillar_direct_quote` - Get boost quote before executing

**Direct DCA Tools:**
- `pillar_direct_dca_invite` - Invite a DCA partner
- `pillar_direct_dca_partners` - View DCA partners
- `pillar_direct_dca_leaderboard` - View DCA leaderboard
- `pillar_direct_dca_status` - Check DCA schedule status

**Signing Key Storage:**
Signing keys are stored encrypted in `~/.aibtc/signing-keys/`:
```
~/.aibtc/signing-keys/
├── keys.json              # Key index (metadata only)
└── [key-id]/
    └── keystore.json      # Encrypted private key (AES-256-GCM)
```

## Agent Behavior Guidelines

When a user asks for something:

1. **For "transfer X STX to Y"** → Use `transfer_stx` directly
2. **For "send X BTC to Y"** → Use `transfer_btc` (wallet must be unlocked)
3. **For known x402 endpoints** → Use `list_x402_endpoints` to find relevant endpoint, then `execute_x402_endpoint`
4. **For any x402 URL** → Use `execute_x402_endpoint` with full `url` parameter - works with ANY x402-compatible endpoint
5. **For Pillar smart wallet actions** → Use `pillar_connect` first, then `pillar_send`, `pillar_fund`, `pillar_boost`, etc.
6. **For unknown actions** → Ask user for the x402 endpoint URL or check if it's a direct blockchain action

### Example User Requests

| Request | Action |
|---------|--------|
| "Send 2 STX to ST1..." | `transfer_stx` with amount "2000000" |
| "Send 50000 sats to tb1q..." | `transfer_btc` with recipient, amount=50000 |
| "Transfer 0.001 BTC with fast fees" | `transfer_btc` with amount=100000, feeRate="fast" |
| "What's my BTC balance?" | `get_btc_balance` (uses wallet's btcAddress) |
| "What are trending pools?" | `execute_x402_endpoint` with path="/api/pools/trending" |
| "What pools can I trade on ALEX?" | `alex_list_pools` to discover available pairs |
| "Swap 0.1 STX for ALEX" | `alex_swap` with tokenX="STX", tokenY="ALEX" (SDK handles resolution) |
| "How much ALEX for 10 STX?" | `alex_get_swap_quote` with simple symbols |
| "Supply 1000 stSTX to Zest" | `zest_supply` with asset="stSTX" |
| "Borrow 100 aeUSDC from Zest" | `zest_borrow` with asset="aeUSDC" |
| "Check my Zest position" | `zest_get_position` for supplied/borrowed |
| "Get Bitflow market data" | `bitflow_get_ticker` (no API key required) |
| "Swap tokens on Bitflow" | `bitflow_swap` with tokenX and tokenY contract IDs |
| "Get a quote on Bitflow" | `bitflow_get_quote` for expected output |
| "Tell me a dad joke" | `execute_x402_endpoint` with url="https://stx402.com/api/ai/dad-joke" |
| "Create a paid API endpoint for jokes" | `scaffold_x402_endpoint` with endpoint config |
| "Create an AI chatbot API that charges per request" | `scaffold_x402_ai_endpoint` with chat aiType |
| "Connect my Pillar wallet" | `pillar_connect` to open browser and get wallet address |
| "Send 10000 sats to muneeb.btc on Pillar" | `pillar_send` with to="muneeb.btc", amount=10000 |
| "Fund my Pillar wallet from Coinbase" | `pillar_fund` with method="exchange" |
| "Boost my sBTC position on Pillar" | `pillar_boost` to create leveraged position |
| "Check my Pillar position" | `pillar_position` for balance and Zest details |

### Endpoint Categories

**x402.biwas.xyz:**
- News & Research, Security, Wallet Analysis
- Market Data, Pools, Tokens

**x402.aibtc.com:**
- Inference (OpenRouter, Cloudflare AI)
- Stacks Utilities (address conversion, tx decode, profile)
- Hashing (SHA256, Keccak256, Hash160)
- Storage (KV, Paste, DB, Memory)

**stx402.com:**
- AI Services (jokes, summarize, translate, TTS, image generation)
- Stacks Blockchain (address conversion, tx decode, contract info)
- Cryptography (SHA256, HMAC, etc.)
- Storage (KV, SQL, Paste)
- Utilities (QR codes, signature verification)
- Registry, Links, Counters, Job Queue, Memory
- Agent Registry & Reputation

---

## Agent Skill

This package includes an Agent Skills-compatible skill at `skill/SKILL.md`. The skill provides:
- Structured workflows for Bitcoin L1 operations
- Reference guides for Pillar smart wallets and Stacks L2 DeFi
- LLM-agnostic instructions following the [agentskills.io](https://agentskills.io) spec

When implementing Bitcoin wallet features, consult the skill for standardized patterns and workflows.

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
