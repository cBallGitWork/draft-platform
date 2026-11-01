# draft-platform

A new fantasy draft product for the Premier League, made for many leagues (Craig, 16 Oct 2026).
Our league moves to it from Fantrax; the companion app lives in `cBallGitWork/epl-draft` and this repo starts clean (14 Oct 2026).

## The product is SPEC.md

- `SPEC.md` is the index and `spec/NN-*.md` each feature; both hold only Craig's answers. Wants no grill has settled live in `docs/to-grill.md`, never in `SPEC.md`; those, a screen marked `to grill` in `SPEC.md`, and any detail a spec file doesn't settle each get a `/grill` before they are built.
- The build queue is the GitHub issues each grill ends in (`/grill` step 6).
- Don't assume features. Generic fantasy-app research is background, never the product (`docs/research/`).

## Decided

- Opus plans and builds. The reviewer runs on a different model from the builder.
- The look is modern, with Championship Manager as a homage, not the rulebook.
- FPL's rules are fixed, so they can be constants. The league's rules are data, never hardcoded.
- Persist FPL's season-stable `code`, never the per-season `id`.
- Football-layer code is copied from epl-draft's `packages/core` when it's needed, not shared.
- The stack is in `ARCHITECTURE.md`: Craig picks services, Claude picks libraries, both with a reason.
- Before drawing any screen, read `docs/design/plate.md`. A screen's approved picture in `docs/design/approved/<screen>/` binds its layout: build to it, and a look call the picture doesn't settle stops for Craig. A screen with none gets one, drawn by Claude through `/design` and approved by Craig, before its layout changes. Pictures are 1440 wide; the phone's waits until Craig asks (1 Nov 2026: "focus on desktop for now, mobile can wait"). `docs/design/references/` (FM, CM) is background, never the product.

## Working

- How we build, in spirit: `docs/PHILOSOPHY.md` (ship small, keep it simple, never cut tests, no silent errors). The lines below are the enforced part. Two readings of it are fixed: tidying is fine only inside files the task already touches, and anything else becomes an issue; "some breakage is acceptable" covers the look and screens, never scoring, the draft or saved league data.
- Never commit on `main`. One branch and one PR per task, squash-merged. Branches start `feat/`, `fix/`, `refactor/`, `docs/` or `chore/` (a convention; the hook checks only `main`).
- Stage named paths; never stage everything.
- Both are enforced by `.claude/hooks/guard_bash.py`, which also refuses `gh pr merge` once a drift pass is due (`docs/REFACTORING.md`), unless the PR is that pass; `.claude/hooks/test.sh` checks every hook.
- Before adding a helper, read, hook, words or test fixture, search for its home and reuse it. A new file goes where `ARCHITECTURE.md` "Where code lives" and its rules say. Builders running at the same time work in different folders.
- Where a spec file is silent, ask Craig: never build on a guessed rule, and never offer a rule only the code holds as a grill recommendation.
- Before a pull request opens, run the `pr-reviewer` agent on the branch and paste its verdict into the template. A merge or restack after the review that changes behaviour gets a second `pr-reviewer` round. A docs-only PR that only quotes Craig's answers may skip `pr-reviewer`, and says so in its Checks.
- A pull request that changes a screen with an approved picture shows approved and built side by side, every difference numbered (the `ui-verifier` agent). With none it merges like any other; with any, it waits for Craig's yes. Pictures are drawn and approved only in a session Craig is watching.
- A doc over 100 lines opens with a contents list.
- Add a rule here only after Claude gets something wrong, and add a hook rather than a rule where possible. `/retro` before clearing the chat finds those moments; `/wait-what` re-says a reply that didn't land.
