# Manual Testnet Integration Test Procedure

This document describes how to manually test the `transfer_btc` tool on Bitcoin testnet.

## Prerequisites

1. **MCP Server Running**
   ```bash
   npm run build
   npm run dev   # or npx ts-node src/index.ts
   ```

2. **Testnet Configuration**
   Ensure `NETWORK=testnet` in your `.env` file or environment.

3. **Testnet Bitcoin Faucet**
   Get testnet BTC from a faucet:
   - https://coinfaucet.eu/en/btc-testnet/
   - https://bitcoinfaucet.uo1.net/
   - https://testnet-faucet.mempool.co/

## Test Procedure

### Step 1: Create and Unlock Wallet

```
User: Create a new testnet wallet called "btc-test"
Claude: [calls wallet_create with name="btc-test", password="...", network="testnet"]

User: Unlock the wallet
Claude: [calls wallet_unlock with password="..."]
```

Verify:
- Wallet is created with `tb1...` Bitcoin address
- Session shows btcAddress in wallet_status

### Step 2: Fund the Wallet

1. Copy the `btcAddress` from wallet_status
2. Send testnet BTC from faucet to this address
3. Wait for confirmation (or test with unconfirmed UTXOs)

```
User: What's my BTC balance?
Claude: [calls get_btc_balance]
```

Verify:
- Balance shows the deposited amount
- UTXOs are visible

### Step 3: Check Fee Estimates

```
User: What are the current BTC fees?
Claude: [calls get_btc_fees]
```

Verify:
- Returns fast/medium/slow fee tiers in sat/vB

### Step 4: Transfer BTC (Medium Fee)

```
User: Send 10000 sats to tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx with medium fees
Claude: [calls transfer_btc with recipient, amount=10000, feeRate="medium"]
```

Verify:
- Transaction is broadcast successfully
- Returns txid and explorerUrl
- Check transaction on mempool.space/testnet

### Step 5: Transfer BTC (Custom Fee)

```
User: Send 5000 sats to tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx with 2 sat/vB fee
Claude: [calls transfer_btc with recipient, amount=5000, feeRate=2]
```

Verify:
- Transaction uses custom 2 sat/vB fee rate
- Fee calculation matches expected vsize * feeRate

### Step 6: Error Handling Tests

**Insufficient Funds:**
```
User: Send 1000000000 sats (more than balance)
Claude: [should return error about insufficient funds]
```

**Locked Wallet:**
```
User: Lock the wallet
Claude: [calls wallet_lock]

User: Send 1000 sats
Claude: [should return error about wallet not being unlocked]
```

**Invalid Address:**
```
User: Send 1000 sats to invalid-address
Claude: [should return error about invalid address format]
```

## Expected Results

| Test | Expected Outcome |
|------|------------------|
| Create wallet | tb1... address generated |
| Check balance | Returns UTXO sum |
| Get fees | Returns fast/medium/slow tiers |
| Transfer (medium) | Broadcast success, returns txid |
| Transfer (custom) | Uses custom fee rate |
| Insufficient funds | Error message |
| Locked wallet | Error: unlock required |
| Invalid address | Error: invalid address |

## Verification on Block Explorer

After each transfer:
1. Open the `explorerUrl` returned by the tool
2. Verify transaction details:
   - Correct recipient address
   - Correct amount
   - Reasonable fee
   - Change output to sender address (if any)

## Notes

- Testnet transactions may take longer to confirm
- Use confirmed UTXOs for reliable testing
- The dust threshold is 546 sats - amounts below this will fail
- Change outputs below dust threshold are donated to miners
