import { defineTable } from "convex/server";
import { v } from "convex/values";

// Waivers (#1197, spec/08 Waivers and free agency): the players on waivers in a league, by FPL's
// season-stable code, one row each at most. A player no team holds and with no row is a free
// agent. The run (#1198) takes a row's player for its winning claim, or frees him.

export const waiverTables = {
  waiverPlayers: defineTable({
    leagueId: v.id("leagues"),
    playerCode: v.number(),
    /** The first moment a run may take him: 24 hours after his drop, or when he went on waivers for
     *  the next run, as a new Premier League player or one nobody drafted. */
    claimableFrom: v.number(),
  }).index("by_leagueId_and_playerCode", ["leagueId", "playerCode"]),
};
