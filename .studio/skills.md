# Project facts for Forge's shared skills

The skills in `.claude/skills/` named in `.studio/kit.json` are Forge's kit files (`/grill` and the
rest); this file holds what differs in draft-platform. Change a kit skill in Forge
(`cBallGitWork/forge`), never here. `design` and `qa-panel` stay this repo's own.

## Grill
- Spec: `SPEC.md` (index), one file per feature in `spec/NN-name.md`; both hold only Craig's answers.
- Glossary: `SPEC.md`, Glossary.
- Decisions log: none; the spec is the record. Wants list: `docs/to-grill.md`.
- Facts to look up, never ask: FPL's rules (fixed, so constants), what epl-draft's `packages/core`
  already does, what `CLAUDE.md` or `SPEC.md` settles. `docs/research/` is background only.
- Model to follow: none. FPL is a data feed, never the rulebook; the league's rules are data. Screens
  start from how Football Manager organises its equivalent, never its look.
- Issue label: `lane:auto` on each issue the grill cuts, so the lead builds it; `lane:craig` on one
  that waits for Craig. A ticket names its stories (each pointing at its `spec/NN-*.md` line), its
  seam, its done check, what blocks it, what it reuses and the folder its code goes in
  (`ARCHITECTURE.md`, Where code lives). One past ~400 changed lines of non-test code is cut.

## Deepen
- Architecture map: `ARCHITECTURE.md` (Where code lives).
- Kept as data, never a constant: the league's rules, each competition's real-world rules.

## Refactor
- Never a refactor here: scoring, the draft and saved league data. A fix there that changes a
  function's arguments or result is reported, never made (`docs/REFACTORING.md`, What is never a
  refactor). Code copied from epl-draft stays copied.
- Words: the glossary's (`SPEC.md`): a *team*, not a *player*, for a manager's side.
- pr-reviewer already checks what is written twice, dead code, a new file's home and league rules as
  constants; the checklist covers the rest.

## Retro
- Checks live in: `.claude/hooks/` (tests in `.claude/hooks/tests/`), `tests/`, the lint rules in
  `eslint.config.js`. Craig's standing answers go in `.claude/hooks/guard_ask.py`.
- Docs that count: `CLAUDE.md`, `SPEC.md`, `ARCHITECTURE.md`, `.claude/rules/`.

## Verify
1. `npm run verify` — the install check, the tests, typecheck, lint, unused exports, recorded
   payloads add-only, tests kept, spec IDs, contents lists, the studio kit and its deny list, the
   hook checks. A first line `node_modules is behind package-lock.json` means no test ran: report
   "install stale (run npm ci)", never a code failure.
- After a change to a screen, the router, `src/main.tsx`, `index.html` or the Vite config, also
  `npm run build` and `npm run smoke` (smoke needs Google Chrome), or report them "not run (CI runs
  them)".
- One test file: `npm test -- <file>`. Never bare `npx vitest`: `npm test` has a deadline. A full run
  can outlast the Bash tool's default timeout: give it a longer one or run it in the background.

## Handover
- Where: the session's memory folder, as `handover-<YYYY-MM-DD>-<topic>.md`, with one line for it at
  the top of the handovers in `MEMORY.md`.
