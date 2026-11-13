import { defineTable } from "convex/server";
import { v } from "convex/values";

// Past seasons' Premier League matches, copied once from ai-carling-premiership by
// scripts/past-season.mjs (#1113 for 2025/26, the first season of #842's table; pastSeasonRows.ts).
// Keyed by FPL's season-stable `code`, the season and the kickoff, never FPL's per-season ids; a
// man with no FPL code by ai-carling's person root id instead.

export const pastMatch = v.object({
  kickoff: v.number(),
  /** The club he played for that day, as ai-carling's log names it (Craig, 12 Nov 2026, on #1541:
   *  "Match by match"); absent on a row copied before. */
  club: v.optional(v.string()),
  /** Where he started, as ai-carling's log gives it; null where it gives none. */
  startingPosition: v.union(v.string(), v.null()),
  /** Under our stat names (matchRecords.ts); a stat the log has no value for is absent. */
  stats: v.record(v.string(), v.number()),
});

/** One match a player played, or, with `match` null, a player the season names who played none. */
const codedRow = v.object({
  /** The year the season starts, as shared/time.ts's `seasonStartYear`. */
  season: v.number(),
  playerCode: v.number(),
  /** His FPL position that season, its `element_type` (1 goalkeeper to 4 forward). */
  fplPosition: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  match: v.union(pastMatch, v.null()),
});

/** One match played by a man with no FPL code, under ai-carling's person root id (spec/14 S14.24;
 *  Craig, 13 Nov 2026, on #1541): he counts in his club's XI in the rule balance lab, and is never
 *  matched to a Sportmonks player, so never in Scouting or last season's points. */
const personRow = v.object({
  season: v.number(),
  person: v.string(),
  match: pastMatch,
});

export const pastSeasonRow = v.union(codedRow, personRow);

export const pastSeasonTables = {
  pastPlayerMatchStats: defineTable(pastSeasonRow).index("by_season_and_playerCode", ["season", "playerCode"]),
  /** Each player's points in a past season under the site's set as it stands (#1114; spec/19, and
   *  spec/04's fallback ranking): a row a player in that season's data, one who played none on no
   *  points. `points` holds his matches' sum at each position (positionTables.ts's POSITIONS), as
   *  playerSeasonPoints does, so it is read at his main position now. Set afresh by the paged
   *  re-price in pastSeasons/pastSeasonPoints.ts, after the copy and whenever the set changes. */
  pastSeasonPoints: defineTable({ season: v.number(), playerCode: v.number(), points: v.record(v.string(), v.number()) }).index(
    "by_season_and_playerCode",
    ["season", "playerCode"],
  ),
};
