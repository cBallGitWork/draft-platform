# 3. League rules

Feature 3 of [SPEC.md](../SPEC.md). Only Craig's answers.

The league's rules are data. A commissioner edits them on **League settings**, the rules that
build the league, starting with the odd team out and the games a gameweek (Craig, 22 Oct 2026).
Players' points by position, on **Player scoring** (once called Scoring), are the site's, not the
league's: the admin changes them by patch, and every manager can read them (`spec/14`, 25 Oct 2026).

Among them:

- Format: head-to-head, or total points.
- Playoffs: how many teams, how many legs.
- Standings tie-breaks.
- How many head-to-head games each team plays a gameweek: one, or more (`spec/09`), never more
  than the league's maximum of teams gives a team different opponents for; more is refused when
  saved, naming the most, and so is lowering the maximum below what the games need (22 Oct 2026).
- With an odd number of teams, whether the team left over plays the league's average
  (`spec/09`).
- Squad make-up (24 Oct 2026): a minimum squad size, and a maximum the commissioner sets in League
  settings. The maximum starts from a default by the league's size, which Craig keeps and edits ("an
  8 man league would have 16 id say ish"; "we can edit that ourselves"), and is never above 25, a
  Premier League squad ("a prem squad is 25"); more is refused when saved. A minimum per area, and
  nothing else per area: "a squad can be full of whatever you want with a few minimum counts". A
  player who can play two areas fills one minimum, whichever helps the squad. A maximum per club,
  off by default.
- Carry-over: redraft, keeper (the league sets how many each team keeps; keeping costs nothing)
  or dynasty (the whole squad carries over).
- The deadline: when it falls, as a time before the gameweek's first kickoff, starting at FPL's
  own, 90 minutes before (see [5. Tactics](05-tactics.md)).
- Each area's minimum and maximum on the pitch, and the formation presets.
- Double gameweeks: both matches count (the default), or best match.
- Waivers: when they run, set by the league; can be more than once a week. The waiver order:
  reverse standings, or rotating (reset weekly).
- The draft clock (see [4. The draft](04-the-draft.md)).
- Roles (see [5. Tactics](05-tactics.md)); their scoring adjustments are the site's (`spec/14`).
- Trade review: none, a commissioner veto, or a league vote (see [8. Between gameweeks](08-between-gameweeks.md)).
