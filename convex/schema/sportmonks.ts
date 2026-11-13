import { defineTable } from "convex/server";
import { v } from "convex/values";
import { clubRow, droppedAt, failure, fixtureRecord, gameweekRecord, playerRecord, scoreRead, scoreWrites, syncTrigger, tableWrites } from "./football";
import { sideRunFields } from "./live";
import { startRecord } from "./positions";

// Sportmonks' reads (#1391), slice 1 of the switch off FPL and the Premier League feeds: each
// competition on the list that is on (#1414), every row naming its own, kept apart from the tables
// FPL fills, so nothing the site shows changes yet. Each row is keyed on Sportmonks' own id (a club's, player's or
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

/** The competition a row was read for, by Sportmonks' league id (#1414). Absent only on rows read
 *  before competitions were a list: the next six-hourly read of a competition takes those as its
 *  own, and run rows without one are on no competition's row of the feeds page. */
const competition = v.optional(v.number());

/** One competition Sportmonks is read for (#1414): data, never a constant, so a league the plan
 *  starts covering is a row turned on. Seeded with the beta's two (sportmonks.ts). */
export const sportmonksCompetition = v.object({
  name: v.string(),
  /** Sportmonks' id for the league, e.g. 501 for the Scottish Premiership. */
  competition: v.number(),
  /** Whether the six-hourly read and the live tick read it. */
  on: v.boolean(),
});

/** One run of the six-hourly read for one competition: what each table took, or why it failed. */
export const sportmonksSyncFields = {
  competition,
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

/** One live tick's run for one competition with a match on. */
export const sportmonksTickFields = { competition, ...sideRunFields };

/** One match a man started (#1419): `startRecord`'s formation place, with the season's first
 *  year, and Sportmonks' detailed position for him in it ("Centre Back"), null where it sent none. */
export const sportmonksStart = startRecord.extend({ season: v.number(), detailedPosition: v.union(v.string(), v.null()) });

/** One run of the positions read (#1419): what it filed, and what the tables don't know yet. */
export const sportmonksPositionsSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      /** Played matches whose lineups were read this run, and those left for the next. */
      matchesRead: v.number(),
      matchesLeft: v.number(),
      startsAdded: v.number(),
      labelsReceived: v.number(),
      labelsChanged: v.number(),
      /** What football/sportmonks/sportmonksPositions.ts and positionTables.ts don't know: each
       *  needs a row before it places anyone. */
      unknownFormations: v.array(v.string()),
      unknownLabels: v.array(v.string()),
    }),
    failure,
  ),
};

/** What a link to FPL's code is for (#1421): a club, a man or a match. */
export const sportmonksLinkKind = v.union(v.literal("club"), v.literal("player"), v.literal("match"));

/** Which Sportmonks read gave a match's held score: the six-hourly sync's or the live tick's. */
export const sportmonksReader = v.union(v.literal("sync"), v.literal("live"));

export const sportmonksTables = {
  sportmonksCompetitions: defineTable(sportmonksCompetition).index("by_competition", ["competition"]),
  sportmonksClubs: defineTable(clubRow.extend({ droppedAt, competition })).index("by_code", ["code"]).index("by_competition", ["competition"]),
  sportmonksPlayers: defineTable(playerRecord.extend({ droppedAt, competition })).index("by_code", ["code"]).index("by_competition", ["competition"]),
  sportmonksFixtures: defineTable(fixtureRecord.extend({ droppedAt, competition }))
    .index("by_code", ["code"])
    .index("by_kickoff", ["kickoff"])
    .index("by_competition", ["competition"]),
  // A round is keyed on its competition, season and number: two competitions both have a round 1.
  sportmonksRounds: defineTable(gameweekRecord.extend({ droppedAt, competition })).index("by_competition", ["competition"]),
  /** Each match's newest score and clock, from the six-hourly read or the live one, and which
   *  gave it: missing only on a score held before #1546. */
  sportmonksScores: defineTable(scoreRead.extend({ readAt: v.number(), reader: v.optional(sportmonksReader) })).index("by_fixtureCode", ["fixtureCode"]),
  /** Each match's lineups and events as the newest live read gave them, replaced whole by each. */
  sportmonksMatches: defineTable({
    fixtureCode: v.number(),
    men: v.array(sportmonksLineupMan),
    /** By minute, then extra minute, as Sportmonks orders them. */
    events: v.array(sportmonksEvent),
    readAt: v.number(),
  }).index("by_fixtureCode", ["fixtureCode"]),
  sportmonksSyncs: defineTable(sportmonksSyncFields).index("by_competition", ["competition"]),
  /** Each man's newest starts and Sportmonks' label for him (#1419), by his Sportmonks id: what
   *  his positions are worked out from (football/sportmonks/sportmonksPositions.ts). */
  sportmonksPlayerStarts: defineTable({
    playerCode: v.number(),
    /** His detailed position, or else his broad one, as this season's squads give it; absent
     *  until one does. */
    label: v.optional(v.string()),
    /** At most `START_WINDOW`, newest first. */
    starts: v.array(sportmonksStart),
  }).index("by_playerCode", ["playerCode"]),
  /** Each played match whose lineups the positions read has filed, so none is filed twice. */
  sportmonksLineupsRead: defineTable({ fixtureCode: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
  sportmonksPositionsSyncs: defineTable(sportmonksPositionsSyncFields),
  /** One row a live tick for each competition it found a match on in, each match read or why not. */
  sportmonksLiveTicks: defineTable(sportmonksTickFields).index("by_competition", ["competition"]),
  /** Each Premier League club, man and match Sportmonks sends, by its Sportmonks id (`code`), and
   *  FPL's `code` for it (#1421): what past seasons, keyed on FPL's codes, are converted through
   *  (S14.16). Null while it links to nothing or to two, with the FPL codes it might be, for the
   *  admin to link by hand. A link, once made, stands: the link run never works it out again
   *  (football/sportmonks/fplLinksSync.ts). */
  sportmonksFplLinks: defineTable({
    kind: sportmonksLinkKind,
    code: v.number(),
    fplCode: v.union(v.number(), v.null()),
    /** FPL codes it might be: none when nothing fits, two or more when it can't tell which, and
     *  one that another row has too. Empty once linked. */
    candidates: v.array(v.number()),
    /** Linked by the admin, not by name. */
    byHand: v.optional(v.literal(true)),
    /** When the link run first held it. */
    since: v.number(),
  })
    .index("by_kind_and_code", ["kind", "code"])
    .index("by_kind_and_fplCode", ["kind", "fplCode"]),
  /** When each man first played a minute in a competition, by his Sportmonks id, from the live
   *  read's lineups (#1421): an unlinked Premier League man is listed for the admin from then on
   *  (Craig, 12 Nov 2026: "Once he plays"). */
  sportmonksFirstMinutes: defineTable({ playerCode: v.number(), competition: v.number(), at: v.number() }).index("by_playerCode_and_competition", [
    "playerCode",
    "competition",
  ]),
};
