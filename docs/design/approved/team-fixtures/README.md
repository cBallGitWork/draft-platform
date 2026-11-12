# My team, Fixtures

Route: `/team/fixtures`, My team's Fixtures tab, checked on `/team/fixtures?preview=manager`.
For #1031.

## The picture

- `1440.png`: Saka Potatoes after GW9. Fixtures to come on the left, the next game (GW10 v
  Pickford Pirates) first; Results on the right, newest first; the next game and the season beside
  them.
- `MyTeam-Fixtures.dc.html`: its source from the canvas.

## Approved

10 Nov 2026: Craig, "Approve it". On the way there:

- He asked whether other sites had been checked first ("have we reviewed other sites first?", "and
  fm etc"). Claude checked FM, CM, Fantrax, ESPN, Yahoo, Sleeper and FPL Draft. From them: a date
  only on each row (none shows a deadline per row) and no table place on games already played.
- "not better to have fixtures/results seperate?": Fixtures and Results became two panels, as FM
  splits Next Fixtures from Latest Results.
- "and also need to handle if theres a league and cup too", "or multiole cups": a Comp column on
  both panels and a Competition picker over them. Cup rows are placeholders: cups are on
  `docs/to-grill.md` for after the beta, so no cup rule is drawn.
- The review panel's clear-cut fixes: the result beside the opponent, games to come with no dashes,
  the next game marked "Next", F and A with titles, the Season row tightened, and the earlier meeting
  this season cut (not in the spec).

## The Football Manager idea

FM's fixtures screens: Next Fixtures beside Latest Results, a competition on each row, and the next
opponent in a card beside the list. Their organisation, never their colours.

## Interaction notes

- **Fixtures:** every game to come, next first, marked with the cyan bar and "Next". The opponent's
  place is today's. The list scrolls inside its panel.
- **Results:** every game played, newest first, with W or L and the score. A row opens that week's
  Matchup.
- **Opponent names** open their team.
- **Competition:** All, the league, or one cup; it filters both panels. It shows only in a league
  with a cup.
- **Next game panel:** their place and points, the deadline with its countdown, their last five
  results, and Matchup ›.
- **Season:** played, won, drawn, lost, points for and against, and table points, with Table ›.

## Placeholders

- Cup rows (Cup round 1 in GW12, Shield group 1 in GW16): drawn as "draw to come" until cups are
  grilled (`docs/to-grill.md`, Cups and a plate).

## Not drawn

- A total-points league plays no fixtures: what this tab shows there is still to settle.
- A gameweek with two games, or the odd team out playing the league average, is two rows or one
  "League average" row, as on the approved `table` picture.

Canvas: <https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, board "My team, Fixtures (#1031)".
