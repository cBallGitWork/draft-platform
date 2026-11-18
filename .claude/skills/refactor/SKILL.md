---
name: refactor
description: The refactor checklist. Runs once over the branch's diff or a given range, code and docs alike, and reports every finding. Use before a pull request's final /verify, after a run of feature work, or when Craig asks for a refactor pass or "one more pass".
argument-hint: "[a range, such as <ref>..HEAD]"
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

# The refactor check

Craig's refactor checklist (16 Oct 2026). Behaviour stays the same, except for bugs it finds,
which are named as bugs.

**First, read the project's facts:** `.studio/skills.md`, section *Refactor* (what is never a
refactor here, its naming and duplication rules), then `CLAUDE.md`.

## The diff

Committed and uncommitted, against where the branch left `main`, then any new files:
!`git diff --stat --merge-base origin/main`
!`git status --short`

Given a range instead, run `git diff --stat <range>` and work over that. Work over the whole diff,
not only the last edit. Change only what it already changed: something older that breaks a rule
becomes an issue, unless it sits in a file the task already touches.

## What is never a refactor

Each needs its own pull request and its own reason, never a cleanup. Report it; don't make it here:

- **What users see or are scored on.** A change to a number, a rule or a screen's words is a
  product change, however small the diff. The project's facts list its own.
- **Saved data.** Renaming a stored field, or anything persisted, is a migration.
- **Facts kept as data.** A real-world fact, or a value Craig tunes, never becomes a constant.
- **Building ahead.** "While I'm in here" pulling toward an unbuilt feature: stop and file it.

## The checklist, one pass

1. **Improve:** is this the clearest way to say it?
2. **Find bugs:** a test that can't fail; a test name promising what its body doesn't check; a
   test double joining downstream of the logic it should protect (delete the fix, run the test:
   if it still passes, it pins the wrong thing); a silent catch. Where the project renders
   output, read the rendered output, not only the source.
3. **Naming:** every variable, function, file and test says what it is: `daysUntilExpiration`,
   not `d`. A function needing a comment to explain it is renamed. The glossary's words, one word
   for one thing. A test is named for its action and its outcome.
4. **Lean, nothing hardcoded:** cut comments that restate the code and anything not carrying its
   weight. **Count before extracting:** grep the duplication and write the number down. A value
   written twice is lifted; logic written three times is lifted, unless only similar; two copies
   of logic stay, and the count goes in the report so the next pass doesn't re-open it. An
   abstraction with one use goes. No bare number or string that means something in a function
   body: name it, in one home.

Report every finding with its file and line, including the ones you chose not to act on. A pass
that finds nothing is a valid result; never invent changes to look busy. A green pull request is
not reworked over borderline duplication: say it in one line and move on.

This skill doesn't run the checks: `/verify` does, after it.
