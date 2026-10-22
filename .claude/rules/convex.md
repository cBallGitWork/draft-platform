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
