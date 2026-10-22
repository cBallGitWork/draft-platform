## What

## Why

<!-- The fault this closes, and the spec item it serves (spec/NN-*.md). -->

Closes #  <!-- only on its own line, only for an issue this PR finishes. For a slice, write "Part of #n". Never put close/fix/resolve next to an issue number anywhere else. -->

## Merge danger

<!-- One-way or two-way door: can a revert undo it (a persisted name, a schema, a scheduled job,
an email sent)? And the blast radius: which screen, league or job it can break. -->

## Checks

<!-- A step not run stays unticked and says why (- [ ] pr-reviewer: not run — <why>); it is never ticked with a caveat. -->

- [ ] the tests at this feature's seam pass, and were run
- [ ] shot at 390 and 1440, and looked at, if anything visible changed
- [ ] `/refactor` run on the branch (one run; it makes its two passes itself); a drift pass is due after 10 merged since the last (`docs/REFACTORING.md`)
- [ ] pr-reviewer run on the branch; its verdict is below
- [ ] docs updated in this branch, not a follow-up
- [ ] staged by named path

## Fresh-eyes review

<!-- Paste the last round's block for Craig. Put earlier rounds and every 'detail for the author' table inside <details><summary>Review detail</summary>…</details>. -->

Commits after the review: none / <sha>..HEAD, second round pasted below

## Left for later

<!-- One line per CRAIG'S CALL or parked finding, naming where it went: '#n' or 'to-grill: <row>'. Or 'none'. -->
