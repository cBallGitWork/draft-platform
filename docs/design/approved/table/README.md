# Table and fixtures

Route: `/table`, checked on `/table?preview=manager`.

## The pictures

- `1440.png`: the League tab after GW9, as Saka Potatoes' manager sees it, in a league of eight.
  The table is on the left, and GW9's Fixtures are on the right. They are grouped under League and
  the Cup's semi-finals, played the same gameweek.
- `1440-live.png`: GW10 live, in a league of nine. The table is marked Provisional, each team's live
  result is an outlined form chip, and Fixtures says Live. The team left over plays League average,
  and Hull Hearts is on the auto team.
- `1440-total-points.png`: a total-points league: Pos, Team, P and Pts (the points scored), with no
  fixtures and no tabs.
- `1440-cup.png`: the Cup tab, a placeholder 8-team bracket: quarter-finals GW8, semi-finals GW9,
  final GW10. The final's scores are outlined until it is played.

## Approved

8 Nov 2026: Craig, "Yes to all". On the way there, Craig answered these:

- Cups are handled now as a placeholder: "Doesn't need to be building cups, just a placeholder like a
  8 team bracket and its matches. We need to handle it". So the screen has League and Cup tabs, and
  Fixtures groups a gameweek's games by competition.
- The Form column stays on the table (the approved form chips, the last five, oldest first).
- Fixture edits wait for the commissioner screens (spec/09, by August per spec/15).
- A team row doesn't open a team panel. Position-change arrows are not wanted.
- Until a league has a cup, the Cup tab is an empty bracket of outlined placeholders, with no made-up
  teams or scores.

The cup's rules stay open for the cups grill (SPEC.md, Later; `docs/to-grill.md`, Cups and a
plate): seeding, legs, a level tie, and who plays the plate. The picture draws one leg a round and
no seeding rule. Its sample teams and scores are the picture's, never the build's.

## The Football Manager idea

FM's competition screen: the table is the page, the round's fixtures and results sit in a side
panel with ◄ round ►, your club's row is picked out, and a Form column holds the last five. FM's
competition switcher and FotMob's Knockout tab gave the League and Cup tabs. FPL gives a cup its own
page beside the league. From Draft Fantasy, Fantrax and ESPN: points for and against, with points
for splitting teams level on points. Their organisation, never their colours.

## Interaction notes

- **League, Cup** on the title plate switch the competition. Both open on the same gameweek.
- **The table:** Pos, Team, P W D L, F and A (fantasy points for and against, in tenths), +/-, Pts,
  Form. Your team's row has the cyan edge. Teams level on points are split by the league's
  tie-breaks (its rules, `spec/03`; the first rules' is points for). A team on the auto team has the
  Auto team chip after its name, and hovering it says what the auto team does.
- **Live:** points move in the table during a match. The table plate says Provisional, and the live
  result is the last form chip, drawn as an outline until it locks. The Fixtures plate says Live.
- **Fixtures:** ◄ GW ► steps through the gameweeks the league plays. Each score opens its matchup,
  and is underlined only under the pointer or with focus. A gameweek not yet played shows "v". With
  a cup that gameweek, its games follow under their own head.
- **The Cup's bracket:** each round heads its column with its gameweek. In each tie the winner is
  white and the loser grey, and screen readers hear "won" or "lost". A played tie opens its matchup.

## Placeholders

- The Cup tab, until cups are grilled and built: an empty bracket of outlined boxes.
- Team crests are not drawn (SPEC.md, Later). They go before the team's name once they exist.
