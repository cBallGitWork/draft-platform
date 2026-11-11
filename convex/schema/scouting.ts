import { defineTable } from "convex/server";
import { v } from "convex/values";
import { droppedAt } from "./football";
import { positionInputs } from "./positions";

// Scouts (#375, spec/19 Scouts and The report): each time a team sends one of its scouts to a
// player, one row, kept for good so its report stays readable with its date. Private to the team:
// only its manager reads them (scouting/scouts.ts).

/** Where a scout's trip stands: out watching him, back with his report, or back with none because
 *  the player left the Premier League while he was out (Craig, 6 Nov 2026, on #375). */
export const scoutState = v.union(v.literal("out"), v.literal("reported"), v.literal("playerLeft"));

export const scoutTables = {
  scouts: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    playerCode: v.number(),
    sentAt: v.number(),
    /** When his report is ready: 24 hours after he was sent (spec/19). */
    dueAt: v.number(),
    state: scoutState,
    /** The report, once written, and when (spec/19, The report). */
    report: v.optional(v.object({ text: v.string(), writtenAt: v.number() })),
    /** How many times writing the report has failed, and the last failure's words, while it is
     *  tried again (scouting/scoutReports.ts). Absent until one fails. */
    failedTries: v.optional(v.number()),
    lastFailure: v.optional(v.string()),
  })
    // Deleting a league deletes its scouts (leagues/leagueDeletion.ts).
    .index("by_leagueId", ["leagueId"])
    .index("by_teamId_and_state", ["teamId", "state"])
    .index("by_teamId_and_sentAt", ["teamId", "sentAt"])
    .index("by_teamId_and_playerCode_and_sentAt", ["teamId", "playerCode", "sentAt"]),
  /** Each player as Scouting's list reads him (#1559, scouting/scoutingPlayers.ts): his row of
   *  `players`, what his positions are worked out from (his `playerPositions` row) and his newest
   *  season's totals (`playerSeasonStats`), copied onto one row, so the list reads one row a
   *  player, not three. Every write to those rows writes this one too; nothing else writes it. */
  scoutingPlayers: defineTable({
    code: v.number(),
    name: v.string(),
    fullName: v.string(),
    clubCode: v.number(),
    droppedAt,
    positions: positionInputs,
    /** His newest season's totals and that season, by the year it starts; absent while he has none. */
    totals: v.optional(v.object({ season: v.number(), stats: v.record(v.string(), v.number()) })),
  })
    .index("by_code", ["code"])
    .index("by_clubCode_and_droppedAt", ["clubCode", "droppedAt"]),
};
