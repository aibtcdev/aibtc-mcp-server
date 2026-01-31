# Pillar Smart Wallet

Pillar is a passkey-secured sBTC smart wallet with built-in DeFi integration. No seed phrases - just your device's biometric or PIN.

## How It Works

Pillar uses WebAuthn passkeys for signing, which means all transactions open a browser window for authentication. The MCP server:

1. Creates an operation intent
2. Opens Pillar in your browser
3. You sign with your passkey
4. MCP polls for completion

## Connection

Connect to your existing Pillar wallet:

```
"Connect my Pillar wallet"
```

Uses `pillar_connect` - opens browser, auto-connects if logged in, returns your wallet address.

Check connection status:

```
"Am I connected to Pillar?"
```

Uses `pillar_status` - shows wallet address if connected.

## Sending sBTC

Send to BNS names, Pillar wallet names, or Stacks addresses:

```
"Send 10000 sats to muneeb.btc"
"Send 50000 sats to my-friend wallet on Pillar"
"Send 25000 sats to SP2..."
```

Uses `pillar_send` with recipient types:
- `bns` - BNS names (alice.btc)
- `wallet` - Pillar wallet names
- `address` - Raw Stacks addresses (SP...)

## Funding Your Wallet

Three funding methods available:

### From Exchange (Coinbase, Binance, etc.)

```
"Fund my Pillar wallet from an exchange"
```

Uses `pillar_fund` with `method: "exchange"` - generates a deposit address.

### From Leather/Xverse (BTC)

```
"Deposit BTC from my Leather wallet"
```

Uses `pillar_fund` with `method: "btc"` - auto-converts BTC to sBTC.

### From Leather/Xverse (sBTC)

```
"Transfer sBTC from my Xverse wallet"
```

Uses `pillar_fund` with `method: "sbtc"` - direct sBTC transfer.

## Yield with Zest Protocol

### Supply sBTC

Deposit sBTC to earn yield:

```
"Supply my sBTC to Zest"
```

Uses `pillar_supply` - deposits to Zest Protocol lending pool.

### Boost Position

Create leveraged exposure (up to 1.5x):

```
"Boost my sBTC position"
"Boost 100000 sats"
```

Uses `pillar_boost` - supplies sBTC, borrows against it, re-supplies. Large amounts (>100k sats) automatically use DCA mode.

### Check Position

View your current position:

```
"What's my Pillar position?"
```

Uses `pillar_position` - shows balance, collateral, borrowed amount, LTV, liquidation price.

### Unwind Position

Close or reduce your leverage:

```
"Unwind 50% of my position"
```

Uses `pillar_unwind` - repays borrowed sBTC and withdraws collateral.

## Tool Reference

| Tool | Description | Browser |
|------|-------------|---------|
| `pillar_connect` | Connect to wallet | Yes |
| `pillar_disconnect` | Clear local session | No |
| `pillar_status` | Check connection | No |
| `pillar_send` | Send sBTC | Yes |
| `pillar_fund` | Fund wallet | Yes |
| `pillar_supply` | Supply to Zest | Yes |
| `pillar_boost` | Leverage position | Yes |
| `pillar_unwind` | Close position | Yes |
| `pillar_position` | View position | Yes |
| `pillar_create_wallet` | Create new wallet | Yes |
| `pillar_add_admin` | Add backup admin | Yes |
| `pillar_invite` | Get referral link | No |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PILLAR_API_URL` | API base URL (default: https://pillarbtc.com) |
| `PILLAR_API_KEY` | Bearer token for auth |

## More Information

- [Pillar Website](https://pillarbtc.com)
- [Twitter @pillar_btc](https://x.com/pillar_btc)
- [CLAUDE.md Pillar Section](../../CLAUDE.md#pillar-smart-wallet)

---

*Back to: [SKILL.md](../SKILL.md)*
