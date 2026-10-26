import { defineTable } from "convex/server";
import { v } from "convex/values";

// Squads (#31, spec/15 Assigning players): which team in a league owns each player, by FPL's
// season-stable code. A player is on one team in a league at most; any other is a free agent.

/** A player as a squad letter names him, and the team concerned. */
export const playerOnTeam = { playerCode: v.number(), playerName: v.string(), teamId: v.id("teams"), teamName: v.string() };

/** What assigning players files for Mail. */
export const squadEvents = [
  v.object({ kind: v.literal("playerAssigned"), ...playerOnTeam }),
  v.object({ kind: v.literal("playerMoved"), ...playerOnTeam, fromTeamId: v.id("teams"), fromTeamName: v.string() }),
  v.object({ kind: v.literal("playerReleased"), ...playerOnTeam }),
] as const;

export const squadTables = {
  squadPlayers: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    playerCode: v.number(),
    /** The number his manager gave him (#13, spec/05 Squad numbers): absent until given, and gone
     *  when he moves, so he starts afresh on another team. */
    number: v.optional(v.number()),
  })
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"])
    .index("by_teamId", ["teamId"]),
};

// The shortlist (#374, spec/19 The shortlist): each team's own list of players for the season, by
// FPL's season-stable code. Private to the team: only its manager reads or changes it.
export const shortlistTables = {
  shortlistPlayers: defineTable({ leagueId: v.id("leagues"), teamId: v.id("teams"), playerCode: v.number() })
    .index("by_teamId_and_playerCode", ["teamId", "playerCode"])
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"]),
};
