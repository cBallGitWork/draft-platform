# 7. Scoring

Feature 7 of [SPEC.md](../SPEC.md). Only Craig's answers; the last section from `/grill match
stats` (20 Oct 2026). The Examples section works his answers through, row by row, and he
approved its rows (6 Nov 2026, #454).

- Only stats from Sportmonks, the football data's feed (SPEC, *What it is*; Craig, 9 Nov 2026),
  in place of FPL's and the Premier League's public APIs. What can be scored and how:
  [14. Scoring categories](14-scoring-categories.md). `S07.7`
- Sportmonks replaces FPL's and the Premier League's public APIs: "stop with fpl and prem, thats
  not scalable". It is the one feed, with the same stats and scoring in every competition: "which
  is good but we want a universal experience" (Craig, 9 Nov 2026, on #1196). Until the switch
  (`spec/20`), the match stats rules below still read both. `S07.8`
- Points move live during matches, provisional until final.
- Stat corrections: points stay open for a fixed window after a match, then lock. The window
  is a platform setting, not a league rule.
- A gameweek is a date window: gameweek N is Sportmonks' round N as first scheduled, running from
  its deadline to the next gameweek's deadline. Each match counts in the gameweek it kicks off in,
  the same rule in every competition, so a rearranged match makes a double or a blank week;
  Sportmonks' rounds aren't followed for that. The admin can move a match (Craig, 9 Nov 2026, on
  #1196). `S07.9`
- A player in a double gameweek scores per the league's rule (see [3. League rules](03-league-rules.md)).
- A team always has a lineup, carried over week to week, as in FPL or Fantrax: there is no "no
  lineup" state (Craig, 29 Oct 2026).
- Once a gameweek is final, every screen shows its saved total, the one the table uses, even if a
  later data fix would work it out differently (Craig, 29 Oct 2026).

## Match stats

- A match stops being provisional at full time once both feeds have sent every player who played.
  The platform sets its own rule here, not FPL's flags. `S07.1`
- The correction window (the admin's setting, `spec/15`) is 1 hour after full time; then its
  points lock. If a player's record still hasn't arrived by then, the match stays provisional and
  locks an hour after it does. A correction after the lock doesn't change points, but shows on
  the feeds page ([15](15-admin-tools.md)). `S07.2`
- A correction that takes a stat away (an assist removed) sets it back to 0. `S07.3`
- Every player in either team sheet is stored; an unused substitute is marked as not having played. `S07.4`
- Where both feeds have a stat, FPL's counts for goals, assists, minutes, cards, saves, clean
  sheets, goals conceded and penalties; the Premier League's for every other stat. That split is
  for now: Craig is investigating the best ways to get them. `S07.5`
- FPL's bonus points and BPS aren't stored. `S07.6`
- At the switch to Sportmonks (`spec/20`), the two answers above that name both feeds (`S07.1`'s
  "both feeds" and `S07.5`'s split) are withdrawn: one feed sends every stat, so a match stops
  being provisional once it has sent every player who played (Craig, 9 Nov 2026, on #1196). `S07.10`
- The winning goal is the one that put the club in front for good: in a 3-1 win going 1-0, 2-0,
  2-1, 3-1, it is the 1-0. Nobody gets it for a draw, a loss or an own goal, and the admin can
  change it by hand (Craig, 12 Nov 2026, on #1415: "Ahead for good"). `S07.11`
- Only men who played get a win, draw or loss: a man on the bench all match gets none, the same
  as every other stat of his (Craig, 12 Nov 2026, on #1415: "Only men who played"). `S07.12`

### Examples

Craig's answers above, worked through by Claude and approved by Craig (6 Nov 2026). Each table
names the answer it shows, and a test runs every row (`tests/convex/stats/matchStats.examples.test.ts`):
change a number here and the test fails until the code agrees. The lock times take the window from `S07.2` itself.

**When a match locks** (`S07.2`):

| full time | last record arrives | locks |
|---|---|---|
| 17:00 | 17:00 | 18:00 |
| 17:00 | 17:40 | 18:00 |
| 17:00 | 18:30 | 19:30 |

**Which feed counts** (`S07.5`), for a stat both feeds send:

| stat | counts from |
|---|---|
| goals | FPL |
| assists | FPL |
| minutes | FPL |
| yellow cards | FPL |
| red cards | FPL |
| saves | FPL |
| clean sheets | FPL |
| goals conceded | FPL |
| penalties saved | FPL |
| penalties missed | FPL |
| own goals | Premier League |
| starts | Premier League |
