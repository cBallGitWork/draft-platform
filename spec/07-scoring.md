# 7. Scoring

Feature 7 of [SPEC.md](../SPEC.md). Only Craig's answers; the last section from `/grill match
stats` (20 Oct 2026). The Examples section works his answers through, row by row, for him to
approve (#454).

- Only stats from the two free feeds: FPL's public API and the Premier League's public API. What
  can be scored and how: [14. Scoring categories](14-scoring-categories.md).
- Points move live during matches, provisional until final.
- Stat corrections: points stay open for a fixed window after a match, then lock. The window
  is a platform setting, not a league rule.
- A player in a double gameweek scores per the league's rule (see [3. League rules](03-league-rules.md)).
- A team that has never saved a lineup scores 0 for the gameweek, and counts as 0 in the league's
  average (Craig, 29 Oct 2026).
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

### Examples

Craig's answers above, worked through by Claude for Craig to approve. Each table names the answer
it shows, and a test runs every row (`tests/convex/stats/matchStats.examples.test.ts`): change a number here and
the test fails until the code agrees. The lock times take the window from `S07.2` itself.

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
