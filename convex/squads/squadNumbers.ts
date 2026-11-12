import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx } from "../_generated/server";
import { managerOf, refuse } from "../shared/leagueAccess";
import { placeOf } from "./squadPlace";
import { HIGHEST_NUMBER, LOWEST_NUMBER } from "./squadNumberRange";

// Squad numbers (#13, spec/05 Squad numbers; Craig, 26 Oct 2026): a manager gives his own players
// numbers on My team's Squad tab, any from 1 to 99, two of them alike if he likes. The number is
// held on the player's squad row, so a move or a release ends it (squads.ts). Until he gives one,
// and again once he takes his away, the player wears his club's (`clubNumbers`), so it follows a
// change at his club or a move to another; with neither, his shirt is blank (Craig, 5 Nov 2026, #13).

/** The number on his shirt: his manager's, else his club's, else none. */
export async function shirtNumber(ctx: QueryCtx, { playerCode, number }: Pick<Doc<"squadPlayers">, "playerCode" | "number">): Promise<number | null> {
  return number ?? (await clubNumberOf(ctx, playerCode));
}

/** His number at his club, as the Premier League's squad list last gave it, or null. */
export async function clubNumberOf(ctx: QueryCtx, playerCode: number): Promise<number | null> {
  const held = await ctx.db.query("clubNumbers").withIndex("by_code", (q) => q.eq("code", playerCode)).unique();
  return held?.number ?? null;
}

export const squadNumberRefusals = {
  notInSquad: "That player isn't in your squad.",
  outOfRange: `A squad number is a whole number from ${LOWEST_NUMBER} to ${HIGHEST_NUMBER}.`,
};

/** The caller gives one of his own players `number`, or null to take his number away, which puts
 *  his club's back on his shirt. Refused
 *  for anyone who runs no team in the league, for a player not in his squad, and for a number
 *  that isn't a whole number from 1 to 99. */
export const set = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), number: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, number }) => {
    const { team } = await managerOf(ctx, leagueId);
    if (number !== null && !(Number.isInteger(number) && number >= LOWEST_NUMBER && number <= HIGHEST_NUMBER)) {
      refuse(squadNumberRefusals.outOfRange);
    }
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place === null || place.teamId !== team._id) refuse(squadNumberRefusals.notInSquad);
    await ctx.db.patch("squadPlayers", place._id, { number: number ?? undefined });
    return null;
  },
});
