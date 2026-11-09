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
- Players are keyed on Sportmonks' player id; FPL's season-stable `code` is kept only to match past seasons (Craig, 9 Nov 2026, on #1196).
- Football-layer code is copied from epl-draft's `packages/core` when it's needed, not shared.
- The stack is in `ARCHITECTURE.md`: Craig picks services, Claude picks libraries, both with a reason.
- Before drawing any screen, read `docs/design/plate.md`. A screen's approved picture in `docs/design/approved/<screen>/` binds its layout: build to it, and a look call the picture doesn't settle stops for Craig. A screen with none gets one, drawn by Claude through `/design` and approved by Craig, before its layout changes. Pictures are 1440 wide; the phone's waits until Craig asks (1 Nov 2026: "focus on desktop for now, mobile can wait"). `docs/design/references/` (FM, CM) is background, never the product: each screen starts from how its FM equivalent is organised (FM first), never from FM's look.

## Working

- How we build, in spirit: `docs/PHILOSOPHY.md` (ship small, keep it simple, never cut tests, no silent errors). The lines below are the enforced part. Two readings of it are fixed: tidying is fine only inside files the task already touches, and anything else becomes an issue; "some breakage is acceptable" covers the look and screens, never scoring, the draft or saved league data.
- One branch and one squash-merged PR per task, its branch starting `feat/`, `fix/`, `refactor/`, `docs/` or `chore/`. Enforced: no commit on `main` and no staging everything (`guard_bash.py`); the drift pass is a weekly build, never a merge gate (Craig, 4 Nov 2026: "once a week but make it a bigger job"; `drift-pass.yml`, `docs/REFACTORING.md`); the lead (`lead.yml`) keeps the builders busy, fixing, resuming and starting builds without a session; a build's PR turns on auto-merge and merges itself once green and approved (`claude-build.yml`, `lane-auto.yml`); no merge until `verify`, `smoke`, `look-approved` and `review-landed` pass on a head holding all of main (the `main` ruleset). `.claude/hooks/test.sh` checks every hook.
- A change to the build pipeline (`.github/workflows/`, the build or review prompts) lands as one PR, tested first: run a real build from its branch (`gh workflow run claude-build.yml --ref <branch> -f issue=<n>`), check its time and result, then merge once. A branch build pushes and opens its PR as the pipeline's own account (CBHelper180, the `BUILD_TOKEN` secret, 5 Nov 2026), so its CI runs and lane-auto approves it like any other. Never merge to see what breaks (Craig, 4 Nov 2026: "16 merges, did we really need all 16 one after another?").
- Before adding a helper, read, hook, words or test fixture, search for its home and reuse it. A new file goes where `ARCHITECTURE.md` "Where code lives" and its rules say. Builders running at the same time work in different folders.
- Talk is talk: an idea, a what-if or theory-crafting is filed, specced, built or shipped only after Craig says to (`guard_mode.py`; 5 Nov 2026: scoring theory-crafting became a build and "destroyed the project flow"). One session per project, and sessions never message one another (`guard_sessions.py`); builds report on GitHub, the lead's board (`lead.yml` rewrites the `Today` issue every half hour: next up, in flight, blocked, merged, red) and the PM dashboard, never in chat. A question is asked once, five to a batch (`guard_ask.py`).
- Don't ask Craig what his standing answers already settle (merges, alpha data, the phone, small look details, fixes): act and say so in one line (`guard_ask.py`; Craig, 5 Nov 2026: "it still feels like im a solo worker").
- Where a spec file is silent, ask Craig: never build on a guessed rule, and never offer a rule only the code holds as a grill recommendation.
- A PR body is the template's `## What` and a `Part of #n` or `Closes #n` line (`pr_body.py`). `pr-reviewer` runs on every PR as its own Sonnet job and posts its verdict as a comment (`review.yml`; Craig, 4 Nov 2026, after the tech-lead review: the builder only builds). The merge waits for it to land, and after a "look at these first" for the fix round's commit (`review-landed`, `review-gate.yml`; Craig, 5 Nov 2026: "we need that in to keep code quality up"); one review round, so a later push isn't reviewed again. A builder still tidies its own diff once before its final verify (Craig, 4 Nov 2026: "a little refactor is always good").
- A PR changing a screen with an approved picture carries `ui-verifier`'s approved-vs-built block, every difference numbered (`pr_body.py`), and merges like any other: layout differences are listed for the UI reskin, never waited on (Craig, 7 Nov 2026: "we can worry about design changes later in our ui reskin"; the `look-approved` check, `look-gate.yml`, lists them and passes). Pictures are drawn and approved only in a session Craig is watching.
- A doc over 100 lines opens with a contents list (`scripts/contents-lists.mjs`, in `npm run verify`, enforces it).
- Add a rule here only after Claude gets something wrong, and add a hook rather than a rule where possible. `/retro` before clearing the chat finds those moments; `/wait-what` re-says a reply that didn't land.
