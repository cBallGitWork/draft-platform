---
name: refactor
description: The refactor checklist the weekly drift pass runs. Runs a four-point checklist once over the branch's diff or a given range, code and docs alike, covering what pr-reviewer doesn't, and reports every finding. Use in a drift pass, or when Craig asks for a refactor pass or "one more pass".
allowed-tools: Bash(git diff:*), Bash(git status:*)
---

# The refactor check

Craig's refactor checklist (16 Oct 2026). The policy around it, and what is never a refactor,
is [docs/REFACTORING.md](../../../docs/REFACTORING.md).

## The branch's diff
Committed and uncommitted, against where the branch left `main`, then any new files:
!`git diff --stat --merge-base origin/main`
!`git status --short`

On a drift pass the branch's own diff is empty: run `git diff --stat <range>` with the range
`docs/REFACTORING.md`'s *Record* gives, and work over that.

Work over the whole branch's diff, not only the last edit. Change only what the branch already
changed: something older that breaks a rule becomes an issue (`CLAUDE.md`), unless it sits in a
file the task already touches. In scoring, the draft or saved data, a fix that changes a
function's arguments or result (handing it the league's rules, say) is reported, never made
here: it needs its own pull request (`docs/REFACTORING.md`, *What is never a refactor*).

## The checklist, one pass

pr-reviewer runs next and checks what is written twice, dead code, a new file's home, an older
twin for a new helper or fixture, and league rules as constants (its checks 3 and 8). This
checklist covers what it doesn't.

1. **Improve:** is this the clearest way to say it?
2. **Find bugs:** a test that can't fail; a test name promising what its body doesn't check; a
   test double joining downstream of the logic it should protect (delete the fix, run the test:
   if it still passes, it pins the wrong thing); a silent catch; a test that silences
   console.error by hand where silenceConsoleError() would assert it.
3. **Naming:** every variable, function, file and test says what it is: `daysUntilExpiration`,
   not `d` (`PHILOSOPHY.md`); a function needing a comment to explain it is renamed. The
   glossary's words (`SPEC.md`): a *team*, not a *player*, for a manager's side. A test is named
   for its action and its outcome, and checks what its name says.
4. **Lean, nothing hardcoded:** comments that restate the code, anything not carrying its weight
   (a first draft usually cuts to a third or a half). A value (a number, a string, a path, a URL)
   written twice is lifted (Craig's rule, 16 Oct 2026); logic written three times is lifted,
   unless it's only similar (`PHILOSOPHY.md`: "the same pattern 3 times"); two copies of logic
   stay; an abstraction with one use goes; code copied from epl-draft stays copied. No bare
   number or string that means something in a function body. The feeds' endpoints sit behind
   the football layer's one seam (`ARCHITECTURE.md`). Setup a test repeats goes in a shared
   helper, not the test body.

Report every finding with its file and line, including the ones you chose not to act on. A pass
that finds nothing is a valid result; never invent changes to look busy. A green pull request is
not reworked over borderline duplication: say it in one line and move on.

A change that touches scoring also replays the recorded match and compares every point, as
`docs/REFACTORING.md`'s *Proving nothing changed* says. The checks themselves (`npm run verify`)
are CI's required `verify` check, so this skill doesn't run them.
