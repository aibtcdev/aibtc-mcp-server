# Phase 1: Bitcoin Private Key Infrastructure

## Goal
Extend existing Bitcoin address derivation to expose private keys for signing, and create a mempool.space API client for UTXO and fee data.

## Design Decisions
- CAIP-2 chain IDs: `stacks:1` (mainnet), `stacks:2147483648` (testnet), `bip122:000000000019d6689c085ae165831e93` (Bitcoin mainnet), `bip122:000000000933ea01ad0ee984209779ba` (Bitcoin testnet)
- Single wallet unlock enables both Stacks AND Bitcoin operations
- Private keys as `Uint8Array` in session, never serialized to WIF/hex
- Same auto-lock timeout applies to both chains
- Libraries: `@scure/btc-signer`, `@scure/bip32`, `@scure/bip39` (already installed)

## Tasks

### Task 1: Create CAIP-2 Chain Identifiers
**File:** `src/config/caip.ts`
**Commit:** `feat(config): add CAIP-2 chain identifiers for Stacks and Bitcoin`

Create constants for chain-agnostic identification following CAIP-2 format:
- Stacks mainnet: `stacks:1`
- Stacks testnet: `stacks:2147483648`
- Bitcoin mainnet: `bip122:000000000019d6689c085ae165831e93`
- Bitcoin testnet: `bip122:000000000933ea01ad0ee984209779ba`

Include helper function to get chain ID from network type.

### Task 2: Add deriveBitcoinKeyPair()
**File:** `src/utils/bitcoin.ts`
**Commit:** `feat(bitcoin): add deriveBitcoinKeyPair for transaction signing`

Add new function that returns both public key and private key bytes:
- Returns `{ address, publicKey, privateKey: Uint8Array }`
- Private key as Uint8Array, never serialized to WIF/hex
- Uses same BIP84 derivation path as existing `deriveBitcoinAddress()`
- Update `BitcoinAddress` interface or create new `BitcoinKeyPair` interface

### Task 3: Store BTC Private Key in Session
**File:** `src/services/wallet-manager.ts`
**Commit:** `feat(wallet): derive and store Bitcoin private key on unlock`

Extend wallet manager to include Bitcoin private key in session:
- Update `Account` interface to include `btcPrivateKey: Uint8Array`
- Update `Session` interface if needed
- Derive BTC private key during `unlock()` using `deriveBitcoinKeyPair()`
- Same auto-lock behavior clears both Stacks and Bitcoin keys

### Task 4: Create mempool.space API Client
**File:** `src/services/mempool-api.ts`
**Commit:** `feat(mempool): add mempool.space API client for UTXO and fees`

Create typed API client for mempool.space:
- `getUtxos(address)` - GET `/api/address/{address}/utxo`
- `getFeeEstimates()` - GET `/api/v1/fees/recommended`
- Support mainnet (`mempool.space`) and testnet (`mempool.space/testnet`)
- Return typed interfaces for UTXO and fee data
- Handle network errors gracefully

### Task 5: Unit Tests
**Files:** `tests/utils/bitcoin.test.ts`, `tests/services/mempool-api.test.ts`
**Commits:**
- `test(bitcoin): add tests for deriveBitcoinKeyPair`
- `test(mempool): add tests for mempool.space API client`

Test coverage:
- `deriveBitcoinKeyPair()` returns valid Uint8Array private key
- Private key length is 32 bytes
- Key derivation is deterministic for same mnemonic
- API client returns typed UTXO data
- API client returns typed fee estimates
- Error handling for API failures

### Task 6: Verify and Finalize
**Commit:** None (verification only)

- Run `npm run build` to verify TypeScript compilation
- Run `npm test` to verify all tests pass
- Update PHASES.md status to `completed`
- Update STATE.md to advance to phase 2

## Deliverables Checklist
- [x] `src/config/caip.ts` - CAIP-2 chain identifiers
- [x] `src/utils/bitcoin.ts` - `deriveBitcoinKeyPair()` function
- [x] `src/services/wallet-manager.ts` - BTC private key in session
- [x] `src/services/mempool-api.ts` - mempool.space API client
- [x] `tests/utils/bitcoin.test.ts` - key derivation tests
- [x] `tests/services/mempool-api.test.ts` - API client tests
- [x] Build passes (`npm run build`)
- [x] Tests pass (`npm test`)

## Completion Summary

**Date:** 2025-01-30
**Status:** Completed

All phase 1 deliverables have been implemented and verified:

1. **CAIP-2 Chain Identifiers** - Created `src/config/caip.ts` with chain identifiers for Stacks and Bitcoin networks, plus helper functions.

2. **Bitcoin Key Pair Derivation** - Added `deriveBitcoinKeyPair()` to `src/utils/bitcoin.ts` that returns private key as Uint8Array (never serialized).

3. **Wallet Manager Update** - Modified `src/services/wallet-manager.ts` to derive BTC private key on unlock and store in session.

4. **Mempool API Client** - Created `src/services/mempool-api.ts` with:
   - `getUtxos()` - Fetch UTXOs for address
   - `getFeeEstimates()` - Get recommended fee rates
   - `getFeeTiers()` - Simplified fast/medium/slow tiers
   - `getBalance()` / `getConfirmedBalance()` - Balance helpers
   - `broadcastTransaction()` - Broadcast signed tx

5. **Unit Tests** - 138 tests pass (22 new tests added):
   - 10 tests for `deriveBitcoinKeyPair()`
   - 22 tests for `MempoolApi`
