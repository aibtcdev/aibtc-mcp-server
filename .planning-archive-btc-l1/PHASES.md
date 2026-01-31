# Phases

## Design Decisions

### CAIP-2 Chain Identifiers
Accounts use [CAIP-2](https://chainagnostic.org/CAIPs/caip-2) format for chain-agnostic identification:

| Chain | Mainnet | Testnet |
|-------|---------|---------|
| Stacks | `stacks:1` | `stacks:2147483648` |
| Bitcoin | `bip122:000000000019d6689c085ae165831e93` | `bip122:000000000933ea01ad0ee984209779ba` |

### Account Model
Single wallet unlock enables both Stacks AND Bitcoin operations:
- Private keys stored as `Uint8Array` in session (never serialized to WIF/hex)
- Same auto-lock timeout applies to both chains
- BIP84 derivation for Bitcoin (coin_type 1 for testnet)

### Transaction Building
- Use `@scure/btc-signer` following Leather/Xverse patterns
- Change address = sender address (same identity, simpler)
- Fee selection: user picks slow/medium/fast, we fetch rates (with override option)

---

## Phase 1: Bitcoin Private Key Infrastructure
Goal: Extend existing Bitcoin address derivation to expose private keys for signing, and create a mempool.space API client for UTXO and fee data.
Status: `completed`

**Deliverables:**
- `src/config/caip.ts` - CAIP-2 chain identifiers for Stacks and Bitcoin
- `src/utils/bitcoin.ts` - Add `deriveBitcoinKeyPair()` returning private key bytes (Uint8Array)
- `src/services/wallet-manager.ts` - Derive BTC private key on unlock, store in session
- `src/services/mempool-api.ts` - API client for mempool.space (mainnet/testnet)
  - `getUtxos(address)` - GET /api/address/{address}/utxo
  - `getFeeEstimates()` - GET /api/v1/fees/recommended
- Unit tests for key derivation and API client

**Libraries:** `@scure/btc-signer`, `@scure/bip32`, `@scure/bip39` (all already installed)

## Phase 2: Read-Only Bitcoin Tools
Goal: Add MCP tools for checking BTC balance and getting fee estimates - no signing required.
Status: `completed`

**Deliverables:**
- `src/tools/bitcoin.tools.ts` - New tool definitions:
  - `get_btc_balance` - Sum of UTXOs (returns satoshis + human-readable BTC)
  - `get_btc_fees` - Fee estimates: `{ fast, medium, slow }` in sat/vB
  - `get_btc_utxos` - List UTXOs for debugging/transparency
- Register tools in `src/index.ts`
- Update CLAUDE.md documentation

## Phase 3: Bitcoin Transaction Building
Goal: Implement transaction building and signing for BTC transfers using @scure/btc-signer.
Status: `completed`

**Deliverables:**
- `src/transactions/bitcoin-builder.ts`:
  - `buildBtcTransaction(utxos, recipient, amount, feeRate)` - Build unsigned tx
  - `signBtcTransaction(tx, privateKey)` - Sign with Uint8Array key
  - `estimateTxSize(inputCount, outputCount)` - For fee calculation
- P2WPKH (native SegWit) inputs/outputs only
- Change sent back to sender address

**Libraries:** `@scure/btc-signer` (following Leather/Xverse patterns)

## Phase 4: Transfer BTC Tool and Broadcasting
Goal: Add the `transfer_btc` MCP tool that builds, signs, and broadcasts BTC transactions.
Status: `completed`

**Deliverables:**
- [x] `src/services/mempool-api.ts` - `broadcastTransaction(txHex)` added in Phase 1
- [x] `src/tools/bitcoin.tools.ts` - Add `transfer_btc` tool:
  - Params: `recipient`, `amount` (satoshis), `feeRate` (optional, default medium)
  - Returns: txid, explorer link, fee paid, change amount
- [x] `src/utils/bitcoin.ts` - Added `publicKeyBytes` to `BitcoinKeyPair` interface
- [x] `src/transactions/builder.ts` - Added `btcPublicKey` to `Account` interface
- [x] `src/services/wallet-manager.ts` - Store btcPublicKey in session on unlock
- [x] Update CLAUDE.md with examples
- [x] Manual testnet integration test procedure documented

## Phase 5: sBTC Bridging & Advanced Transactions
Goal: sBTC deposits/withdrawals, OP_RETURN, inscriptions
Status: `deferred` (follow-on quest)

**Scope (future):**
- sBTC deposit flow (BTC → sBTC)
- sBTC withdrawal flow (sBTC → BTC)
- OP_RETURN transactions
- Ordinals/Inscriptions support
