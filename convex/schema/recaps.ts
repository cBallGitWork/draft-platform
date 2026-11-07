import { defineTable } from "convex/server";
import { v } from "convex/values";

// League home's weekly recaps (#387; spec/12, League home): one a league a gameweek, written by
// Claude from facts only once every match of the gameweek is final (home/recaps.ts). Written once
// and never rewritten (Craig, 6 Nov 2026, on #387).

/** Where a recap stands: being written, or written. */
export const recapState = v.union(v.literal("writing"), v.literal("written"));

export const recapTables = {
  recaps: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    state: recapState,
    /** The recap, once written, and when. */
    text: v.optional(v.string()),
    writtenAt: v.optional(v.number()),
    /** Each team's points as the recap was written from them: a score that differs later puts a
     *  line under it saying so (Craig, 6 Nov 2026). Empty while it is being written. */
    teamPoints: v.array(v.object({ teamId: v.id("teams"), points: v.number() })),
    /** How many times writing it has failed, and the last failure's words, while it is tried
     *  again. Absent until one fails. */
    failedTries: v.optional(v.number()),
    lastFailure: v.optional(v.string()),
  })
    // Deleting a league deletes its recaps (leagues/leagueDeletion.ts).
    .index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
};
