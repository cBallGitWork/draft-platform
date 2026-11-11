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
- **Player identity.** Players are keyed on Sportmonks' player id, and FPL's season-stable `code` is
  kept only to match past seasons (Craig, 9 Nov 2026, on #1196). Until the move off FPL lands, the
  site's tables still key players on FPL's `code`; only the `sportmonks*` tables key on Sportmonks'
  id. A refactor never touches either key.
- **League rules as data.** Lifting a value into a constant is a refactor only if it is one of
  FPL's fixed rules. A league's rule stays a row.
- **Copied football code.** Code copied from epl-draft's `packages/core` is copied on purpose
  (`CLAUDE.md`). Two copies of it are not duplication to lift into a shared package.
- **Function paths.** A Convex function's path is saved with every job
  `ctx.scheduler.runAt`/`runAfter` queues, and a loaded browser calls the old path too. Renaming
  one the scheduler or the client calls is not a refactor: give it its own PR that keeps a thin
  re-export at the old path until the jobs queued under it have run, or drains and reschedules
  them. Crons are exempt, because the push re-registers them.
- **The round robin's draw.** The table draws every league's fixtures again from its seed on every
  read, so a change to `convex/table/roundRobin.ts` or `convex/shared/shuffle.ts` that moves one
  fixture deals every live league's season again, however evenly it still deals.
- **Building ahead.** "While I'm in here" pulling toward an unbuilt feature: stop and file it.

## With every pull request

A build gives its own diff one quick pass before its final verify: code written twice, names that
don't match their neighbours, a helper or fixture that already exists elsewhere, fixed in place
(Craig, 4 Nov 2026: "a little refactor is always good"; the prompt is in `claude-build.yml`).
No skill and no subagent: the full `/refactor` (`.claude/skills/refactor/`) runs in the weekly
drift pass, or in a session when Craig asks. `pr-reviewer` reviews every pull request as its own
job (`.github/workflows/review.yml`), posting its verdict as a comment; the merge waits for it to land (`review-landed`, `.github/workflows/review-gate.yml`).

## The drift pass

Each pull request is reviewed on its own diff, so nothing looks across them: duplication creeps
back, names drift, docs desync. The drift pass is a scheduled step back.

**When:** once a week, and a bigger job than a per-merge tidy (Craig, 4 Nov 2026: "once a week
but make it a bigger job"). It is never a merge gate. `.github/workflows/drift-pass.yml` runs on
Monday mornings: it opens (or reopens) the one issue labelled `drift-pass` and `build`, with
*Record*'s range and the merges in it, and starts its build (`claude-build.yml`). Also:
- before the mini beta, and before the draft goes live;
- a file passes 300 lines (the line-ceiling hook will say when, `ARCHITECTURE.md`).

**What:** `/refactor`'s checklist, across everything merged since the last pass (the skill diffs
the current branch unless given a range: give it the one from the last drift pass to `main`, as
*Record* finds it); for each new home the range adds (a helper, read, hook, words, test
fixture), a search of the whole codebase for an older one, since a copy older than the range is
outside its diff; whether each thing lives in the right place; whether ui-verifier's
colour-role bullet still matches plate.md; and SPEC.md's status rows and ARCHITECTURE.md brought up
to what merged in the range (builds no longer edit them per slice). (`tests/src/designNever.test.ts` holds
`.claude/rules/ui.md`'s Never list equal to plate.md's `## Never`.)

The drift pass is a task of its own, so fixing older files there keeps `CLAUDE.md`'s rule that
tidying stays inside the files a task touches.

**How:** the build works the checklist over the range; `review.yml` gives its pull request fresh
eyes, as every other. Fixes go in on a `refactor/drift-pass` branch, and its pull request title starts `refactor: drift pass`.

**Record**, in a commit message on the drift pass's branch. The repo's squash merge keeps every
commit's message, so the line reaches `main`:
`Self-review: <range>: <what was checked>; <what changed, or "clean, no changes">`, with the
counts, including what was declined ("3 things written three times: 2 lifted, 1 only similar").
The line is how a pass is found, whatever its title: `git log --grep '^Self-review:' main` lists
the passes (`drift-pass.yml`'s `PASS_MARK`). Each merged pull request is one commit on `main`, so the
count since the last pass is `git rev-list --count $(git log -1 --format=%H --grep '^Self-review:' main)..main`.
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
- **Adapter:** a thing that plugs in at a seam. The football layer's seam, `Football`, has two:
  FPL's (`convex/football/fpl/fpl.ts`), which fills the tables the site reads, and Sportmonks'
  (`convex/football/sportmonks/sportmonks.ts`, #1391), which fills only its own `sportmonks*`
  tables until the switch lands; the recorded payloads the tests replay sit
  underneath every adapter, through the faked fetch (`tests/support/convex/test.harness.ts`).
- **Locality:** for whoever changes a module: a change, or a bug, sits in one place, not spread
  across many.
- **Leverage:** for whoever calls a module: how much it does per thing they must learn.

## Proving nothing changed

- The Vitest suite and the type check pass before and after.
- Scoring: the whole-gameweek golden is the proof any refactor near scoring owes (the scorer, the
  matchup, the table, the stored scores). `tests/convex/endToEnd/gameweekGolden.test.ts` plays
  recorded gameweek 6 through a league of four, under the site's first scoring set, to the lock,
  and every fielded player's points and every head-to-head result must match
  `tests/support/golden/gameweek6.scores.json` before and after. Beside it, the whole-match golden
  in `tests/convex/scoring/scoring.test.ts` scores every recorded line of Hull v Everton, from both
  feeds, in all six areas, under a test-only set, and must match
  `tests/support/golden/hull-everton.scores.json`; and
  `tests/convex/endToEnd/miniBetaGameweek.test.ts`, which checks gameweek 6's team points against
  points worked out man by man, passes. A refactor/ branch that changes either golden is not a
  refactor.
- The draw: `tests/convex/table/roundRobinGolden.test.ts` pins the exact fixtures four seeds deal
  (an even league, an odd one with byes, an odd one against the league's average, two games a
  gameweek) and the first numbers `seededRandom("x")` gives. A refactor/ branch that changes them
  is not a refactor.
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

- `/refactor` (`.claude/skills/`): the checklist the weekly drift pass runs.
- `/deepen` (`.claude/skills/`): the architecture pass.
- `/simplify` and `/code-review` are Claude Code's own skills.
- `/simplify`: reuse and simplification cleanups, applied. The driver for mode 1.
- `/code-review`: a correctness pass; run it after an untangle.
- `pr-reviewer` (`.claude/agents/`): the fresh-eyes reviewer for every pull request, the drift
  pass's included, run by `.github/workflows/review.yml`.
- Vitest and `convex-test`: the regression gate.
