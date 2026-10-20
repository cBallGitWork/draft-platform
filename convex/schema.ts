import { defineSchema, defineTable } from "convex/server";
import { v, type VLiteral } from "convex/values";
import { POSITIONS, type Position } from "./positionTables";

/** What one read of a feed found: a count of what came back, or why it failed. */
export const feedOutcome = v.union(
  v.object({ ok: v.literal(true), count: v.number() }),
  v.object({ ok: v.literal(false), error: v.string() }),
);

export const feedCheckTrigger = v.union(v.literal("manual"), v.literal("timer"));

// One row per run of feeds.check (issue #7): proof that Convex reaches both feeds,
// and, for a "timer" run, that a scheduled function fired with nobody watching.
export const feedCheckFields = {
  trigger: feedCheckTrigger,
  scheduledFor: v.optional(v.number()),
  ranAt: v.number(),
  fplPlayers: feedOutcome,
  plFixtures: feedOutcome,
  arsenalSquadNumbers: feedOutcome,
};

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

// The schema is live: clubs, players, fixtures, gameweeks and footballSyncs hold rows written
// before #64, so every field added since is optional, or the next push would refuse those rows.
// Renaming a field is a migration, never an edit here.

/** When the feed stopped sending a held row: the `ranAt` of the first sync without it. Absent
 *  while the row is sent. The row is kept, never deleted, and unmarked when sent again, found by
 *  its key as ever: a player by his `code` (#64). */
const droppedAt = v.optional(v.number());

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
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

// Match stats (#27, spec/07 "Match stats"): one record per player per match, both feeds merged,
// keyed on FPL's player and fixture codes. Stats keep the feeds' own names (spec/14 names them
// later); a stat a whole record leaves out is 0.

/** Provisional until full time and every man who played has both feeds' records; complete then;
 *  locked when the correction window closes, after which a correction changes nothing. */
export const matchStatsState = v.union(v.literal("provisional"), v.literal("complete"), v.literal("locked"));

export const playerMatchRecord = v.object({
  playerCode: v.number(),
  fixtureCode: v.number(),
  started: v.boolean(),
  /** False for an unused substitute; null while no feed has sent a substitute's minutes. */
  played: v.union(v.boolean(), v.null()),
  /** Whether each feed has sent his record for this match. */
  arrived: v.object({ fpl: v.boolean(), pl: v.boolean() }),
  stats: v.record(v.string(), v.number()),
});

/** One match's place in the window. `fullTimeAt` is when a read first found it at full time;
 *  `completeAt` when every record it needs had arrived (absent while provisional). */
const matchStatsStatusFields = {
  fixtureCode: v.number(),
  state: matchStatsState,
  fullTimeAt: v.number(),
  completeAt: v.optional(v.number()),
  lockedAt: v.optional(v.number()),
  lastReadAt: v.number(),
};

/** A stat a feed changed after the lock, for the feeds page (spec/15): the locked value and the sent one. */
export const lateStatChange = v.object({ stat: v.string(), locked: v.number(), sent: v.number() });

/** The platform's own settings, the admin's to change (spec/15). A league's rules are never here. */
const platformSettingName = v.literal("statCorrectionWindowMinutes");

/** What one sync did with one match. */
export const matchSyncOutcome = v.union(
  v.object({
    fixtureCode: v.number(),
    ok: v.literal(true),
    state: matchStatsState,
    players: v.number(),
    inserted: v.number(),
    updated: v.number(),
    lateCorrections: v.number(),
    /** Men a team sheet names whom FPL does not list: no record, since there is no code to key it on. */
    unmatched: v.array(v.object({ plPlayerId: v.number(), name: v.string(), opta: v.union(v.string(), v.null()) })),
  }),
  v.object({ fixtureCode: v.number(), ok: v.literal(false), error: v.string() }),
);

// One row per run of matchStatsSync.run, so a failed read is on record, never silent.
export const matchStatsSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      matches: v.array(matchSyncOutcome),
      /** Matches due whose Premier League status is not yet full time. */
      waiting: v.array(v.number()),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

const matchStatsTables = {
  playerMatchStats: defineTable(playerMatchRecord.extend({ state: matchStatsState })).index("by_fixtureCode_and_playerCode", [
    "fixtureCode",
    "playerCode",
  ]),
  matchStatsStatus: defineTable(matchStatsStatusFields).index("by_fixtureCode", ["fixtureCode"]),
  lateStatCorrections: defineTable({
    fixtureCode: v.number(),
    playerCode: v.number(),
    seenAt: v.number(),
    changes: v.array(lateStatChange),
  }).index("by_fixtureCode_and_playerCode", ["fixtureCode", "playerCode"]),
  platformSettings: defineTable({ name: platformSettingName, value: v.number() }).index("by_name", ["name"]),
  matchStatsSyncs: defineTable(matchStatsSyncFields),
  /** When a run last tried each match, read or not: one that never reads steps behind the rest. */
  matchStatsTries: defineTable({ fixtureCode: v.number(), triedAt: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
};

// Positions (#22). Kept apart from `players`, which the football sync rewrites every six hours, so
// no feed read touches the admin's say. Each row is keyed on FPL's season-stable `code`.

// `v.union` takes two or more members, which a mapped array cannot promise its type.
const positionLiterals = POSITIONS.map((position) => v.literal(position));
export const position = v.union(...(positionLiterals as [VLiteral<Position>, VLiteral<Position>, ...VLiteral<Position>[]]));

/** One match a player started, where he lined up: `Start` in positions.ts. */
export const startRecord = v.object({
  fixtureCode: v.number(),
  kickoff: v.number(),
  formation: v.union(v.string(), v.null()),
  line: v.union(v.number(), v.null()),
  place: v.union(v.number(), v.null()),
});

export const playerPositionFields = {
  code: v.number(),
  /** The Premier League's `positionInfo` for him, his squad's or else his newest sheet's; absent
   *  until one names him. */
  plLabel: v.optional(v.string()),
  /** His newest starts, at most `START_WINDOW`, newest first. */
  starts: v.array(startRecord),
  // The admin's say (`AdminPositions` in positions.ts): only his actions write these.
  approved: v.array(position),
  confirmedLabel: v.optional(v.string()),
  set: v.array(position),
  removed: v.array(position),
};

export const approveMode = v.union(v.literal("proposals"), v.literal("countAtOnce"));

/** How positions from starts count: a single row, absent until the admin first sets it. */
export const positionSettingsFields = { approveMode };

// One row per run of positionsSync.run, so a failed read is on record, never silent.
export const positionsSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      /** Matches whose sheets were read this run, and those played but left for the next. */
      matchesRead: v.number(),
      matchesLeft: v.number(),
      /** Matches whose sheets do not draw the men they start, each with why: not filed, so read
       *  again next run. */
      matchesRefused: v.array(v.string()),
      startsAdded: v.number(),
      /** Men a squad or a sheet names whom FPL does not list (gone abroad, say): not held. */
      unmatchedPlayers: v.number(),
      labelsReceived: v.number(),
      labelsChanged: v.number(),
      /** What the tables in positionTables.ts do not know: each needs a row before it counts. */
      unknownFormations: v.array(v.string()),
      unknownLabels: v.array(v.string()),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

export default defineSchema({
  ...matchStatsTables,
  feedChecks: defineTable(feedCheckFields),
  clubs: defineTable(clubRecord.extend({ droppedAt })).index("by_code", ["code"]),
  players: defineTable(playerRecord.extend({ droppedAt })).index("by_code", ["code"]).index("by_clubCode", ["clubCode"]),
  fixtures: defineTable(fixtureRecord.extend({ droppedAt })).index("by_code", ["code"]),
  gameweeks: defineTable(gameweekRecord.extend({ droppedAt })).index("by_number", ["number"]),
  footballSyncs: defineTable(footballSyncFields),
  playerPositions: defineTable(playerPositionFields).index("by_code", ["code"]),
  /** Each match whose sheets the positions sync has filed, so none is filed twice. */
  positionSheets: defineTable({ fixtureCode: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
  positionSettings: defineTable(positionSettingsFields),
  positionsSyncs: defineTable(positionsSyncFields),
});
