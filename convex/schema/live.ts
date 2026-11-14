import { defineTable } from "convex/server";
import { v } from "convex/values";
import { failure, matchFailure, scoreWrites } from "./football";
import { matchSyncOutcome } from "./matchStats";

// The live poller (#28): one row per tick that found a match live, so a failed one is on record.
export const liveStatsTickFields = {
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      matches: v.array(matchSyncOutcome),
      /** The live matches' scores; absent on ticks before #49's scores. */
      scores: v.optional(scoreWrites),
    }),
    failure,
  ),
};

/** The live ticks that run themselves near matches (#1999, stats/liveTicks.ts): FPL's and Sportmonks'. */
export const liveTickFeed = v.union(v.literal("liveStats"), v.literal("sportmonksLive"));

export const liveStatsTables = {
  liveStatsTicks: defineTable(liveStatsTickFields),
  /** Each live tick's next run, one row a feed, so a sync arming it never starts a second chain. */
  liveTickChains: defineTable({ feed: liveTickFeed, scheduledId: v.id("_scheduled_functions") }).index("by_feed", ["feed"]),
  /** One compact row a match while it is live (#2006, stats/livePrints.ts): each man's record as a
   *  print, so a tick reads this one row, not his every record, to find who moved. Its being there
   *  says the match's records are not yet in anyone's season totals; full time counts them and
   *  deletes it. */
  liveMatchPrints: defineTable({
    fixtureCode: v.number(),
    prints: v.array(v.object({ playerCode: v.number(), print: v.number() })),
  }).index("by_fixtureCode", ["fixtureCode"]),
};

// The live tick's side reads, each its own feed (#522, admin/sideRuns.ts): one row per run with a
// match to work on, so a failure is on record, never only a line in the logs.

/** One match a side read worked on: done, or why not. */
export const sideMatchOutcome = v.union(
  v.object({ fixtureCode: v.number(), ok: v.literal(true) }),
  matchFailure,
);

export const sideRunFields = {
  ranAt: v.number(),
  outcome: v.union(
    v.object({ ok: v.literal(true), matches: v.array(sideMatchOutcome) }),
    failure,
  ),
};

export const sideRunTables = {
  teamSheetsRuns: defineTable(sideRunFields),
  teamStatsRuns: defineTable(sideRunFields),
  thresholdStepsRuns: defineTable(sideRunFields),
};

// Each match's commentary as written from the Premier League's stream (#43, spec/10): one row a
// match for its delay and its lines in chunks, each read writing only the chunks it changes, and
// kept after the gameweek as written (football/matchCommentary.ts, football/commentaryChunks.ts).

/** One of our lines, with the feed line it was written from, and that line's minute, type and men
 *  as FPL codes (null for a man FPL does not list), which the matchup sorts and prices by (#44).
 *  Those are absent on lines stored before they were kept; a match's next read writes them. */
export const commentaryLine = v.object({
  sourceId: v.number(),
  text: v.string(),
  minute: v.optional(v.union(v.number(), v.null())),
  addedMinute: v.optional(v.union(v.number(), v.null())),
  type: v.optional(v.string()),
  playerCodes: v.optional(v.array(v.union(v.number(), v.null()))),
});

/** Why a match's commentary is delayed, and since when: a read that failed, a stream behind the
 *  match clock, or a line it could not word. */
const commentaryDelay = v.object({ reason: v.string(), since: v.number() });

export const commentaryTables = {
  matchCommentary: defineTable({
    fixtureCode: v.number(),
    /** The lines as stored before #2004, newest first, held whole on this row: read as the match's
     *  lines while it has no chunks, and moved to them by its next store or
     *  football/commentaryChunksMove.ts. Absent on every row stored since. */
    lines: v.optional(v.array(commentaryLine)),
    /** Null while the stream keeps up. */
    delayed: v.union(commentaryDelay, v.null()),
  }).index("by_fixtureCode", ["fixtureCode"]),
  /** A match's lines, COMMENTARY_LINES_A_CHUNK a row counted from its oldest (#2004), so a read
   *  that adds a line rewrites only the newest chunk, not every line the match has had. */
  commentaryChunks: defineTable({
    fixtureCode: v.number(),
    /** 0 for the match's oldest lines. */
    chunk: v.number(),
    /** Newest first, as the feed's. */
    lines: v.array(commentaryLine),
  }).index("by_fixtureCode_and_chunk", ["fixtureCode", "chunk"]),
};

// The threshold lines' moments (#44, #835, spec/10): each live read that showed a stat move a man's
// points, up or down, under some slot's pricing, with the clock then (matchup/thresholdSteps.ts).

/** One man's stat as a read showed it move his points. */
export const thresholdStep = v.object({
  playerCode: v.number(),
  /** The rule's stat, a catalogue stat or an own stat, and his total before and after the read. */
  stat: v.string(),
  from: v.number(),
  to: v.number(),
  /** His minutes then, which a rule's minimum is judged by. */
  minutes: v.number(),
});

export const thresholdStepTables = {
  /** A live read's steps, at most THRESHOLD_STEPS_A_ROW a row (#871): a match's rows stay about as
   *  few as its reads, so a set whose roles adjust every pass fits in one query. */
  thresholdStepReads: defineTable({
    fixtureCode: v.number(),
    /** The match clock then, null where the read gave none. */
    minute: v.union(v.number(), v.null()),
    steps: v.array(thresholdStep),
  }).index("by_fixtureCode", ["fixtureCode"]),
  /** One row a step, as stored before #871: neither read nor written. Kept only until the rows the
   *  production deployment still holds are cleared (stats/oldThresholdStepsClear.ts), as a schema
   *  without it can't deploy over them (#1755). */
  thresholdSteps: defineTable({
    fixtureCode: v.number(),
    playerCode: v.number(),
    /** The rule's stat, a catalogue stat or an own stat, and his total before and after the read. */
    stat: v.string(),
    from: v.number(),
    to: v.number(),
    /** His minutes then, which a rule's minimum is judged by. */
    minutes: v.number(),
    /** The match clock then, null where the read gave none. */
    minute: v.union(v.number(), v.null()),
  }).index("by_fixtureCode", ["fixtureCode"]),
};

// Each match's five team stats (#45, spec/10, The match page): one row a match, replaced by each
// read that changes them, and kept after full time as last read (football/matchTeamStats.ts).

/** One side's five, as `football/premierLeague/plTeamStats.ts` maps them from Opta. */
export const sideTeamStats = v.object({
  shots: v.number(),
  shotsOnTarget: v.number(),
  /** A share out of 100, to Opta's decimal place (49.4); null while Opta sends none, as in a
   *  match's first minutes. */
  possession: v.union(v.number(), v.null()),
  corners: v.number(),
  yellowCards: v.number(),
  redCards: v.number(),
});

export const teamStatsTables = {
  matchTeamStats: defineTable({
    fixtureCode: v.number(),
    home: sideTeamStats,
    away: sideTeamStats,
  }).index("by_fixtureCode", ["fixtureCode"]),
};

// Each match's team sheets before kickoff (#45, spec/10, The match page: "From the lineups, about
// an hour before kickoff"): one row a match, replaced by each read that changes them, so a change
// made in the warm-up shows. From kickoff the match's records, written from the same sheets, are
// what the page shows (football/matchTeamSheets.ts).

/** One man the sheets name, by FPL's code: a starter, or a substitute. */
export const teamSheetMan = v.object({ playerCode: v.number(), started: v.boolean() });

export const teamSheetTables = {
  matchTeamSheets: defineTable({
    fixtureCode: v.number(),
    /** Both sides' men in the feed's order, home's sheet first. */
    men: v.array(teamSheetMan),
  }).index("by_fixtureCode", ["fixtureCode"]),
};
