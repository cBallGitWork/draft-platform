---
name: verify
description: Run every gate before a commit or a pull request (tests, typecheck, the hook checks) and report the count. Use before any commit, before /refactor and pr-reviewer, and whenever Craig asks whether it passes. Adapted from epl-draft's verify (17 Oct 2026).
---

# Verify

```bash
npm run verify   # install check, vitest run, then tsc on convex/ and on the app, then .claude/hooks/test.sh
npm test -- <file>   # one test file
```

`npm run verify` is the gate, and the Stop hook runs the same script, so a session can't
end on a failure it didn't mention.

Never run bare `npx vitest`: `npm test` wraps vitest in `scripts/with-deadline.mjs`, which kills
the run at 120s, so a test that loops forever fails instead of hanging the session. 120s sits under
the Stop hook's 170s.

**Report the test count.** "3 passed" is a fact the next session can compare against;
"tests pass" is not. If the count fell, say which file lost tests before anything else.

**A gate you did not run did not pass.** If one is skipped (no network, no `node_modules`),
say so in those words.

**A stale install is not a code failure.** Verify first checks `node_modules` against
`package-lock.json`. If it prints `node_modules is behind package-lock.json: run npm ci`, no test ran:
report "install stale (run npm ci)" in place of the test counts, and never present it as a code
failure.

## Report

```
test       <n> passed / FAILED (<which>) / install stale (run npm ci)
typecheck  clean / <n> errors
hooks      all checks pass / <n> FAIL
```
