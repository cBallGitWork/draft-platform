# Tests

Every Vitest and Playwright test sits here (the hook checks, and the recorded add-only check's,
are in `.claude/hooks/tests/`), under one of four roots: at the path of the code it tests, or at
the root for a test that spans many files (`tests/src/flow.test.ts`).

## The four roots

| Root | What it tests | Runs with | An example |
| --- | --- | --- | --- |
| `tests/convex/` | `convex/`, in Convex's own runtime (convex-test) | Vitest, the `convex` project: `*.test.ts` | `tests/convex/scoring/scoring.test.ts` |
| `tests/src/` | `src/`, the screens, in jsdom | Vitest, the `app` project: `*.test.ts`, `*.test.tsx` | `tests/src/table/table.test.tsx` |
| `tests/scripts/` | `scripts/`, in Node | Vitest, the `scripts` project: `*.test.mjs` | `tests/scripts/port.test.mjs` |
| `tests/smoke/` | the app loaded in a real browser, no Convex | Playwright (`npm run smoke`, `playwright.config.ts`) | `tests/smoke/smoke.spec.ts` |

`npm test` runs the three Vitest projects (`vitest.config.ts` holds their include patterns); a
file that matches none of them never runs. `npm run verify` runs them with the install check, the
type check, the recorded-payload check, the spec-ID check and the hook checks; CI also runs
`npm run build` and `npm run smoke`.

## What `tests/support/` holds

Nothing in it is a test. Each kind of file:

- **`*.setup.ts`**, the setup files `vitest.config.ts` names. `test.setup.ts` puts the real timers
  back after every test. `console.setup.ts` (convex and app) fails a test that logs with
  `console.error` without calling `silenceConsoleError()`. `app.setup.ts` (app) unmounts whatever a
  test rendered and stubs `window.scrollTo`, which jsdom lacks and the router calls.
- **`*.harness.ts`** (and `.tsx`), one feature's shared setup: `convex/` for the Convex tests
  (`test.harness.ts` is their common base: a fresh Convex, a faked fetch, a refused read), `src/`
  for the screens' (`shell.harness.tsx` opens the app at an address with its actions faked).
- **`recorded/*.json`**, real feed payloads, recorded once and cut down. A **`*.payloads.ts`**
  beside them loads and types each set, and says when it was recorded and how it was cut.
- **`convex/scoring.example.ts`**, a scoring set for the tests only, never one anyone plays; the
  first real set is in `convex/scoring/firstScoring.ts`.
- **`golden/`**, the expected output a test compares with (`toMatchFileSnapshot`):
  `hull-everton.scores.json` (scoring), `round-robin.txt` (the round-robin fixture draws) and
  `schema.json` (the saved tables).

`recorded/` and `golden/` are add-only: `scripts/recorded-add-only.mjs`, run by `npm run verify`,
fails on a changed or deleted file unless a commit on the branch carries the trailer
`Re-record: <file>: <why>`.

## The scoring proof

A change near scoring proves nothing moved with the whole-match golden: every recorded line of
Hull v Everton, from both feeds, in every area, scored in `tests/convex/scoring/scoring.test.ts`
and matched against `golden/hull-everton.scores.json`. How, and the other proofs a refactor owes:
`docs/REFACTORING.md`, *Proving nothing changed*.

## Citing the spec

An answer in `spec/NN-*.md` may end with an ID such as `S07.2` (#454; for now only spec/07's
*Match stats*). A test that asserts that answer cites it by writing the ID beside it, as a comment
or in the test's name. `scripts/spec-ids.mjs`, run by `npm run verify`, fails on an ID given twice
or a citation to an ID no answer has, and lists the answers no test cites. Where an answer has an
example table, `tests/support/specExamples.ts` reads its rows for a test to run
(`tests/convex/stats/matchStats.examples.test.ts`).
