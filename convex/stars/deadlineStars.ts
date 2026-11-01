import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { lineupsInGameweek } from "../lineup/lineups";
import { takeAllOrThrow } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { starsOfPlayers } from "./playerStars";
import type { RoleStars } from "./starsShape";

// Stars at the deadline (spec/05 Auto-subs; Craig, 1 Nov 2026): an auto-sub who comes on in his
// own area plays the role he had the most stars for when the lineup locked, so scoring the gameweek
// again never moves it. When a league's deadline is recorded (deadlineRecorder.ts), each team's
// bench as it stood then is kept with its stars. A gameweek with none kept, one locked before this
// was built, plays the slot's first role.
//
// Cost: one row a team a gameweek, each holding its bench players' rated roles: a few kilobytes,
// growing with teams and gameweeks.

/** Each team's bench at the league's deadline for `gameweek`, kept with its stars. Kept once: a
 *  second call for the same gameweek changes nothing. */
export const storeLeague = internalMutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    if ((await keptRows(ctx, leagueId, gameweek)).length > 0) return null;
    const teamIds = (await teamsOf(ctx, leagueId)).map((team) => team._id);
    for (const [teamId, held] of await lineupsInGameweek(ctx, leagueId, teamIds, gameweek)) {
      const stars = await starsOfPlayers(ctx, held.bench);
      const bench = held.bench.map((playerCode) => ({ playerCode, stars: stars.get(playerCode)!.filter((rating) => typeof rating.stars === "number") }));
      await ctx.db.insert("deadlineStars", { leagueId, gameweek, teamId, bench });
    }
    return null;
  },
});

function keptRows(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number) {
  return takeAllOrThrow(
    ctx.db.query("deadlineStars").withIndex("by_leagueId_and_gameweek_and_teamId", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek)),
    MOST_TEAMS,
    `More than ${MOST_TEAMS} teams hold stars kept at gameweek ${gameweek}'s deadline`,
  );
}

/** Each team's bench players' stars kept at the league's deadline for `gameweek`: none for a team
 *  or player with no copy kept. */
export async function deadlineStarsIn(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number): Promise<Map<Id<"teams">, Map<number, RoleStars[]>>> {
  const rows = await keptRows(ctx, leagueId, gameweek);
  return new Map(rows.map((row) => [row.teamId, new Map(row.bench.map(({ playerCode, stars }) => [playerCode, stars]))]));
}
