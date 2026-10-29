import { defineTable } from "convex/server";
import { v } from "convex/values";
import { LEAGUE_AVERAGE } from "../table/roundRobin";

// A league's head-to-head fixtures in each gameweek it has begun, stored once the gameweek begins
// and read from here ever after (#137); none in one begun with no head-to-head, such as before the
// league was made (#282). One row a league and gameweek, written only by
// convex/table/playedFixtures.ts, which says why.
export const playedFixtureTables = {
  playedFixtures: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    fixtures: v.array(v.object({ team: v.id("teams"), opponent: v.union(v.id("teams"), v.literal(LEAGUE_AVERAGE)) })),
    /** The teams left over with a bye, in a league whose odd team out has one. */
    byes: v.array(v.id("teams")),
    storedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** Each team's points in a gameweek once they are final: every match in it locked, so no
   *  correction can change them (spec/07). One row a league, gameweek and team, written only by
   *  convex/table/finalScores.ts, which says when (#418). */
  finalScores: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    teamId: v.id("teams"),
    points: v.number(),
    /** True for a team that held no lineup in a gameweek begun before #637 gave every team one,
     *  so scored 0 (gameweekScores.ts's TeamGameweek); absent otherwise. */
    noLineup: v.optional(v.boolean()),
    /** The gameweek's matches it was scored from: a match moved in or out since reopens it. */
    fixtureCodes: v.array(v.number()),
    storedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** A commissioner's override of one player's points in one locked match (#32, spec/14): his
   *  points there in place of what his record scores. One row a league, match and player, a
   *  second override replacing the first; written only by convex/table/pointsOverrides.ts. */
  pointsOverrides: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    fixtureCode: v.number(),
    playerCode: v.number(),
    points: v.number(),
    reason: v.string(),
    /** Who set it, by email, and when. */
    by: v.string(),
    at: v.number(),
  })
    .index("by_leagueId_and_fixtureCode_and_playerCode", ["leagueId", "fixtureCode", "playerCode"])
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"]),
};
