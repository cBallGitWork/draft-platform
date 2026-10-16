# Plate: the look

The values behind [spec/12-screens.md](../../spec/12-screens.md). Craig chose the look; the
values are Claude's, from the designer's round-2 brief and the reviewer's pass on R3·1
(16 Oct 2026). The reference mock-up is "R3·1 · Plate, chosen" (source: `docs/design/mockups/PlateOne.dc.html`) on
<https://claude.ai/artifact/Qz9zn3FrMHgPB189UtbjoB>. Every screen is drawn from this file.

## Colour roles (CM 99/00 blue)

| Role | Value | Used for |
|---|---|---|
| ground | `#0a1240` | the page |
| panel | `#16238a` | a panel's body |
| plate | `#0030a6` | the top bar, a panel's title plate, date blocks |
| stepper | `#1f13a7` | the `◄ GW9 ►` gameweek stepper |
| name plate | `#050a30` | under a player's name on the pitch, the alert strip |
| column head | `#b9bcc4`, ink `#0a1240` | one continuous plate over a table's columns |
| fact | `#ffffff` | names, labels that are facts, a role |
| figure | `#ffe600` | a number that is a figure: points, form, stars |
| derived reading | `#6bfdfa` | something worked out: a countdown, a formation's preset name |
| event | `#ff9b3d` | something that happened or needs you: a doubt, unread mail |
| muted / unavailable | `#9aa4b8` | secondary labels, subs, read mail |
| role text | `#c9d1ff` | the role under a name on the pitch |
| pitch | stripes `#2f8535` / `#276f2c`, lines 2px `#e6f2e6` | |

**Fixture difficulty**, always with its digit, never by colour alone:
1 `#00b050` ink `#04130a` · 2 `#8fd36a` ink `#0c1a06` · 3 `#c9ccd4` ink `#0a1240` ·
4 `#ff4f6d` ink `#1a0208` · 5 `#8c1236` ink `#ffffff`.

The pairs the reviewer computed meet WCAG 2.1 AA (muted on panel 5.1:1, every difficulty ink on
its fill 6.2:1 or better, the unread badge 8.5:1); check any new pair before using it. Cyan never
sits straight on the pitch: it fails there (4.35:1).

## Type

Archivo Narrow 400/600/700 only. Data 13px, a player's name 15px, the page title 26px. Rows 20px
on the desk. Figures use tabular numerals.

## Shape

- Radius 0 everywhere.
- CM's bevel, 2px: `inset 0 2px 0` light, `inset 0 -2px 0` dark, on title plates and the top bar.
- Tabs are butted, separated by 1px rules, never gaps.
- Panels sit 8px apart and align to the top (no stretched empty panels).
- Spacing steps: 4, 8, 12, 16.

## Marks

- **Shirts**: our own outline in the club's colours, the squad number on the chest.
- **Stars**: SVG, filled in the figure colour, empty ones as outlines in muted grey, the set
  labelled "Role fit 4 of 5".
- **A doubt**: an orange square with a bar, on the name plate and the squad row, labelled "Doubt".
- **Unread**: a 3px orange bar down the letter's left edge, and "Unread" for screen readers.
- **Subs**: their own "Subs" plate in the table, below the eleven.

## Never

From the designer's review, the tells that make a screen look AI-made:

1. Rows of stat tiles, a card for every section, small tracked uppercase labels over big numbers.
2. Pills and tinted badges; a chip, where one is needed, is square and solid.
3. Indigo or slate grounds with lavender-grey text and a neon accent; gradient buttons.
4. `·` strings, floating rows, ★ typed as text, the same 16px gutter around everything.

## The phone (to draw when the phone design is grilled)

From the reviewer, for a 390px screen: a bottom bar of five (Team, Matchup, Table, Players, Mail
with its count); the deadline and Continue in a 48px bar at the top; every target 44px; the squad table
keeps the player column fixed and drops Club, Role and Role fit; Mail collapses to an "N unread"
bar above the pitch; the pitch's player blocks narrow to 84px. The app needs a viewport meta.

## Open: Craig's call

The reviewer and the designer disagree on these, so they wait for Craig:

- **Yellow for Continue and the active tab.** The designer gave Continue CM's yellow; the reviewer
  says yellow means a figure and should not be spent on buttons, and wants white on blue (orange
  when the deadline is near) with a cyan underline for the active tab.
- **Fixture difficulty as a filled cell** (the whole column coloured, as CM did) instead of a chip
  inside the cell.
- **The squad as the dominant panel** over the pitch.
