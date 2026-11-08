# Scouting

Route: `/scouting`, checked on `/scouting?preview=manager`.

## The pictures

- `1440.png`: the Players tab, opened on free agents, sorted by key passes over the last 6
  gameweeks, with Eze selected: his panel is at the top of the right column.
- `1440-compare.png`: Eze compared with the manager's own CAM, Palmer.
- `1440-report.png`: a scout's report on Wood, opened from the Scouts widget.
- `1440-stat-race.png`: the Stat race tab, ranked by clean sheets, with the manager's team's every
  category in the right column.

## Approved

8 Nov 2026: Craig, "Yes approve". On the way there, Craig answered these:

- Clicking a row opens the player's panel in the right column, FM-style: "His panel in the right column".
- A name search: "Yes, a name box".
- Compare shows "Points, league cat, some per 90 stats would be nice".
- The list opens on free agents.
- After research into other fantasy sites (FPL, FPL Draft, Fantrax, Sleeper, ESPN, Yahoo) and
  football sites (FBref, SofaScore), he picked a stat period picker, percentile bars against
  same-position players, and comparing with your own player.
- Scout reports stay plain sentences.
- The draft queue's buttons show only before and during the draft.
- Fresh-eyes pass: of two ways to use the space it freed, he picked option 1, "1 ok": more figures in the table.

These answers add to spec/19 (a name search; the period picker; per 90 and percentiles; compare
with your player; Free agents first; the queue only near the draft). The builds that use them
add the lines.

## The Football Manager idea

FM's player search and recruitment: a list on the left, and a selected player's panel at the top
of a right-hand column of titled widgets (Shortlist, Scouts). FM's scout report is judgement first.
From FBref: per-90 figures with a percentile bar against the same position. From Yahoo: compare a
free agent with your own player. From FPL and Fantrax: a handful of figures in the list, and a
mark for a shortlisted player. Their organisation, never their colours.

## Interaction notes

- **All, Free agents, On waivers, Owned** filter the list; it opens on Free agents. In the All and
  Owned views a Status column says who owns him, or when he clears waivers.
- **Name** finds a player as you type. **Position**, **Club**, **Stat** and **Period** (Season,
  Last 4, Last 6 gameweeks) narrow and sort. Mins, Pts, G, A, SOT and the picked stat follow the
  period. A column's head sorts by it.
- **A row** selects him: his panel opens at the top of the right column. His name opens his
  player card.
- **His panel:**
  - Season points, minutes and role fit.
  - Each stat per 90 over the period, with a percentile bar against his position (hover gives
    the figure; 270+ minutes to be ranked).
  - **Pick up** (a free agent), or **Claim** (on waivers).
  - **Send a scout**, **Shortlist** (a star then shows after his name in the list).
  - **Compare with your [position], [player]**: your player in the same position.
  - **Compare with another…**: then click a second row.
  - **Player card ›**.
- **Compare:** the two players' totals and per 90, with a bar each. Its actions: Pick up X, drop Y.
- **Shortlist:** the manager's own list; ✕ takes a player off. Before and during the draft,
  each row gets **Queue** and the widget gets **Add the whole shortlist to the queue** (spec/04).
  A player another team owns is greyed.
- **Scouts:** each of the 3 is out on a player with the time left, has a report in (**Read ›**
  opens it in the right column), or is free.
- **The report:** fit, form, job security and fixtures, in plain sentences, with role-fit stars
  and the date written. It also shows on the player card. **Scout him again** writes a new one.
- **Stat race:** **Rank by** picks the category. Each team's season totals as raw counts.
  Clicking a team shows its every category, with its rank, in the right column.
- Role fit stars show only for the manager's squad and players with a report in (spec/19).

## Placeholders

| Placeholder | Waits for | Where it's tracked |
|---|---|---|
| The Next 3 cells' difficulty colours | where fixture difficulty comes from | to-grill: Where fixture difficulty comes from |
| The status chips after a name (knock, booking) | which FPL statuses each chip reads | to-grill: Status chips' data |

## Builds it unblocks

- #375: scouts, their reports and the role-stars rule.
- #800: the stat race.
- #1028: Scouting itself, rebuilt to this picture.

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, under "Scouting". The four boards are saved
here beside their pictures.
