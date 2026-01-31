# Phase 2: Improve Code Quality

<plan>
  <goal>Mark legacy modules as deprecated with pointers to canonical replacements, and convert the storage migration from a module-load side-effect to an explicit async initialization step.</goal>

  <context>
    src/wallet.ts (422 lines) and src/api.ts (87 lines) contain duplicated logic superseded by newer modules.
    No tool files import from wallet.ts. Only api.ts imports from wallet.ts (line 4).
    Canonical replacements exist in: src/services/x402.service.ts, src/transactions/builder.ts, src/transactions/clarity-values.ts, src/config/networks.ts, src/services/hiro-api.ts.
    src/utils/storage.ts has a bare migrateStorageDirectory() call at line 33 that runs as a module-load side effect using renameSync().
    initializeStorage() already exists at line 99 of storage.ts and is called by wallet-manager.ts ensureInitialized().
    src/index.ts runs the MCP server startup in a main() async function at line 110.
  </context>

  <task id="1">
    <name>Deprecate legacy wallet.ts and api.ts with canonical pointers</name>
    <files>src/wallet.ts, src/api.ts</files>
    <action>
1. In `src/wallet.ts`, add a file-level JSDoc comment at the top (after imports) marking the entire module as deprecated:
   ```typescript
   /**
    * @deprecated This module is superseded by modular replacements.
    * - mnemonicToAccount → src/services/x402.service.ts
    * - transferStx, callContract, deployContract, sign*, broadcast* → src/transactions/builder.ts
    * - getAccountInfo, getStxBalance, getTransactionStatus → src/services/hiro-api.ts
    * - parseArgToClarityValue → src/transactions/clarity-values.ts
    * - Network, getStacksNetwork, getApiBaseUrl → src/config/networks.ts
    * This file will be removed in a future version.
    */
   ```

2. Add `@deprecated` JSDoc to each exported function and type. Each annotation should point to the specific canonical replacement. For example:
   ```typescript
   /** @deprecated Use mnemonicToAccount from src/services/x402.service.ts */
   export async function mnemonicToAccount(...) { ... }
   ```

3. In `src/api.ts`, add a file-level JSDoc comment:
   ```typescript
   /**
    * @deprecated This module is superseded by src/services/x402.service.ts.
    * - createApiClient → src/services/x402.service.ts createX402Client()
    * - getWalletAddress, getAccount → src/services/x402.service.ts
    * - NETWORK, API_URL → src/config/networks.ts
    * This file will be removed in a future version.
    */
   ```

4. Add `@deprecated` JSDoc to each exported function and constant in api.ts.

5. Verify no tool files import from wallet.ts or api.ts:
   ```bash
   grep -rn "from.*wallet\.js\|from.*\/wallet\b" src/tools/ src/services/ src/transactions/
   grep -rn "from.*api\.js\|from.*\/api\b" src/tools/ src/services/ src/transactions/
   ```
   The only expected import is api.ts importing from wallet.ts — that is acceptable since both are deprecated together.
    </action>
    <verify>
1. Run `npm run build` and confirm no TypeScript errors.
2. Verify every exported function/type in wallet.ts has @deprecated JSDoc.
3. Verify every exported function/constant in api.ts has @deprecated JSDoc.
4. Grep confirms no tool/service files import from the legacy modules (except api.ts → wallet.ts which is OK).
    </verify>
    <done>
- File-level deprecation comments on both wallet.ts and api.ts
- Every export in both files has @deprecated JSDoc with pointer to canonical replacement
- No tool or service files import from the legacy modules
- Build succeeds
    </done>
  </task>

  <task id="2">
    <name>Convert storage migration to explicit async initialization</name>
    <files>src/utils/storage.ts, src/index.ts</files>
    <action>
1. In `src/utils/storage.ts`, remove the module-level side effect:
   - Delete line 32 (comment: `// Run migration on module load`)
   - Delete line 33 (call: `migrateStorageDirectory();`)

2. In `src/utils/storage.ts`, modify the existing `initializeStorage()` function (line 99) to call migration first:
   - Add `await migrateStorage();` as the first line of `initializeStorage()`
   - Convert `migrateStorageDirectory()` to an async version named `migrateStorage()` that uses `fs.rename()` instead of `renameSync()`:
     ```typescript
     async function migrateStorage(): Promise<void> {
       try {
         const oldExists = await fs.access(OLD_STORAGE_DIR).then(() => true).catch(() => false);
         const newExists = await fs.access(STORAGE_DIR).then(() => true).catch(() => false);
         if (oldExists && !newExists) {
           await fs.rename(OLD_STORAGE_DIR, STORAGE_DIR);
           console.error(`Migrated wallet storage from ${OLD_STORAGE_DIR} to ${STORAGE_DIR}`);
         }
       } catch (error) {
         console.error(`Failed to migrate storage directory: ${error}`);
       }
     }
     ```
   - Remove the old synchronous `migrateStorageDirectory()` function and its `existsSync`/`renameSync` imports if no longer needed.

3. In `src/index.ts`, add explicit storage initialization to the MCP server startup path:
   - Add import: `import { initializeStorage } from "./utils/storage.js";`
   - Call `await initializeStorage();` inside the `main()` function, before `server.connect(transport)`.
   - This ensures storage is initialized before any tools that need it are invoked.

4. Check if the `existsSync` and `renameSync` imports from `fs` are still needed in storage.ts after removing the sync migration. If not, clean up the import.
    </action>
    <verify>
1. Run `npm run build` and confirm no TypeScript errors.
2. Grep: `grep -n "migrateStorageDirectory" src/utils/storage.ts` should return no matches (function renamed to migrateStorage and made async).
3. Grep: `grep -n "renameSync\|existsSync" src/utils/storage.ts` should return no matches (sync APIs replaced with async).
4. Verify initializeStorage is imported and called in src/index.ts main().
5. Verify no bare function calls at module scope in storage.ts.
    </verify>
    <done>
- Module-level migrateStorageDirectory() call removed from storage.ts
- Migration converted to async migrateStorage() using fs.rename()
- initializeStorage() calls migrateStorage() first
- src/index.ts calls initializeStorage() in main() before server.connect()
- No sync fs imports remain in storage.ts (unless needed elsewhere in the file)
- Build succeeds
    </done>
  </task>
</plan>
