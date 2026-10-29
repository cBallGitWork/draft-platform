import { defineTable } from "convex/server";
import { v } from "convex/values";

// The real Premier League, as the football layer hands it over (#21). Each row is keyed on a
// season-stable code, never FPL's per-season id, and names its clubs by their codes too, so a
// new season's ids change nothing. A gameweek is keyed on its number, as FPL numbers them.
// Times are epoch milliseconds.

export const clubRecord = v.object({
  code: v.number(),
  name: v.string(),
  /** Three letters, e.g. "ARS". */
  shortName: v.string(),
});

export const playerRecord = v.object({
  code: v.number(),
  /** FPL's short display name, e.g. "Saka". */
  name: v.string(),
  fullName: v.string(),
  clubCode: v.number(),
  /** FPL's news on why he may miss the next match, "" with none (#381); absent on rows from before it. */
  news: v.optional(v.string()),
  /** FPL's chance he plays in the next round, in percent, null while it has no doubt about him
   *  (#381); absent on rows from before it. */
  chanceOfPlaying: v.optional(v.union(v.number(), v.null())),
});

export const fixtureRecord = v.object({
  code: v.number(),
  /** Null while a postponed match waits for a new date. */
  gameweek: v.union(v.number(), v.null()),
  homeClubCode: v.number(),
  awayClubCode: v.number(),
  /** Null while a match has no kickoff time. */
  kickoff: v.union(v.number(), v.null()),
});

export const gameweekRecord = v.object({
  number: v.number(),
  /** FPL's own deadline. A league's deadline is its own rule (spec/03), worked out from the kickoffs. */
  deadline: v.number(),
});

// Each match's score and clock (#49, #50), written by both feeds, so kept apart from `fixtures`,
// FPL's record rewritten whole: football/matchScores.ts.

/** Where a match stands. The Premier League's half-time is its own; FPL's feed has none. */
export const matchState = v.union(v.literal("upcoming"), v.literal("live"), v.literal("halfTime"), v.literal("fullTime"));

/** The feed a score was read from. */
export const scoreFeed = v.union(v.literal("fpl"), v.literal("pl"));

/** One match's score as one read gives it. */
export const scoreRead = v.object({
  fixtureCode: v.number(),
  state: matchState,
  /** Null before kickoff, when there is no score yet (the Premier League sends 0–0 then). */
  homeGoals: v.union(v.number(), v.null()),
  awayGoals: v.union(v.number(), v.null()),
  /** The minute on the match clock, null before kickoff: FPL's `minutes`, or the whole minutes of
   *  the Premier League's clock, which restarts at 45 for the second half and runs on in stoppage. */
  minutes: v.union(v.number(), v.null()),
  /** The Premier League's own clock label, e.g. "45+3'00"; null from FPL, which sends none. */
  clockLabel: v.union(v.string(), v.null()),
});

/** A match whose score a read could not give, and why: kept on the run row, never written. */
export const scoreProblem = v.object({ fixtureCode: v.number(), problem: v.string() });

/** One run's share of the scores: the matches read, how many rows changed, and the problems. */
export const scoreWrites = v.object({ received: v.number(), written: v.number(), problems: v.array(scoreProblem) });

// The schema is live: clubs, players, fixtures, gameweeks and footballSyncs hold rows written
// before #64, so every field added since is optional, or the next push would refuse those rows.
// Renaming a field is a migration, never an edit here.

/** When the feed stopped sending a held row: the `ranAt` of the first sync without it. Absent
 *  while the row is sent. The row is kept, never deleted, and unmarked when sent again, found by
 *  its key as ever: a player by his `code` (#64). */
export const droppedAt = v.optional(v.number());

/** One table's share of a sync: the rows the feed sent, how many were new or had changed, and
 *  how many held rows it marked as no longer sent or unmarked as sent again (absent on runs before #64). */
export const tableWrites = v.object({
  received: v.number(),
  inserted: v.number(),
  updated: v.number(),
  marked: v.optional(v.number()),
  unmarked: v.optional(v.number()),
});

/** Who started a sync: someone by hand, or its cron. */
export const syncTrigger = v.union(v.literal("manual"), v.literal("cron"));

// One row per run of footballSync.run, so a failed fetch is on record, never silent.
export const footballSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      clubs: tableWrites,
      players: tableWrites,
      fixtures: tableWrites,
      gameweeks: tableWrites,
      /** Absent on runs before #49's scores. */
      scores: v.optional(scoreWrites),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

export const footballTables = {
  clubs: defineTable(clubRecord.extend({ droppedAt })).index("by_code", ["code"]).index("by_droppedAt", ["droppedAt"]),
  players: defineTable(playerRecord.extend({ droppedAt }))
    .index("by_code", ["code"])
    .index("by_clubCode_and_droppedAt", ["clubCode", "droppedAt"])
    .index("by_droppedAt", ["droppedAt"])
    .searchIndex("search_fullName", { searchField: "fullName", filterFields: ["droppedAt"] }),
  fixtures: defineTable(fixtureRecord.extend({ droppedAt }))
    .index("by_code", ["code"])
    .index("by_kickoff", ["kickoff"])
    .index("by_droppedAt_and_kickoff", ["droppedAt", "kickoff"])
    // A gameweek's matches, for the Premier League's fixtures and results (#49).
    .index("by_gameweek_and_droppedAt", ["gameweek", "droppedAt"]),
  gameweeks: defineTable(gameweekRecord.extend({ droppedAt })).index("by_number", ["number"]).index("by_droppedAt", ["droppedAt"]),
  footballSyncs: defineTable(footballSyncFields),
  /** Each match's newest score, which feed gave it and when that read was made. */
  matchScores: defineTable(scoreRead.extend({ feed: scoreFeed, readAt: v.number() })).index("by_fixtureCode", ["fixtureCode"]),
};
