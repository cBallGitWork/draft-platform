# 10. Live matchday

Feature 10 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill live
commentary` (16 Oct 2026).

- Live scores during matches, for every league's head-to-head and table.

## The matchup, as a live match

- The two teams' totals are the score at the top. Each player shows his own status: yet to play,
  playing now with his minute, or finished.
- The matchup has commentary: a vidiprinter, newest first, of every line from every match that
  involves either team's players.
- No line for an auto-sub: whether a player played is known only after his match.
- The commentary is kept with the matchup after the gameweek.

## The match page

- One real Premier League match: the score and clock, both clubs' lineups and subs, five team stats
  (shots, shots on target, possession, corners, cards), and commentary for every event in it.
- Every player owned in the league shows his team and his live points.
- A player traded or released after the deadline shows the team that had him at it: "Yes show the
  old team as for the current games he's on that team" (Craig, 31 Oct 2026).
- From the lineups, about an hour before kickoff, to full time; kept afterwards.
- Opened from a player's status on the matchup, and from the Premier League's fixtures (`spec/18`).

## The commentary

- Our own short lines, CM-terse, built from the Premier League's events: "62' GOAL Saka, assist
  Ødegaard". Championship Manager's and Football Manager's commentary is a style reference only;
  none of it is copied.
- A goal, an assist or a card shows the points it moves, for a player owned in the league.
- A threshold line when a player's running total reaches a point where he earns more under the league's rules: "~58'
  Rice: 3 key passes, +1". The "~" because it's when the totals showed it, not when it happened.
  Only for players owned in the league.
- A kick-off and a full-time line for each match with either team's players in it, on the matchup
  ("FT ARS 2–1 CHE: Saka 11, Palmer 6").
- If the commentary stream falls behind or stops, the matchup and the match page say so
  ("Commentary delayed"); points carry on from FPL.
