# draft-platform

A new fantasy draft product for the Premier League, made for many leagues (Craig, 16 Oct 2026).
Our league moves to it from Fantrax; the companion app lives in `cBallGitWork/epl-draft` and this repo starts clean (14 Oct 2026).

## The product is SPEC.md

- `SPEC.md` is the index and `spec/NN-*.md` each feature; both hold only Craig's answers. A feature marked `to grill`, or any detail it doesn't settle, gets a `/grill` before it is built.
- The build queue is the GitHub issues each grill ends in (`/grill` step 6).
- Don't assume features. Generic fantasy-app research is background, never the product (`docs/research/`).

## Decided

- Opus plans and builds. The reviewer runs on a different model from the builder.
- The look is modern, with Championship Manager as a homage, not the rulebook.
- FPL's rules are fixed, so they can be constants. The league's rules are data, never hardcoded.
- Persist FPL's season-stable `code`, never the per-season `id`.
- Football-layer code is copied from epl-draft's `packages/core` when it's needed, not shared.
- The stack is in `ARCHITECTURE.md`: Craig picks services, Claude picks libraries, both with a reason.
- Before drawing any screen, read `docs/design/plate.md`. `docs/design/references/` is background, never the product.

## Working

- How we build, in spirit: `docs/PHILOSOPHY.md` (ship small, keep it simple, never cut tests, no silent errors). The lines below are the enforced part. Two readings of it are fixed: tidying is fine only inside files the task already touches, and anything else becomes an issue; "some breakage is acceptable" covers the look and screens, never scoring, the draft or saved league data.
- Never commit on `main`. One branch and one PR per task, squash-merged. Branches start `feat/`, `fix/`, `refactor/`, `docs/` or `chore/`.
- Stage named paths; never stage everything.
- Both are enforced by `.claude/hooks/guard_bash.py`; `.claude/hooks/test.sh` checks every hook.
- Before a pull request opens, run the `pr-reviewer` agent on the branch and paste its verdict into the template.
- A doc over 100 lines opens with a contents list.
- Add a rule here only after Claude gets something wrong, and add a hook rather than a rule where possible. `/retro` before clearing the chat finds those moments; `/wait-what` re-says a reply that didn't land.
