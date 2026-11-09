import { defineTable } from "convex/server";
import { v } from "convex/values";
import { clubRecord, droppedAt, failure, fixtureRecord, gameweekRecord, playerRecord, scoreRead, scoreWrites, syncTrigger, tableWrites } from "./football";
import { sideRunFields } from "./live";

// Sportmonks' reads (#1391), slice 1 of the switch off FPL and the Premier League feeds: the
// Scottish Premiership on Sportmonks' free plan, kept apart from the tables FPL fills, so nothing
// the site shows changes yet. Each row is keyed on Sportmonks' own id (a club's, player's or
// match's `code` is Sportmonks' id for it), and a round on its season and number, as a gameweek
// is. football/sportmonks/sportmonksSync.ts writes them.

/** One man in a match's lineups, by Sportmonks' player id, with his stats so far. */
export const sportmonksLineupMan = v.object({
  playerId: v.number(),
  teamId: v.number(),
  /** Named to start (Sportmonks' lineup type), or on the bench. */
  started: v.boolean(),
  /** Sportmonks' `formation_field`, row and column, e.g. "2:3"; null on the bench. */
  formationField: v.union(v.string(), v.null()),
  formationPosition: v.union(v.number(), v.null()),
  /** His running totals, by Sportmonks' statistic type id (`lineups.details`). */
  stats: v.array(v.object({ typeId: v.number(), value: v.number() })),
});

/** One line of a match's events timeline: a goal, a card, a substitution, a VAR call. */
export const sportmonksEvent = v.object({
  id: v.number(),
  /** Sportmonks' event type id. */
  typeId: v.number(),
  minute: v.union(v.number(), v.null()),
  extraMinute: v.union(v.number(), v.null()),
  teamId: v.union(v.number(), v.null()),
  playerId: v.union(v.number(), v.null()),
  /** The other man in it: the one assisting a goal, or coming off for a substitute. */
  relatedPlayerId: v.union(v.number(), v.null()),
  /** The score after a goal, e.g. "1-0". */
  result: v.union(v.string(), v.null()),
  info: v.union(v.string(), v.null()),
  addition: v.union(v.string(), v.null()),
});

/** One run of the six-hourly read: what each table took, or why it failed. */
export const sportmonksSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      clubs: tableWrites,
      players: tableWrites,
      fixtures: tableWrites,
      rounds: tableWrites,
      /** True when Sportmonks sent no fixtures for the season, so none were upserted or marked. */
      betweenSeasons: v.optional(v.literal(true)),
      scores: scoreWrites,
    }),
    failure,
  ),
};

export const sportmonksTables = {
  sportmonksClubs: defineTable(clubRecord.extend({ droppedAt })).index("by_code", ["code"]),
  sportmonksPlayers: defineTable(playerRecord.extend({ droppedAt })).index("by_code", ["code"]),
  sportmonksFixtures: defineTable(fixtureRecord.extend({ droppedAt })).index("by_code", ["code"]).index("by_kickoff", ["kickoff"]),
  sportmonksRounds: defineTable(gameweekRecord.extend({ droppedAt })).index("by_season_and_number", ["season", "number"]),
  /** Each match's newest score and clock, from the six-hourly read or the live one. */
  sportmonksScores: defineTable(scoreRead.extend({ readAt: v.number() })).index("by_fixtureCode", ["fixtureCode"]),
  /** Each match's lineups and events as the newest live read gave them, replaced whole by each. */
  sportmonksMatches: defineTable({
    fixtureCode: v.number(),
    men: v.array(sportmonksLineupMan),
    /** By minute, then extra minute, as Sportmonks orders them. */
    events: v.array(sportmonksEvent),
    readAt: v.number(),
  }).index("by_fixtureCode", ["fixtureCode"]),
  sportmonksSyncs: defineTable(sportmonksSyncFields),
  /** One row a live tick that found a Scottish match on, each match read or why not. */
  sportmonksLiveTicks: defineTable(sideRunFields),
};
