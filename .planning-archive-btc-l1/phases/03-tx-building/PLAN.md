# Phase 3: Bitcoin Transaction Building

## Goal
Implement transaction building and signing for BTC transfers using @scure/btc-signer.

## Deliverables
- `src/transactions/bitcoin-builder.ts`:
  - `buildBtcTransaction(utxos, recipient, amount, feeRate)` - Build unsigned tx
  - `signBtcTransaction(tx, privateKey)` - Sign with Uint8Array key
  - `estimateTxSize(inputCount, outputCount)` - For fee calculation
- P2WPKH (native SegWit) inputs/outputs only
- Change sent back to sender address

## Design Decisions (from PHASES.md)
- Use `@scure/btc-signer` following Leather/Xverse patterns
- Change address = sender address (same identity, simpler)
- Fee selection: user picks slow/medium/fast, we fetch rates (with override option)
- Private keys as Uint8Array (already stored in wallet session from Phase 1)

## Tasks

### Task 1: Create bitcoin-builder.ts with types and estimateTxSize
Create the transaction builder file with:
- Type definitions for BTC transaction building
- `estimateTxSize(inputCount, outputCount)` for P2WPKH transactions
- P2WPKH size constants (68 vB input, 31 vB output, 10.5 vB overhead)

### Task 2: Implement buildBtcTransaction
Implement the core transaction building function:
- Select UTXOs (use all for simplicity, selectUTXO lib available)
- Create P2WPKH outputs for recipient and change
- Calculate and verify fees
- Return unsigned transaction

### Task 3: Implement signBtcTransaction
Implement transaction signing:
- Accept Transaction object and private key Uint8Array
- Sign all inputs with the private key
- Finalize the transaction
- Return signed tx hex

### Task 4: Add unit tests for bitcoin-builder
Write comprehensive tests:
- estimateTxSize calculations
- buildBtcTransaction edge cases (dust, insufficient funds)
- signBtcTransaction with mock UTXOs
- End-to-end tx building flow

### Task 5: Verify build and tests pass
- Run `npm run build`
- Run `npm test`
- Fix any issues

## Implementation Notes

### P2WPKH Transaction Size Calculation
Based on @scure/btc-signer patterns:
- Base transaction overhead: ~10.5 vB (version, locktime, witness marker)
- P2WPKH input: ~68 vB (txid:32 + vout:4 + sequence:4 + witness:~27 vB scaled)
- P2WPKH output: ~31 vB (amount:8 + script:22 + length:1)

### @scure/btc-signer Usage Pattern
```typescript
import * as btc from '@scure/btc-signer';

// Create transaction
const tx = new btc.Transaction();

// Add input with witnessUtxo (required for P2WPKH)
tx.addInput({
  txid: utxo.txid,
  index: utxo.vout,
  witnessUtxo: {
    script: btc.p2wpkh(pubKey).script,
    amount: BigInt(utxo.value),
  },
});

// Add output
tx.addOutputAddress(recipient, BigInt(amount), network);

// Sign with private key
tx.sign(privateKey);

// Finalize
tx.finalize();

// Get hex
const txHex = tx.hex;
```

### Network Configuration
- Mainnet: `btc.NETWORK`
- Testnet: `btc.TEST_NETWORK`

## Dependencies
- `@scure/btc-signer` (already installed v2.0.1)
- Existing: `src/utils/bitcoin.ts` (deriveBitcoinKeyPair)
- Existing: `src/services/mempool-api.ts` (UTXO type)
