# draft-platform

A new fantasy draft product for the Premier League, made for many leagues (Craig, 16 Oct 2026).
Our league moves to it from Fantrax; the companion app lives in `cBallGitWork/epl-draft` and this repo starts clean (14 Oct 2026).

## The product is SPEC.md

- `SPEC.md` holds only Craig's answers. A feature marked `to grill`, or any detail it doesn't settle, gets a `/grill` before it is built.
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
