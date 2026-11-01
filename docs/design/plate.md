# Plate: the look

The values behind [spec/12-screens.md](../../spec/12-screens.md). Craig chose the look; the
values are Claude's, from the designer's round-2 brief and the reviewer's pass on R3·1
(16 Oct 2026). The reference mock-up is "R3·1 · Plate, chosen" (source: `docs/design/mockups/PlateOne.dc.html`) on
<https://claude.ai/artifact/Qz9zn3FrMHgPB189UtbjoB>. Every screen is drawn from this file.
How the screens link, and which the spec names but nobody has built: [flow.md](flow.md).
Where a screen has an approved picture ([approved/](approved/README.md)), the picture settles its
layout (what sits where, the columns, the rows) and this file its values (colours, type, spacing);
where the two disagree, ask Craig.

**Contents:** [Colour roles](#colour-roles-cm-material) · [Type](#type) · [Shape](#shape) ·
[Marks](#marks) · [Controls](#controls) · [Never](#never) ·
[The phone](#the-phone-to-draw-when-the-phone-design-is-grilled) · [Decided](#decided)

## Colour roles (CM material)

CM's blue is the chrome: the top bar royal blue, title plates, date blocks and controls indigo. The
page is near-neutral dark under a drawn texture, a fine grain and a faint floodlit glow from the top,
and the panels are see-through over it, so the indigo and the meaning colours stand out and the page
isn't flat (Craig, 31 Oct 2026; see Decided: Look B).

| Role | Value | Used for |
|---|---|---|
| ground | `#111214`, under a fine grain (white at 5%) and a glow from the top, `rgb(70 96 84 / 0.22)` fading out by 70% of an ellipse 90% wide and 60% tall; at its lightest, the glow's brightest point with the grain counted, the page is `#282e2d` | the page. Drawn in CSS, never a photograph |
| panel | `rgb(26 27 31 / 0.84)`, so `#191a1d` to `#1c1e21` over the page; solid `#1a1b1f` where it opens over the page (the top bar's league list) | a panel's body |
| bar | `#173a94` | the top bar |
| plate | `#2a1f86` | a panel's title plate, date blocks, keys |
| stepper | `#3529a8` | the `◄ GW9 ►` gameweek stepper; a control on the plate under the pointer, and a toggle on the bar while its list is open (the top bar's league) |
| name plate | `#050608` | under a player's name on the pitch, a tick box's well |
| alert | `#2a1d10` | the alert strip, under its orange edge |
| column head | `#b9bcc4`, ink `#111214` | one continuous plate over a table's columns |
| fact | `#ffffff` | names, labels that are facts, a role |
| figure | `#ffe600` | a number that is a figure: points, form, stars. Never a button or tab |
| derived reading | `#6bfdfa` | something worked out: a countdown, a formation's preset name |
| event | `#ff9b3d` | something that happened or needs you: a doubt, unread mail |
| muted / unavailable | `#a1a5ab` | secondary labels, the bench, read mail |
| role text | `#caced4` | the role under a name on the pitch |
| pitch | stripes `#2f8535` / `#276f2c`, lines 2px `#e6f2e6` | |
| action | fill `#ffffff`, ink `#111214`, bevel `#b9bcc4` | Continue; hover `#caced4`, pressed `#b9bcc4` (bevel flipped); `#ff9b3d` (hover `#ffb36b`, pressed `#e07f1f`) when the deadline is near; with nothing to do, no fill, 1px `#a1a5ab` border, "Nothing needs you" |
| secondary action | fill `#2a1f86`, 1px border `#caced4`, ink `#ffffff` | hover fill `#3529a8`, border `#ffffff`; pressed fill `#111214` |
| danger action | the secondary action's shape: fill `#2a1d10`, 1px border `#ff9b3d`, ink `#ff9b3d` 600 | the yes on a confirm that deletes or removes (Delete it, Remove them, Leave); hover its edge doubled and ink `#ffffff`, never filled orange (that is Continue near the deadline); pressed fill `#111214`; busy, border and ink `#a1a5ab` |
| active tab | text `#ffffff` 600, 3px underline `#6bfdfa` (2px on a sub-tab) | inactive tabs `#caced4`; never muted `#a1a5ab` on the bar (4.1:1) |
| focus | 2px outline `#6bfdfa`, offset 2px | every control |
| link | `#ffffff`, no underline at rest; a 1px `#6bfdfa` underline under the pointer (where a pointer hovers, as Controls' Hover) and with the focus ring | a link, and a button drawn as one (Move, Dismiss). A bare link inside a sentence of running text keeps a 1px `#ffffff` underline at rest, as nothing else tells it from the words around it (WCAG 1.4.1); none exists yet (Craig, 31 Oct 2026; see Decided) |

**Fixture difficulty** fills the whole cell, CM style, with no digit (Craig), so colour carries it on screen by choice; the labels below carry it for
screen readers. The fills fall in
lightness from easiest to hardest, so the order survives red-green colour blindness:
1 `#57e08a` ink `#04130a` · 2 `#93b83a` ink `#0c1a06` · 3 `#8a90a0` ink `#08090b` ·
4 `#c9304f` ink `#ffffff` · 5 `#8c1236` ink `#ffffff`. Each cell carries `title` and `aria-label`
("Opponent BOU, home, difficulty 2 of 5, easy"; the words: very easy, easy, average, hard, very
hard), a five-step legend sits above the table, and rows keep a 1px ground (`#111214`) gap.

The pairs meet WCAG 2.1 AA (`contrast()` in `convex/football/clubColours.ts`, 31 Oct 2026): muted on
a panel 6.8:1 and muted straight on the page 5.6:1, both at the page's lightest with the grain counted (the worse case; 6.4:1 on the glow alone), white on the plate
12.8:1, role text on the plate 8.1:1, cyan on the plate 10.4:1, white on the stepper 10.3:1, the
action's ink 18.7:1, the column head's ink 9.9:1, every difficulty ink on its fill 5.2:1 or better,
the unread badge 8.9:1, the danger action's ink 7.8:1 (8.9:1 pressed, 6.6:1
busy, white under the pointer 16.4:1) and its orange edge on a panel 8.2:1. Muted on the stepper is 4.2:1, so it is only ever a step that can't be taken
(the stepper's greyed ◄ or ►, a disabled control). Check any new pair before using it. Cyan never
sits straight on the pitch: it fails there (3.77:1 on the light stripe).

## Type

Two faces. Archivo Narrow 400/600/700 for everything that is data. Archivo, heavy (800) and wide
(width 125), for page titles and team names only: a page's title plate, the matchup's two sides
and their panels' plates, a Premier League match's two clubs, and the product name on the sign-in
bar. Both are served with the app (Fontsource). Data 13px, a player's name 15px, the page title
26px. A table's rows are 28px on the desk (the 13px data on its 20px line, 4px above and below)
and 44px on the phone wherever a row is tapped (see Decided). Figures use tabular numerals, in Archivo Narrow even beside a team's
name (the score).

## Shape

- Radius 0 everywhere.
- CM's bevel, 2px: `inset 0 2px 0` light, `inset 0 -2px 0` dark, on title plates and the top bar.
  On the bar, light `#4a6cc8` and dark `#001a5e`; on the plate, light `#6a5fe0` and dark `#110a4a`;
  on a panel, light `#34363c` and dark `#050608`. The line above a section's tabs is 1px `#34363c`.
- Tabs are butted, separated by 1px rules, never gaps: `#001a5e` on the bar, `#110a4a` on the
  plate, the ground `#111214` on a panel. Every tab is 44px tall; a section's tabs are 36px on the desk.
- Panels sit 8px apart and align to the top (no stretched empty panels).
- In Windows' high-contrast mode the browser drops every bevel (it removes `box-shadow`), so each
  section and the top bar get a 1px system-colour border there instead.
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
- **A placeholder**: a cell for data not held yet (stars, fixture difficulty) keeps its place and
  size, drawn as a 1px muted (`#a1a5ab`) outline with nothing in it; its `title` and label say what
  will show there ("Role fit: not rated yet"). Never a made-up figure (Craig, 1 Nov 2026:
  "placeholders, always placeholders, dont design a page with missing info when info is to come").
- **The pitch**: portrait, a real pitch's 68 m wide by 105 m long, attack at the top, its markings
  to scale: penalty area 40.32 × 16.5 m, goal area 18.32 × 5.5 m, penalty spot 11 m out (its dot drawn bigger, to show), the D
  9.15 m from the spot, centre circle 9.15 m round, the halfway line and 1 m corner arcs. The
  measurements live once, in `src/myTeam/tactics/pitch/pitchMarkings.ts`. Flat: one stripe to each of
  its six rows, which share its length equally so each line of players stands where it would; no
  gradients or photo grass. It is the Tactics tab's centrepiece (Decided).
- **A role's run** (spec/05 Runs): a 2px dashed white line from the player's place with a solid
  white arrowhead, drawn under the players' blocks so it never covers a name. Its shape is the
  role's, in metres (`convex/lineup/roles.ts`); `src/myTeam/tactics/pitch/RoleRuns.tsx` only draws it.
- **Where a picked-up player can go** (spec/05, Moving players): a free cell he may move to is a
  2px dashed box in the pitch line's colour; a player he may swap with gets the same dashes round
  his block, and in the squad table his Move reads Swap. A slot a preset asks to fill is quieter,
  1px dotted, so it never reads as a place to tap.
- **The sweeper** (spec/05, The pitch): his cell drawn an eighth of a row deeper than the
  defence's line, and over the keeper's where the two meet on a phone.
- **A lost player** (#323): a squad row whose player the football data no longer holds says so in
  orange in place of his name, under a notice saying football data is missing.

## Controls

Craig chose "Wells" of three looks (22 Oct 2026), drawn as board "A · Wells" on
<https://claude.ai/artifact/LArQQrJt8SuAZzqedPhx4u>: CM's bevel turned inward. Built once each: the general
ones in `src/ui/` (`TickBox`, `Choice`), the rules screens' own in `src/rules/` (`SaveBar`, `NumberBox`).

- **Tick box**: a real checkbox drawn as a 22px well: name plate fill, the panel bevel flipped
  (`inset 0 2px 0 #050608`, `inset 0 -2px 0 #34363c`), a 1px `#caced4` rim like a box to type in
  (the rim is ours: the well alone is 1.2:1 on the panel), stepper fill under the pointer, and
  a white drawn tick (stroke 2.5, square caps) when on. Its row is 44px and toggles it anywhere;
  the words are white when on, `#caced4` when off.
- **Keys**, one of a few chosen (a rule's Points): butted 44px keys, 1px `#110a4a` rules between.
  The others are the plate with its bevel and `#caced4` text; the chosen one is pressed in:
  ground fill, the plate bevel flipped (`inset 0 2px 0 #110a4a`, `inset 0 -2px 0 #6a5fe0`), white
  600. A radio group, so the arrow keys move it.
- **Discard and Save**, on the rules screens: Discard is the secondary action, there only once
  something changed; Save is the action, and with nothing to save it is the action with nothing to
  do, in `#a1a5ab` text.
- **Undo**, on the Tactics tab, which saves each move itself (spec/05, Moving players): the
  secondary action, and with nothing to undo the action with nothing to do.
- **Hover**: the action's, the secondary action's and a key's hover look shows only where a pointer
  hovers (`@media (hover: hover)`): a phone keeps a tapped button "hovered", and Save stayed grey.
  A mouse resting on Save after a click still shows its hover, `#caced4`.

## Never

From the designer's review, the tells that make a screen look AI-made:

1. Rows of stat tiles, a card for every section, small tracked uppercase labels over big numbers.
2. Pills and tinted badges; a chip, where one is needed, is square and solid.
3. Indigo or slate grounds with lavender-grey text and a neon accent; gradient buttons.
4. `·` strings, floating rows, ★ typed as text, the same 16px gutter around everything.
5. Telling a manager what he already knows: the basics any fantasy manager knows (live points can change, every team meets every other), what a screen is for, or what a control does when its label says it. A state is a word or a mark ("Live", "Provisional"), never a sentence (Craig, 31 Oct 2026: "you treat users like a 2 year old"). Our own mechanics are another matter: a role's description, what it changes in scoring, what stars mean are wanted. "When I say don't explain the game, I mean the absolute basic things like 'this is a league, round robin'; explaining game mechanics is highly encouraged" (Craig, 31 Oct 2026).

## The phone (to draw when the phone design is grilled)

From the reviewer, for a 390px screen: a bottom bar of five (Team, Matchup, Table, Scouting, Mail
with its count); the deadline and Continue in a 48px bar at the top; every target 44px; the squad table
keeps the player column fixed and drops Club, Role and Role fit; Mail collapses to an "N unread"
bar above the pitch; the pitch's player blocks narrow to a fifth of its width. The app needs a viewport meta.

## Decided

- **Yellow is a figure only.** Continue is white, orange when the deadline is near, and the active
  tab is a cyan underline: the UX expert's call, which Craig handed them (16 Oct 2026).
- **Fixture difficulty** is a filled cell without a digit (Craig).
- **The approved squad table against these rules** (Craig, 1 Nov 2026). "R3·1 · Plate, chosen"
  draws digits in its difficulty cells, blue panel bodies and rows about 28px. The rules win on the
  first two: no digits ("remove digits"), the page stays neutral ("ok neutral is i guess"). The
  row height was left to a design call: 28px, Claude's, as 20px left no air around 13px figures,
  stars and a difficulty cell; FM27's tables run 26 to 33px.
- **Pitch, squad and Mail** stay side by side (Craig). The pitch is the Tactics tab's centrepiece
  (Craig, 31 Oct 2026: "The pitch is the centrepiece of my team. More than other sites since we
  need to visually show roles / adjust positions"): on the desk it is as tall as the window,
  so scrolled to, its whole length shows at once, and the squad beside it takes the rest; on the phone it fills the
  width, the squad under it.
- **Blue on neutral** (Craig, 23 Oct 2026). The app was "a lot of blue on blue"; Craig likes the
  blue and wants it as the primary colour, on the top bar. Of three takes, A1 ranked first in
  review and Craig said go ahead to its refined board, "A1 refined" on
  <https://claude.ai/artifact/RSU7FzEB9rB98QnM5mTqT6>: grey page and panels, blue bar and title
  plates, the plates a deeper blue than the bar. Why grey: the research on
  <https://claude.ai/artifact/2FXidXSXxa1ZqmTBsqapYq> found fantasy apps and design systems keep
  surfaces neutral and spend colour on meaning. The grey stays truly neutral, never slate (Never 3).
  Replaced in part by Look B (31 Oct 2026): the bar stayed this blue, but the plates went indigo,
  and the flat near-black page (`#08090b`) and solid panels (`#1c1d21`) became a textured page
  under see-through panels. The page stays neutral, never slate or indigo (Never 3).
- **Look B, CM material** (Craig, 31 Oct 2026): of three looks on
  <https://claude.ai/artifact/L6GHypfFTMfeZtdr7TqLft>, B, without its mown-stripe texture ("it just
  looks like a bug"): a drawn grain and a glow from the top behind see-through panels, indigo title
  plates, a heavy wide Archivo for titles and team names. Reopens Blue on neutral: the page is no
  longer flat near-black. Craig, the same day: CM 99/00 is old UI, so FM is the stronger reference
  from here on.
- **Links aren't underlined at rest** (Craig, 31 Oct 2026: "the constant underlines for hyperlinks
  looks terrible"): the underline shows under the pointer and with focus; only a link inside
  running text keeps one, which WCAG 1.4.1 needs (Colour roles: link).
- **Destructive confirms** (Craig, 31 Oct 2026): the yes on a confirm that deletes or removes is
  orange-edged, never Continue's white (#403): orange is the event colour, and a delete needs you to decide. It is the danger action (Colour roles), built once
  in `src/ui/Confirm.tsx`.
