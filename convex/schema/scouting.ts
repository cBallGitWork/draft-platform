import { defineTable } from "convex/server";
import { v } from "convex/values";

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
};
