---
name: refactor
description: The refactor check every pull request gets before pr-reviewer runs. Runs a six-point checklist twice over the branch's diff, code and docs alike, reports every finding, then verifies. Use before opening a pull request, or when Craig asks for a refactor pass or "one more pass".
allowed-tools: Bash(git diff:*)
---

# The refactor check

Adapted from the whering-qa-automation repo's `qa-refactor` skill (16 Oct 2026). The policy
around it, and what is never a refactor, is [docs/REFACTORING.md](../../../docs/REFACTORING.md).

## The branch's diff
!`git diff --stat origin/main...HEAD`

Work over the whole branch's diff, not only the last edit. Change only what the branch already
changed: something older that breaks a rule becomes an issue (`CLAUDE.md`), unless it sits in a
file the task already touches.

## The checklist, twice

1. **Improve:** is this the clearest way to say it?
2. **Find bugs:** a test that can't fail; a test name promising what its body doesn't check; a
   test double joining downstream of the logic it should protect (delete the fix, run the test:
   if it still passes, it pins the wrong thing); a silent catch; a league rule hardcoded.
3. **Naming:** the glossary's words (`SPEC.md`); a test named for its action and its outcome.
4. **Debloat:** comments that restate the code, the same explanation in two places, anything not
   carrying its weight. A first draft usually cuts to a third or a half.
5. **Rule of three:** anything written three times is lifted; two copies stay (`PHILOSOPHY.md`: "the same pattern 3 times").
   An abstraction with one use goes. Code copied from epl-draft stays copied.
6. **Right home:** FPL's fixed rules as constants, a league's rules as data, the football layer
   behind its one seam (`ARCHITECTURE.md`).

Report every finding from each pass with its file and line, including the ones you chose not to
act on. A pass that finds nothing is a valid result; never invent changes to look busy. A green
pull request is not reworked over borderline duplication: say it in one line and move on.

## Verify

`/verify` once it exists (`ARCHITECTURE.md`, *With the first code*); until then, the type check
and the Vitest suite. A change that touches scoring also replays a recorded gameweek and compares
every point (`docs/REFACTORING.md`, *Proving nothing changed*). If a step fails, fix it and
rerun from the first.
