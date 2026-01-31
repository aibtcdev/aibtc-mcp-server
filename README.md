# @aibtc/mcp-server

[![npm version](https://img.shields.io/npm/v/@aibtc/mcp-server.svg)](https://www.npmjs.com/package/@aibtc/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that gives Claude its own Stacks wallet to interact with the blockchain and x402 paid API endpoints.

## Features

- **Agent's Own Wallet** - Claude gets its own wallet to perform blockchain transactions
- **Secure Storage** - Wallets encrypted with AES-256-GCM and stored locally
- **50+ Tools** - Comprehensive Stacks blockchain operations
- **sBTC Support** - Native Bitcoin on Stacks operations
- **Token Operations** - SIP-010 fungible token transfers and queries
- **NFT Support** - SIP-009 NFT holdings, transfers, and metadata
- **DeFi Trading** - ALEX DEX swaps and Zest Protocol lending/borrowing
- **Stacking/PoX** - Stacking status and delegation
- **BNS Domains** - .btc domain lookups and management (V1 + V2)
- **x402 Payments** - Automatic payment handling for paid APIs

## Quick Start

### One-Command Install

```bash
npx @aibtc/mcp-server@latest --install
```

That's it! This automatically configures Claude Code. Restart your terminal and start chatting.

**For testnet:**
```bash
npx @aibtc/mcp-server@latest --install --testnet
```

> **Why npx?** Using `npx @aibtc/mcp-server@latest` ensures you always get the newest version automatically. Global installs (`npm install -g`) won't auto-update.

## Giving Claude a Wallet

When you first use @aibtc/mcp-server, Claude doesn't have a wallet. Here's the smooth onboarding flow:

### Example Conversation

```
You: What's your wallet address?

Claude: I don't have a wallet yet. Would you like to assign me one?
        I can either create a fresh wallet or you can import an existing one.

You: Create a new wallet called "agent-wallet"

Claude: What password should I use to protect the wallet?

You: use "secure123password"

Claude: I now have a wallet! My address is ST1ABC...XYZ

        IMPORTANT: Please save this recovery phrase securely:
        "word1 word2 word3 ... word24"

        This phrase will NOT be shown again. It's the only way to recover
        the wallet if the password is forgotten.

You: Send 10 STX to ST2DEF...

Claude: Done! I've sent 10 STX to ST2DEF...
        Transaction: 0x123...
```

### Wallet States

| State | What Claude Says | What To Do |
|-------|-----------------|------------|
| No wallet | "I don't have a wallet yet" | Use `wallet_create` or `wallet_import` |
| Locked | "My wallet is locked" | Use `wallet_unlock` with password |
| Ready | "My address is ST..." | Claude can perform transactions |

### Session Management

- By default, the wallet auto-locks after 15 minutes
- You can change this with `wallet_set_timeout` (set to 0 to disable)
- Use `wallet_lock` to manually lock the wallet
- Use `wallet_unlock` when you need Claude to transact again

## Wallet Storage

Claude's wallets are stored locally on your machine:

```
~/.aibtc/
├── wallets.json       # Wallet index (names, addresses - no secrets)
├── config.json        # Active wallet, settings
└── wallets/
    └── [wallet-id]/
        └── keystore.json  # Encrypted mnemonic (AES-256-GCM + Scrypt)
```

**Security:**
- AES-256-GCM encryption with Scrypt key derivation
- Password required to unlock
- Mnemonics never stored in plaintext
- File permissions set to owner-only (0600)

## Bitcoin Address Derivation

Each wallet automatically derives both a **Stacks address** and a **Bitcoin address** from the same mnemonic using BIP39/BIP32 standards.

**Derivation Paths (BIP84):**
- Mainnet: `m/84'/0'/0'/0/0` (Bitcoin coin type 0)
- Testnet: `m/84'/1'/0'/0/0` (Bitcoin testnet coin type 1)

**Address Format:**
- Mainnet: `bc1q...` (Native SegWit P2WPKH)
- Testnet: `tb1q...` (Native SegWit P2WPKH)

**Current Support:**
- Read-only Bitcoin address derivation
- Same mnemonic produces both Stacks and Bitcoin addresses
- Bitcoin address included in wallet status and info
- No Bitcoin signing or transaction support (yet)

**Example:**
```
You: Create a wallet called "my-wallet"
Claude: I've created a wallet with:
        Stacks address: ST1ABC...
        Bitcoin address: bc1q...
```

Both addresses are derived from the same recovery phrase, making it easy to manage both Layer 1 (Bitcoin) and Layer 2 (Stacks) assets.

## Available Tools (50+ total)

### Wallet Management
| Tool | Description |
|------|-------------|
| `wallet_create` | Create a new wallet for Claude |
| `wallet_import` | Import an existing wallet for Claude |
| `wallet_unlock` | Unlock Claude's wallet |
| `wallet_lock` | Lock Claude's wallet |
| `wallet_list` | List Claude's available wallets |
| `wallet_switch` | Switch Claude to a different wallet |
| `wallet_delete` | Delete a wallet |
| `wallet_export` | Export wallet mnemonic |
| `wallet_status` | Check if Claude's wallet is ready (includes Stacks and Bitcoin addresses) |
| `wallet_set_timeout` | Set how long wallet stays unlocked |

### Wallet & Balance
| Tool | Description |
|------|-------------|
| `get_wallet_info` | Get Claude's wallet addresses (Stacks + Bitcoin) and status |
| `get_stx_balance` | Get STX balance for any address |

### STX Transfers
| Tool | Description |
|------|-------------|
| `transfer_stx` | Send STX to a recipient |
| `broadcast_transaction` | Broadcast a pre-signed transaction |

### sBTC Operations
| Tool | Description |
|------|-------------|
| `sbtc_get_balance` | Get sBTC balance |
| `sbtc_transfer` | Send sBTC |
| `sbtc_get_deposit_info` | Get BTC deposit instructions |
| `sbtc_get_peg_info` | Get peg ratio and TVL |

### Token Operations (SIP-010)
| Tool | Description |
|------|-------------|
| `get_token_balance` | Get balance of any SIP-010 token |
| `transfer_token` | Send any SIP-010 token |
| `get_token_info` | Get token metadata |
| `list_user_tokens` | List tokens owned by an address |
| `get_token_holders` | Get top holders of a token |

### NFT Operations (SIP-009)
| Tool | Description |
|------|-------------|
| `get_nft_holdings` | List NFTs owned by an address |
| `get_nft_metadata` | Get NFT metadata |
| `transfer_nft` | Send an NFT |
| `get_nft_owner` | Get NFT owner |
| `get_collection_info` | Get NFT collection details |
| `get_nft_history` | Get NFT transfer history |

### Stacking / PoX
| Tool | Description |
|------|-------------|
| `get_pox_info` | Get current PoX cycle info |
| `get_stacking_status` | Check stacking status |
| `stack_stx` | Lock STX for stacking |
| `extend_stacking` | Extend stacking period |

### BNS Domains (V1 + V2)
| Tool | Description |
|------|-------------|
| `lookup_bns_name` | Resolve .btc domain to address |
| `reverse_bns_lookup` | Get .btc domain for an address |
| `get_bns_info` | Get domain details |
| `check_bns_availability` | Check if domain is available |
| `get_bns_price` | Get registration price |
| `list_user_domains` | List domains owned |

### Smart Contracts
| Tool | Description |
|------|-------------|
| `call_contract` | Call a smart contract function |
| `deploy_contract` | Deploy a Clarity smart contract |
| `get_transaction_status` | Check transaction status |
| `call_read_only_function` | Call read-only function |

### DeFi - ALEX DEX (Mainnet)

Uses the official `alex-sdk` for swap operations. Supports simple token symbols like "STX", "ALEX".

| Tool | Description |
|------|-------------|
| `alex_list_pools` | Discover all available trading pools |
| `alex_get_swap_quote` | Get expected output for a token swap |
| `alex_swap` | Execute a token swap (SDK handles routing) |
| `alex_get_pool_info` | Get liquidity pool reserves |

### DeFi - Zest Protocol (Mainnet)

Supports 10 assets: sBTC, aeUSDC, stSTX, wSTX, USDH, sUSDT, USDA, DIKO, ALEX, stSTX-BTC

| Tool | Description |
|------|-------------|
| `zest_list_assets` | List all supported lending assets |
| `zest_get_position` | Get user's supply/borrow position |
| `zest_supply` | Supply assets to earn interest |
| `zest_withdraw` | Withdraw supplied assets |
| `zest_borrow` | Borrow against collateral |
| `zest_repay` | Repay borrowed assets |

### Blockchain Queries
| Tool | Description |
|------|-------------|
| `get_account_info` | Get account nonce, balance |
| `get_account_transactions` | List transaction history |
| `get_block_info` | Get block details |
| `get_mempool_info` | Get pending transactions |
| `get_contract_info` | Get contract ABI and source |
| `get_contract_events` | Get contract event history |
| `get_network_status` | Get network health status |

### x402 API Endpoints
| Tool | Description |
|------|-------------|
| `list_x402_endpoints` | Discover x402 endpoints |
| `execute_x402_endpoint` | Execute x402 endpoint with auto-payment |

## Usage Examples

**Wallet management:**
> "What's your wallet address?"
> "Create a wallet for yourself"
> "Unlock your wallet"
> "Keep your wallet unlocked for 1 hour"

**Check balances:**
> "How much STX do you have?"
> "What's your sBTC balance?"

**Transfer tokens:**
> "Send 2 STX to ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
> "Transfer 0.001 sBTC to muneeb.btc"

**NFTs:**
> "What NFTs do you own?"
> "Send this NFT to alice.btc"

**BNS domains:**
> "What address is satoshi.btc?"
> "Is myname.btc available?"

**DeFi trading (mainnet):**
> "What pools are available on ALEX?"
> "Swap 0.1 STX for ALEX"
> "Get a quote for 100 STX to ALEX"
> "What assets can I lend on Zest?"
> "Supply 100 stSTX to Zest"
> "Borrow 50 aeUSDC from Zest"
> "Check my Zest position"

**x402 endpoints:**
> "Get trending liquidity pools"
> "Tell me a dad joke"

## Supported Tokens

Well-known tokens can be referenced by symbol:
- **sBTC** - Native Bitcoin on Stacks
- **USDCx** - USD Coin on Stacks
- **ALEX** - ALEX governance token
- **wSTX** - Wrapped STX

**ALEX DEX tokens:** STX, ALEX, and any token from `alex_list_pools`

**Zest Protocol assets:** sBTC, aeUSDC, stSTX, wSTX, USDH, sUSDT, USDA, DIKO, ALEX, stSTX-BTC

Or use any SIP-010 token by contract ID: `SP2X...::token-name`

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `NETWORK` | `mainnet` or `testnet` | `mainnet` |
| `API_URL` | Default x402 API base URL | `https://x402.biwas.xyz` |
| `CLIENT_MNEMONIC` | (Optional) Pre-configured mnemonic | - |

**Note:** `CLIENT_MNEMONIC` is optional. The recommended approach is to let Claude create its own wallet.

## Architecture

```
You ←→ Claude ←→ aibtc-mcp-server
                        ↓
              Claude's Wallet (~/.aibtc/)
                        ↓
              ┌─────────┴─────────┐
              ↓                   ↓
        Hiro Stacks API    x402 Endpoints
              ↓                   ↓
        Stacks Blockchain  Paid API Services
```

## Security Notes

- Claude's wallet is stored encrypted on YOUR machine
- Password is never stored - only the encrypted keystore
- Mnemonics shown only once at creation
- Auto-lock after 15 minutes (configurable)
- Transactions signed locally before broadcast
- For mainnet: Fund with small amounts first

## Advanced: Pre-configured Mnemonic

For automated setups where Claude needs immediate wallet access, set the `CLIENT_MNEMONIC` environment variable in your `~/.claude.json`:

```json
{
  "mcpServers": {
    "aibtc": {
      "command": "npx",
      "args": ["@aibtc/mcp-server@latest"],
      "env": {
        "CLIENT_MNEMONIC": "your twenty four word mnemonic phrase",
        "NETWORK": "testnet"
      }
    }
  }
}
```

This bypasses the wallet creation flow - Claude has immediate access to transact.

## Agent Skill

This package includes an [Agent Skills](https://agentskills.io) compatible skill that teaches any LLM how to use the Bitcoin wallet capabilities effectively.

### What is it?

The `aibtc-bitcoin-wallet` skill provides:
- Structured workflows for Bitcoin L1 operations (balance, send, fees)
- Reference guides for Pillar smart wallets and Stacks L2 DeFi
- LLM-agnostic instructions that work with Claude Code, Cursor, Codex, and 20+ other tools

### Using the Skill

The skill is automatically included when you install the MCP server. Find it at:
- **Local**: `node_modules/@aibtc/mcp-server/skill/SKILL.md`
- **ClawHub**: [clawhub.ai/skills](https://www.clawhub.ai/skills) - search for `aibtc-bitcoin-wallet`

### Skill Structure

```
skill/
├── SKILL.md                    # Bitcoin L1 core workflows
└── references/
    ├── pillar-wallet.md        # Pillar smart wallet guide
    ├── stacks-defi.md          # Stacks L2 / DeFi operations
    └── troubleshooting.md      # Common issues and solutions
```

## Development

```bash
git clone https://github.com/aibtcdev/aibtc-mcp-server.git
cd aibtc-mcp-server
npm install
npm run build
npm run dev       # Run with tsx (development)
```

### Repository Secrets (Maintainers)

The following secrets are required for the release workflow:

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm publish token for @aibtc scope |
| `CLAWHUB_API_TOKEN` | ClawHub API token for skill publishing |

To obtain a ClawHub API token, visit [clawhub.ai](https://www.clawhub.ai) and create an account.

## License

MIT
