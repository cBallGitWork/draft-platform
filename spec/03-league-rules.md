# 3. League rules

Feature 3 of [SPEC.md](../SPEC.md). Only Craig's answers.

The league's rules are data. Among them:

- Format: head-to-head, or total points.
- Playoffs: how many teams, how many legs.
- Standings tie-breaks.
- How many head-to-head games each team plays a gameweek: one, or more (`spec/09`), never more
  than the league's maximum of teams gives a team different opponents for; more is refused when
  saved, naming the most, and so is lowering the maximum below what the games need (22 Oct 2026).
- With an odd number of teams, whether the team left over plays the league's average
  (`spec/09`).
- Squad make-up: a minimum and maximum squad size, or no limits; a minimum and maximum per area;
  a maximum per club. A squad maximum above the 60 players any team can hold is refused when
  saved (22 Oct 2026).
- Carry-over: redraft, keeper (the league sets how many each team keeps; keeping costs nothing)
  or dynasty (the whole squad carries over).
- The deadline: when it falls, as a time before the gameweek's first kickoff, starting at FPL's
  own, 90 minutes before (see [5. Tactics](05-tactics.md)).
- Each area's minimum and maximum on the pitch, and the formation presets.
- Double gameweeks: both matches count (the default), or best match.
- Waivers: when they run, set by the league; can be more than once a week. The waiver order:
  reverse standings, or rotating (reset weekly).
- The draft clock (see [4. The draft](04-the-draft.md)).
- Roles and their scoring adjustments (see [5. Tactics](05-tactics.md)).
- Trade review: none, a commissioner veto, or a league vote (see [8. Between gameweeks](08-between-gameweeks.md)).
