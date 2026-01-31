# Bitcoin L1 Transaction Capabilities

Add Bitcoin L1 transaction capabilities to the MCP server - ability to check BTC balance, get fee estimates, and transfer BTC from the wallet.

Status: completed
Created: 2025-01-30
Completed: 2025-01-30
Repos: aibtcdev/aibtc-mcp-server

## Goal

Enable the MCP server to perform Bitcoin L1 transactions, building on the existing Bitcoin address derivation. This includes:

- **BTC Balance**: Query balance using UTXO sum from mempool.space API
- **Fee Estimates**: Get recommended fee rates (fast/medium/slow sat/vB)
- **BTC Transfers**: Build, sign, and broadcast transactions using @scure/btc-signer

The implementation leverages:
- Existing `@scure/btc-signer` v2.0.1 library (already installed)
- Existing BIP84 native SegWit address derivation in `src/utils/bitcoin.ts`
- mempool.space public API (no API key required)

Future work includes sBTC bridging capabilities.

## Technical Context

- Wallet manager already handles encrypted mnemonics with session-based unlock
- Need to extend to derive Bitcoin private keys for transaction signing
- Support P2WPKH (native SegWit) transactions matching existing address format
- Use mempool.space API for UTXO queries and transaction broadcasting
