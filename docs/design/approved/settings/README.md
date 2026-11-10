# League settings

Route: `/leagues/$leagueId/settings`, checked on
`/leagues/preview-pro-league/settings?preview=commissioner`. For #1034 (UI 10, League settings
drawn whole) and #1190 (the scoring start). The Waivers tab's picture is in
[`waivers`](../waivers/README.md) (`1440-settings.png`); these five tabs follow it.

## The pictures

- `1440.png`: Fixtures, with the scoring start set to GW11 and an unsaved change.
- `1440-squad.png`: Squad, each area's squad and starting limits in one table, and the formation
  presets.
- `1440-draft.png`: Draft, before the draft starts.
- `1440-trades.png`: Trades, under a league vote, with a trade deadline.
- `1440-draft-order.png`: Draft order, one team the commissioner picks for.

## Approved

9 Nov 2026: Craig, "Approve". On the way there, his answers:

- The format locks when the league's first scored gameweek begins (the scoring start, GW11 here),
  not the first gameweek it ticks: "First scored GW".
- The commissioner can change the order of the table's tie-breaks with Up and Down: "Yes, Up/Down".

## The Football Manager idea

FM's competition rules: one rule to a row, label left and its control right, grouped under titled
panels, with a right-hand column of widgets showing what the rules lead to (here the gameweeks, the
draft and trades in review). The tabs on the title plate come from the Waivers picture. Its
organisation, never its colours.

## Interaction notes

- **Tabs:** Fixtures, Squad, Draft, Waivers, Trades, Draft order, on the title plate.
- **Save:** one Save bar at the end of each tab, muted until something changes; then "Not saved",
  Discard and Save. Draft order has none: each move or draw saves at once, and it says "Saved".
- **Format:** Head-to-head or Total points, locked once the first scored gameweek begins.
- **Scoring starts in:** a gameweek picker offering only ticked gameweeks not begun; fixed once its
  deadline passes (spec/04, After the draft).
- **Games a gameweek, Deadline, Most players, each area's limits, Players from one club:** number
  boxes; the club limit has a tick to turn it off.
- **Odd team out, Double gameweeks, Review, Undrafted players go to, pick time's unit:** keys.
- **Tie-breaks:** Up and Down move each one; the first can't go up, the last can't go down.
- **Auto-pick:** a tick for "never", and the timeouts before it.
- **Trade deadline:** a tick to turn it off, and the last gameweek with trades.
- **Draft order:** Up and Down per team, Draw at random, and an "I'll pick" tick per team.
- **Gameweeks widget:** read-only, the scoring start marked in cyan and an unused gameweek muted;
  Edit › opens the Gameweeks screen.
- **The draft widget:** its start, rounds, picks and teams, with Draft room › and Draft order ›.
- **In review widget:** each trade in review, opening it, and Trades ›.
- **Round 2 widget:** the snake's reversed order.
- **Formation presets widget:** the league's presets by name, read-only.

## Placeholders

- **Play-off teams** and **Play-off legs** (spec/03): no held rule yet.
- **Carry-over** (spec/03: redraft, keeper or dynasty): no held rule yet; keeping waits for its own
  grill (spec/04).

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, boards `SettingsFixtures`, `SettingsSquad`,
`SettingsDraft`, `SettingsTrades` and `SettingsDraftOrder`.
