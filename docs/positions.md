# Where positions come from

How #22 works out each player's positions ([spec/06](../spec/06-positions.md)), and what the
Premier League's data decided along the way. Read from Craig's Mac on 20 Oct 2026: both seasons'
fixture lists, all 900 team sheets of the 450 matches played, and both seasons' squads.

**Contents:** [The seam](#the-seam) · [The team sheets](#the-team-sheets) ·
[The formation table](#the-formation-table) · [The labels](#the-labels) ·
[When positions change](#when-positions-change) · [Held, and read](#held-and-read) · [The sync](#the-sync)

## The seam

`positionsOf` in `convex/positions/positions.ts`: his starts, his Premier League label, the admin's say,
the approve mode, the change thresholds and the gameweek boundary in; each position with its
source (starts, label, admin), whether it is confirmed and whether it is flagged out, with his
proposals (what his starts give that the admin has not approved) and the positions a run elsewhere
removed.

- His newest 38 starts count, last season's and this; 3 at a place give its position. A
  substitute's appearance is never a start.
- At first (`proposals`) a position from starts counts once the admin approves it. In
  `countAtOnce` it counts at once, unconfirmed, and waits in his queue until approved.
- With no start-position counting he plays on his label, unconfirmed until the admin approves him
  (which confirms that label while it stays the same).
- A position the admin sets stays until he removes it, support striker included. One he removes
  stays off, whatever starts or the label say, until he sets it again.

## The team sheets

- The formation table is keyed on the sheet's label and drawn as the sheet draws it, so
  `formation_place` is not read: a start's line and place say where he played.
- Every 2025/26 sheet labelled 4-5-1 (six) draws a 4-3-2-1, its two the wide men of the five.
  The label is kept, and has its own row.
- Manchester City's sheet at Coventry (fixture 128950, 5 Sep 2026) draws Enzo Fernández, listed on
  the bench, and not Nico O'Reilly, listed as starting. That match is refused: never filed, read
  again every run and named in the run's `matchesRefused` until the feed corrects it.

## The formation table

`FORMATION_PLACES` in `convex/positions/positionTables.ts`, 19 formations, every one seen; the rule they
follow is the comment above it. Where the rule left a choice, the labels of the men who started
there decided:

- A 3-4-2-1's two behind the striker are W: more wingers than anything else, 115 of 240 men
  (Pino 27 starts there, Sarr 22, Mbeumo 16), with 50 attacking midfielders and 38 strikers.
- A 4-5-1's two are W: of the six sheets' twelve men, six wingers and four forwards (Bowen twice,
  Bakwa, Hutchinson); one sheet put a full back and an attacking midfielder there (Bogle,
  Aaronson).
- A 4-3-2-1's two are CAM: 12 of its 18 men were attacking midfielders (Cherki 7), the rest wingers.
- A 4-2-2-2's two are CAM, which the labels do not settle: of 14 men on 7 sheets, 4 wingers, 5
  midfielders, 2 attacking midfielders, 2 full backs and a striker. CAM or W is Craig's call.
- The middle of a 3-5-2's and a 3-5-1-1's five is CDM: centre-backs and holding midfielders.
- A 4-1-4-1's and a 5-4-1's wide men are WM by the rule, though most were wingers (Doku,
  Semenyo): a winger who also plays a 4-3-3 or a 4-2-3-1 gets W from those.

A formation not in the table gives nothing and is reported (`unknownFormations`), never guessed.

## The labels

`labelPositions`: a label is sides then a role ("Left/Right Full Back"). The sides are dropped,
except for an attacking midfielder: CAM in the centre, W out wide, both with no side named. Clear
roles map straight across; the three vague ones give every position they could mean: Defender
CB FB (spec/06), Midfielder CDM CM WM CAM, Forward W SS ST. All 54 labels seen are pinned in
`tests/convex/positions/positionTables.test.ts`; an unseen one gives nothing and is reported (`unknownLabels`).

This season's squads leave some men out (Romero, Vicario and Spence at Spurs), so a man's label
is his squad's, else the newest sheet's that names him.

## When positions change

`startsElsewhere` in `convex/positions/positionChanges.ts` (spec/06, When positions change): for each
position his starts give him, how many of his newest starts in a row were at a place that gives
another. At the admin's `flagAfter` (3 until he tunes it) it is flagged; at `removeAfter` (6) it no
longer counts, nor is it proposed.

- Only positions from starts, approved ones included. One the admin set stays until he removes
  it, and a label's positions are not from starts. With every position from his starts removed he
  plays on his label, as a man with too few starts does.
- A start that gives no position (a sheet that drew none, a formation the table doesn't know)
  neither adds to a run nor ends it. One start back at a position ends its run, and a removed one
  counts again while his window still holds 3 starts there.
- Only between gameweeks: a start is judged once a gameweek deadline after it has passed, so the
  starts judged are those before the last FPL deadline the newest positions sync ran after
  (`judgedBefore` in `positionSettings.ts`). A query can't read the clock, and every start held was
  played before that run, so a sync within a gameweek moves nothing. Before any sync, or before
  the season's first deadline, every start is judged. Gaining a position is not held back this way.
- Nothing is refused for it: losing a position never makes a squad illegal (spec/06).

## Held, and read

`playerPositions`, one row per player keyed on FPL's `code`, apart from `players` so the
six-hourly football sync never touches it: his newest 38 starts and his label, from the feeds,
and the admin's approvals and corrections, written only by his functions. `positionsOf` runs on
every read (`positions/playerPositions:ofPlayer`), so neither a change of approve mode nor a corrected
table needs a recount. `positionSettings` holds the approve mode and the thresholds, each absent until he sets it;
`positionSheets` each match filed.

The admin's functions, his alone by his email on the server (#124): `queue` (new signings, the
men whose starts wait for him, and positions flagged or removed), `ofPlayer`, `find`,
`approvePlayer`, `approveClub`, `setPosition` (SS is set this way) and `removePosition`, in
`convex/positions/playerPositions.ts`; `setApproveMode` and `setChangeThresholds` (whole numbers,
flagging after 1 or more, removing after more than that and at most 38; refused with why
otherwise) in `convex/positions/positionSettings.ts`. The dashboard's screen is built.

## The sync

`npx convex run positions/positionsSync:run '{"trigger":"manual"}'`, then `positions/positionsSync:latest`. It reads
FPL's players (the join), both seasons' fixture lists, the sheets of up to 150 played matches not
yet read, oldest first and one at a time, and this season's twenty squads. Every run is a row in
`positionsSyncs`; a failed read fails the run, keeping the matches filed before it. The first run
after deploy leaves 300 matches for two more. Nothing schedules it yet: once a day would do, since positions change only between
gameweeks (spec/06), and a matchday's sheets are final by the next morning.
