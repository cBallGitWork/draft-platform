# Refactoring

How we change code's structure without changing what it does, fitted to this repo's stack and
to the rules already in `CLAUDE.md` and [PHILOSOPHY.md](PHILOSOPHY.md); where they differ, those
two win. Read this before any change whose goal is "make the code better" rather than "make it
do a new thing".

**Contents:** [The one line](#the-one-line) · [What is never a refactor](#what-is-never-a-refactor) ·
[With every pull request](#with-every-pull-request) · [The drift pass](#the-drift-pass) ·
[The architecture pass](#the-architecture-pass) · [The words](#the-words) ·
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
- **Function paths.** A Convex function's path is saved with every job
  `ctx.scheduler.runAt`/`runAfter` queues, and a loaded browser calls the old path too. Renaming
  one the scheduler or the client calls is not a refactor: give it its own PR that keeps a thin
  re-export at the old path until the jobs queued under it have run, or drains and reschedules
  them. Crons are exempt, because the push re-registers them.
- **Building ahead.** "While I'm in here" pulling toward an unbuilt feature: stop and file it.

## With every pull request

`/refactor` (`.claude/skills/refactor/`), before `pr-reviewer` runs: a six-point checklist, twice,
over the branch's own diff, then the checks. The checklist lives in the skill, not here. The pull
request template has a box for it.

## The drift pass

Each pull request is reviewed on its own diff, so nothing looks across them: duplication creeps
back, names drift, docs desync. The drift pass is a scheduled step back.

**When**, whichever comes first:
- 10 merged pull requests since the last drift pass (the session-start hook
  `.claude/hooks/drift_due.py` runs *Record*'s count and says `drift pass due` when it is);
- before the mini beta, and before the draft goes live;
- a file passes 300 lines (the line-ceiling hook will say when, `ARCHITECTURE.md`).

**What:** `/refactor`'s checklist, across everything merged since the last pass (the skill diffs
the current branch unless given a range: give it the one from the last drift pass to `main`, as
*Record* finds it); whether each thing lives in the right place; and whether ui-verifier's
colour-role bullet still matches plate.md. (`tests/src/designNever.test.ts` holds
`.claude/rules/ui.md`'s Never list equal to plate.md's `## Never`.)

The drift pass is a task of its own, so fixing older files there keeps `CLAUDE.md`'s rule that
tidying stays inside the files a task touches.

**How:** fresh eyes, never the author's own: `pr-reviewer` or `/code-review`, each given the range.
Fixes go in on a `refactor/` branch, and its pull request title starts `refactor: drift pass`.

**Record**, in a commit message on the drift pass's branch. The repo's squash merge keeps every
commit's message, so the line reaches `main`:
`Self-review: <range>: <what was checked>; <what changed, or "clean, no changes">`, with the
counts, including what was declined ("3 things written three times: 2 lifted, 1 only similar").
`git log --grep '^refactor: drift pass' main` lists the passes. Each merged pull request is one
commit on `main`, so the count since the last pass is
`git rev-list --count $(git log -1 --format=%H --grep '^refactor: drift pass' main)..main`.
`Self-review:` is the drift pass's record line only; a feature branch records /refactor in its
PR's checks box.

## The architecture pass

The drift pass tidies what is there; it never asks whether the code is cut into the right pieces.
As the codebase grows, every change made without the whole in view leaves it a little harder to
change, and that compounds. `/deepen` (`.claude/skills/deepen/`) looks across the whole codebase
for modules to deepen, in [the words](#the-words) below.

**When:** when Craig asks, for now (Craig, 28 Oct 2026: "its sizeable now....but later").

**Who decides:** agents find up to six candidates and put them to Craig in plain words; Craig picks.
A pick goes to `/grill`, which ends in issues; nothing is built from a candidate he didn't pick.

## The words

The shared vocabulary for talking about the code's shape, from John Ousterhout's *A Philosophy of
Software Design* by way of Matt Pocock (Oct 2026). `/deepen` reads them from here by this
heading's exact text, so renaming it means changing the skill's `sed` line too.

- **Module:** a unit of the code with one job: scoring a match, the draft's pick order, a screen
  with its parts.
- **Interface:** everything a caller must know to use a module correctly: its functions, what
  they take and return, and the rules for calling them (call this before that).
- **Implementation:** what the module does inside, which a caller never needs to know.
- **Deep / shallow:** a deep module hides a lot behind a small interface; a shallow one has an
  interface nearly as big as what it does. Deep is better: callers learn less.
- **Seam:** where one module meets another, through its interface. Tests poke a module at its
  seam.
- **Adapter:** a thing that plugs in at a seam. The real feeds and the recorded payloads the tests
  replay are two adapters at the football layer's one seam.
- **Locality:** for whoever changes a module: a change, or a bug, sits in one place, not spread
  across many.
- **Leverage:** for whoever calls a module: how much it does per thing they must learn.

## Proving nothing changed

- The Vitest suite and the type check pass before and after.
- Scoring: the whole-match golden in `tests/convex/scoring/scoring.test.ts` scores every recorded
  line of Hull v Everton, from both feeds, in all six areas, and must match
  `tests/support/golden/hull-everton.scores.json` before and after, and
  `tests/convex/endToEnd/miniBetaGameweek.test.ts`, which checks gameweek 6's team points against
  points worked out man by man, passes before and after.
- The Convex schema is unchanged: `tests/convex/schema.contract.test.ts` passes without `-u`; a
  refactor/ branch that changes `tests/support/golden/schema.json` is not a refactor.
- A test that still passes with the fix deleted pins the wrong thing: delete it, run it, see.

## The three modes

1. **Safe and identical:** readability, smaller pieces, the same interfaces. The smallest diff.
2. **Modernise:** current TypeScript idiom. No new library without a reason in `ARCHITECTURE.md`.
3. **Untangle:** split a file doing too much. Propose the new layout before editing.

Every mode: plan first, touch only what the goal needs, say why per file, and report the proof's
numbers, not "looks fine".

## Toolkit

- `/refactor` (`.claude/skills/`): the check every pull request gets.
- `/deepen` (`.claude/skills/`): the architecture pass.
- `/simplify` and `/code-review` are Claude Code's own skills.
- `/simplify`: reuse and simplification cleanups, applied. The driver for mode 1.
- `/code-review`: a correctness pass; run it after an untangle.
- `pr-reviewer` (`.claude/agents/`): the fresh-eyes reviewer for every pull request and the drift
  pass.
- Vitest and `convex-test`: the regression gate.
