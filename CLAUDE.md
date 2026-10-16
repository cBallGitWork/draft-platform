# draft-platform

Our own fantasy draft platform for the league, for 2027/28. It replaces Fantrax.
The companion app lives in `cBallGitWork/epl-draft`; this repo starts clean (Craig, 14 Oct 2026).

## The product is not defined yet

- The first session is an interview (`/grill`): Claude asks, Craig answers, and only his answers go into `SPEC.md`. Until `SPEC.md` exists a hook blocks writing anything but docs and `.claude/`.
- Don't assume features. Generic fantasy-app research is background, never the product.
- Storylines (morale, contracts, conduct) are off for now.

## Decided

- Opus plans and builds. Only a reviewer runs on a different model.
- The look is modern, with Championship Manager as a homage, not the rulebook.
- FPL's rules are fixed, so they can be constants. The league's rules are data, never hardcoded.
- Persist FPL's season-stable `code`, never the per-season `id`.
- Football-layer code is copied from epl-draft's `packages/core` when it's needed, not shared.

## Working

- Never commit on `main`. One branch and one PR per task, squash-merged.
- Stage named paths; never stage everything.
- Both are enforced by `.claude/hooks/guard_bash.py`; `.claude/hooks/test.sh` checks every hook.
- Add a rule here only after Claude gets something wrong, and add a hook rather than a rule where possible. `/retro` before clearing the chat finds those moments.
