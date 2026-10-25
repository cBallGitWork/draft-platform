---
name: refactor
description: The refactor check every pull request gets before pr-reviewer runs. Runs a six-point checklist twice over the branch's diff, code and docs alike, reports every finding, then verifies. Use before opening a pull request, or when Craig asks for a refactor pass or "one more pass".
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

## The checklist, twice

1. **Improve:** is this the clearest way to say it?
2. **Find bugs:** a test that can't fail; a test name promising what its body doesn't check; a
   test double joining downstream of the logic it should protect (delete the fix, run the test:
   if it still passes, it pins the wrong thing); a silent catch; a league rule hardcoded; a test
   that silences console.error by hand where silenceConsoleError() would assert it.
3. **Naming:** every variable, function, file and test says what it is: `daysUntilExpiration`,
   not `d` (`PHILOSOPHY.md`); a function needing a comment to explain it is renamed. The
   glossary's words (`SPEC.md`): a *team*, not a *player*, for a manager's side. A test is named
   for its action and its outcome, and checks what its name says.
4. **Debloat:** comments that restate the code, the same explanation in two places, anything not
   carrying its weight. A first draft usually cuts to a third or a half.
5. **Rule of 2/3:** a value (a number, a string, a path, a URL) written twice is lifted (Craig's
   rule, 16 Oct 2026); logic written three times is lifted, unless it's only similar
   (`PHILOSOPHY.md`: "the same pattern 3 times"). Two copies of logic stay. An abstraction with
   one use goes. Code copied from epl-draft stays copied.
6. **Right home, nothing hardcoded:** no bare number or string that means something in a
   function body; each goes to its shared file, one home for each kind of thing. FPL's fixed
   rules are constants; a league's rules are data, never a constant (in scoring, reported: see
   above); the feeds' endpoints sit behind the football layer's one seam (`ARCHITECTURE.md`).
   Setup a test repeats goes in a shared helper, not the test body.

Report every finding from each pass with its file and line, including the ones you chose not to
act on. A pass that finds nothing is a valid result; never invent changes to look busy. A green
pull request is not reworked over borderline duplication: say it in one line and move on.

## Verify

`/verify` (`npm run verify`: the install check, the tests, the type check, the recorded-payload
check and the hook checks; CI also runs the build and the smoke test). A change that touches
scoring also replays the recorded match and compares every point, as `docs/REFACTORING.md`'s
*Proving nothing changed* says. If a step fails, fix it and rerun from the first.
