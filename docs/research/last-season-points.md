# Last season's points, for auto-pick and Scouting

Background for #1106, not the product (CLAUDE.md). Checked 4 Nov 2026 against the feeds, the dev
deployment and ai-carling-premiership's files. The spec line it serves (`spec/04-the-draft.md`):

> With no ranking uploaded, auto-pick falls back to last season's points under the site's scoring
> (`spec/14`), newcomers last by name (Craig, 2 Nov 2026).

**Contents:** Craig's answers · What was checked · The options · Recommendation · Newcomers · Size
and scale · Gaps · Build issues

## Craig's answers (4 Nov 2026)

1. **"Yes, copy it"**: 2025/26 goes into the site from ai-carling-premiership, as the first
   season of #842's past-matches table.
2. A newcomer is a player **"Not in last season's data"**: only a player missing from 2025/26
   altogether. One who is in it but played no minutes (an unused substitute, injured all season)
   ranks with 0 points, above every newcomer.

For example: Saka ranks by his 2025/26 matches under the site's rules as they stand; a reserve
keeper who sat on the bench all season ranks on 0; a summer signing from Serie A goes to the
bottom, A to Z.

## What was checked

- **FPL keeps no per-match stats for past seasons.** `element-summary/1/` answers with `history`
  (this season's 9 matches) and `history_past`, one line of **season totals** for 2025/26 keyed by
  `element_code` (minutes 3330, clean sheets 19, saves 60...). Its `event/N/live/` is this season's
  only.
- **The Premier League feed still serves 2025/26 match by match.** Its fixture list for that
  season (`compSeasons=777`, already `PL_LAST_COMP_SEASON` in `convex/football/football.ts`)
  returns all 380, and `stats/player/33231?fixtures=124791` returns 99 Opta stats for Szoboszlai
  in that match, `formation_place` among them. It is one call per player per match.
- **ai-carling-premiership already holds 2025/26 match by match.**
  `data/match_logs/player_match_log/season=25-26/player_match_log.parquet`: 380 Premier League
  matches, 11,492 rows of a player who played, 537 players, filtered to `competition ==
  "premier_league"` (the file also holds the cups and Europe).
  - Every one of the 537 has an FPL `code` in `data/identity/persons/root/*.json`
    (`source_mappings.fpl_code`): 537 of 537.
  - Every stat the site's first scoring set prices (`convex/scoring/firstScoring.ts`) has a
    column: `fpl_minutes`, `goals`, `assists_fpl`, `fpl_clean_sheets`, `fpl_goals_conceded`,
    `fpl_saves`, `fpl_penalties_saved`, `fpl_penalties_missed`, `fpl_defensive_contribution`,
    `yellow_cards`, `red_cards`, `fpl_own_goals`; and `starting_position` for where he started.
  - Every played row has `fpl_minutes`. 267 have no `fpl_defensive_contribution` (median 81
    minutes), so that stat is missing, not zero (see Gaps).
  - Each row carries FPL's own points (`fpl_total_points`, `fpl_bonus`), so a re-score under the
    first set, which is FPL's without bonus, can be checked match by match.
  - It holds no Premier League (Opta) stats, only FPL's, FotMob's, SofaScore's and Understat's, as
    `spec/14` (The rule balance lab) already notes.
- **Our own records start at gameweek 1 of 2026/27.** On dev, `matchStatsStatus` holds 89 matches,
  gameweeks 1 to 9. So from next summer, "last season" is our own records and needs no copy. Prod
  could not be read from here (read-only), so that is checked on dev only.
- **The work is already half-filed.** #956 (Scouting's last-season points in the summer) prices
  last season under today's set as a paged job; #842 copies five past seasons from ai-carling for
  the lab; #1094 (auto-pick) waits on this.

## The options

| | Where 2025/26 comes from | Cost | Right numbers? |
|---|---|---|---|
| **A** | ai-carling's file, copied once by a script on Craig's Mac (#842's route, one season) | One script, one table, about 5 MB | Yes for every stat the site prices today, checkable against FPL's own points. A future Opta-only category (say, key passes) takes its nearest column. |
| **B** | The Premier League feed, replayed through our own reader | About 13,700 calls (380 matches × about 36 men on the two team sheets) to an unofficial feed, once; a run that must be resumable | Opta's exact stats for every catalogue category. FPL's own counts (its defensive contribution, its assists) only as Opta's nearest. Works only while the feed keeps 2025/26 online. |
| **C** | FPL's `history_past` season totals | About 800 calls | No. The rules are per match (2 for 60 minutes, a clean sheet only after 60, defensive contribution per match, -1 per two conceded), so totals can't be scored. |
| **D** | Nothing: fall back to this season's points so far until next summer | None | Changes the spec: early in a season it ranks on a handful of matches. |

## Recommendation

**A**, as the first season of #842's table, with #956's re-price job writing one "last season's
points" row per player that three places read: auto-pick's fallback (#1094), Scouting in the
summer (#956, `spec/19`), and the player card's last-season line (`spec/12`). From summer 2027
last season's points come from our own records, and the copy is never run again for the fallback.

Why: it is the only source that is complete today, it matches the stats the site prices, the
copy is one run with no feed to depend on, and the table is one #842 needs anyway. Per
`spec/19`, the points are at each player's main position and under the site's set as it stands,
re-priced when a patch changes it.

## Newcomers

Craig's answer 2: a player in this season's FPL list (by `code`) who is not in ai-carling's
2025/26 Premier League rows at all. Those rows name 707 players, every one with an FPL `code`:
the 537 who played and 170 more who were only ever an unused substitute, left out, injured,
suspended or ineligible (`play_status`). So the copy keeps every one of the 707, the 170 with no
matches, and they rank on 0. Newcomers rank after everyone in the data. Claude's calls: newcomers
go A to Z by the name the site shows him by, and players level on points go A to Z the same way.

## Size and scale

- 2025/26 at the first set's stats: 11,492 rows of about 430 bytes, **about 5 MB**. With all 120
  numeric columns, as the lab may want, about 25 MB a season, about 125 MB for #842's five.
- For comparison, one of our own match records on dev is about 1.8 KB.
- The points rows: one per player in this season's list, about 700, newcomers included.
- Re-pricing after a patch: the 537 who played, 22 pages of 25, the job #956 already sizes.
- None of it grows with teams or leagues: it is per player, so 80 teams cost the same as 8.

## Gaps

- 267 played rows lack FPL's defensive contribution. Craig, 4 Nov 2026: "Work it out": each is
  rebuilt from FPL's own points for that match (the total, minus the bonus, minus every other
  stat's points at his FPL position). The remainder is FPL's 0 or 2, so those rows keep whether he
  reached FPL's threshold, not a count. His 2025/26 FPL position comes from ai-carling's copy of
  FPL's player list of 1 Mar 2026 (`data/raw/fpl/wayback_bootstrap/`).
- Settled: among played Premier League rows there is one `fpl_fixture_id` per match (380) and no
  player twice in a match or at one kickoff. The 465 ids counted over every row come from bench
  and unavailable rows. Ids are per season and never persisted (CLAUDE.md), so a row is kept by
  player `code`, season and kickoff.
- Prod's records weren't read (read-only from here).

## Build issues

Both on lane:auto after Craig's answers:

- #1113: copy 2025/26 from ai-carling into a past-matches table, checked row by row against FPL's
  own points.
- #1114: price last season under today's set, one row per player, re-priced on each patch, and
  the fallback ranking with newcomers last. It does #956's storage; #1094 reads it.
