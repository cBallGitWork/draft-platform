import { defineTable } from "convex/server";
import { v } from "convex/values";

// Past seasons' Premier League matches, copied once from ai-carling-premiership by
// scripts/past-season.mjs (#1113 for 2025/26, the first season of #842's table; pastSeasonRows.ts).
// Keyed by FPL's season-stable `code`, the season and the kickoff, never FPL's per-season ids.

export const pastMatch = v.object({
  kickoff: v.number(),
  /** Where he started, as ai-carling's log gives it; null where it gives none. */
  startingPosition: v.union(v.string(), v.null()),
  /** Under our stat names (matchRecords.ts); a stat the log has no value for is absent. */
  stats: v.record(v.string(), v.number()),
});

/** One match a player played, or, with `match` null, a player the season names who played none. */
export const pastSeasonRow = v.object({
  /** The year the season starts, as shared/time.ts's `seasonStartYear`. */
  season: v.number(),
  playerCode: v.number(),
  /** His FPL position that season, its `element_type` (1 goalkeeper to 4 forward). */
  fplPosition: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  match: v.union(pastMatch, v.null()),
});

export const pastSeasonTables = {
  pastPlayerMatchStats: defineTable(pastSeasonRow).index("by_season_and_playerCode", ["season", "playerCode"]),
};
