# Refactoring

How we change code's structure without changing what it does. Adapted from sideband's
`REFACTORING.md` (16 Oct 2026) to this repo's stack and to the rules already in `CLAUDE.md` and
[PHILOSOPHY.md](PHILOSOPHY.md); where they differ, those two win. Read this before any change
whose goal is "make the code better" rather than "make it do a new thing".

**Contents:** [The one line](#the-one-line) · [What is never a refactor](#what-is-never-a-refactor) ·
[With every pull request](#with-every-pull-request) · [The drift pass](#the-drift-pass) ·
[Proving nothing changed](#proving-nothing-changed) · [The three modes](#the-three-modes) ·
[Toolkit](#toolkit)

## The one line

A refactor changes structure, never behaviour. If an output changes (a point, a pick, a saved
row, a screen's data), it is a feature or a fix and goes through the spec, not this page.

## What is never a refactor

These are where "just a move" quietly changes the product. Each needs its own pull request and
its own reason, never a cleanup:

- **Scoring and the draft.** `CLAUDE.md`: breakage is acceptable on the look and the screens,
  never on scoring, the draft or saved league data.
- **Saved data.** Renaming a field in the Convex schema, or anything persisted, is a migration.
- **Player identity.** Players are keyed on FPL's season-stable `code`; a refactor never touches
  that key.
- **League rules as data.** Lifting a value into a constant is a refactor only if it is one of
  FPL's fixed rules. A league's rule stays a row.
- **Copied football code.** Code copied from epl-draft's `packages/core` is copied on purpose
  (`CLAUDE.md`). Two copies of it are not duplication to lift into a shared package.
- **Building ahead.** "While I'm in here" pulling toward an unbuilt feature: stop and file it.

## With every pull request

A small check on the pull request's own diff, before `pr-reviewer` runs. It covers only what this
branch wrote; anything older found on the way becomes an issue (`CLAUDE.md`), unless it sits in a
file the task already touches.

- **Written three times?** Lift it, after the third copy (PHILOSOPHY: duplicate code is cheaper
  than the wrong abstraction). Two copies stay.
- **Left behind?** Unused imports, functions, arguments, commented-out code: delete.
- **Named for what it is?** In the glossary's words (`SPEC.md`): a *team*, not a *player*, for a
  manager's side.
- **Docs still true?** A doc the change makes wrong is fixed in the same branch.
- **Would I write it this way from scratch?** If not, and the fix is inside this diff, fix it.

The pull request template has a box for it.

## The drift pass

Each pull request is reviewed on its own diff, so nothing looks across them: duplication creeps
back, names drift, docs desync. The drift pass is a scheduled step back.

**When**, whichever comes first:
- 10 merged pull requests since the last drift pass;
- before the mini beta, and before the draft goes live;
- a file passes 300 lines (the line-ceiling hook will say when, `ARCHITECTURE.md`).

**What:** the per-PR checks above, across everything merged since the last pass; and whether each
thing lives in the right place.

The drift pass is a task of its own, so fixing older files there keeps `CLAUDE.md`'s rule that
tidying stays inside the files a task touches.

**How:** fresh eyes, never the author's own: `pr-reviewer` over the range, or `/code-review`.
Fixes go in on a `refactor/` branch, and its pull request title starts `refactor: drift pass`.
A pass that finds nothing is a success; say so and stop. Never invent changes to look busy.

**Record**, in a commit message on the drift pass's branch. The repo's squash merge keeps every
commit's message, so the line reaches `main`:
`Self-review: <range>: <what was checked>; <what changed, or "clean, no changes">`, with the
counts, including what was declined ("3 things written three times: 2 lifted, 1 only similar").
`git log --grep '^Self-review:' main` lists the passes. Each merged pull request is one commit on
`main`, so the count since the last pass is
`git rev-list --count $(git log -1 --format=%H --grep '^Self-review:' main)..main`; before the
first pass, `git rev-list --count main`.

## Proving nothing changed

- The Vitest suite and the type check pass before and after.
- Scoring: a recorded gameweek replayed through scoring, before and after, gives identical points
  for every player and every head-to-head, once such a test exists (#28's replayed match, for
  live points, is the nearest so far).
- The Convex schema is unchanged.
- A test that still passes with the fix deleted pins the wrong thing: delete it, run it, see.

## The three modes

1. **Safe and identical:** readability, smaller pieces, the same interfaces. The smallest diff.
2. **Modernise:** current TypeScript idiom. No new library without a reason in `ARCHITECTURE.md`.
3. **Untangle:** split a file doing too much. Propose the new layout before editing.

Every mode: plan first, touch only what the goal needs, say why per file, and report the proof's
numbers, not "looks fine".

## Toolkit

- `/simplify` and `/code-review` are Claude Code's own skills.
- `/simplify`: reuse and simplification cleanups, applied. The driver for mode 1.
- `/code-review`: a correctness pass; run it after an untangle.
- `pr-reviewer` (`.claude/agents/`): the fresh-eyes reviewer for every pull request and the drift
  pass.
- Vitest and `convex-test`: the regression gate.
