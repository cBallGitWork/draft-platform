# The guide videos

Twelve videos on working with Claude Code that Craig pasted into sessions, and what this repo took
from each. Background, never the product. A–J were gathered from the session logs of
draft-platform, epl-draft and sideband (16 Oct 2026); K and L were pasted on 21 Oct 2026.

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
| K | Simon Scrapes, 15 things that changed in the last 10 months | draft-platform |
| L | AI Foundations (Drake), the rebuilt Claude Projects | draft-platform |

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
| Test a skill against no skill; keep only what beats it | K | *Tested*, below |
| Stop gate, line ceiling, UI rules by path, MCPs, CI review, bug hunts as we go, one design skill tested, pre-approved commands | A, E, I, J, G | ARCHITECTURE.md, "With the first code" |

## Not taken

- **Opus plans, Sonnet builds** (A): Craig keeps "Opus plans and builds".
- **Third-party design skill packs** (C, G): skipped; video J reports 7 of 9 popular packs did no
  better than a dummy file. One gets a single test against R3·1.
- **A changelog and a status doc** (A): the spec's status column and squash-merged PR titles do it.
- **A rule on plan mode** (F, A, I disagree): none; each ticket is the brief. K agrees.
- **`/advisor`** (K): we don't build on Sonnet.
- **Projects with a coordinator and threads** (K, L): not for builds. Since 20 Oct each builder
  has run in its own worktree against its own local Convex deployment on Craig's Mac, which a
  cloud thread can't reach; and a coordinator splitting a ticket its own way breaks one ticket,
  one branch, one PR. A grill or research run there is worth one trial.
- **A smaller workflow size** (K): the session setting is medium (under 10 agents), which has
  fitted the waves of 3–4 builders run so far.
- **`/loop`** (K): nothing needs polling, since builders end on the Stop gate and a finish notice.
  One use in view: watching the live poller's logs during the first live match (#37).

## Tested (21 Oct 2026)

Each skill ran 3 times with it and 3 without, through `claude plugin eval`, on one case. Neither
arm loads CLAUDE.md or `.claude/`, so the fixture carries the repo context. The Haiku judge marked
correct answers wrong at least twice, so every report was also read by hand.

- **`/grill`** earns its place through the round format: with it, 3 of 3 gave numbered questions
  each with a recommendation; without, none recommended anything. Opus alone already caught a
  *swap*/*transfer* clash and didn't re-ask a settled rule.
- **`/refactor`**: Opus alone caught every planted fault; the skill adds the two passes and a file
  and line per finding. All 3 with-skill runs also rewrote scoring's signatures to make the league
  points data, which `docs/REFACTORING.md` says is never a cleanup. #109 adds a line saying such
  a fix is reported, not made; rerun, 3 of 3 reported it and left the code alone.
- **`/goal`** (K: its checker reads only the chat): true per
  [the docs](https://code.claude.com/docs/en/goal), but 6 headless runs on one small task, 3 with
  a vague goal and 3 with a proof goal, all passed the tests for real. A proof clause in a long
  builder's goal stays cheap insurance.
