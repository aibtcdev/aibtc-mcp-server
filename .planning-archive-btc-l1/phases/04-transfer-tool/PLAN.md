# Phase 4: Transfer BTC Tool and Broadcasting

## Goal
Add the `transfer_btc` MCP tool that builds, signs, and broadcasts BTC transactions.

## Prerequisites (Verified)
- [x] `broadcastTransaction()` exists in `src/services/mempool-api.ts` (Phase 1)
- [x] `buildAndSignBtcTransaction()` exists in `src/transactions/bitcoin-builder.ts` (Phase 3)
- [x] Wallet manager stores `btcPrivateKey` (Uint8Array) in session on unlock
- [x] Bitcoin tools file exists at `src/tools/bitcoin.tools.ts` with read-only tools

## Tasks

### Task 1: Add transfer_btc Tool
File: `src/tools/bitcoin.tools.ts`

Add `transfer_btc` tool with:
- **Params:**
  - `recipient` (required): Bitcoin address to send to
  - `amount` (required): Amount in satoshis
  - `feeRate` (optional): "fast" | "medium" | "slow" | number (sat/vB), default "medium"
- **Returns:**
  - `txid`: Transaction ID
  - `explorerUrl`: mempool.space link
  - `feePaid`: Fee in satoshis
  - `changeAmount`: Change sent back (0 if no change output)
  - `recipient`: Confirmed recipient address
  - `amount`: Amount sent in satoshis

**Implementation:**
1. Get wallet session (must have btcPrivateKey and btcAddress)
2. Fetch UTXOs via MempoolApi
3. Resolve fee rate (if string tier, fetch from API)
4. Build and sign transaction using buildAndSignBtcTransaction()
5. Broadcast via MempoolApi.broadcastTransaction()
6. Return result with explorer URL

### Task 2: Update CLAUDE.md Documentation
Add to Bitcoin L1 section:
- `transfer_btc` tool documentation
- Example user requests and actions
- Security notes (wallet must be unlocked)

### Task 3: Create Integration Test Documentation
File: `.planning/phases/04-transfer-tool/TEST-PROCEDURE.md`

Document manual testnet testing procedure:
1. Setup: Create testnet wallet, fund from faucet
2. Test: Execute transfer with different fee tiers
3. Verify: Check transaction on mempool.space testnet

## Acceptance Criteria
- [ ] `transfer_btc` tool builds, signs, and broadcasts transactions
- [ ] Fee selection works (fast/medium/slow/custom)
- [ ] Returns correct txid and explorer URL
- [ ] Error handling for insufficient funds, locked wallet, invalid address
- [ ] CLAUDE.md updated with examples
- [ ] Manual test procedure documented
