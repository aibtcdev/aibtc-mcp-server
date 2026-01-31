# Phase 2: Read-Only Bitcoin Tools

## Goal
Add MCP tools for checking BTC balance and getting fee estimates - no signing required.

## Prerequisites
- Phase 1 completed: `mempool-api.ts` service exists with `getUtxos()`, `getFeeEstimates()`, `getFeeTiers()`, `getBalance()`
- Wallet manager stores `btcAddress` in session on unlock

## Tasks

### Task 1: Create bitcoin.tools.ts
Create the new tool file with three read-only tools:

1. **get_btc_balance** - Sum of UTXOs
   - Input: optional `address` (uses wallet's btcAddress if not provided)
   - Returns: `{ address, network, balance: { satoshis, btc }, confirmed: { satoshis, btc } }`
   - Uses: `MempoolApi.getUtxos()` to sum values

2. **get_btc_fees** - Fee estimates
   - Input: none
   - Returns: `{ network, fees: { fast, medium, slow }, unit: "sat/vB" }`
   - Uses: `MempoolApi.getFeeTiers()`

3. **get_btc_utxos** - List UTXOs
   - Input: optional `address`, optional `confirmedOnly` flag
   - Returns: `{ address, network, utxos: [...], count, totalValue }`
   - Uses: `MempoolApi.getUtxos()`

### Task 2: Register tools in index.ts
- Import `registerBitcoinTools` from `./bitcoin.tools.js`
- Add to `registerAllTools()` function with comment "// Bitcoin L1"

### Task 3: Update CLAUDE.md documentation
Add new section for Bitcoin L1 tools after the existing wallet tools.

## Verification
- `npm run build` passes
- `npm test` passes
- Tools appear in the MCP server tool list

## Commits
1. `feat(tools): add Bitcoin L1 read-only tools (balance, fees, UTXOs)`
2. `docs: document Bitcoin L1 tools in CLAUDE.md`
