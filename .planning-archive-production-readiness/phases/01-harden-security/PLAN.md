# Phase 1: Harden Security and Fix Bugs

<plan>
  <goal>Eliminate all security-sensitive data leaks from server output and fix user-reported bugs that affect runtime correctness.</goal>

  <context>
    The MCP server (src/index.ts) creates an McpServer, registers tools, and connects via stdio.
    Wallet management tools accept password/mnemonic parameters as plain z.string() schemas.
    The yield hunter daemon (src/yield-hunter/index.ts) runs a background loop checking balances and depositing to Zest.
    Two files (src/services/x402.service.ts and src/api.ts) contain duplicate debug console.error() calls that dump full 402 payment payloads.
    The server version is hardcoded as "1.0.0" at src/index.ts:99 while package.json is at 1.3.0.
  </context>

  <task id="1">
    <name>Mask password and mnemonic values in server stderr output</name>
    <files>src/index.ts, src/tools/wallet-management.tools.ts, src/utils/errors.ts</files>
    <action>
1. Create a new utility `src/utils/redact.ts` with a `redactSensitive(input: string): string` function that replaces values of JSON keys matching "password", "mnemonic", or "secret" with "[REDACTED]". Use a regex that matches `"password":"<any-value>"` patterns in stringified JSON.

2. In `src/index.ts` line 114, wrap the fatal error handler:
   - Before: `console.error("Fatal error:", error);`
   - After: `console.error("Fatal error:", redactSensitive(String(error)));`
   - Import redactSensitive from utils/redact.

3. In `src/tools/wallet-management.tools.ts`, update the z.string() schema descriptions for all password and mnemonic parameters to include "WARNING: sensitive value" so Claude avoids echoing them. Specifically update:
   - wallet_create password param (around line 22)
   - wallet_import mnemonic param (around line 65) and password param (around line 66)
   - wallet_unlock password param (around line 112)
   - wallet_delete password param (around line 262)
   - wallet_export password param (around line 309)

4. In `src/utils/errors.ts`, wrap the `formatError()` return value through `redactSensitive()` so any error message containing password/mnemonic values is sanitized before being returned to the MCP client.
    </action>
    <verify>
1. Run `npm run build` and confirm no TypeScript errors.
2. Grep the codebase: `grep -rn "console.error\|console.log\|console.warn" src/ | grep -v node_modules` and verify no path can log raw password/mnemonic values.
3. Check that redactSensitive('{"password":"hunter2"}') returns '{"password":"[REDACTED]"}'.
    </verify>
    <done>
- redact.ts utility exists and is imported where needed
- Fatal error handler in index.ts uses redaction
- Error formatting in errors.ts uses redaction
- All password/mnemonic schema descriptions include sensitivity warnings
- Build succeeds
    </done>
  </task>

  <task id="2">
    <name>Fix yield hunter wallet lock and add logging</name>
    <files>src/yield-hunter/index.ts, src/services/wallet-manager.ts</files>
    <action>
1. In `src/yield-hunter/index.ts`, swap the order at lines 196-204 so that `setAutoLockTimeout(0)` is called BEFORE `unlock()`. This ensures the config value is persisted before unlock reads it:
   - Before: unlock() → setAutoLockTimeout(0)
   - After: setAutoLockTimeout(0) → unlock()

   BUT: setAutoLockTimeout requires ensureInitialized() which needs no session — it only reads/writes config. Verify this works without an active session.

2. After unlock succeeds, add a defensive verification:
   ```typescript
   const sessionInfo = walletManager.getSessionInfo();
   if (sessionInfo?.expiresAt !== null) {
     log("WARNING: Auto-lock still active after disabling, forcing null expiry");
     // Force it via setAutoLockTimeout again
     await walletManager.setAutoLockTimeout(0);
   }
   log("Auto-lock disabled for daemon mode (session never expires)");
   ```

3. In `src/services/wallet-manager.ts`, add a public `getSessionInfo()` method if one doesn't already exist, returning `{ walletId, expiresAt }` or null if no session.

4. Add a `--log-file <path>` CLI option to the yield hunter. In `src/yield-hunter/index.ts`, check for `--log-file` in process.argv. If present, redirect the `log()` helper function (currently line 99: `console.error(...)`) to also append to the specified file using `fs.appendFileSync`. Log format: ISO timestamp + message.
    </action>
    <verify>
1. Run `npm run build` and confirm no TypeScript errors.
2. Read the yield-hunter/index.ts and verify setAutoLockTimeout(0) is called before unlock().
3. Verify getSessionInfo() method exists on WalletManager.
4. Check that --log-file argument is parsed and used in the log() helper.
    </verify>
    <done>
- setAutoLockTimeout(0) called before unlock in daemon startup
- Defensive check verifies session has no expiry after unlock
- getSessionInfo() method available on WalletManager
- --log-file option supported for persistent daemon logging
- Build succeeds
    </done>
  </task>

  <task id="3">
    <name>Read MCP server version from package.json at runtime</name>
    <files>src/index.ts, package.json</files>
    <action>
1. In `src/index.ts`, add an import to read the version from package.json. Use `createRequire` from "module" since the project uses ES modules and this is the most reliable approach:
   ```typescript
   import { createRequire } from "module";
   const require = createRequire(import.meta.url);
   const packageJson = require("../package.json");
   ```

2. Replace the hardcoded version at line 99:
   - Before: `version: "1.0.0",`
   - After: `version: packageJson.version,`

3. Verify no other hardcoded version strings exist in src/ by searching for `"1.0.0"` or `version: "`.
    </action>
    <verify>
1. Run `npm run build` and confirm no TypeScript errors.
2. Grep: `grep -rn '"1.0.0"' src/` should return no matches.
3. Grep: `grep -rn 'packageJson.version' src/index.ts` should show the dynamic version.
    </verify>
    <done>
- Version read from package.json at runtime via createRequire
- No hardcoded version strings remain in src/index.ts
- Build succeeds
    </done>
  </task>

  <task id="4">
    <name>Remove debug logging of x402 payment payloads</name>
    <files>src/services/x402.service.ts, src/api.ts</files>
    <action>
1. In `src/services/x402.service.ts`, remove lines 75-78 (the console.error debug log inside the 402 status check):
   ```typescript
   // REMOVE:
   console.error(
     "x402 debug 402 payload",
     typeof data === "string" ? data : JSON.stringify(data)
   );
   ```
   Keep the surrounding `if (error?.response?.status === 402)` block only if it contains other logic. If the only thing inside the 402 check is the console.error, remove the entire if block and leave just the string-parsing logic below it.

2. In `src/api.ts`, remove lines 55-58 (identical debug log):
   ```typescript
   // REMOVE:
   console.error(
     "x402 debug 402 payload",
     typeof data === "string" ? data : JSON.stringify(data)
   );
   ```
   Same approach — remove the if block if it only contains the debug log.

3. Verify no other debug console.error calls exist that dump payment/transaction data by searching for "x402 debug" and "402 payload".
    </action>
    <verify>
1. Run `npm run build` and confirm no TypeScript errors.
2. Grep: `grep -rn "x402 debug" src/` should return no matches.
3. Grep: `grep -rn "402 payload" src/` should return no matches.
4. The 402 response interceptor logic (string-to-JSON parsing) must still work — only the debug log is removed.
    </verify>
    <done>
- Debug console.error calls removed from both x402.service.ts and api.ts
- No "x402 debug" or "402 payload" strings remain in src/
- 402 response parsing logic preserved (only debug output removed)
- Build succeeds
    </done>
  </task>
</plan>
