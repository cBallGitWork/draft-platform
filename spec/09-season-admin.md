# 9. Season admin

Feature 9 of [SPEC.md](../SPEC.md). Only Craig's answers.

- The platform generates the head-to-head fixtures as a round robin; the commissioner can edit them.
  It is drawn over the gameweeks the league uses ([13](13-setting-up-a-league.md#gameweeks)).
- The round robin needn't repeat in one order: it is drawn as evenly as possible. A league can
  choose more than one game per gameweek (21 Oct 2026).
- A change to the league's settings never redraws a gameweek already played: it applies from the
  next gameweek on ("yes games played in past are done", 22 Oct 2026).
- The table is a real football table: 3 points for a win, 1 for a draw, 0 for a loss (21 Oct 2026).
- With an odd number of teams, the team left over each gameweek plays the league's average, as a
  league setting (21 Oct 2026).
- The commissioner can hand a team to a new manager mid-season.
- Auto team, for a manager who stops playing: it sets the lineup only, never claims waivers or
  answers trades. The commissioner or the manager can switch it on, and the app does at the deadline
  if a lineup is illegal. While it is on, trades with that team are paused; waivers carry on.
