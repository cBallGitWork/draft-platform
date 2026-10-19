---
name: verify
description: Run every gate before a commit or a pull request (tests, typecheck, the hook checks) and report the count. Use before any commit, before /refactor and pr-reviewer, and whenever Craig asks whether it passes. Adapted from epl-draft's verify (17 Oct 2026).
---

# Verify

```bash
npm run verify   # vitest run, then tsc on convex/ and on the app, then .claude/hooks/test.sh
```

That one script is the gate, and the Stop hook runs the same script, so a session can't
end on a failure it didn't mention.

**Report the test count.** "3 passed" is a fact the next session can compare against;
"tests pass" is not. If the count fell, say which file lost tests before anything else.

**A gate you did not run did not pass.** If one is skipped (no network, no `node_modules`),
say so in those words.

## Report

```
test       <n> passed / FAILED (<which>)
typecheck  clean / <n> errors
hooks      all checks pass / <n> FAIL
```
