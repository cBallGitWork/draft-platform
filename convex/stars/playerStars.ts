import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { EVERY_LEAGUE } from "../positions/positionSettings";
import type { Doc, Id } from "../_generated/dataModel";
import { scoutedThisSeason } from "../scouting/scouts";
import { memberOf, refuse } from "../shared/leagueAccess";
import { seasonStartAt } from "../shared/time";
import { isSquadMove, movedOff, squadMovesSince, squadOf } from "../squads/squadPlace";
import { ratedRoles } from "./stars";
import { NO_DATA, roleStarsShape, type RoleStars } from "./starsShape";

// Players' stars as screens read them (#11; spec/05 Roles), from the stored rows starsRefresh.ts
// keeps: each role in each area he plays, with his stars. Now scouts exist (#375), a manager is
// shown them only for his own squad and the players his scouts have reported on, for the season
// (spec/19, Role stars), and for any player his team has held this season, who stays shown once
// he has left it (Craig, 6 Nov 2026, on #375). Everyone else's are hidden: null.
// No screen calls ofPlayer or ofPlayers yet (the 11 Nov review, #1574): they stay for #375's hiding
// to wire in, not removed.

/** The most players one read asks for: a squad's, or a page of Scouting's list, with room. More is
 *  refused, never a silent cut. */
export const STARS_READ_MOST = 100;

export const starsReadRefusals = {
  tooMany: `Stars are read for at most ${STARS_READ_MOST} players at once.`,
};

const playerStarsShape = v.object({ playerCode: v.number(), stars: v.union(v.array(roleStarsShape), v.null()) });

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
  const positionsOf = await positionsNow(ctx, EVERY_LEAGUE);
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

/** The players whose stars the team is shown in the season `now` falls in: its squad, every player
 *  a squad move put on or took off it this season, and every player its scouts reported on this
 *  season. None for no team (a commissioner who runs none), who has no squad or scouts. */
export async function starsShownTo(ctx: QueryCtx, leagueId: Id<"leagues">, team: Doc<"teams"> | undefined, now: number): Promise<Set<number>> {
  if (team === undefined) return new Set();
  const shown = await scoutedThisSeason(ctx, team._id, now);
  for (const { playerCode } of await squadOf(ctx, team._id)) shown.add(playerCode);
  for (const { event } of await squadMovesSince(ctx, leagueId, seasonStartAt(now))) {
    if (!isSquadMove(event)) continue;
    if (event.teamId === team._id || movedOff(event, team._id)) shown.add(event.playerCode);
  }
  return shown;
}

/** One player's stars, for a member of the league, at `now` (the screen's: a query may not read the
 *  clock); null while they are hidden from the caller. */
export const ofPlayer = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), now: v.number() },
  returns: v.union(v.array(roleStarsShape), v.null()),
  handler: async (ctx, { leagueId, playerCode, now }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (!(await starsShownTo(ctx, leagueId, team, now)).has(playerCode)) return null;
    return (await starsOfPlayers(ctx, [playerCode])).get(playerCode)!;
  },
});

/** Many players' stars at once, in the order asked, for a member of the league at `now`; null for
 *  each whose are hidden from the caller. Refused past STARS_READ_MOST. */
export const ofPlayers = query({
  args: { leagueId: v.id("leagues"), playerCodes: v.array(v.number()), now: v.number() },
  returns: v.array(playerStarsShape),
  handler: async (ctx, { leagueId, playerCodes, now }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (playerCodes.length > STARS_READ_MOST) refuse(starsReadRefusals.tooMany);
    const shownTo = await starsShownTo(ctx, leagueId, team, now);
    const stars = await starsOfPlayers(ctx, playerCodes.filter((playerCode) => shownTo.has(playerCode)));
    return playerCodes.map((playerCode) => ({ playerCode, stars: stars.get(playerCode) ?? null }));
  },
});
