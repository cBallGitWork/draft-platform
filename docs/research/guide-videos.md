# The guide videos

Ten videos on working with Claude Code that Craig pasted into sessions on 14–16 Oct 2026, and what
this repo took from each. Background, never the product. Gathered from the session logs of
draft-platform, epl-draft and sideband (16 Oct 2026).

## The videos

| | Video | Pasted in |
|---|---|---|
| A | Avthar, "PSB: plan, setup, build" | draft-platform |
| B | Claude Design: a design system from an inspiration image (creator unnamed) | draft-platform |
| C | Chase AI, "Defeat AI slop in three steps" | draft-platform |
| D | Matt Pocock's skills v1.3 (presented by Kevin) | epl-draft |
| E | Kevin, dynamic workflows and a bug hunt | sideband |
| F | Boris Cherny's setup (narrator unnamed) | epl-draft |
| G | Jonathan, a hackathon winner's workflow | epl-draft |
| H | "I let Claude run my agency" (probably Nick Saraev) | epl-draft |
| I | Simon Scrapes, "What the top 1% do now" | sideband |
| J | "Skills: the 100-line rule" (probably Simon Scrapes) | sideband |

## Taken

| Practice | From | Where it lives here |
|---|---|---|
| Interview before building, a recommendation per question, facts looked up | D, F, G, A | `/grill` |
| A glossary with words to avoid | D | SPEC.md, `/grill` step 4 |
| Throwaway mock-ups that look nothing alike | D, C | `/grill` step 3 |
| Product spec plus a pinned stack | A | SPEC.md, ARCHITECTURE.md |
| A grill ends in session-sized tickets with a seam and a done | D | `/grill` step 6 |
| A short CLAUDE.md that points at files | I, F, A | CLAUDE.md |
| Rules only after a mistake; hooks over rules | F, I, D | CLAUDE.md, `.claude/hooks/` |
| `/retro` before clearing | D, A, J | `.claude/skills/retro` |
| `/wait-what` | D, G | `.claude/skills/wait-what` |
| A reviewer on a different model | D, F | `.claude/agents/pr-reviewer.md` |
| Merge danger on every pull request | D | `.github/pull_request_template.md` |
| Contents lists on long docs | I, J | CLAUDE.md |
| A taste library, a design system first, a "Never" list | C, B, G | `docs/design/` |
| Five directions, then three, then tweaks | C | the screens grill's rounds |
| Stop gate, line ceiling, UI rules by path, MCPs, CI review, bug hunts as we go, one design skill tested, pre-approved commands | A, E, I, J, G | ARCHITECTURE.md, "With the first code" |

## Not taken

- **Opus plans, Sonnet builds** (A): Craig keeps "Opus plans and builds".
- **Third-party design skill packs** (C, G): skipped; video J reports 7 of 9 popular packs did no
  better than a dummy file. One gets a single test against R3·1.
- **A changelog and a status doc** (A): the spec's status column and squash-merged PR titles do it.
- **A rule on plan mode** (F, A, I disagree): none; each ticket is the brief.
