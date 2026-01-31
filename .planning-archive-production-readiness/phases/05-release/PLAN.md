# Phase 5: Final Verification and Release

<plan>
  <goal>Verify build succeeds, all tests pass, no regressions, and prepare the branch for PR and release.</goal>

  <context>
    Phases 1, 2, and 4 are complete. Phase 3 (Bitflow proxy) was deferred.
    The branch feat/production-readiness has 8 commits ahead of main.
    Current package.json version is 1.3.0.
    The release workflow triggers on tag push and publishes to npm.
    Since Phase 3 is deferred, this is a minor release (security fixes + code quality + tests).
  </context>

  <task id="1">
    <name>Final build and test verification, then prepare PR</name>
    <files>package.json, src/index.ts</files>
    <action>
1. Run a clean build:
   ```bash
   rm -rf dist/
   npm run build
   ```

2. Run the full test suite:
   ```bash
   npm test
   ```

3. Verify the MCP server can start (quick smoke test):
   ```bash
   timeout 3 node dist/index.js 2>&amp;1 || true
   ```
   It should print "aibtc-mcp-server running on stdio" and the version/network info before timing out (it waits for stdio input).

4. Review git log to confirm all commits are clean:
   ```bash
   git log main..HEAD --oneline
   ```

5. Do NOT bump the version or create a tag yet — that will happen after the PR is merged via the existing npm version workflow documented in CLAUDE.md. The PR itself is the deliverable of this phase.
    </action>
    <verify>
1. `npm run build` succeeds with no errors.
2. `npm test` — all tests pass (93+).
3. `git log main..HEAD --oneline` shows all phase commits.
4. `git status` is clean (no uncommitted changes).
    </verify>
    <done>
- Clean build succeeds
- All tests pass
- Server starts without errors
- Git history is clean with conventional commits
- Branch is ready for PR
    </done>
  </task>
</plan>
