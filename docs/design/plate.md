# Plate: the look

The values behind [spec/12-screens.md](../../spec/12-screens.md). Craig chose the look; the
values are Claude's, from the designer's round-2 brief and the reviewer's pass on R3·1
(16 Oct 2026). The reference mock-up is "R3·1 · Plate, chosen" (source: `docs/design/mockups/PlateOne.dc.html`) on
<https://claude.ai/artifact/Qz9zn3FrMHgPB189UtbjoB>. Every screen is drawn from this file.
How the screens link, and which the spec names but nobody has built: [flow.md](flow.md).

**Contents:** [Colour roles](#colour-roles-cm-9900-blue) · [Type](#type) · [Shape](#shape) ·
[Marks](#marks) · [Controls](#controls) · [Never](#never) ·
[The phone](#the-phone-to-draw-when-the-phone-design-is-grilled) · [Decided](#decided)

## Colour roles (CM 99/00 blue)

| Role | Value | Used for |
|---|---|---|
| ground | `#0a1240` | the page |
| panel | `#1a2a80` | a panel's body |
| plate | `#173a94` | the top bar, a panel's title plate, date blocks |
| stepper | `#1d2a98` | the `◄ GW9 ►` gameweek stepper; a control on the plate under the pointer, and a toggle on the plate while its list is open (the top bar's league) |
| name plate | `#050a30` | under a player's name on the pitch, the alert strip |
| column head | `#b9bcc4`, ink `#0a1240` | one continuous plate over a table's columns |
| fact | `#ffffff` | names, labels that are facts, a role |
| figure | `#ffe600` | a number that is a figure: points, form, stars. Never a button or tab |
| derived reading | `#6bfdfa` | something worked out: a countdown, a formation's preset name |
| event | `#ff9b3d` | something that happened or needs you: a doubt, unread mail |
| muted / unavailable | `#9aa4b8` | secondary labels, the bench, read mail |
| role text | `#c9d1ff` | the role under a name on the pitch |
| pitch | stripes `#2f8535` / `#276f2c`, lines 2px `#e6f2e6` | |
| action | fill `#ffffff`, ink `#0a1240`, bevel `#b9bcc4` | Continue; hover `#c9d1ff`, pressed `#b9bcc4` (bevel flipped); `#ff9b3d` (hover `#ffb36b`, pressed `#e07f1f`) when the deadline is near; with nothing to do, no fill, 1px `#9aa4b8` border, "Nothing needs you" |
| secondary action | fill `#173a94`, 1px border `#c9d1ff`, ink `#ffffff` | hover fill `#1d2a98`, border `#ffffff`; pressed fill `#0a1240` |
| active tab | text `#ffffff` 600, 3px underline `#6bfdfa` (2px on a sub-tab) | inactive tabs `#c9d1ff`; never muted `#9aa4b8` on the bar (4.05:1) |
| focus | 2px outline `#6bfdfa`, offset 2px | every control |
| link | `#ffffff`, 1px underline; hover underline `#6bfdfa` | |

**Fixture difficulty** fills the whole cell, CM style, with no digit (Craig), so colour carries it on screen by choice; the labels below carry it for
screen readers. The fills fall in
lightness from easiest to hardest, so the order survives red-green colour blindness:
1 `#57e08a` ink `#04130a` · 2 `#93b83a` ink `#0c1a06` · 3 `#8a90a0` ink `#0a1240` ·
4 `#c9304f` ink `#ffffff` · 5 `#8c1236` ink `#ffffff`. Each cell carries `title` and `aria-label`
("Opponent BOU, home, difficulty 2 of 5, easy"; the words: very easy, easy, average, hard, very
hard), a five-step legend sits above the table, and rows keep a 1px `#0a1240` gap.

The pairs the reviewer computed meet WCAG 2.1 AA (muted on panel 4.97:1, every difficulty ink on
its fill 5.2:1 or better, the unread badge 8.5:1); check any new pair before using it. Cyan never
sits straight on the pitch: it fails there (3.77:1 on the light stripe).

## Type

Archivo Narrow 400/600/700 only. Data 13px, a player's name 15px, the page title 26px. Rows 20px
on the desk. Figures use tabular numerals.

## Shape

- Radius 0 everywhere.
- CM's bevel, 2px: `inset 0 2px 0` light, `inset 0 -2px 0` dark, on title plates and the top bar.
  On the plate, light `#4a6cc8` and dark `#001a5e`; on a panel, light `#4556b8` and dark
  `#050a30`. The line above a section's tabs is 1px `#4556b8`.
- Tabs are butted, separated by 1px rules, never gaps: `#001a5e` on the plate, `#0a1240` on a
  panel. Every tab is 44px tall; a section's tabs are 36px on the desk.
- Panels sit 8px apart and align to the top (no stretched empty panels).
- The league sits in the top bar: on the desk inline after the product name, ruled off by 1px
  `#001a5e`; on the phone its own 44px row under the name, Continue and Sign out, above the menu.
- Spacing steps: 4, 8, 12, 16.

## Marks

- **Shirts**: our own outline in the club's colours, the squad number on the chest.
- **Stars**: SVG, filled in the figure colour, empty ones as outlines in muted grey, the set
  labelled "Role fit 4 of 5".
- **A doubt**: an orange square with a bar, on the name plate and the squad row, labelled "Doubt".
- **Unread**: a 3px orange bar down the letter's left edge, and "Unread" for screen readers.
- **The current one of a list**: a 3px bar down its left edge in the active tab's cyan, and
  `aria-current` for screen readers (the top bar's league list).
- **The bench**: its own "Bench" plate in the table, below the eleven.

## Controls

Craig chose "Wells" of three looks (22 Oct 2026), drawn as board "A · Wells" on
<https://claude.ai/artifact/LArQQrJt8SuAZzqedPhx4u>: CM's bevel turned inward. Built once each, for the rules
screens, in `src/rules/` (`TickBox`, `Choice`, `SaveBar`).

- **Tick box**: a real checkbox drawn as a 22px well: name plate fill, the panel bevel flipped
  (`inset 0 2px 0 #050a30`, `inset 0 -2px 0 #4556b8`), a 1px `#c9d1ff` rim like a box to type in
  (the rim is ours: the well alone is 1.54:1 on the panel), stepper fill under the pointer, and
  a white drawn tick (stroke 2.5, square caps) when on. Its row is 44px and toggles it anywhere;
  the words are white when on, `#c9d1ff` when off.
- **Keys**, one of a few chosen (a rule's Pays): butted 44px keys, 1px `#001a5e` rules between.
  The others are the plate with its bevel and `#c9d1ff` text; the chosen one is pressed in:
  ground fill, the plate bevel flipped (`inset 0 2px 0 #001a5e`, `inset 0 -2px 0 #4a6cc8`), white
  600. A radio group, so the arrow keys move it.
- **Discard and Save**: Discard is the secondary action, there only once something changed; Save
  is the action, and with nothing to save it is the action with nothing to do, in `#9aa4b8` text.

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

## Decided

- **Yellow is a figure only.** Continue is white, orange when the deadline is near, and the active
  tab is a cyan underline: the UX expert's call, which Craig handed them (16 Oct 2026).
- **Fixture difficulty** is a filled cell without a digit (Craig).
- **Pitch, squad and Mail** stay side by side; no panel is made dominant (Craig).
