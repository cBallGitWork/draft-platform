import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { memberOf, refuse } from "../shared/leagueAccess";
import { ratedRoles } from "./stars";
import { NO_DATA, roleStarsShape, type RoleStars } from "./starsShape";

// Players' stars as screens read them (#11; spec/05 Roles), from the stored rows starsRefresh.ts
// keeps: each role in each area he plays, with his stars. Until scouts exist every member of a
// league sees every player's (spec/19, Role stars); the league is asked for so scouting can narrow
// it later.

/** The most players one read asks for: a squad's, or a page of Scouting's list, with room. More is
 *  refused, never a silent cut. */
export const STARS_READ_MOST = 100;

export const starsReadRefusals = {
  tooMany: `Stars are read for at most ${STARS_READ_MOST} players at once.`,
};

const playerStarsShape = v.object({ playerCode: v.number(), stars: v.array(roleStarsShape) });

/** His stored row (starsRefresh.ts keeps it), if any. */
export function starsRow(ctx: QueryCtx, playerCode: number) {
  return ctx.db
    .query("playerRoleStars")
    .withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode))
    .unique();
}

/** Each player's stars, by his code: his stored ratings, or, with no row (no counted match yet, or
 *  a row not yet worked out), "—" for every role in every area his positions play now. */
export async function starsOfPlayers(ctx: QueryCtx, playerCodes: readonly number[]): Promise<Map<number, RoleStars[]>> {
  const positionsOf = await positionsNow(ctx);
  const stars = new Map<number, RoleStars[]>();
  for (const playerCode of new Set(playerCodes)) {
    const row = await starsRow(ctx, playerCode);
    stars.set(
      playerCode,
      row === null
        ? ratedRoles(await positionsOf(playerCode)).map(({ area, role }) => ({ area, role, stars: NO_DATA }))
        : row.ratings.map(({ area, role, stars }) => ({ area, role, stars })),
    );
  }
  return stars;
}

/** One player's stars, for a member of the league. */
export const ofPlayer = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.array(roleStarsShape),
  handler: async (ctx, { leagueId, playerCode }) => {
    await memberOf(ctx, leagueId);
    return (await starsOfPlayers(ctx, [playerCode])).get(playerCode)!;
  },
});

/** Many players' stars at once, in the order asked, for a member of the league. Refused past
 *  STARS_READ_MOST. */
export const ofPlayers = query({
  args: { leagueId: v.id("leagues"), playerCodes: v.array(v.number()) },
  returns: v.array(playerStarsShape),
  handler: async (ctx, { leagueId, playerCodes }) => {
    await memberOf(ctx, leagueId);
    if (playerCodes.length > STARS_READ_MOST) refuse(starsReadRefusals.tooMany);
    const stars = await starsOfPlayers(ctx, playerCodes);
    return playerCodes.map((playerCode) => ({ playerCode, stars: stars.get(playerCode)! }));
  },
});
