import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { callerEmail, getLeague, refuse, refusals, teamOf } from "../shared/leagueAccess";

// Squad numbers (#13, spec/05 Squad numbers; Craig, 26 Oct 2026): a manager gives his own players
// numbers on My team's Squad tab, any from 1 to 99, two of them alike if he likes. The number is
// held on the player's squad row, so a move or a release ends it (squads.ts).

export const LOWEST_NUMBER = 1;
export const HIGHEST_NUMBER = 99;

export const squadNumberRefusals = {
  notInSquad: "That player isn't in your squad.",
  outOfRange: `A squad number is a whole number from ${LOWEST_NUMBER} to ${HIGHEST_NUMBER}.`,
};

/** The caller gives one of his own players `number`, or null to take his number away. Refused
 *  for anyone who runs no team in the league, for a player not in his squad, and for a number
 *  that isn't a whole number from 1 to 99. */
export const set = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), number: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, number }) => {
    const email = await callerEmail(ctx);
    await getLeague(ctx, leagueId);
    const team = (await teamOf(ctx, leagueId, email)) ?? refuse(refusals.runsNoTeam);
    if (number !== null && !(Number.isInteger(number) && number >= LOWEST_NUMBER && number <= HIGHEST_NUMBER)) {
      refuse(squadNumberRefusals.outOfRange);
    }
    const place = await ctx.db
      .query("squadPlayers")
      .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
      .unique();
    if (place === null || place.teamId !== team._id) refuse(squadNumberRefusals.notInSquad);
    await ctx.db.patch("squadPlayers", place._id, { number: number ?? undefined });
    return null;
  },
});
