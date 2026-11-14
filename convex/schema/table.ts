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
  /** The live gameweek as the league's screens read it while a match is on (#2007): each team's
   *  points and the matchday Vidiprinter's lines, scored once a live tick rather than once a
   *  viewer. One row a league and gameweek, written only by convex/table/liveScores.ts, which says
   *  when it is read and when it goes. */
  liveScores: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    /** The league's teams it was scored for: a team added or removed since sets it aside. */
    teamIds: v.array(v.id("teams")),
    /** The gameweek's matches it was scored from: a match moved in or out since sets it aside. */
    fixtureCodes: v.array(v.number()),
    /** Each team's points, or why the gameweek can't be scored (gameweekScores.ts's unscored). */
    teams: v.union(
      v.object({ kind: v.literal("scored"), scores: v.array(v.object({ teamId: v.id("teams"), points: v.number(), provisional: v.boolean() })) }),
      v.object({ kind: v.literal("unscored"), reason: v.string() }),
    ),
    /** The lines of the gameweek's matches that move a head-to-head, newest first, each with its
     *  match, and the moment each match's commentary is delayed from; or why they can't be read. */
    vidiprinter: v.union(
      v.object({
        kind: v.literal("read"),
        lines: v.array(v.object({ fixtureCode: v.number(), key: v.string(), text: v.string(), points: v.union(v.string(), v.null()) })),
        delays: v.array(v.object({ fixtureCode: v.number(), delayedFrom: v.union(v.number(), v.null()) })),
      }),
      v.object({ kind: v.literal("unread"), reason: v.string() }),
    ),
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
