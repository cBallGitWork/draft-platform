import { defineTable } from "convex/server";
import { v } from "convex/values";

// Waivers (#1197, #1198; spec/08 Waivers and free agency): the players on waivers in a league, by
// FPL's season-stable code, one row each at most. A player no team holds and with no row is a free
// agent. The run (../waivers/waiverRun.ts) takes a row's player for his winning claim, or frees him.

export const waiverTables = {
  waiverPlayers: defineTable({
    leagueId: v.id("leagues"),
    playerCode: v.number(),
    /** The first moment a run may take him: 24 hours after his drop, or when he went on waivers for
     *  the next run, as a new Premier League player or one nobody drafted. */
    claimableFrom: v.number(),
  }).index("by_leagueId_and_playerCode", ["leagueId", "playerCode"]),
  /** A manager's pending claim (#1198): the player on waivers he wants and, with a full squad, who
   *  he drops if it succeeds. A run takes it away, won or failed. */
  waiverClaims: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    playerCode: v.number(),
    /** Who goes if the claim succeeds, or null for nobody. */
    dropCode: v.union(v.number(), v.null()),
    /** Its place among the team's claims, lowest first: the first is tried first. */
    rank: v.number(),
    /** Who put it in: the league's letter says it is theirs, and a failed one is told to them. */
    by: v.string(),
  }).index("by_leagueId_and_teamId_and_rank", ["leagueId", "teamId", "rank"]),
  /** A league's waiver order between runs (#1198), one row at most: the teams that won a claim, the
   *  latest last, who go to the bottom of the order (../waivers/waiverOrder.ts), and when waivers
   *  last ran. */
  waiverOrders: defineTable({
    leagueId: v.id("leagues"),
    winners: v.array(v.id("teams")),
    /** The latest gameweek the league had begun when `winners` was last written, null before its
     *  first: under reverse table order they go back up once a later one has begun. */
    gameweek: v.union(v.number(), v.null()),
    /** The scheduled moment of the league's last run, made or skipped, so each runs once. */
    ranAt: v.number(),
    /** The scheduled moment of the league's last run made, never skipped: free agents are picked up
     *  only once one is made after the latest begun gameweek's deadline (#1199, the window). */
    madeAt: v.optional(v.number()),
  }).index("by_leagueId", ["leagueId"]),
};
