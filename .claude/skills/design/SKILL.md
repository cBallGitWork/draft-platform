---
name: design
description: Draw one screen and get it approved, with the same quality control code has. A brief from the spec, references, a 1440 board on the Claude Design canvas, a render check with the design lint, a review panel of four agents, then Craig's yes and a docs PR saving the picture. Use before any screen's layout changes, or when Craig asks for a screen to be designed.
argument-hint: "[the screen, by its route]"
---

# Design one screen

**Contents:** [1. Brief](#1-brief) · [2. References](#2-references) · [3. Draw at 1440](#3-draw-at-1440) ·
[4. Render check](#4-render-check) · [5. The review panel](#5-the-review-panel) ·
[6. Show Craig](#6-show-craig) · [7. Save the approved picture](#7-save-the-approved-picture)

Craig, 1 Nov 2026: "on claude code we have multiple steps/rules/hooks etc for quality control, how
do we do the same for ui design". This is that loop, for one screen. It ends in an approved picture
in `docs/design/approved/<screen>/`, which then binds the screen's layout (`CLAUDE.md`, Decided).

Desktop first: "focus on desktop for now, mobile can wait" (Craig, 1 Nov 2026). Every board is
drawn at 1440; a 390 board only when Craig asks for the phone.

Read `docs/design/plate.md` first, all of it: its Never list and Decided's Tables and panels hold
Craig's corrections.

## 1. Brief

Write the screen's brief before drawing, from `SPEC.md` and its `spec/NN-*.md` files only:

- the route, and how a manager reaches it (`docs/design/flow.md`);
- the jobs a manager does here, each with the spec line it comes from;
- the data it shows, each fact with its spec line, and which are placeholders (not held yet, and
  the issue that brings them).

Anything the spec doesn't settle is a question for Craig, asked in chat. Never draw a guessed rule,
and never offer a rule only the code holds as a recommendation. A want in `docs/to-grill.md` isn't
the product until a grill settles it.

## 2. References

`docs/design/references/` (FM26, CM, FPL, FPL Draft, Sleeper; its README says what each shot
shows), plus what Fantrax and FPL do on the same screen. Background only: FM's organisation, never
its colours or a copy of its screens ("dont obviously rip off FM but they do things right", Craig,
1 Nov 2026). Note the one or two ideas the board borrows; they go in the README later.

## 3. Draw at 1440

On the "Draft Manager screens" canvas, <https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>.

- `read` the canvas first (Artifact tool, `action: "read"`, its `url`), and `read`
  `project/canvas.json`, so the publish builds on the live version.
- One board is one file, `project/<Name>.dc.html`, a Design Component page: the
  `<script src="./support.js"></script>` head line exactly, the markup inside `<x-dc>`, a
  `<helmet>` for fonts and page styles, and the `<script type="text/x-dc" data-dc-script>` block
  whose `renderVals()` holds the made-up data. Repeats are `<sc-for>`, branches `<sc-if>`. The
  existing boards are the pattern: copy one.
- Each board has an entry in `canvas.json`'s `boards` (`x`, `y`, `w`: 1440, `h`, `title`) and
  `order`; keep every key you aren't changing.
- Work in a folder in the scratchpad, `<root>/project/...`, and publish with the Artifact tool:
  `url` the canvas, `root` that folder, `file_path` `<root>/project/canvas.json`, `files` the
  boards you wrote (`{"project/<Name>.dc.html": "project/<Name>.dc.html"}`).
- Values from plate.md and `src/styles.css`; made-up figures that look real; every placeholder in
  its real place and size.

## 4. Render check

From this checkout, with its own `node_modules` (Playwright is a dev dependency):

```bash
node scripts/design/expand.mjs <root>/project/<Name>.dc.html <out>/<Name>.html
node scripts/design/shoot-board.mjs <out>/<Name>.html <out>/<Name>-1440.png
node scripts/design/lint.mjs <root>/project/<Name>.dc.html
```

`expand` turns the board into a plain page (a `<dc-import>` is named, not drawn: shoot that board
on its own). `shoot-board` prints the fonts that loaded, the height, any sideways scroll and every
page error, and fails on an error. `lint` fails on a role written as initials (from the role
catalogue, `convex/lineup/roles.ts`), a key or legend, or a `·` string.

Read every PNG with the Read tool. A picture you did not open is not evidence. Fix what the lint or
the picture shows, and render again.

## 5. The review panel

Four reviewers, run in parallel in one message, each a read-only agent on sonnet:

| Agent | Lens |
|---|---|
| `design-fm-player` | organised like FM: panels, where things sit, depth; FM's organisation, not its colours |
| `design-fantasy-manager` | a draft and FPL player: weekly jobs fast, nothing he doesn't need, nothing missing |
| `design-ux` | layout, density, scan speed, plate.md and its Never list, Tables and panels |
| `design-pm` | matches SPEC and the brief, nothing invented, build cost, which screens it reaches |

Give each the PNG paths, the brief, and the lint's output. Each returns numbered findings and
Craig's calls. Fix the clear-cut findings (a broken plate.md rule, an invented control, a missing
fact the brief holds), render and lint again. Where two reviewers disagree, or a finding is taste,
it goes to Craig.

## 6. Show Craig

Publish the fixed board to the canvas, and send Craig the picture (a preview screenshot, not only a
link) with a short list:

- what the panel changed, one line each;
- where they disagreed, and every Craig's call, each a question with the options and a
  recommendation, in plain words.

Pictures are drawn and approved only in a session Craig is watching (`CLAUDE.md`, Working). He
comments on the canvas until he says it's right; each round goes back through steps 4 and 5.

## 7. Save the approved picture

On his yes, a `docs/` branch and PR adds `docs/design/approved/<screen>/` (the route's name,
`team-squad` for `/team/squad`):

- `1440.png`, the shot of the approved board;
- `README.md` as `docs/design/approved/README.md` sets out: the `Route:` line, Craig's words
  approving it and the date, the FM idea it borrows, interaction notes one line per control, each
  placeholder with its data's issue, and the canvas link;
- the screen's line in `docs/design/approved/README.md`'s Screens list.

The PR quotes Craig's yes and the panel's findings (the template's Checks). A docs-only PR that
only quotes Craig's answers may skip `pr-reviewer`, and says so.
