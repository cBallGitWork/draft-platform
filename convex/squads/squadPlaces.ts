import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MOST_IN_SQUAD, MOST_TEAMS } from "../leagues/leagueLimits";
import { takeAllOrThrow } from "../shared/cappedRead";

// Who owns a player in a league: his squad row, read one player at a time or for the whole league
// at once. Squads, the shortlist, squad numbers, the player card, Compare, the players list and the
// match page all read it here.

/** The most players a league can own: every team's squad full. */
export const OWNED_IN_LEAGUE_MOST = MOST_TEAMS * MOST_IN_SQUAD;

/** The player's place in this league, or null while he is a free agent. */
export function placeOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<Doc<"squadPlayers"> | null> {
  return ctx.db
    .query("squadPlayers")
    .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
    .unique();
}

/** The name of the team a place is on, or null for a free agent (no place). */
export async function ownerNameOf(ctx: QueryCtx, place: Doc<"squadPlayers"> | null): Promise<string | null> {
  return place === null ? null : (await ctx.db.get("teams", place.teamId))!.name;
}

/** Each owned player's team in the league, by his code, in one read. Past OWNED_IN_LEAGUE_MOST it
 *  throws, its message ending in `why`: what the caller would cut short. */
export async function ownersIn(ctx: QueryCtx, leagueId: Id<"leagues">, why: string): Promise<Map<number, Id<"teams">>> {
  const owned = await takeAllOrThrow(
    ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    OWNED_IN_LEAGUE_MOST,
    `More than ${OWNED_IN_LEAGUE_MOST} players are owned in league ${leagueId}, so ${why}`,
  );
  return new Map(owned.map((row) => [row.playerCode, row.teamId]));
}
