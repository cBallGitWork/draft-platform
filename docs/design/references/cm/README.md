# Championship Manager — the reference library

**This folder is the work base.** `docs/rules/DESIGN.md` §2 and the 29 Aug handover both say
the CM reference was "studied from the game's own screenshots… not from memory of
it" — and then nobody committed the screenshots. Every session since has been
building from a prose summary of pixels it could not see, which is how a bevel
gets bolted to a modern layout and the result "looks nothing like CM".

**No CM claim in a commit message, a doc or a code comment may cite memory. It
cites a numbered shot in here.**

`fetch.sh` re-downloads the set and records exactly how. Two things that cost an
afternoon each: `.jpg` is full size and `.png` under the same prefix is a
thumbnail, and a `Referer` header naming the game page is required — without it
the CDN serves a 404 body with a 404 status.

| Folder | Release | Shots |
|---|---|---|
| `cm9900/` | **Season 99/00 — the binding reference** | 21 |
| `cm3/` | Championship Manager 3 — the same engine generation | 8 |
| `cm0102/` | Season 01/02 | 12 |
| `cm0001/` | Season 00/01 | 1 |

## Measured geometry

Everything below was measured off the pixels (`cm9900/12.jpg` and `21.jpg`), not
judged by eye.

| Thing | Measured |
|---|---|
| Canvas | **800 × 600** — *not* 640×480, which earlier density arithmetic assumed |
| Sidebar width | **90px — 11.25% of the canvas** |
| Title bar | ~60px tall, full content width, bold white, centred |
| Tab strip | ~36px tall, tabs butted with no gap |
| **Table row pitch** | **~18px** — about 30 rows to a screen |
| Column-head strip | ~16px, bevelled, one continuous run |

At our 800px-equivalent widths that 18px row is why CM reads as dense and a
44px row does not. It is also why the desk target is 28px and not 44 — see
`docs/rules/PRODUCT.md`'s tap floor, which is ours and not CM's.

## Measured palette

Sampled from the images. Ratios computed against CM's own row ground `#4c4944`.

**A NAME IS WHITE.** This table said cyan was a "person link" and cited
`12.jpg` and `21.jpg` names for it, and it was wrong — wrong in the one row that
had been driving colour decisions in the app. Re-read off the images on 3 Sep
2026 (Craig: *"looking at cm, text is white for all"*):

- `12.jpg` — every name in the Everton squad is white. The cyan is the
  **Position** column (`D/DM LC`, `AM/F C`) and the **Inf** column's repeated
  "Fitness", plus the manager's own name in the rail.
- `21.jpg` — ten of eleven names are white; one is cyan, and it is the
  highlighted row rather than a person being a person.
- `16.jpg` — every name white, unavailable ones grey, and the **ratings** column
  cyan down both sides.

So cyan marks **a reading the game DERIVED** — a rating, a condition, a
position — against white for a recorded fact and grey for a man who is not
available. One cyan name per screen is the selection, which is a state and not
a category.


| Role | CM's value | Ratio | Where |
|---|---|---|---|
| Title bar | `#0030a6` royal blue | 10.64 vs its white title | `12.jpg`, `23.jpg` |
| Active tab | `#ffff03` pure yellow, text **and** border | — | `05.jpg`, `16.jpg`, `21.jpg` |
| Index cell | `#1f13a7` deep blue block | 10.75 vs its white number | `12.jpg`, `21.jpg`, `23.jpg` |
| Button / column-head plate | light grey, highlight edge `#fbf9fc` | **7.34** off the ground | `12.jpg` |
| Derived reading | `#6bfdfa` cyan | 7.28 | `16.jpg` ratings, `12.jpg` Position, `21.jpg` Cond. |
| Stat figure | `#faff00` **yellow** | 8.26 | `21.jpg` stat columns |
| Unavailable | `#7d8e6c` grey | **2.54** | `16.jpg`, `21.jpg` non-playing subs |
| `Inj` box | red fill, white text | — | `12.jpg` (Billic) |
| `Fut` box | yellow fill, dark text | — | `12.jpg` (Degn, Farrelly) |
| Money / value column | white on a purple-magenta **ground** | — | `12.jpg` Value, `23.jpg` fee |

## Three corrections to `docs/record/HANDOVER.md` §3

The prose summary was written from these same shots and got three things wrong.
This is the whole argument for committing the pictures.

1. **"Orange stat figures" — the figures are YELLOW, `#faff00`.** Measured across
   the stats table in `21.jpg`. Orange does exist, but it means an **event or a
   change**, not a figure: `on 71` and `Inj 7` in `16.jpg`, `to Lazio` in
   `23.jpg`. Two different jobs the summary merged into one.
2. **"Match header: home on a blue panel, away on red" — the panels are the two
   CLUBS' OWN COLOURS.** `21.jpg` is Everton blue `#073cc6` against Arsenal red
   `#fd0019`; `16.jpg` is the same Everton blue against Torquay **white**. This is
   a much better rule and it maps straight onto the `clubColours` we already hold.
3. **The canvas is 800×600**, not the 640×480 the density arithmetic assumed.

## Two things CM did that we deliberately will not

- ~~**The darkened match photograph behind every screen.**~~ **Reversed 31 Aug
  2026** — it ships, at full strength. `09.jpg` was the whole case for dropping
  it and `09.jpg` is a screen of bare prose over a goalmouth; every DENSE screen
  in this library puts its words on a plate or inside a translucent panel and
  lets the photograph show between them (`24.jpg`, `12.jpg`, `21.jpg`). The
  reading was right about the pixels and wrong about the rule they demonstrate.
  `tools/ui/groundfit.mjs` measures ours.
- **Greying a man out to 2.54:1.** CM put unavailable players below any modern
  floor. Ours grey to `--color-faint`, which is 5.34:1 on our ground — the same
  signal, above `docs/rules/PRODUCT.md`'s AA floor.

## What the screenshots settle about structure

- The **left rail is permanent chrome**, ~11% of the width, carrying the date in
  yellow, arrow steppers, the manager's name in cyan, and section links in white.
- A screen is a **title bar, a tab strip, one or more bevelled panels, and a
  button row at the foot** — not a scrolling column of headings.
- The column-head strip is **one continuous bevelled run**, not separated buttons.
- Rows sit **straight on the ground**: no card, no zebra, no gap. The only
  repeating fill is the **index cell** down the left.

## Index

All 42 have been read. The table below is the 36 indexed by the cataloguing pass;
the six read by hand are detailed under it. Twelve carry a dense data table, and
those are the ones to build from.

| Shot | Screen | Dense table | Column heads read off the image |
|---|---|---|---|
| `cm0001/01.jpg` | Setup Game main menu |  | — |
| `cm0102/01.jpg` | Setup Game main menu |  | — |
| `cm0102/02.jpg` | Live match - Match Overview |  | — |
| `cm0102/03.jpg` | Game Settings modal dialog |  | — |
| `cm0102/04.jpg` | Setup Game main menu |  | — |
| `cm0102/05.jpg` | Save Game Info modal dialog |  | — |
| `cm0102/06.jpg` | Enter Name - manager details form |  | — |
| `cm0102/07.jpg` | Club squad list | **✔** | Position(s) |
| `cm0102/08.jpg` | Player profile - attributes | **✔** | Apps, Con, Asts, MoM, Pass, Tck, Drb, Sh Tar, Av R |
| `cm0102/09.jpg` | Player news inbox |  | — |
| `cm0102/10.jpg` | News inbox with Game Options menu |  | — |
| `cm0102/11.jpg` | News inbox - transfer bid item |  | — |
| `cm0102/12.jpg` | Save game file dialog |  | — |
| `cm3/01.jpg` | Setup Game main menu |  | — |
| `cm3/02.jpg` | Select League(s) — nation picker | **✔** | none drawn — the table has no header row; the three unlabelled columns are nation name, then a SELECTED cell, … |
| `cm3/03.jpg` | Manager news inbox — article reader |  | news list is 2 columns, unheaded: date/time cell, then headline |
| `cm3/04.jpg` | Club squad list - Position(s) view | **✔** | Green slot header row: GK, DL, DR, DC, DC, ML, MR, MC, MC, FC, FC, SB1, SB2, SB3, SB4, SB5 (plus 3 unlabelled … |
| `cm3/05.jpg` | In-match Match Overview - commentary |  | — |
| `cm3/06.jpg` | In-match Player Ratings - both teams | **✔** | No printed headers. Three unlabelled columns per team: squad number (on a blue ground), player name, rating |
| `cm3/07.jpg` | Tactics — formation and pitch |  | — |
| `cm3/08.jpg` | In-match player stats table | **✔** | Pas, Cmp, Key, Tck, Won, Key, Hea, Won, Key, Ast, Sho, On, Con, plus one unlabelled rating column at the far r… |
| `cm9900/01.jpg` | Setup Game main menu |  | — |
| `cm9900/02.jpg` | Match report - player ratings | **✔** | none drawn - the list has no header row; columns are positional (squad no. / card / name / sub note / rating /… |
| `cm9900/03.jpg` | Game Settings modal dialog |  | — |
| `cm9900/04.jpg` | Select Team (club picker) | **✔** | — |
| `cm9900/06.jpg` | Club screen - Finances & Info |  | — |
| `cm9900/08.jpg` | Manager news inbox |  | Date/time (unlabelled), Headline (unlabelled) |
| `cm9900/10.jpg` | Club squad list | **✔** | GK, DL, DR, DC, DC, ML, MR, MC, MC, FC, FC, SB1, SB2, SB3, SB4, SB5, SB6, SB7, SB8, SB9 (position/selection sl… |
| `cm9900/11.jpg` | Player profile - attributes | **✔** | Apps, Gls, Con, Pens, Asts, Yel, Red, MoM, Av R |
| `cm9900/13.jpg` | Transfer bid dialog |  | — |
| `cm9900/14.jpg` | Set Role At Club dialog |  | — |
| `cm9900/15.jpg` | Offer Contract - Basic terms |  | — |
| `cm9900/19.jpg` | Tactics - team formation | **✔** | (none drawn - unheaded 3-column list: shirt number / player name / condition %) |
| `cm9900/22.jpg` | Match Stats (in-match) |  | — |
| `cm9900/24.jpg` | League table - English Premier Division | **✔** | Pld, Won, Drn, Lst, For, Ag, Pts |
| `cm9900/25.jpg` | Squad list - Everton |  | — |

### Sent by Craig — `craig/`

The shots Craig sends mid-build, kept because *"record the screenshots ive
attached and keep comparing"* (5 Sep 2026) makes them the thing to check against
rather than a passing note. Provenance is as given: they are Championship
Manager, and which release is not always pinned. Filed by the date they arrived
rather than by game.

| Shot | Screen | What it settles |
|---|---|---|
| `craig/01-evening-results.jpg` | **Evening Results** — six scorelines over a stadium photograph | The RESULTS ROW, which the app had four spellings of. See below. |
| `craig/02-news.jpg` | **Mike Paul News** — the manager's inbox | The NEWS SCREEN, which the app had none of, and the blue FOOT ROW on a phone. See below. |

#### `02-news.jpg`, read — 5 Sep 2026

CM's news inbox, and the shot that settled two separate things.

**The screen.** A white title bar reading `Mike Paul News` — the MANAGER's news,
not the club's — then a four-plate tab strip `All · Messages · Competitions ·
Injuries and Bans`. Under it a dated list: a blue date block down the left, the
headline beside it, one row filled RED because it is the one being read. Below
the list, the open item's headline centred in yellow and its body in white under
that. A `Filter :` control and a `Next Unread` button sit between the two. The
foot row is `Contracts and Media · Transfers · Jobs · Records`.

| What it settles | Where it went |
|---|---|
| An inbox is CM's first screen and this app had none | `/news` — its OWN section, because CM's rail entry for it is the manager's name | 
| The tabs are the game's own four words | `TABS` in that page — business is a MESSAGE, a round is a COMPETITION |
| The blue block here carries a DATE | which is the third thing that block carries, after a league position and a minute |
| **The selected row is filled red** — and a second row is important without being selected | two marks, not one: a fill for "you are reading this", red INK for "this is bad news about you" |
| **The foot row is filled royal blue** | the phone's navigation from 5 to 23 Sep 2026; since then the phone wears the rail along its foot (`shell/ThumbRail`), because a tab bar goes where you can go from anywhere |

**The one thing in the shot we do not copy**: it sets the open headline and its
body straight onto the photograph. DESIGN §2 forbids that and `groundfit`
measures it, so ours are inside a panel.

#### `01-evening-results.jpg`, measured — 5 Sep 2026

920 x 562. Sampled off the pixels, not judged by eye; the working is in the
session that built `components/shell/ScoreRow.tsx`.

| Thing | Measured | What it means for us |
|---|---|---|
| Index block | `#02068d`, **x 27-76 (50px)** left and **860-910 (51px)** right | **One at EACH end of the row**, not just the left. This shot's block holds a NATION; ours holds the side's **league position**, which is what `24.jpg` puts in the same block (`1st`, `2nd`) and what Craig asked for on 5 Sep. A club's crest sits beside the name instead; a Fantrax team has none |
| The blue is **continuous** | unbroken from y=116 to y=290 at x=30 | Six rows, **no gap between one block and the next**. A column of them is a spine; 2px of row padding between them makes it a stack of chips |
| Row pitch | **29.2px** of a 562px shot | |
| Team name | `#f3f8fc` **white**, mixed case, LEFT in its own column | Not right-aligned against the score. Every home name starts at the same x, every away name starts at the same x — it is a GRID |
| Score | `#befafc` **cyan**, separated by a **colon** | `1:3`, never `1-3`. Cyan is DESIGN §3's derived-reading slot and this is what the game spends it on |
| Yours | `#ffff03` **yellow on the NAME** (Man City, one of six) | The accent slot, unchanged. The score stays cyan on your own row |
| Panel edge | photograph `#252c1c` runs straight into plate `#434c51` — **no lighter pixel on the boundary** | **CM does not bevel this panel.** `.cm-panel` drew a sunken bevel and Craig asked for it to go; `cm9900/24.jpg`'s League Table agrees. Every bevel in the library is on a CONTROL |
| Title plate | yellow caption on a grey-blue plate | The `Caption` treatment we already have, and the same one `24.jpg` uses for "League Table" |

### The six read first, in more detail

| Shot | Why it matters |
|---|---|
| `cm9900/12.jpg` | **The reference table.** Bevelled heads, blue index cells, **white names**, a cyan Position column, yellow figures, red `Inj`, yellow `Fut`, purple value column |
| `cm9900/21.jpg` | **The densest table in the set** — 13 abbreviated stat columns, club-coloured header panels |
| `cm9900/16.jpg` | Player ratings — greyed non-playing subs, cyan ratings, yellow card boxes |
| `cm9900/23.jpg` | Transfers — blue date index, yellow clubs, orange destinations, purple fee column |
| `cm9900/05.jpg` | News — tab strip, selected row on a red ground |
| `cm9900/09.jpg` | Meet with Board — the clearest look at the rail, and at why the photograph had to go |

## The screens, catalogued — 31 Aug 2026

Six of the twenty-one had never been opened. What follows is what they show, and
most of it is unbuilt.

| Shot | Screen | What it has that we do not |
|---|---|---|
| `25.jpg` | **Everton — Squad** | **Two columns of players side by side**, so a whole squad is one screen with no scroll. A slot plate down the left of each name carrying his POSITION (`GK` `DR` `DC` `SB5`) rather than a row number. A strip of every slot above the list with the unfilled ones greyed and a problem one in red. Eligibility strings in yellow beside each name. |
| `24.jpg` | **English Premier Division — Table** | The index cell is an **ordinal** — `1st` `2nd` — not a bare number. Your own club in yellow. **A dashed yellow rule under the cut line.** A yellow centred caption INSIDE the panel. A second foot row of related screens above the Back/Next pair. |
| `13.jpg` | Transfer bid | A form whose unavailable rows are **greyed out** — the third sighting of the treatment `.cm-out` was written for and never wired. Foot buttons named for the action (`Offer`), never `Submit`. |
| `14.jpg` | Set Role At Club | The photograph at close to full strength behind white and yellow prose. |
| `19.jpg` | Everton Tactics | The list and the pitch **side by side**, and the pitch a flat diagram of numbered discs. Reserves greyed in the list. Formation in yellow above it. |
| `22.jpg` | Match Stats | **A comparison table**: one centred column of labels with each side's figure in a blue index block left and right. The label takes its category's own colour — yellow for Yellow Cards, red for Red. |

**Two things every one of them has and we have on none.**

A **yellow centred caption inside the panel** — "League Table", "Position(s)",
"Achievements", "Everton transfer bid for McSheffrey". The blue title bar names
the SCREEN; this names what is in the panel. We have the first and not the
second.

A **second foot row**: related screens (`Tactics ▸ Training ▸ Last Match ▸ 6th in
PRM ▸ History ▸`) above the Back/Next pair. Ours has the pair and not the row.

## The rail is master buttons plus context buttons

Craig, 31 Aug, and the shots settle it. The master set is constant — `Continue
Game`, the manager's own name in cyan, `Competitions`, `Nations & Clubs`, `Find`,
`Game Options` (`12.jpg`, `19.jpg`, `24.jpg`, `25.jpg`). During a match it is
**replaced**, not extended: `Continue Game`, `Everton Tactics`, `Arsenal
Tactics`, `Commentary Speed` (`21.jpg`), or `Everton Tactics`, `Torquay
Tactics`, `Commentary Speed` (`16.jpg`).

So a rail entry is not always a section. Ours is sections and nothing else;
CM's is "where you can go from anywhere" over "what this screen can do".

One of theirs we do now keep, and it is the second entry: CM's rail names the
MANAGER between `Continue Game` and `Competitions`, so the thing you run sits
above the competitions and every other club is reached through them. `My Team`
is that slot (21 Sep 2026) — the ten squads reached through the league were the
redundancy Craig removed on 2 Sep, and your own was never one of the ten.

## The title bar has two treatments

Blue with a white title on a club or a person (`12.jpg`, `13.jpg`, `25.jpg`), and
**white with a blue title on a competition** (`24.jpg`), which also carries a
`Print ▾` control at its right end. We drew the first and assumed it was the
only one.

## Both galleries are exhausted, and a second source exists

myabandonware serves 21 for 99/00, 8 for CM3, 12 for 01/02 and 1 for 00/01.
Numbers 7, 17, 18, 20 and everything past 25 return 404 — probed 31 Aug, so do
not probe again.

`gamefabrique.com/screenshots/pc/championship-manager-season-99-00-NN.jpg`
(01–17, no Referer needed) is a second set, and it carries the one screen the
full-size library does not: **the attribute grid** — three columns of
`label · 1–20 rating`, tabbed `Profile | Injuries & Bans | Contract | Transfer |
History`, over a small appearances table. They are 344px thumbnails, so they are
good for identifying a screen and useless for measuring one. Not committed for
that reason; `fetch.sh` records the URL.
