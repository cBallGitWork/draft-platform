# League home

Route: `/home`, the Overview tab, checked on `/home?preview=manager`, and on
`/home?preview=commissioner` for Run the league. The Calendar tab has no route yet: it is built in #2683.

**Contents:** [The pictures](#the-pictures) · [Approved](#approved) · [The News tab](#the-news-tab) ·
[The Calendar tab](#the-calendar-tab) · [The Football Manager idea](#the-football-manager-idea) · [Interaction notes](#interaction-notes) ·
[Placeholders](#placeholders) · [Canvas](#canvas)

## The pictures

- `1440.png`: the main board in a gameweek before its deadline, Overview open (Home E). Its
  layout binds: where each panel sits. What a placeholder panel holds (below) binds only once its
  grill settles it. Redrawn 16 Nov 2026 with Mail top left, opening on Needs you; its source is
  `SP1-HomeE.dc.html`.

The plan for later, each grilled when its feature is built. These show where each state's panels
go; they don't bind until that grill settles what they hold:

- `1440-after.png`: the Monday after, the gameweek final, with the result and the recap (Home E,
  After).
- `1440-locked.png`: lineups locked and matches live, with the Vidiprinter (Home E, Locked).
- `1440-break.png`: a break, every gameweek off and the league locked until the next (Home E,
  Break).
- `1440-pre-season.png`: pre-season, before and up to the draft (Home E, Pre).
- `1440-joiner.png`: a new joiner who took over a team, and the "before approval" panel (Home E,
  Joiner).
- `1440-season-over.png`: the season over, with the champions and the final table (Home E, Over).

- `1440-news.png`: the News tab, every team's moves (approved 8 Nov 2026, below).

## Approved

1 Nov 2026, Craig, "yes to all", answering:

- the main Home board;
- the pre-season, new joiner and season-over Home boards "as the plan for later";
- that Table stays in the top menu.

With it: "ditch team of the week", so Team of the Week is off Home (`spec/12`, League home).

16 Nov 2026, Craig, "Go ahead", on the main board redrawn for #2443 (what needs a manager this
week): no new panel; Mail moves to the top of the left column, under the deadline strip, and
opens on Needs you; a doubtful or out starter is a Needs you letter ("Saka is doubtful and
starts"), opening Tactics; claims waiting stay in the strip (`spec/12` S12.15, `spec/16` S16.7).

## The Calendar tab

`1440-calendar.png`, source `HomeCalendar.dc.html` (#2681): November, Monday first, six weeks, in
UK time. Each day holds what `spec/12` S12.24 lists: a gameweek's deadline (white, bold), the
waiver runs (muted), a break (`spec/13` S13.5-S13.9) as the alert fill with "Break" on its first
day and each Monday, "Break starts" at its edge and "Reopens, waivers" on the reopening; the draft
shows on its day (none in November). Today has the current-of-a-list cyan edge and
`aria-current="date"`; days gone and other months' days are dimmed.

18 Nov 2026, Craig, "Yes, approve it", with: the break keeps the orange ("Keep orange"),
gameweeks show only as deadlines ("Deadlines only"), and a day opens nothing for now ("Nothing
for now"). The review panel's changes before it: waiver runs quieter, past days dimmed, the break
labelled once per week with no sentence, the reopening and its waiver run one line, "UK time" in
the month's plate, the "Today" word white.

FM's idea borrowed: its Calendar's month of days, each day's events in its cell.

## The News tab

8 Nov 2026: Craig, "approve", after a grill the same day. He asked for a league-wide feed like
Fantrax's and Sleeper's: "So let's do this".

- It is League home's News tab, the tab this picture already had: every team's completed moves.
  These are claims won, free agents picked up, drops, trades once through, and the commissioner's
  assignments.
- Pending claims stay private (`spec/08`), and failed claims stay in Mail.
- Team and Kind filters, newest first, over the whole season, with Older moves paging back.
- My team's Transactions tab stays as well (`approved/waivers/`).
- On "your call": selecting a row opens its detail on the right, such as a trade's sides. A
  commissioner action that isn't a squad move, such as a rule change or a break, is only his
  letter, never a row. A trade that is blocked never shows.
- The commissioner's latest letter is pinned on top and opens in Mail. Overview's "More, on News"
  opens this tab.

Built from the squad events Mail reads, through one league-wide read indexed by league and time,
with paging. Trades join once they are built.

## The Football Manager idea

FM27's Portal › Overview: columns of messages, news, the table and collapsible widgets, so the
whole league reads at a glance (Craig: "fm and its widgets as inspo"). Its organisation, never its
colours.

## Interaction notes

- Overview | News | Calendar: Home's own tabs, all three drawn.
- Calendar's ◄ and ►: the month before and after; Today: back to this month. A day opens nothing.
- The patch banner's Read the patch notes: opens Patch notes. The cross hides the banner.
- The deadline strip: reads only; none of its boxes opens anything (`spec/12` S12.10).
- Mail's Needs you | All: opens on Needs you; switches the panel between letters waiting on him
  and every letter. A letter opens it in Mail, except a doubtful or out starter's, which opens
  Tactics; All mail opens Mail.
- News: More, on News opens the News tab. The commissioner's latest letter stays pinned on top
  (`spec/12`).
- Your matchup: Open the matchup and the score open the matchup; Set lineup opens the Tactics tab.
- This gameweek: a head-to-head opens its matchup.
- Table: Whole table and fixtures opens Table.
- Premier League, GW9: a match opens its match page; All fixtures opens the Premier League.
- The ▾ on a right-hand panel: collapses or opens it.
- The recap's Read the recap: opens the recap.
- Your squad news: a player's name opens his player card (`spec/12`).
- Run the league, for the commissioner and co-commissioner only: Run the league ▸ opens the
  commissioner's pages; each line of its to-do list opens where it's done (Craig, 16 Nov 2026, the
  Run the league grill on #2267).

## Placeholders

Each shows in its place and size until its data comes.

| Placeholder | Waits for | Where it's tracked |
|---|---|---|
| The Calendar tab's events | drawn (`1440-calendar.png`); the month's events read and the tab built by #2682 and #2683, breaks once #2663 and #2665 land | #2682, #2683 |
| The deadline strip in the other states (after, locked, break, pre-season) | settled: the same four boxes all season, each saying what is true now (`spec/12` S12.22); the gameweek before its deadline is wired (S12.9, S12.10; #1976) | `spec/12` S12.22 |
| Mail's Needs you tab | settled 9 Nov 2026: a lineup to set, a trade offer to you, a trade to review (`spec/16`), and 16 Nov a doubtful or out starter (S16.7); the panel gains Unread as Mail has | #1030 |
| Premier League, GW9: live scores in matchday mode | settled: live and full-time scores (`spec/12` S12.23); kickoff times wired (S12.12; #1976) | `spec/12` S12.23 |
| Your squad news's chips | settled: each player's chip and Sportmonks' reason, the whole squad by name (`spec/12` S12.8) | `spec/05` S05.59-S05.60 |
| Run the league | settled 16 Nov 2026: join requests waiting (a count), teams with no lineup yet (a number only), the draft order not set before the draft, trades waiting their veto, a team with no manager | #2267 |
| The score boxes, before the deadline (empty) | lineups locked and matches scored | `spec/12`, matchday mode (#387) |
| GW8 recap (empty lines) | the weekly recap | #387 |
| The state boards: after, locked, break, pre-season, new joiner, season over | each state's grill | to-grill: Home through the season; `spec/13`, Breaks |

The issue that builds the rest of the screen: #387.

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>
