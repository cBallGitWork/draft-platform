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
  /** A league's deadline for a gameweek FPL stopped sending, as it stood when FPL stopped (#202):
   *  "Keeps its last deadline" (Craig, 1 Nov 2026; spec/05). One row a league and gameweek, written
   *  by deadlineRecorder.ts's `keepDroppedDeadlines` before the gameweek is marked dropped. A
   *  passed deadline (`passedDeadlines`) wins over it; once it passes, it is recorded there too. */
  keptDeadlines: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    deadline: v.number(),
    keptAt: v.number(),
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
