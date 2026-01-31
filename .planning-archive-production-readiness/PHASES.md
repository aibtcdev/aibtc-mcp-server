# Phases

## Phase 1: Harden security and fix bugs

**Goal:** Eliminate all security-sensitive data leaks from server output and fix user-reported bugs that affect runtime correctness.

**Tasks included:** #1 (password masking), #2 (yield hunter wallet lock), #3 (version mismatch), #4 (debug logging removal)

**Repo:** aibtcdev/aibtc-mcp-server

**Dependencies:** None (first phase)

**Rationale:** These four tasks are the highest-priority items. Tasks 1 and 4 are security fixes that prevent sensitive data from leaking to stderr. Task 2 is a user-reported bug. Task 3 is a correctness fix. All four are independent of each other and touch distinct files, so they can be tackled sequentially within a single executor context. Combined, they touch approximately 6 files and produce 4 atomic commits. This is at the upper bound of a single phase but feasible because each task is small and well-scoped.

**Commits (conventional):**
1. `fix: mask password and mnemonic values in server stderr output`
2. `fix: resolve yield hunter wallet lock timeout and add log-file option`
3. `fix: read MCP server version from package.json at runtime`
4. `fix: remove debug logging of x402 payment payloads`

---

## Phase 2: Improve code quality

**Goal:** Mark legacy modules as deprecated with pointers to canonical replacements, and convert the storage migration from a module-load side-effect to an explicit async initialization step.

**Tasks included:** #5 (deprecate legacy wallet.ts and api.ts), #6 (explicit storage migration)

**Repo:** aibtcdev/aibtc-mcp-server

**Dependencies:** Phase 1 (task 4 modifies api.ts which task 5 annotates; task 6 modifies storage.ts and index.ts which task 3 also touches)

**Rationale:** These are code-quality improvements that do not change runtime behavior (task 5) or change it minimally (task 6). They are grouped together because both are refactoring tasks. Task 5 adds JSDoc annotations and verifies no tools import from legacy files. Task 6 converts synchronous side-effect migration to async. These are small, low-risk changes that produce 2 atomic commits.

**Commits (conventional):**
1. `refactor: deprecate legacy wallet.ts and api.ts with canonical pointers`
2. `refactor: convert storage migration to explicit async initialization`

---

## Phase 3: Enable Bitflow DEX proxy

**Goal:** Create a Cloudflare Worker proxy that holds the Bitflow API key as a secret and exposes REST endpoints the MCP server can call, then wire the MCP server to use the proxy and re-enable Bitflow tools.

**Tasks included:** #7a (plan and scaffold Bitflow proxy), #7b (wire MCP server to proxy)

**Repos:** aibtcdev/bitflow-proxy (new, for 7a), aibtcdev/aibtc-mcp-server (for 7b)

**Dependencies:** Phase 2 (task 5 deprecates api.ts; task 7b modifies bitflow.service.ts and tools/index.ts which should be on clean code)

**Rationale:** Task 7a is a separate repo but is tightly coupled with 7b -- the proxy API surface must be defined before the MCP server can be wired to call it. These two tasks form a natural unit. Task 7a produces the scaffolded Worker project; task 7b updates the MCP server to use it. The proxy follows established patterns from x402-api (Hono + Chanfana, typed Env, logger middleware). This phase may need a planning sub-step for the proxy API surface before execution.

**Commits (conventional):**
1. `feat: scaffold Bitflow proxy Cloudflare Worker` (in bitflow-proxy repo)
2. `feat: wire MCP server Bitflow tools to proxy API` (in aibtc-mcp-server repo)

---

## Phase 4: Add unit test suite

**Goal:** Add vitest with tests covering encryption, wallet lifecycle, clarity value parsing, validation, and password redaction. Tests must pass locally and in CI.

**Tasks included:** #8 (unit test suite)

**Repo:** aibtcdev/aibtc-mcp-server

**Dependencies:** Phases 1 and 2 (tests should cover the final implementations from tasks 1-6, particularly password redaction from task 1 and the storage migration from task 6)

**Rationale:** Testing is separated into its own phase because it depends on all implementation work being complete. The test suite covers 5 modules (encryption.ts, wallet-manager.ts, clarity-values.ts, validation.ts, and the password redaction logic from phase 1). All tests must be offline (no network, no real wallets). This phase also adds a CI workflow step so tests run on every push.

**Commits (conventional):**
1. `test: add vitest with unit tests for core modules`
2. `ci: add test step to GitHub Actions workflow`

---

## Phase 5: Final verification and release

**Goal:** Verify build succeeds, all tests pass, no regressions, and publish a new minor release.

**Tasks included:** Final build check, version bump, tag push

**Repo:** aibtcdev/aibtc-mcp-server

**Dependencies:** Phases 1-4 (all work complete)

**Rationale:** This is a verification and release phase. It confirms the build compiles cleanly, tests pass, the server starts without errors, and then bumps the version to the next minor (1.4.0) and pushes the tag to trigger the release workflow. This phase is lightweight and serves as the final gate.

**Commits (conventional):**
1. `chore: bump version to 1.4.0 for production readiness release`

---

## Dependency Graph

```
Phase 1 (security + bugs)
    |
    v
Phase 2 (code quality)
    |
    v
Phase 3 (Bitflow proxy)     <-- also touches bitflow-proxy repo
    |
    v
Phase 4 (test suite)
    |
    v
Phase 5 (verify + release)
```

## Summary Table

| # | Phase Name | Tasks | Repo | Depends On | Est. Commits |
|---|-----------|-------|------|------------|--------------|
| 1 | Harden security and fix bugs | 1, 2, 3, 4 | aibtc-mcp-server | -- | 4 |
| 2 | Improve code quality | 5, 6 | aibtc-mcp-server | Phase 1 | 2 |
| 3 | Enable Bitflow DEX proxy | 7a, 7b | bitflow-proxy + aibtc-mcp-server | Phase 2 | 2 |
| 4 | Add unit test suite | 8 | aibtc-mcp-server | Phases 1, 2 | 2 |
| 5 | Final verification and release | -- | aibtc-mcp-server | Phases 1-4 | 1 |
