---
paths:
  - "convex/**"
  - "tests/convex/**"
---

# Convex

Read `convex/_generated/ai/guidelines.md` before writing Convex code: Convex's own rules for the
version in `package.json`, which override what Claude learned in training. After bumping
`convex`, refresh it with `npx convex ai-files update`, then delete what that adds besides the
guidelines (skills, `AGENTS.md`, a block in `CLAUDE.md`).

Where those guidelines say to bound a read with `.take(n)`, ours never cuts silently: a table that
grows is read through `convex/shared/cappedRead.ts`, `takeAllOrThrow` (past its named cap it
throws) or `takeShown` (it says there were more), and work across leagues through `everyLeague`, or
`scheduleEveryLeague` when it writes, so one league's fault stays its own (#214, #1558).

Where tests go, and what `tests/support/` holds (harnesses, recorded feeds, goldens):
`tests/README.md`.
