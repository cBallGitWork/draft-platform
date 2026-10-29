import { defineTable } from "convex/server";
import { v } from "convex/values";
import { scoreWrites } from "./football";
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
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

export const liveStatsTables = {
  liveStatsTicks: defineTable(liveStatsTickFields),
};

// Each match's commentary as written from the Premier League's stream (#43, spec/10): one row a
// match, its lines replaced whole by each read, and kept after the gameweek as written
// (football/matchCommentary.ts).

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
    /** Newest first, as the feed's. */
    lines: v.array(commentaryLine),
    /** Null while the stream keeps up. */
    delayed: v.union(commentaryDelay, v.null()),
  }).index("by_fixtureCode", ["fixtureCode"]),
};

// The threshold lines' moments (#44, spec/10): each live read that showed a man's running total
// pass a point where a rule's points change, with the clock then (stats/thresholdSteps.ts).
export const thresholdStepTables = {
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
