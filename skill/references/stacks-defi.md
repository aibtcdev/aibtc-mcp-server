# Stacks L2 DeFi

Stacks is a Bitcoin L2 with smart contracts. This reference covers STX transfers, DEX swaps, lending protocols, and x402 paid endpoints.

## STX Transfers

Transfer STX tokens to any Stacks address:

```
"Send 2 STX to ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
```

Uses `transfer_stx` - amounts in micro-STX (1 STX = 1,000,000 micro-STX).

Check STX balance:

```
"What's my STX balance?"
```

Uses `get_stx_balance`.

## ALEX DEX (Mainnet Only)

Decentralized exchange for token swaps on Stacks.

### Discover Pools

Find available trading pairs:

```
"What pools are available on ALEX?"
```

Uses `alex_list_pools` - shows all tradable token pairs.

### Get Quote

Check expected output before swapping:

```
"How much ALEX for 10 STX?"
```

Uses `alex_get_swap_quote` with token symbols (STX, ALEX, etc).

### Execute Swap

Swap tokens:

```
"Swap 0.1 STX for ALEX"
```

Uses `alex_swap` - handles routing, wrapping, and post-conditions automatically.

### ALEX Tool Reference

| Tool | Description |
|------|-------------|
| `alex_list_pools` | List all trading pools |
| `alex_get_swap_quote` | Get expected output |
| `alex_swap` | Execute token swap |
| `alex_get_pool_info` | Get pool reserves |

## Zest Protocol (Mainnet Only)

Lending and borrowing protocol for earning yield on assets.

### Supported Assets

| Symbol | Description |
|--------|-------------|
| sBTC | Synthetic Bitcoin |
| aeUSDC | Bridged USDC |
| stSTX | Staked STX |
| wSTX | Wrapped STX |
| USDH | Stablecoin |
| USDA | Arkadiko stablecoin |
| ALEX | ALEX token |

### Check Position

View your lending position:

```
"What's my Zest position for stSTX?"
```

Uses `zest_get_position` with asset symbol.

### Supply Assets

Deposit to earn interest:

```
"Supply 1000 stSTX to Zest"
```

Uses `zest_supply` - amounts in smallest units (check decimals per asset).

### Borrow Assets

Borrow against collateral:

```
"Borrow 100 aeUSDC from Zest"
```

Uses `zest_borrow` - ensure sufficient collateral first.

### Repay Loan

Repay borrowed assets:

```
"Repay 50 aeUSDC on Zest"
```

Uses `zest_repay`.

### Withdraw Assets

Withdraw supplied assets:

```
"Withdraw 500 stSTX from Zest"
```

Uses `zest_withdraw`.

### Zest Tool Reference

| Tool | Description |
|------|-------------|
| `zest_list_assets` | List supported assets |
| `zest_get_position` | Check supply/borrow |
| `zest_supply` | Deposit assets |
| `zest_withdraw` | Withdraw assets |
| `zest_borrow` | Borrow assets |
| `zest_repay` | Repay loan |

## x402 Paid Endpoints

Access paid APIs with automatic micropayments.

### Discover Endpoints

Find available paid APIs:

```
"What x402 endpoints are available?"
"Show AI endpoints on stx402.com"
```

Uses `list_x402_endpoints` with optional source and category filters.

### Execute Endpoint

Call a paid endpoint:

```
"Tell me a dad joke"
"Get trending pools data"
```

Uses `execute_x402_endpoint` - payment handled automatically.

### API Sources

| Source | URL | Categories |
|--------|-----|------------|
| x402.biwas.xyz | https://x402.biwas.xyz | DeFi, market data, wallet analysis |
| stx402.com | https://stx402.com | AI, crypto, storage, utilities |

### x402 Tool Reference

| Tool | Description |
|------|-------------|
| `list_x402_endpoints` | Discover available APIs |
| `execute_x402_endpoint` | Call paid endpoint |

## Smart Contract Calls

Call any Stacks smart contract:

```
"Call get-balance on token contract"
```

Uses `call_contract` for write operations, `call_read_only_function` for read-only.

### Contract Tool Reference

| Tool | Description |
|------|-------------|
| `call_contract` | Call contract function (signs tx) |
| `call_read_only_function` | Read-only call (no signing) |
| `deploy_contract` | Deploy Clarity contract |
| `get_contract_info` | Get contract ABI |
| `get_transaction_status` | Check tx status |

## More Information

- [Stacks Docs](https://docs.stacks.co)
- [ALEX DEX](https://alexgo.io)
- [Zest Protocol](https://zestprotocol.com)
- [CLAUDE.md DeFi Sections](../../CLAUDE.md#defi---alex-dex-mainnet-only)

---

*Back to: [SKILL.md](../SKILL.md)*
