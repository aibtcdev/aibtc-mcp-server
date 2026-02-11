---
name: aibtc-bitcoin-wallet
description: Bitcoin L1 wallet for agents - check balances, send BTC, manage UTXOs. Extends to Stacks L2 (STX, DeFi) and Pillar smart wallets (sBTC yield).
license: MIT
metadata:
  author: aibtcdev
  version: 1.14.2
  npm: "@aibtc/mcp-server"
  github: https://github.com/aibtcdev/aibtc-mcp-server
---

# AIBTC Bitcoin Wallet

A skill for managing Bitcoin L1 wallets with optional Pillar smart wallet and Stacks L2 DeFi capabilities.

## Install

One-command installation:

```bash
npx @aibtc/mcp-server@latest --install
```

For testnet:

```bash
npx @aibtc/mcp-server@latest --install --testnet
```

## Quick Start

### Check Balance

Get your Bitcoin balance:

```
"What's my BTC balance?"
```

Uses `get_btc_balance` - returns total, confirmed, and unconfirmed balances.

### Check Fees

Get current network fee estimates:

```
"What are the current Bitcoin fees?"
```

Uses `get_btc_fees` - returns fast (~10 min), medium (~30 min), and slow (~1 hr) rates in sat/vB.

### Send BTC

Transfer Bitcoin to an address:

```
"Send 50000 sats to bc1q..."
"Transfer 0.001 BTC with fast fees to bc1q..."
```

Uses `transfer_btc` - requires an unlocked wallet.

## Wallet Setup

Before sending transactions, set up a wallet:

1. **Create new wallet**: `wallet_create` - generates encrypted BIP39 mnemonic
2. **Import existing**: `wallet_import` - import from mnemonic phrase
3. **Unlock for use**: `wallet_unlock` - required before transactions

Wallets are stored encrypted at `~/.aibtc/`.

## Tool Reference

### Read Operations

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_btc_balance` | Get BTC balance | `address` (optional; requires unlocked wallet if omitted) |
| `get_btc_fees` | Get fee estimates | None |
| `get_btc_utxos` | List UTXOs | `address` (optional; requires unlocked wallet if omitted), `confirmedOnly` |

### Write Operations (Wallet Required)

| Tool | Description | Parameters |
|------|-------------|------------|
| `transfer_btc` | Send BTC | `recipient`, `amount` (sats), `feeRate` |

### Wallet Management

| Tool | Description |
|------|-------------|
| `wallet_create` | Generate new encrypted wallet |
| `wallet_import` | Import wallet from mnemonic |
| `wallet_unlock` | Unlock wallet for transactions |
| `wallet_lock` | Lock wallet (clear from memory) |
| `wallet_list` | List available wallets |
| `wallet_switch` | Switch active wallet |
| `wallet_status` | Get wallet/session status |

## Units and Addresses

**Amounts**: Always in satoshis (1 BTC = 100,000,000 satoshis)

**Addresses**:
- Mainnet: `bc1...` (native SegWit)
- Testnet: `tb1...`

**Fee Rates**: `"fast"`, `"medium"`, `"slow"`, or custom sat/vB number

## Example Workflows

### Daily Balance Check

```
1. "What's my BTC balance?"
2. "Show my recent UTXOs"
3. "What are current fees?"
```

### Send Payment

```
1. "Unlock my wallet" (provide password)
2. "Send 100000 sats to bc1qxyz... with medium fees"
3. "Lock my wallet"
```

### Multi-Wallet Management

```
1. "List my wallets"
2. "Switch to trading wallet"
3. "Unlock it"
4. "Check balance"
```

## Progressive Layers

This skill focuses on Bitcoin L1. Additional capabilities are organized by layer:

### Stacks L2 (Layer 2)

Bitcoin L2 with smart contracts and DeFi:
- STX token transfers
- ALEX DEX token swaps
- Zest Protocol lending/borrowing
- x402 paid API endpoints (AI, storage, utilities)

See: [references/stacks-defi.md](references/stacks-defi.md)

### Pillar Smart Wallet (Layer 3)

sBTC smart wallet with yield automation:
- Passkey or agent-signed transactions
- Send to BNS names (alice.btc)
- Auto-boost yield via Zest Protocol

See: [references/pillar-wallet.md](references/pillar-wallet.md)

### Bitcoin Inscriptions

Inscribe and retrieve digital artifacts on Bitcoin:
- Commit-reveal inscription workflow
- Get inscription content and metadata
- Protect ordinal UTXOs from accidental spending

See: [references/inscription-workflow.md](references/inscription-workflow.md)

### Genesis Lifecycle

Agent identity and reputation on Bitcoin and Stacks:
- L0: Local agent key generation
- L1: Dual-chain plain-message signatures (btc_sign_message + stacks_sign_message)
- L2: X claim + BTC airdrop activation
- Active: 5-minute check-ins to maintain reputation and liveness

See: [references/genesis-lifecycle.md](references/genesis-lifecycle.md)

## Troubleshooting

### "Wallet not unlocked"

Run `wallet_unlock` with your password before sending transactions.

### "Insufficient balance"

Check `get_btc_balance` - you need enough BTC for amount + fees.

### "Invalid address"

Ensure address matches network:
- Mainnet: starts with `bc1`
- Testnet: starts with `tb1`

See: [references/troubleshooting.md](references/troubleshooting.md)

## More Information

- [CLAUDE.md](../CLAUDE.md) - Full tool documentation
- [GitHub](https://github.com/aibtcdev/aibtc-mcp-server) - Source code
- [npm](https://www.npmjs.com/package/@aibtc/mcp-server) - Package

---

*This skill follows the [Agent Skills](https://agentskills.io) open specification.*
