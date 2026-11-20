# Project facts for Forge's shared skills

Copy to `.studio/skills.md` in a project and fill in. The skills (`/grill` and the rest) keep
the method; this file keeps what differs here. Leave a section out to take the skill's default.

## Grill
- Spec: `SPEC.md` (index), one file per feature in `spec/NN-name.md`.
- Glossary: `SPEC.md`, Glossary.
- Decisions log: `docs/decisions.md`. Wants list: `docs/to-grill.md`.
- Model to follow: {e.g. FPL's structure}. Issue label: {e.g. `lane:auto`, or none}.

## Deepen
- Architecture map: `ARCHITECTURE.md`.
- Kept as data, never a constant: {e.g. the league's facts, values Craig tunes}.

## Refactor
- Never a refactor here: {e.g. scoring, prices, deadlines, transfers}.

## Retro
- Checks live in: {e.g. `tests/`, `.claude/hooks/` with tests in `.claude/hooks/tests/`}.
- Docs that count: {e.g. CLAUDE.md, SPEC.md}.

## Verify
1. `{command}` — {what it checks}
- With `--push`: `{command}`

## Handover
- Where: {the memory folder, indexed in MEMORY.md / `docs/record/HANDOVER.md`, older ones moved to `docs/archive/handovers/<date>.md`}.
