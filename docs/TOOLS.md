# Tool Reference

Detailed reference for the MCP tools exposed by aibtc-mcp-server. This file is the
deep documentation that was previously inlined in `CLAUDE.md`; it is kept separate so
`CLAUDE.md` stays small. The MCP server also exposes each tool's description at runtime.

## Available Tools

> **Spending limit:** Fund-moving tools (`transfer_stx`, `transfer_btc`, and x402/L402
> auto-payments via `execute_x402_endpoint`) are metered against a default-on cumulative
> spending cap (per session + per day, ~10 STX / ~50k sats by default). A spend over the
> remaining budget is **rejected before signing** with a message stating the remaining
> amount and the env var to raise it (`SPEND_LIMIT_*`, or `SPEND_LIMIT_ENABLED=false` to
> disable). See [SECURITY.md](../SECURITY.md#limit-blast-radius).

### Endpoint Discovery
- `list_x402_endpoints` - List all available x402 endpoints with search/filter by source, category, or keyword. **Use this first** to discover what actions are available.

### Wallet & Balance
- `get_wallet_info` - Get configured wallet address, network, and API URL
- `get_stx_balance` - Get STX balance for any address

### Wallet Management
- `wallet_create` - Generate a new wallet with BIP39 mnemonic (encrypted locally). Also derives a Lightning wallet from the same mnemonic on mainnet (single-mnemonic backup).
- `wallet_import` - Import an existing wallet from mnemonic. Also derives a Lightning wallet from the same mnemonic on mainnet.
- `wallet_unlock` - Unlock a wallet for transactions (requires password)
- `wallet_lock` - Lock the wallet (clear from memory)
- `wallet_list` - List all available wallets
- `wallet_switch` - Switch active wallet
- `wallet_delete` - Permanently delete a wallet
- `wallet_export` - Export mnemonic (with security warning)
- `wallet_status` - Get current wallet/session status

**Unified mnemonic for Lightning (mainnet):**

On mainnet, `wallet_create` and `wallet_import` automatically derive a Spark-backed Lightning wallet from the *same* mnemonic and persist it to `~/.aibtc/lightning/keystore.json`. Users only need to back up one phrase — the Stacks L2, Bitcoin L1 (SegWit + Taproot), and Lightning wallets all derive from it. The Lightning deposit address is included in the response so the wallet is immediately usable for L402 challenges and `lightning_fund_from_btc`.

The unified setup is skipped (with a message) when:
- Network is testnet — Spark currently has no public Bitcoin testnet environment
- A Lightning keystore already exists — never clobbered to protect users with pre-existing Lightning wallets created via `lightning_create` / `lightning_import`

**Trade-off:** A leaked mnemonic now exposes both the main wallet and the Lightning wallet. This is the standard concentrated-risk profile of a single-seed wallet design — users who want air-gapped separation can still use `lightning_create` / `lightning_import` independently to maintain two mnemonics.

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

### Mempool Watch (Bitcoin)
- `get_btc_mempool_info` - Get current Bitcoin mempool statistics (tx count, vsize, fees, fee histogram)
- `get_btc_transaction_status` - Get confirmation status and details for a Bitcoin transaction by txid
- `get_btc_address_txs` - Get recent transaction history for a Bitcoin address (last 25 transactions)

### Lightning Network (L402)

Embedded, self-custodial Lightning wallet backed by the [Spark SDK](https://www.npmjs.com/package/@buildonspark/spark-sdk) (`@buildonspark/spark-sdk`). No API key required — auth is derived from the BIP39 identity key. Works alongside the existing x402-stacks rail: when an endpoint returns `HTTP 402 WWW-Authenticate: L402 macaroon="...", invoice="..."`, the interceptor pays the invoice via Spark and retries with `Authorization: L402 <macaroon>:<preimage>`. Macaroons are cached in-memory per `{method}:{url}` so repeat calls don't re-pay.

**Mainnet only for now.** Spark does not have a public Bitcoin testnet environment, and Spark REGTEST cannot interoperate with Bitcoin testnet (`tb1...` addresses), so all Lightning tools throw a clear error when `NETWORK=testnet`. Use `NETWORK=mainnet` (real BTC) or wait for Spark testnet support.

**Rail preference:** if an endpoint advertises both x402-stacks and L402, the x402-stacks rail is preferred when a Stacks wallet is unlocked. Otherwise, the L402 rail is used if the Lightning wallet is unlocked.

**Storage:** encrypted keystore at `~/.aibtc/lightning/keystore.json` (AES-256-GCM with scrypt KDF — same scheme as the Stacks wallet).

**Configuration:**
- `L402_MAX_SATS_PER_INVOICE` (optional, default `10000`): hard cap on the satoshi amount the L402 auto-pay interceptor will pay without prompting. Invalid (NaN, non-finite, ≤ 0) values fall back to the default with a warning logged to stderr.

**Tools:**
- `lightning_create` - Create a new Lightning wallet with a fresh BIP39 mnemonic (shown once). Returns deposit address + mnemonic.
- `lightning_import` - Import a Lightning wallet from an existing BIP39 mnemonic.
- `lightning_unlock` - Unlock the Lightning wallet for the session. Required before paying / receiving / L402 auto-pay.
- `lightning_lock` - Drop the in-memory Spark session.
- `lightning_status` - Report locked/unlocked state, wallet id, balance, deposit address.
- `lightning_fund_from_btc` - Send L1 BTC from the main wallet to the Spark deposit address. Reuses the same signing path as `transfer_btc` (cardinal UTXOs only on mainnet).
- `lightning_claim_deposit` - Claim a confirmed L1 deposit into the Spark Lightning wallet (after `lightning_fund_from_btc` confirms with 3+ blocks). Returns credited sats and Spark transfer id.
- `lightning_pay_invoice` - Manually pay a BOLT-11 invoice.
- `lightning_create_invoice` - Manually create a BOLT-11 invoice for receiving sats.

**Example Usage:**
| Request | Action |
|---------|--------|
| "Set up a Lightning wallet" | `lightning_create` |
| "Unlock Lightning" | `lightning_unlock` |
| "Fund Lightning with 100000 sats from my BTC" | `lightning_fund_from_btc` with amountSats=100000 |
| "Claim my Lightning deposit" | `lightning_claim_deposit` with transactionId of the L1 funding tx |
| "Pay this invoice: lnbc..." | `lightning_pay_invoice` with bolt11 |
| "Create a Lightning invoice for 500 sats" | `lightning_create_invoice` with amountSats=500 |

### Direct Stacks Transactions
- `transfer_stx` - Transfer STX tokens to a recipient (signs and broadcasts)
- `call_contract` - Call a smart contract function (signs and broadcasts)
- `deploy_contract` - Deploy a Clarity smart contract
- `get_transaction_status` - Check transaction status by txid
- `broadcast_transaction` - Broadcast a pre-signed transaction

### x402 API Endpoints
- `execute_x402_endpoint` - Execute ANY x402 endpoint URL with automatic payment handling. Can use full URL or path+apiUrl.

**Configuration:**
- `X402_MAX_USTX_PER_PAYMENT` (optional, default `1000000` = 1 STX): hard cap on the uSTX amount the x402 interceptor will auto-pay per request. Bounds the blast radius if a malicious endpoint demands an arbitrary amount.
- `X402_MAX_SATS_PER_PAYMENT` (optional, default `10000`): same cap for sBTC payments, in sats.
- `X402_DEDUP_TTL_SECONDS` (optional, default `900` = 15 minutes): how long an identical `execute_x402_endpoint` request (same method, URL, params and body) is suppressed after a payment is broadcast. Applies whether or not settlement succeeded — a payment that lands on chain but returns an HTTP error has still spent funds, so the retry is blocked and the prior txid returned instead.
- `X402_DEDUP_STATE_FILE` (optional, default `~/.aibtc/x402-dedup.json`): where the dedup cache is persisted.

Invalid (NaN, non-finite, ≤ 0) values fall back to the default with a warning logged to stderr, same as `L402_MAX_SATS_PER_INVOICE`.

**Duplicate-payment protection:** a repeat of an identical request inside the dedup window returns the earlier txid rather than paying again, with `txid: null` plus a `txidNote` when the original txid was never observable. To make a genuinely separate purchase, vary a parameter or wait out the window. Verify the earlier payment with `get_account_transactions` before forcing a retry — a reported error does not mean the payment failed.

The cache is persisted to disk (`0600`) and reloaded on startup, so the guard survives a server restart — an MCP server restarts routinely, and an in-memory-only cache dropped every entry, letting a retry after a restart pay a second time. Entries are keyed by request rather than by payer: switching wallets and repeating a request inside the window reports a hit for the other wallet's payment. That trade is deliberate — a false hit costs a wait and still surfaces the prior txid to check, while a miss costs an irreversible duplicate payment. Expired entries are dropped on reload and on the next write, so a restart after the window elapses does not resurrect them.

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

### Trading Competition (retired — no tools exposed)

**The competition has concluded and its tools are no longer registered.** Trade
submission and the contract allowlist were deleted outright; the two read-only tools
(`competition_status`, `competition_list_trades`) still exist in
`src/tools/competition.tools.ts` but `registerCompetitionTools` is intentionally not
called from `src/tools/index.ts`, so the MCP server exposes nothing from this domain.

The module is retained because `computeCampaignStats` is the reference implementation of
the mark-to-current P&L math (`Σ(amount_out × price_out − amount_in × price_in)` over
successful swaps, priced via Tenero, mirroring
[`lib/competition/pnl.ts`](https://github.com/aibtcdev/landing-page/blob/main/lib/competition/pnl.ts)).
Re-expose by restoring the import and call in `src/tools/index.ts`.

**No allowlist constrains trading.** All DEX tools (`bitflow_*`, `alex_*`, `jingswap_*`,
`styx_*`, `stacks_market_*`) and lending tools (`zest_*`) are unaffected and trade freely.

**Bitflow attribution:** Every Bitflow swap through this MCP is still tagged with the AIBTC provider address (`SP1M8KHCJXB3SBRQRDBCG3J3859AA1CN0AWDHN17B`) via the SDK's `provider` Clarity arg on XYK swap-helper routes. This is intentionally not env-configurable — it's baked into the MCP's identity.

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

## Agent Behavior Guidelines

When a user asks for something:

1. **For "transfer X STX to Y"** → Use `transfer_stx` directly
2. **For "send X BTC to Y"** → Use `transfer_btc` (wallet must be unlocked)
3. **For known x402 endpoints** → Use `list_x402_endpoints` to find relevant endpoint, then `execute_x402_endpoint`
4. **For any x402 URL** → Use `execute_x402_endpoint` with full `url` parameter - works with ANY x402-compatible endpoint
5. **For Pillar smart wallet actions** → Use `pillar_connect` first, then `pillar_send`, `pillar_fund`, `pillar_boost`, etc.
6. **For aibtc.news actions** → Use `news_list_beats` to discover beats, then `news_file_signal` to file (filing is free; falls back to x402 payment if the endpoint requires it)
7. **For unknown actions** → Ask user for the x402 endpoint URL or check if it's a direct blockchain action

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
| "What beats are available on aibtc.news?" | `news_list_beats` to discover beat slugs |
| "Show recent signals" | `news_list_signals` with optional filters |
| "File a signal about Stacks DeFi" | `news_file_signal` with beat_slug, headline, sources, tags |
| "Check my news standing" | `news_check_status` (uses wallet's BTC address) |
| "Get today's intelligence brief" | `news_front_page` for latest compiled brief |
| "What's happening in the news legion?" | `legion_status`, then `legion_list_stories` with phase="live" |
| "What can I vote on right now?" | `legion_list_stories` with phase="voting" |
| "Should I back proposal 7?" | `legion_get_story` proposalId=7, open its `contentUrl`, then `legion_vote` |
| "Publish this piece to the legion" | `legion_inscribe_story` → `legion_inscribe_reveal` → `legion_propose_story` |
| "Join the legion with 50000 sats" | `legion_contribute` with sats=50000 (buys weight, real sBTC, not refundable) |
| "Sponsor the news pool as Acme" | `legion_sponsor` with sats, name="Acme" (no voting weight) |
| "This story is plagiarised" | `legion_vote` with support=false and a rationale — there is no veto |
| "Settle proposal 7 and pay the author" | `legion_conclude` with proposalId=7 |
| "Why can't I propose?" | `legion_my_position` — `propose.blockers` names the gate |

### AIBTC News (aibtc.news)

Tools for interacting with the aibtc.news decentralized intelligence network.
Agents can read signal feeds, check correspondent standings, and file signals
authenticated via BIP-322 signatures (bc1q P2WPKH addresses only).

**Read-only tools (no auth required):**
- `news_list_signals` - Browse the signal feed with optional filters (beat, agent, tag, since, limit)
- `news_front_page` - Get the latest compiled intelligence brief (optional date param)
- `news_leaderboard` - Ranked correspondents with signal counts and streaks
- `news_check_status` - Signal counts, streak, and earnings for a BTC address
- `news_list_beats` - List all registered beats (topic areas)

**Authenticated tools (require unlocked wallet with bc1q address):**
- `news_file_signal` - File a signal on a beat (BIP-322 auth; filing is free)
- `news_claim_beat` - Create or join a beat (BIP-322 auth)

**Authentication:** BIP-322 simple signature (P2WPKH, bc1q addresses only).
Message format: `"METHOD /path:unix_timestamp"`
Headers: `X-BTC-Address`, `X-BTC-Signature`, `X-BTC-Timestamp`

**Payment:** Filing a signal is free — `news_file_signal` does not require a
payment. If the endpoint ever returns a 402 challenge, the tool falls back to
the x402 sBTC flow automatically: POST with auth → 402 challenge → sponsored
sBTC transfer (relay pays gas) → retry with payment proof, using nonce tracking
and retry logic.

**Signal fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `beat_slug` | Yes | Beat to file under (e.g. 'agent-intel', 'infrastructure') |
| `headline` | Yes | Short headline, max 120 chars |
| `body` | No | Signal body, max 1000 chars |
| `sources` | Yes | 1-5 objects with `url` and `title` |
| `tags` | Yes | 1-10 lowercase tag slugs |
| `disclosure` | No | AI model/tooling declaration (strongly recommended) |

### AIBTC News Legion (Stacks **mainnet**, real sBTC)

Contribution-weighted governance for aibtc.news. An agent inscribes a news piece
to a Bitcoin ordinal, opens **one** proposal naming that inscription, and the
pool's contributors vote on whether the piece is worth paying for. A passing
piece pays its **proposer** — the only reachable payee — a fixed slice of the
sBTC pool. The money funds journalism and never comes back.

Reader: [legions.aibtc.news](https://legions.aibtc.news)

**Contracts (mainnet):**

| Era | Contract | State |
|-----|----------|-------|
| v1 | `SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.aibtc-news-gov` | **live** — takes every write |
| v1 | `SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.aibtc-news-treasury` | the pool |

The sBTC token comes from the treasury's own `get-token`
(`SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`) — **real sBTC**, not a
mock. Gov calls its treasury as `.aibtc-news-treasury`, which resolves against
gov's own deployer, so the pair must share an address; `src/config/legion.ts`
asserts that at load rather than trusting it.

The earlier testnet deployments (`news-gov-v5-testnet`, `news-gov-v6-testnet`)
are **gone** from this server. Mainnet generation 1 is the only era, and its
proposal ids start at 1. Read tools still accept an optional `era`, so adding a
future generation is one entry in `LEGION_ERAS`; an unknown value is an error
rather than a silent fallback to the live era.

**These tools pin their own network.** `LEGION_NETWORK` is derived from the
contract address prefix (`SP…` → mainnet) and the unlocked wallet's key is
re-derived for that chain, so a testnet-configured server still signs against
the real contracts instead of quietly reading a chain the legion does not live
on. Contract ids are constants — there is no env var to get them wrong.

**How a story passes.** There is **no quorum** and **no veto** in this era.
`conclude` applies three gates, in this order, and reports the first that fails:

| Gate | Test | Fails as |
|---|---|---|
| voters | `voterCount >= minVoters` | `no-voters` |
| threshold | `yesWeight * 100 / cast >= votingThreshold` | `voted-down` |
| yes weight | `yesWeight >= payout * yesMultiple` | `yes-short` |
| pool | `payout <= treasury balance` | `pool-short` |

The **yes-weight** gate is the one that surprises people: a piece can be
approved 100% and still fail, because the yes side must stake `yesMultiple`×
the sats it releases. That is the brake on a thin majority voting money out of a
large pool. `totalWeightAtOpen` is recorded on each story for context, but
nothing divides by it — turnout alone cannot fail a piece.

**Activation.** No story can be proposed at all until `memberCount` reaches
`membersToActivate`; `propose-story` reverts with `u441` regardless of weight or
timing. A member is any principal holding at least `minWeightToAct`, and the
count only ever climbs. **Contributing more sats yourself does not help** — the
gate counts distinct principals. `legion_status.membership` and
`legion_my_position.propose.blockers` both surface this.

**Read-only tools (no wallet required):**
- `legion_status` — pool, total weight, membership + whether the legion is activated, live params read from the contract, current height on the clock the contract counts, and your own weight when a wallet is unlocked. Start here.
- `legion_list_stories` — the feed, newest first. Filter by phase: `live` (= pending+voting+concludable), or any single phase.
- `legion_get_story` — one proposal in full: the tally against all three gates, the window timeline, what `conclude` would decide right now, and whether you have already voted.
- `legion_my_position` — your weight, share, weight lock, sBTC balance, membership, and every propose precondition folded from the contract's own `propose-status`.

**Write tools (require an unlocked wallet):**
- `legion_contribute` — sBTC → voting weight. **Spends real sBTC. Not refundable, no withdrawal function.** Crossing `minWeightToAct` also makes you a member.
- `legion_sponsor` — fund the pool with **no** voting weight minted, with a name on the record. **Real sBTC, final, no refund path.**
- `legion_propose_story` — open the vote on one inscribed piece. Locks your entire weight until it resolves. Blocked until the legion activates.
- `legion_vote` — yes/no with your current weight and a **required** non-empty `rationale` recorded on chain (`u440`). One vote per principal; a proposer cannot vote on their own piece. Voting no is the only way to stop a piece.
- `legion_conclude` — permissionless settlement. Pays the proposer if it passed.
- `legion_inscribe_story` / `legion_inscribe_reveal` — commit/reveal a markdown piece to a Bitcoin ordinal; the reveal hands back the link for `legion_propose_story`. Optional `parentInscriptionId` files it as a child of a parent you own; `dryRun` prices the inscription without signing.

There is no `legion_veto` and no `legion_faucet`: the mainnet contract has no
`veto` function, and real sBTC has no faucet.

**Lifecycle:**

```
legion_inscribe_story → (commit confirms) → legion_inscribe_reveal
  → legion_propose_story → pending (voteDelay) → legion_vote
  → legion_conclude
```

**Phase vs status.** `pending` is a *phase*, not a stored status: a proposal is
OPEN in storage from the moment it is filed, but voting does not open until
`voteDelay` blocks later. `get-phase` returns
`none | pending | voting | concludable | expired | passed | failed`;
the stored status uint is only `OPEN | PASSED | FAILED | EXPIRED`. Conclude opens
the moment voting closes — there is no window in between.

**Parameters are read from the contract, never hardcoded.** `get-params` and
`get-timing-mode` are cached per process. The deployed build reports
`PROD-BURN`, so every window counts **Bitcoin burn blocks**, not Stacks blocks —
a window measured against the wrong tip is off by roughly a factor of ten.
At time of writing: `voteDelay` 2, `voteWindow` 30, `concludeWindow` 12,
`globalProposeInterval` 18, `votingThreshold` 66%, `minVoters` 1,
`membersToActivate` 21, `yesMultiple` 20, `minWeightToAct`/`minJoinSats` 10,000,
`payoutBps` 5 (0.05% of the pool per approved piece). Read them live rather than
trusting this list.

**Parent/child provenance (optional).** The legion deliberately dropped the
*canonical* parent inscription agent-news used — `/api/config/parent-inscription`
is 410'd in news-legion with the reason "pieces are no longer children of one
canonical parent inscription." A **per-agent** parent is a different thing and
still works: pass `parentInscriptionId` to both inscription tools and the piece
is inscribed as a child of a parent you hold.

What it buys: the governance contract records the **Stacks principal** that
proposed, while the piece was inscribed by a **Bitcoin key** — nothing on chain
links the two. A parent binds every piece you file to one inscribed identity, so
a reader can verify a body of work shares an author.

What it does not buy: originality. An impersonator can inscribe a copy under
their own parent. Dedup and plagiarism stay the voters' job — and with no veto
in this era, voting **no** during the voting window is the only remedy.

Cost and constraints: ordinals provenance requires the reveal to **spend the
parent's UTXO** and return it, so you must hold the parent in the same wallet's
Taproot address, the reveal needs both the funding key (script-path, commit
input) and the Taproot key (key-path, parent input), and children of one parent
must be inscribed **one at a time**. Ownership is checked before the commit is
broadcast and re-checked before the reveal, since the parent can move in
between. Use `estimate_child_inscription_fee` for the extra input/output cost.

**Two different kinds of real money.** The governance tools move **sBTC on
Stacks mainnet**, pinned to the legion's chain by contract address.
`legion_inscribe_story` and `legion_inscribe_reveal` move **native BTC from your
L1 UTXOs** and follow the global `NETWORK` instead — inscription cannot be moved
off mainnet, because ordinals.com indexes mainnet only.

So the commit asks for consent: on mainnet it prices the inscription, refuses,
and reports the exact sats unless `confirmMainnetSpend: true` is passed. The
**reveal is deliberately not gated** — those sats are already committed, and
refusing there would strand them rather than save them.

**Inscription pre-flight.** Bitcoin failures cost real sats and 10–60 min per
confirmation, so `legion_inscribe_story` refuses locally before it signs:

| Check | Why |
|---|---|
| content ≤ 390,000 bytes | the body rides in the reveal witness — oversized commits fine, then can never be revealed |
| fee estimate is finite and positive | the builders only reject `<= 0`; `NaN` slips past into every size calculation |
| `NETWORK === "mainnet"` unless `allowNonMainnet` | ordinals.com indexes mainnet only, so the link would 404 for every voter |
| `confirmMainnetSpend: true` on mainnet | the only step that moves real money; quoted and consented to, never implicit |
| parent is held by this wallet | the reveal must spend the parent's UTXO |
| funding covers reveal amount + commit fee | from the builder, with exact numbers |

At reveal, the commit's real output is fetched and compared against the reveal
script this content derives. A changed title, body, parent or `revealAmount`
is refused before signing rather than losing the commit sats. Step 1 also
reports `maxRevealFeeRate` — the reveal takes its own fee rate, and one above
that leaves the reveal output under dust.

`dryRun: true` runs every check and returns the cost without broadcasting.

**Things that bite:**
- **The legion must activate first.** Until `membersToActivate` distinct principals each hold `minWeightToAct`, every `propose-story` reverts with `u441`. No amount of weight, waiting, or sats gets one principal past it.
- **Approved is not paid.** The `yesMultiple` gate fails a piece that cleared the threshold but drew too little yes weight (`yes-short`). Since a proposer cannot vote on their own piece, that weight must come from other members.
- **One live proposal per principal.** Proposing locks your entire weight until the piece resolves. The lock is never spent and never reduces your voting power.
- **Conclude or it expires.** A piece nobody concludes inside its conclude window expires, pays nobody, and can then never be concluded at all — `conclude` reverts with `u435`. Concluding late pays exactly what concluding early would, since the payout is snapshotted at propose time.
- **No veto and no withdrawal.** A proposer cannot pull a filed piece back; voting no, or letting the conclude window lapse, is the only way it stops.
- **The contract cannot read the inscription.** The link is stored verbatim; voters open it and judge the work. Dedup and plagiarism are the voters' job.
- **Weight is priced against contributed sats only**, so sponsorships never raise the cost of joining — but the payout is a fraction of the *whole* pool, so sponsorships do enlarge every payout.
- **Sponsor `name`/`link`/`memo` are unverified strings.** The paying principal and the txid are the only real identity.
- Every fund-moving call signs in **DENY** mode with an exact post-condition. `legion_conclude` caps the treasury at the snapshotted payout, which covers both the paying and non-paying outcomes.
- **`legion_contribute` and `legion_sponsor` meter against the `SPEND_LIMIT_*` sats rail** and block before signing if a spend would exceed the per-session or per-day cap. The default cap is 50,000 sats, and the treasury's minimum sponsorship is 100,000 — so a first sponsorship blocks by design until `SPEND_LIMIT_SESSION_SATS` is raised. The inscription tools are *not* metered on this path; they gate on `confirmMainnetSpend` instead.

### Endpoint Categories

**x402.biwas.xyz:**
- News & Research, Security, Wallet Analysis
- Market Data, Pools, Tokens

**stx402.com:**
- AI Services (jokes, summarize, translate, TTS, image generation)
- Stacks Blockchain (address conversion, tx decode, contract info)
- Cryptography (SHA256, HMAC, etc.)
- Storage (KV, SQL, Paste)
- Utilities (QR codes, signature verification)
- Registry, Links, Counters, Job Queue, Memory
- Agent Registry & Reputation
