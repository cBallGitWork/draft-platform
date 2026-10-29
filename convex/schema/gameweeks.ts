import { defineTable } from "convex/server";
import { v } from "convex/values";

export const gameweekTables = {
  /** A league's deadline for a gameweek once it has passed (#150): where it fell stays put, even if
   *  the first match is then postponed (spec/05). One row a league and gameweek, written at or
   *  after the deadline by deadlineRecorder.ts. */
  passedDeadlines: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    deadline: v.number(),
    recordedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** A gameweek's first kickoff once it has passed (#414): where it fell stays put, even if that
   *  match then leaves the gameweek, so the site's scoring version for it can't change. One row a
   *  season and gameweek, site-wide, written by gameweeks/gameweekStarts.ts. */
  gameweekStarts: defineTable({
    /** The year the season starts, as shared/time.ts's `seasonStartYear`. */
    season: v.number(),
    gameweek: v.number(),
    firstKickoff: v.number(),
    recordedAt: v.number(),
  }).index("by_season_and_gameweek", ["season", "gameweek"]),
};
