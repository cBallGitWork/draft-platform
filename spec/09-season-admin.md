# 9. Season admin

Feature 9 of [SPEC.md](../SPEC.md). Only Craig's answers.

- The platform generates the head-to-heads as a round robin; the commissioner can edit them,
  only in gameweeks that haven't begun (24 Oct 2026): whose deadline hasn't passed (5 Nov 2026).
  It is drawn over the gameweeks the league uses ([13](13-setting-up-a-league.md#gameweeks)). `S09.1`
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

## The auto team

From `/grill the auto team and fixture edits` (5 Nov 2026).

- It keeps the team's last lineup. At the deadline it swaps any starter who is out (`spec/06`,
  Availability) for the first bench player who fits, the way an auto-sub comes on (`spec/05`).
- It only ever touches the lineup, never dropping or adding players.
- Switched on by the app for an illegal lineup, it fixes that gameweek and switches off again.
  Switched on by a person, it stays on until someone switches it off.
- The manager and the commissioner can both switch it off.
- A team with no manager (he left or was removed, `spec/13`) is on the auto team until it is handed
  on, and handing a team to a new manager switches it off.
- A manager switching it on himself can name a gameweek it ends after, like CM's holiday.
- The table and the matchup mark a team on the auto team ("ok").

## Fixture edits

From the same grill.

- An edit swaps opponents within one gameweek: two games are picked and a team swapped between them,
  so every team plays the same number of games ("ok").
- An edit leaves every other gameweek as drawn; nothing is redrawn to even it out.
- With an odd number of teams, the league's average can be swapped like a team.
