import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// A player's place in a league's squads: one home for the read squads, squad numbers, the player
// card and the shortlist each make.

/** The player's row in the squad of the team that holds him in this league, or null while he is a
 *  free agent. */
export function placeOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number) {
  return ctx.db
    .query("squadPlayers")
    .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
    .unique();
}
