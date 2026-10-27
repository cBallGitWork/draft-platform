---
name: verify
description: Run the local gate before a commit or a pull request (the install check, tests, typecheck, the recorded-payload check, the hook checks) and report the count; CI also runs the build and the smoke suite. Use before any commit, before /refactor and pr-reviewer, and whenever Craig asks whether it passes. Adapted from epl-draft's verify (17 Oct 2026).
---

# Verify

```bash
npm run verify   # install check, vitest run, tsc on convex/ and on the app, then
                 # scripts/recorded-add-only.mjs (payloads, goldens add-only), .claude/hooks/test.sh
npm test -- <file>   # one test file
```

`npm run verify` is the local gate, and the Stop hook runs the same script, so a session can't
end on a failure it didn't mention.

CI also runs `npm run build` and `npm run smoke`. Smoke needs Google Chrome locally (the Smoke
tests row in [ARCHITECTURE.md](../../../ARCHITECTURE.md#libraries-claudes)).

**After a change to a screen, the router, `src/main.tsx`, `index.html` or the Vite config,** run
`npm run build` and `npm run smoke` yourself, or report them as "not run (CI runs them)".

Never run bare `npx vitest`: `npm test` wraps vitest in `scripts/with-deadline.mjs`, which kills
the run at its deadline (`package.json`'s `test` script), so a test that loops forever fails
instead of hanging the session. That deadline (300s, raised from 120 in #467) sits under the Stop hook's own
(`GATE_TIMEOUT_SECONDS`, `.claude/hooks/gate_on_stop.py`).

**Report the test count.** "3 passed" is a fact the next session can compare against;
"tests pass" is not. If the count fell, say which file lost tests before anything else.

**A gate you did not run did not pass.** If one is skipped (no network, no `node_modules`, no
Chrome for smoke), say so in those words.

**A stale install is not a code failure.** Verify first checks `node_modules` against
`package-lock.json`. If it prints `node_modules is behind package-lock.json: run npm ci`, no test ran:
report "install stale (run npm ci)" in place of the test counts, and never present it as a code
failure.

## Report

```
test       <n> passed / FAILED (<which>) / install stale (run npm ci)
typecheck  clean / <n> errors
recorded   add-only / FAILED (<which file>)
hooks      all checks pass / <n> FAIL
build      passed / FAILED / not run (CI runs it)
smoke      <n> passed / FAILED (<which>) / not run (CI runs it)
```
