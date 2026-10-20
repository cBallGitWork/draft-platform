# Where positions come from

How #22 works out each player's positions ([spec/06](../spec/06-positions.md)), and what the
Premier League's data decided along the way. Read from Craig's Mac on 20 Oct 2026: both seasons'
fixture lists, all 900 team sheets of the 450 matches played, and both seasons' squads.

**Contents:** [The seam](#the-seam) · [The team sheets](#the-team-sheets) ·
[The formation table](#the-formation-table) · [The labels](#the-labels) ·
[Held, and read](#held-and-read) · [The sync](#the-sync)

## The seam

`positionsOf` in `convex/positions.ts`: his starts, his Premier League label, the admin's say and
the approve mode in; each position with its source (starts, label, admin) and whether it is
confirmed out, with his proposals (what his starts give that the admin has not approved).

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
- Every 2025/26 sheet labelled 4-5-1 (six) draws a 4-3-2-1 with wingers as its two (Bowen and
  Summerville, Murphy and Barnes). The label is kept, and has its own row.
- Manchester City's sheet at Coventry (fixture 128950, 5 Sep 2026) draws Enzo Fernández, listed on
  the bench, and not Nico O'Reilly, listed as starting. That match is refused: never filed, read
  again every run and named in the run's `matchesRefused` until the feed corrects it.

## The formation table

`FORMATION_PLACES` in `convex/positionTables.ts`, 19 formations, every one seen. Spec/06 fixes
two rows (a 4-2-3-1's two deepest are CDM, a 4-3-3's three are CM); the rest follow one rule
(wide in a back four FB, in a back five or beside a back three WB, in a flat midfield WM, ahead
of midfield W). Where the rule left a choice, the labels of the men who started there decided:

- A 3-4-2-1's two behind the striker are W: mostly wingers (Pino 27, Sarr 22, Mbeumo 16).
- A 4-3-2-1's and a 4-2-2-2's two are CAM: mostly attacking midfielders.
- The middle of a 3-5-2's and a 3-5-1-1's five is CDM: centre-backs and holding midfielders.
- A 4-1-4-1's and a 5-4-1's wide men are WM by the rule, though most were wingers (Doku,
  Semenyo): a winger who also plays a 4-3-3 or a 4-2-3-1 gets W from those.

A formation not in the table gives nothing and is reported (`unknownFormations`), never guessed.

## The labels

`labelPositions`: a label is sides then a role ("Left/Right Full Back"). The sides are dropped,
except for an attacking midfielder: CAM in the centre, W out wide, both with no side named. Clear
roles map straight across; the three vague ones give every position they could mean: Defender
CB FB (spec/06), Midfielder CDM CM WM CAM, Forward W SS ST. All 54 labels seen are pinned in
`convex/positionTables.test.ts`; an unseen one gives nothing and is reported (`unknownLabels`).

This season's squads leave some men out (Romero, Vicario and Spence at Spurs), so a man's label
is his squad's, else the newest sheet's that names him.

## Held, and read

`playerPositions`, one row per player keyed on FPL's `code`, apart from `players` so the
six-hourly football sync never touches it: his newest 38 starts and his label, from the feeds,
and the admin's approvals and corrections, written only by his functions. `positionsOf` runs on
every read (`playerPositions:ofPlayer`), so neither a change of approve mode nor a corrected
table needs a recount. `positionSettings` holds the approve mode; `positionSheets` each match filed.

The admin's functions are internal until sign-in (#20); the screen is #87:
`approvePlayer`, `approveClub`, `setPosition` (SS is set this way), `removePosition` and
`setApproveMode`, in `convex/playerPositions.ts`.

## The sync

`npx convex run positionsSync:run '{"trigger":"manual"}'`, then `positionsSync:latest`. It reads
FPL's players (the join), both seasons' fixture lists, the sheets of up to 150 played matches not
yet read, oldest first and one at a time, and this season's twenty squads. Every run is a row in
`positionsSyncs`; a failed read fails the run, keeping the matches filed before it. The first run
after deploy leaves 300 matches for two more. Nothing schedules it yet: once a day would do, since positions change only between
gameweeks (spec/06), and a matchday's sheets are final by the next morning.
