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
  /** A feed's round's first kickoff as first seen (#1416): gameweek N is the date window from round
   *  N's to round N+1's (spec/05 S05.22), so a later move never changes it. One row a season and
   *  round, site-wide, written by gameweeks/roundStarts.ts before the sync writes the matches. */
  roundStarts: defineTable({
    /** The year the season starts, as shared/time.ts's `seasonStartYear`. */
    season: v.number(),
    round: v.number(),
    firstKickoff: v.number(),
    recordedAt: v.number(),
  }).index("by_season_and_round", ["season", "round"]),
  /** A match the admin has moved to another gameweek (#1417; spec/07 S07.9): the window rule
   *  (`roundStarts`) yields to it until he clears it. One row a match, by FPL's fixture `code`,
   *  written by gameweeks/matchMoves.ts. `unmoved` is the gameweek the window rule would give it
   *  (null for a postponed match the feed puts in no round), kept by each football sync, so a
   *  clear puts the match straight back there. */
  matchMoves: defineTable({
    fixtureCode: v.number(),
    gameweek: v.number(),
    unmoved: v.union(v.number(), v.null()),
    movedAt: v.number(),
  }).index("by_fixtureCode", ["fixtureCode"]),
  /** Each move and clear the admin makes (#1417), seen only by him (spec/15: "His actions are
   *  logged where only he sees them"). `to` is null for a clear. Never changed once written. */
  matchMoveLog: defineTable({
    fixtureCode: v.number(),
    from: v.union(v.number(), v.null()),
    to: v.union(v.number(), v.null()),
    at: v.number(),
  }).index("by_at", ["at"]),
  /** The one deadline alarm pending, site-wide (#1329): at most one row, written only by
   *  deadlineRecorder.ts's `setDeadlineAlarm`, so it cancels or keeps the alarm by its id rather
   *  than scanning every scheduled function Convex keeps. */
  deadlineAlarms: defineTable({
    scheduledId: v.id("_scheduled_functions"),
    at: v.number(),
  }),
};
