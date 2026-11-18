---
name: verify
description: Run the project's local gate before a commit, a push or a pull request, and report exactly what ran and what it printed. Use before any commit, after /refactor and before the reviewer, and whenever Craig asks whether it passes.
argument-hint: "[--push]"
---

# Verify

**The gate is the project's:** `.studio/skills.md`, section *Verify*, names its commands in order,
and any extra ones for `--push`. Run them all, in that order, in full. With no `.studio/skills.md`,
use the gate `CLAUDE.md` or `README.md` names, and say which you used.

**A gate you did not run did not pass.** If one is skipped (a tool missing, no network, a build
already running), say so in those words, never three greens reported as four.

**Say what it printed.** Quote failing lines before anything else. Report counts ("669 passed"),
not "tests pass"; if a count fell against the last run you know of, say which file lost tests
first.

**Never cut a test, skip one or switch a rule off** to get to green. A check that is wrong is
fixed in the open, in the same pull request, with the reason in its commit message. No disable
comment without its reason on the same line.

## Report

One line per command, in the order run:

```
<command>   passed (<count>) / FAILED (<what>) / not run (<why>)
```
