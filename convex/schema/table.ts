import { defineTable } from "convex/server";
import { v } from "convex/values";
import { LEAGUE_AVERAGE } from "../table/roundRobin";

/** A gameweek's head-to-head fixtures, and the teams left over with a bye. */
const gameweekGames = {
  fixtures: v.array(v.object({ team: v.id("teams"), opponent: v.union(v.id("teams"), v.literal(LEAGUE_AVERAGE)) })),
  /** The teams left over with a bye, in a league whose odd team out has one. */
  byes: v.array(v.id("teams")),
};

// A league's head-to-head fixtures in each gameweek it has begun, stored once the gameweek begins
// and read from here ever after (#137); none in one begun with no head-to-head, such as before the
// league was made (#282). One row a league and gameweek, written only by
// convex/table/playedFixtures.ts, which says why.
export const tableTables = {
  playedFixtures: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    ...gameweekGames,
    storedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** A commissioner's edit of a gameweek not yet begun (spec/09, Fixture edits; #1208): its
   *  fixtures as edited, held while the gameweek still draws as `drawn`, the draw the edits were
   *  made on. A change that redraws it (spec/13: a rule, a team, a gameweek ticked) replaces them.
   *  Once it begins it is stored as edited (playedFixtures.ts). One row a league and gameweek,
   *  written only by convex/table/fixtureEdits.ts. */
  fixtureEdits: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    ...gameweekGames,
    drawn: v.object(gameweekGames),
    editedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** Each team's points in a gameweek once they are final: every match in it locked, so no
   *  correction can change them (spec/07). One row a league, gameweek and team, written only by
   *  convex/table/finalScores.ts, which says when (#418). */
  finalScores: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    teamId: v.id("teams"),
    points: v.number(),
    /** No longer written or read: it marked a team that held no lineup in a gameweek begun before
     *  #637, so scored 0. The #1040 backfill (lineup/firstLineupBackfill.ts) takes it off every
     *  row, and once it has run on each deployment this field can go. */
    noLineup: v.optional(v.boolean()),
    /** The gameweek's matches it was scored from: a match moved in or out since reopens it. */
    fixtureCodes: v.array(v.number()),
    storedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** A commissioner's override of one player's points in one match (#32, spec/14), open or
   *  locked: his points there in place of what his record scores, standing over any later
   *  correction until changed or removed (#903). One row a league, match and player, a second
   *  override replacing the first; written only by convex/table/pointsOverrides.ts. */
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
  /** A commissioner's override of one team's total in one gameweek (#903, spec/14 S14.3): its
   *  total there, the head-to-head and the table following it, standing over the gameweek's
   *  player overrides and any later correction until changed or removed. One row a league,
   *  gameweek and team, a second override replacing the first; written only by
   *  convex/table/teamOverrides.ts. */
  teamOverrides: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    teamId: v.id("teams"),
    points: v.number(),
    reason: v.string(),
    /** Who set it, by email, and when. */
    by: v.string(),
    at: v.number(),
  }).index("by_leagueId_and_gameweek_and_teamId", ["leagueId", "gameweek", "teamId"]),
};
