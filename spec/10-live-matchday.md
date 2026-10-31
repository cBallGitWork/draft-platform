# 10. Live matchday

Feature 10 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill live
commentary` (16 Oct 2026).

- Live scores during matches, for every league's head-to-head and table.

## The matchup, as a live match

- The two teams' totals are the score at the top. Each player shows his own status: yet to play,
  playing now with his minute, or finished.
- Before the deadline a rival's lineup is hidden, and only his squad shows, as a real club's would.
  At the deadline both lineups show: the starters, the bench in order, the formation and each
  starter's role. The commissioner and the admin see only what managers see (Craig, 31 Oct 2026:
  "they just get to view what the managers see").
- Tapping a player on the matchup or its pitch shows his breakdown for this match, his role's line
  included (`spec/14`): "the opposition manager needs to see why his opponent got the points"
  (Craig, 31 Oct 2026). It leads on to his player card, which keeps his base points (`spec/12`).
- His minute shows stoppage time, and "Live" before there is one (Craig, 31 Oct 2026: "Yes
  stoppage time and live").
- The matchup has commentary: a vidiprinter, newest first, of every line from every match that
  involves either team's players.
- No line for an auto-sub: whether a player played is known only after his match.
- The commentary is kept with the matchup after the gameweek.

## The match page

- One real Premier League match: the score and clock, both clubs' lineups and subs, five team stats
  (shots, shots on target, possession, corners, cards), and commentary for every event in it.
- Every player shows his live points, and only one owned in the league his team: "I need to stress
  that players who don't have a team still have their scores show. Just because they aren't a team
  doesn't mean they don't get points" (Craig, 31 Oct 2026). A player with no team says so in place
  of a team: "Well he would be a free agent or waiver not blank" (Craig, 31 Oct 2026). His points
  are the ones his player card opens on (`spec/12`), and show plainly, not greyed: "people don't
  think grey means no teams" (Craig, 31 Oct 2026).
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
