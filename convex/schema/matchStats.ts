import { defineTable } from "convex/server";
import { v } from "convex/values";
import { scoreWrites, syncTrigger } from "./football";

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
    /** The men inserted or updated, whose points to recompute (#28). Absent on runs before it. */
    changed: v.optional(v.array(v.number())),
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
      /** The due matches' scores; absent on runs before #49's scores, and on a run with none due. */
      scores: v.optional(scoreWrites),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

export const matchStatsTables = {
  playerMatchStats: defineTable(playerMatchRecord.extend({ state: matchStatsState }))
    .index("by_fixtureCode_and_playerCode", ["fixtureCode", "playerCode"])
    // A player's matches, for his card (#381), whichever clubs he played them for.
    .index("by_playerCode", ["playerCode"]),
  matchStatsStatus: defineTable(matchStatsStatusFields)
    .index("by_fixtureCode", ["fixtureCode"])
    // The feeds page's matches still provisional past their window (spec/15).
    .index("by_state_and_fullTimeAt", ["state", "fullTimeAt"])
    // The locked matches still watched for a late correction (matchStatsDue.due, #199).
    .index("by_state_and_lockedAt", ["state", "lockedAt"]),
  lateStatCorrections: defineTable({
    fixtureCode: v.number(),
    playerCode: v.number(),
    seenAt: v.number(),
    changes: v.array(lateStatChange),
  }).index("by_fixtureCode_and_playerCode", ["fixtureCode", "playerCode"]),
  platformSettings: defineTable({ name: platformSettingName, value: v.number() }).index("by_name", ["name"]),
  matchStatsSyncs: defineTable(matchStatsSyncFields),
  /** Each player's records added up for a season (#373, seasonStats.ts), so Scouting sorts every
   *  player by any stat without reading a season of records: one row a player and season, kept
   *  in step as each record is written. `season` is the year it starts (shared/time.ts's
   *  `seasonStartYear` of the match's kickoff). */
  playerSeasonStats: defineTable({ season: v.number(), playerCode: v.number(), stats: v.record(v.string(), v.number()) }).index(
    "by_season_and_playerCode",
    ["season", "playerCode"],
  ),
  /** What each team's counted players did in a final gameweek, added up (#800, spec/19 The stat
   *  race; teamSeasonStats.ts): its starters and the bench players who came on, as the gameweek
   *  scorer counted them. One row a league, gameweek and team, kept so a gameweek reopened or
   *  scored again takes away exactly what it added. `fixtureCodes` are the matches it was added
   *  up from: a match moved in or out since makes it stale. */
  teamGameweekStats: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    teamId: v.id("teams"),
    fixtureCodes: v.array(v.number()),
    stats: v.record(v.string(), v.number()),
  }).index("by_leagueId_and_gameweek_and_teamId", ["leagueId", "gameweek", "teamId"]),
  /** Each team's season totals, its teamGameweekStats rows added up, so Scouting ranks the
   *  league's teams by any stat with one small row a team (#800). */
  teamSeasonStats: defineTable({ leagueId: v.id("leagues"), teamId: v.id("teams"), stats: v.record(v.string(), v.number()) }).index(
    "by_leagueId_and_teamId",
    ["leagueId", "teamId"],
  ),
  /** When a run last tried each match, read or not: one that never reads steps behind the rest. */
  matchStatsTries: defineTable({ fixtureCode: v.number(), triedAt: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
  /** One row: the kickoff from which matchStatsDue.due reads the fixtures for matches past full time
   *  with no status row yet (#199). Every current match kicked off before it has one; absent, the
   *  whole season is read. */
  matchStatsUnseenFrom: defineTable({ kickoff: v.number() }),
};
