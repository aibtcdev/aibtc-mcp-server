# Phase 4: Add Unit Test Suite

<plan>
  <goal>Add vitest with tests covering encryption, wallet lifecycle, clarity value parsing, validation, and password redaction. Tests must pass locally and in CI.</goal>

  <context>
    The project is ESM ("type": "module" in package.json) with TypeScript targeting ES2022/NodeNext.
    No test infrastructure exists — no vitest, no test files, no test config.
    CI workflow exists at .github/workflows/release.yml (runs on tag push, does npm ci + npm run build).

    Modules to test (all pure functions except wallet-manager which needs storage mocks):
    - src/utils/encryption.ts (159 lines) — AES-256-GCM encrypt/decrypt, scrypt key derivation
    - src/utils/validation.ts (99 lines) — Stacks address, contract ID, txid regex validation
    - src/utils/redact.ts (28 lines) — sensitive value redaction in strings
    - src/transactions/clarity-values.ts (216 lines) — Clarity value parsing, 14+ types
    - src/services/wallet-manager.ts (519 lines) — wallet CRUD, session management, auto-lock
  </context>

  <task id="1">
    <name>Set up vitest infrastructure and write tests for pure utility modules</name>
    <files>package.json, vitest.config.ts, tests/utils/encryption.test.ts, tests/utils/validation.test.ts, tests/utils/redact.test.ts, tests/transactions/clarity-values.test.ts, tsconfig.json</files>
    <action>
1. Install vitest as a dev dependency:
   ```bash
   npm install --save-dev vitest
   ```

2. Create `vitest.config.ts` at project root:
   ```typescript
   import { defineConfig } from "vitest/config";
   export default defineConfig({
     test: {
       globals: false,
       environment: "node",
       include: ["tests/**/*.test.ts"],
       testTimeout: 10000,
     },
   });
   ```

3. Add test scripts to package.json:
   ```json
   "test": "vitest run",
   "test:watch": "vitest"
   ```

4. Create `tests/utils/encryption.test.ts`:
   - Test encrypt/decrypt round-trip with valid password
   - Test decrypt with wrong password throws
   - Test randomBytes returns correct length
   - Test generateWalletId returns UUID format
   - Test encrypted data has expected schema fields (version, iv, salt, authTag, data)

5. Create `tests/utils/validation.test.ts`:
   - Test isValidStacksAddress with mainnet (SP...) and testnet (ST...) addresses
   - Test isValidStacksAddress rejects invalid addresses (too short, wrong prefix, lowercase)
   - Test isValidContractId with valid format (address.contract-name)
   - Test isValidContractId rejects missing dot, invalid contract name
   - Test isValidTxId with and without 0x prefix
   - Test isValidTxId rejects wrong length, non-hex chars

6. Create `tests/utils/redact.test.ts`:
   - Test redacts JSON double-quoted password values
   - Test redacts JSON double-quoted mnemonic values
   - Test redacts single-quoted password values
   - Test handles multiple sensitive fields in one string
   - Test case insensitivity (Password, PASSWORD)
   - Test non-sensitive fields remain unchanged
   - Test empty input returns empty string

7. Create `tests/transactions/clarity-values.test.ts`:
   - Test parseArgToClarityValue with null/undefined → noneCV
   - Test with boolean true/false → boolCV
   - Test with positive number → uintCV
   - Test with negative number → intCV
   - Test with float throws error
   - Test with string matching SP address → principalCV
   - Test with non-address string → stringUtf8CV
   - Test with typed object {type: "uint", value: 100} → uintCV
   - Test with typed object {type: "principal", value: "SP..."} → principalCV
   - Test with typed object {type: "bool", value: true} → boolCV
   - Test with array → listCV (recursive)
   - Test with plain object → tupleCV (recursive)
   - Test with {type: "none"} → noneCV
   - Test with {type: "some", value: ...} → someCV

8. Run `npm test` and verify all tests pass.
    </action>
    <verify>
1. Run `npm test` — all tests must pass.
2. Run `npm run build` — TypeScript compilation still works.
3. Verify test file count: `ls tests/**/*.test.ts` shows 4 test files.
4. Verify vitest is in devDependencies in package.json.
    </verify>
    <done>
- vitest installed and configured
- package.json has test and test:watch scripts
- 4 test files covering: encryption, validation, redact, clarity-values
- All tests pass with `npm test`
- Build still succeeds
    </done>
  </task>

  <task id="2">
    <name>Add wallet-manager tests and CI test step</name>
    <files>tests/services/wallet-manager.test.ts, .github/workflows/ci.yml</files>
    <action>
1. Create `tests/services/wallet-manager.test.ts`:
   - Mock the storage module: `vi.mock('../../src/utils/storage.js', () => ({...}))` with in-memory implementations for readWalletIndex, writeWalletIndex, readKeystore, writeKeystore, readAppConfig, writeAppConfig, addWalletToIndex, removeWalletFromIndex, deleteWalletStorage, updateWalletMetadata, initializeStorage.
   - IMPORTANT: The WalletManager is a singleton obtained via getWalletManager(). Between tests, call lock() to reset session state.
   - Test createWallet: returns wallet ID, address, and mnemonic (24 words)
   - Test importWallet: accepts valid mnemonic, returns wallet info
   - Test importWallet with invalid mnemonic: throws error
   - Test unlock/lock lifecycle: unlock returns account, isUnlocked() is true, lock() sets isUnlocked() to false
   - Test unlock with wrong password: throws error
   - Test getSessionInfo: returns session data when unlocked, null when locked
   - Test setAutoLockTimeout(0): session expiresAt is null
   - Test deleteWallet: requires correct password
   - Test exportMnemonic: requires correct password, returns mnemonic string

2. Create `.github/workflows/ci.yml` — a separate CI workflow that runs tests on PRs and pushes:
   ```yaml
   name: CI
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm ci
         - run: npm run build
         - run: npm test
   ```

3. Run `npm test` and verify all tests pass (including wallet-manager tests).
    </action>
    <verify>
1. Run `npm test` — all tests pass (including wallet-manager).
2. Run `npm run build` — TypeScript still compiles.
3. Verify CI workflow file exists: `cat .github/workflows/ci.yml`
4. Verify wallet-manager test file exercises create, unlock, lock, delete flows.
    </verify>
    <done>
- wallet-manager tests with mocked storage covering full lifecycle
- CI workflow runs build + tests on PRs and pushes to main
- All tests pass with `npm test`
- Build still succeeds
    </done>
  </task>
</plan>
