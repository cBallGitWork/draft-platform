# Plate: the look

The values behind [spec/12-screens.md](../../spec/12-screens.md). Craig chose the look; the
values are Claude's, from the designer's round-2 brief and the reviewer's pass on R3·1
(16 Oct 2026). Every screen is drawn from this file. The approved pictures in
[approved/](approved/README.md) bind now, drawn on the "Draft Manager screens" canvas
<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>; the old reference mock-up, R3·1, is history
([decisions.md](decisions.md)).
How the screens link, and which the spec names but nobody has built: [flow.md](flow.md).
The design system artifact, <https://claude.ai/artifact/KnbhQ7oEyXakwqFsEbGk8e>, copies these
values and `src/styles.css` for Claude Design; this file and styles.css are the source, and the
`/design` skill re-syncs it when either changes (`.claude/skills/design/SKILL.md`, step 7).
Where a screen has an approved picture, the picture settles its
layout (what sits where, the columns, the rows) and this file its values (colours, type, spacing);
where the two disagree, ask Craig.

Each value lives once, in `src/styles.css`: this file names its token (`--color-…`), never its hex,
and a test holds every token named here to one styles.css defines. A value marked "not yet a
token" has none, because nothing built draws it yet. Superseded decisions and their dates are in
[decisions.md](decisions.md).

**Contents:** [Colour roles](#colour-roles-cm-material) · [Type](#type) · [Shape](#shape) ·
[Marks](#marks) · [Controls](#controls) · [Never](#never) ·
[The phone](#the-phone-to-draw-when-the-phone-design-is-grilled) · [Decided](#decided) ·
[Tables and panels](#tables-and-panels-craig-1-nov-2026)

## Colour roles (CM material)

CM's blue is the chrome: the top bar royal blue, title plates, date blocks and controls indigo. The
page is near-neutral dark under a drawn texture, a fine grain and a faint floodlit glow from the top,
and the panels are see-through over it, so the indigo and the meaning colours stand out and the page
isn't flat (Craig, 31 Oct 2026; see Decided: Look B).

| Role | Token | Used for |
|---|---|---|
| ground | `--color-ground`, under a fine grain (white at 5%, `--ground-grain`) and a glow from the top (`--ground-glow`) fading out by 70% of an ellipse 90% wide and 60% tall; at its lightest, the glow's brightest point with the grain counted, the page measures `#282e2d` (a reading, not a token) | the page. Drawn in CSS, never a photograph |
| panel | `--color-panel`, see-through over the page; `--color-panel-solid` where it opens over the page (the top bar's league list) | a panel's body |
| bar | `--color-bar` | the top bar |
| plate | `--color-plate` | a panel's title plate, date blocks, keys |
| stepper | `--color-stepper` | the `◄ GW9 ►` gameweek stepper; a control on the plate under the pointer, and a toggle on the bar while its list is open (the top bar's league) |
| name plate | `--color-name-plate` | under a player's name on the pitch, a tick box's well |
| alert | `--color-alert` | the alert strip, under its orange edge |
| column head | `--color-head`, ink `--color-ground` | one continuous plate over a table's columns |
| fact | `--color-fact` (white) | names, labels that are facts, a role |
| figure | `--color-figure` (yellow) | a number that is a figure: points, form, stars. Never a button or tab |
| derived reading | `--color-derived` (cyan) | something worked out: a countdown, a formation's preset name |
| event | `--color-event` (orange) | something that happened or needs you: a doubt, unread mail |
| muted / unavailable | `--color-muted` | secondary labels, the bench, read mail |
| role text | `--color-soft` | the role under a name on the pitch |
| pitch | stripes `--color-pitch` / `--color-pitch-stripe`, lines 2px `--color-pitch-line` | |
| action | fill `--color-fact`, ink `--color-ground`, bevel `--color-head` | Continue; hover `--color-soft`, pressed `--color-head` (bevel flipped); `--color-event` when the deadline is near, its hover `#ffb36b` and pressed `#e07f1f` not yet tokens (not built); with nothing to do, no fill, 1px `--color-muted` border, "Nothing needs you" |
| secondary action | fill `--color-plate`, 1px border `--color-soft`, ink `--color-fact` | hover fill `--color-stepper`, border `--color-fact`; pressed fill `--color-ground` |
| danger action | the secondary action's shape: fill `--color-alert`, 1px border `--color-event`, ink `--color-event` 600 | the yes on a confirm that deletes or removes (Delete it, Remove them, Leave); hover its edge doubled and ink `--color-fact`, never filled orange (that is Continue near the deadline); pressed fill `--color-ground`; busy, border and ink `--color-muted` |
| active tab | text `--color-fact` 600, 3px underline `--color-derived` (2px on a sub-tab) | inactive tabs `--color-soft`; never `--color-muted` on the bar (4.1:1) |
| focus | 2px outline `--color-derived`, offset 2px | every control |
| link | `--color-fact`, no underline at rest; a 1px `--color-derived` underline under the pointer (where a pointer hovers, as Controls' Hover) and with the focus ring | a link, and a button drawn as one (Move, Dismiss). A bare link inside a sentence of running text keeps a 1px `--color-fact` underline at rest, as nothing else tells it from the words around it (WCAG 1.4.1); none exists yet (Craig, 31 Oct 2026; see Decided) |

**Fixture difficulty** fills the whole cell, CM style, with no digit (Craig), so colour carries it on screen by choice; the labels below carry it for
screen readers. The fills fall in
lightness from easiest to hardest, so the order survives red-green colour blindness:
1 `#57e08a` ink `#04130a` · 2 `#93b83a` ink `#0c1a06` · 3 `#8a90a0` ink `#08090b` ·
4 `#c9304f` ink `#ffffff` · 5 `#8c1236` ink `#ffffff`, not yet tokens (no built screen fills a
difficulty cell yet). Each cell carries `title` and `aria-label`
("Opponent BOU, home, difficulty 2 of 5, easy"; the words: very easy, easy, average, hard, very
hard), with no legend (Craig, 1 Nov 2026: "remove difficulty key"), and rows keep a 1px ground
(`--color-ground`) gap.

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
26px. A table's rows are 28px on the desk (the 13px data on its 20px line, 4px above and below),
`--spacing-row` (`h-row`), and 44px on the phone wherever a row is tapped, `--spacing-tap` (see
Decided). Figures use tabular numerals, in Archivo Narrow even beside a team's
name (the score).

## Shape

- Radius 0 everywhere.
- CM's bevel, 2px: `inset 0 2px 0` light, `inset 0 -2px 0` dark, on title plates and the top bar.
  On the bar, light `--color-bar-edge` and dark `--color-bar-rule`; on the plate, light `--color-plate-edge` and dark `--color-plate-rule`;
  on a panel, light `--color-panel-edge` and dark `--color-name-plate`. The line above a section's tabs is 1px `--color-panel-edge`.
- Tabs are butted, separated by 1px rules, never gaps: `--color-bar-rule` on the bar, `--color-plate-rule` on the
  plate, `--color-panel-rule` (the ground) on a panel. Every tab is 44px tall; a section's tabs are 36px on the desk.
- Panels sit 8px apart and align to the top (no stretched empty panels).
- In Windows' high-contrast mode the browser drops every bevel (it removes `box-shadow`), so each
  section and the top bar get a 1px system-colour border there instead.
- The league sits in the top bar: on the desk inline after the product name, ruled off by 1px
  `--color-bar-rule`; on the phone its own 44px row under the name, Continue and Sign out, above the menu.
- Spacing steps: 4, 8, 12, 16.

## Marks

- **Shirts**: our own outline in the club's colours, the squad number on the chest.
- **Stars**: SVG, filled in the figure colour, empty ones as outlines in muted grey, the set
  labelled "Role fit 4 of 5".
- **A doubt**: the orange knock chip of the status chips (Tables and panels), on the name plate and
  after the name in a row, labelled "Doubt".
- **Unread**: a 3px orange bar down the letter's left edge, and "Unread" for screen readers.
- **The current one of a list**: a 3px bar down its left edge in the active tab's cyan, and
  `aria-current` for screen readers (the top bar's league list).
- **The bench**: its own "Bench" plate in the table, below the eleven.
- **Position chips**: a square solid chip with the position's code, in its area's colour, from
  the approved Tactics picture (`approved/team/`): goalkeeper `--color-area-goalkeeper` ink
  `--color-ground`, defence `--color-area-defence` ink `--color-fact`, defensive midfield
  `--color-area-defensive-midfield` ink `--color-fact`, midfield `--color-area-midfield` ink
  `--color-ground`, attacking midfield `--color-area-attacking-midfield` ink `--color-fact`, attack
  `--color-area-attack` ink `--color-ground` (12.2, 5.0, 6.0, 8.6, 5.6 and 7.9:1). A sweeper's SW
  and a wing-back's WB take the defence's, a support striker's SS the attacking midfield's. Built
  once, `src/ui/PositionChip.tsx`.
- **Form**: a team's last five results, W, L or D, each a square chip in the figure colour with
  the ground's ink (14.8:1), oldest first. Built once, `src/myTeam/header/FormChips.tsx`.
- **A placeholder**: a cell for data not held yet (stars, fixture difficulty) keeps its place and
  size, drawn as a 1px muted (`--color-muted`) outline with nothing in it; its `title` and label say what
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
  his block. A slot a preset asks to fill is quieter,
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
  (`--shadow-bevel-sunk`), a 1px `--color-soft` rim like a box to type in
  (the rim is ours: the well alone is 1.2:1 on the panel), stepper fill under the pointer, and
  a white drawn tick (stroke 2.5, square caps) when on. Its row is 44px and toggles it anywhere;
  the words are white when on, `--color-soft` when off.
- **Keys**, one of a few chosen (a rule's Points): butted 44px keys, 1px `--color-plate-rule` rules between.
  The others are the plate with its bevel and `--color-soft` text; the chosen one is pressed in:
  ground fill, the plate bevel flipped (`--shadow-bevel-plate-pressed`), white
  600. A radio group, so the arrow keys move it.
- **Discard and Save**, on the rules screens: Discard is the secondary action, there only once
  something changed; Save is the action, and with nothing to save it is the action with nothing to
  do, in `--color-muted` text.
- **Undo**, on the Tactics tab, which saves each move itself (spec/05, Moving players): the
  secondary action, and with nothing to undo the action with nothing to do.
- **Hover**: the action's, the secondary action's and a key's hover look shows only where a pointer
  hovers (`@media (hover: hover)`): a phone keeps a tapped button "hovered", and Save stayed grey.
  A mouse resting on Save after a click still shows its hover, `--color-soft`.

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
- **Fixture difficulty** is a filled cell without a digit (Craig; again 1 Nov 2026: "remove digits").
- **The page stays neutral**, the panels too, never blue bodies (Craig, 1 Nov 2026: "ok neutral is
  i guess"); never slate or indigo (Never 3).
- **A table's rows are 28px on the desk** (1 Nov 2026), a design call Craig left to Claude: 20px
  left no air around 13px figures, stars and a difficulty cell. The built tables still draw 20px
  rows; each follows (`--spacing-row`) when its screen is rebuilt to its approved picture.
- **Pitch, squad and Mail** stay side by side (Craig). The pitch is the Tactics tab's centrepiece
  (Craig, 31 Oct 2026: "The pitch is the centrepiece of my team. More than other sites since we
  need to visually show roles / adjust positions"): on the desk it is as tall as the window,
  so scrolled to, its whole length shows at once, and the squad beside it takes the rest; on the phone it fills the
  width, the squad under it.
- **Blue is the primary colour, on the top bar** (Craig, 23 Oct 2026); the surfaces stay neutral
  and colour is spent on meaning. Its history, Blue on neutral, is in [decisions.md](decisions.md).
- **Look B, CM material** (Craig, 31 Oct 2026): of three looks on
  <https://claude.ai/artifact/L6GHypfFTMfeZtdr7TqLft>, B, without its mown-stripe texture ("it just
  looks like a bug"): a drawn grain and a glow from the top behind see-through panels, indigo title
  plates, a heavy wide Archivo for titles and team names. Craig, the same day: CM 99/00 is old UI,
  so FM is the stronger reference from here on.
- **Links aren't underlined at rest** (Craig, 31 Oct 2026: "the constant underlines for hyperlinks
  looks terrible"): the underline shows under the pointer and with focus; only a link inside
  running text keeps one, which WCAG 1.4.1 needs (Colour roles: link).
- **Destructive confirms** (Craig, 31 Oct 2026): the yes on a confirm that deletes or removes is
  orange-edged, never Continue's white (#403): orange is the event colour, and a delete needs you to decide. It is the danger action (Colour roles), built once
  in `src/ui/Confirm.tsx`.

### Tables and panels (Craig, 1 Nov 2026)

Craig's corrections to the Tactics and Squad boards, 1 Nov 2026. They hold on every screen.

- **Roles in full, never initials.** No SHS, DFB, IF or N10 anywhere: "the initials for different
  roles......theres no standard....nobody knows what they are". A position chip (GK, CB, CDM, W,
  ST) is fine. `scripts/design/lint.mjs` fails a board that draws a role's initials.
- **No colour keys or legends**, for fixture difficulty, the pitch's lines or anything else:
  "remove difficulty key, thats 'people arent stupid' / same for lines too". The colours carry it;
  the labels for screen readers stay.
- **No action column in a table.** "wtf is the move column". What can be done to a player (move
  him, swap him) sits in the selected player's panel.
- **A table's columns run Pos, then Player with his club, far left**, and his opponent beside him:
  "names being in the middle, prob should be far left"; "position tab to left of player";
  "opponent too far away from player".
- **Wide or growing detail goes in the right-hand panel, never the table**: points per action, a
  stat breakdown. "points per action row takes up so much, and that can get bigger with more
  stats....thats what the column on the right is for".
- **A right-hand column of titled widgets**, as FM and Fantrax do: "like fm, the use of a secondary
  column/widget design is the play here i think". Each widget is a panel with its title plate;
  selecting a player puts his panel at the top of the column.
- **Status chips after the name**, CM style, square and solid (Never 2): a red cross injured, a
  yellow card one booking from a ban, a red card suspended, an orange knock. "could you a chip
  after the name (i like a CM like red/yellow cross/card for suspension etc)".
- **No position group rows** (Goalkeepers, Defenders) where the position chips already group the
  table: "the coloured chips do that work, removes clutter".
- **A formation preset says what it does**, beside its name: "presets should describe what it does".
