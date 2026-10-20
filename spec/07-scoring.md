# 7. Scoring

Feature 7 of [SPEC.md](../SPEC.md). Only Craig's answers; the last section from `/grill match
stats` (20 Oct 2026).

- Only stats from the two free feeds: FPL's public API and the Premier League's public API. What
  can be scored and how: [14. Scoring categories](14-scoring-categories.md).
- Points move live during matches, provisional until final.
- Stat corrections: points stay open for a fixed window after a match, then lock. The window
  is a platform setting, not a league rule.
- A player in a double gameweek scores per the league's rule (see [3. League rules](03-league-rules.md)).

## Match stats

- A match stops being provisional when FPL marks it finished and both feeds have sent every player
  who played.
- The correction window is 1 hour after FPL marks the match finished; then its points lock. A
  correction after that doesn't change points, but shows on the feeds page
  ([15](15-admin-tools.md)).
- A correction that takes a stat away (an assist removed) sets it back to 0.
- Every player in either team sheet is stored; an unused substitute is marked as not having played.
- Where both feeds have a stat, FPL's counts for goals, assists, minutes, cards, saves, clean
  sheets, goals conceded and penalties; the Premier League's for every other stat. That split is
  for now: Craig is investigating the best way to get these stats elsewhere.
- FPL's bonus points and BPS aren't stored.
