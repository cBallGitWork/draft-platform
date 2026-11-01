import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { heldFixtures } from "../gameweekScorer/heldMatches";
import { lineupsInGameweek } from "../lineup/lineups";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { teamsOf } from "../shared/leagueAccess";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { statusOf } from "../stats/matchStats";
import { LEAGUES_RECORDED_MOST } from "../gameweeks/deadlineRecorder";
import { starsOfPlayers } from "./playerStars";
import type { RoleStars } from "./starsShape";

// Stars at the deadline (spec/05 Auto-subs; Craig, 1 Nov 2026): an auto-sub who comes on in his
// own area plays the role he had the most stars for when the lineup locked, so scoring the gameweek
// again never moves it. When a league's deadline is recorded (deadlineRecorder.ts), each team's
// bench as it stood then is kept with its stars.
//
// With no copy kept, a sub plays the slot's first role: a stable fallback, which no change of stars
// moves. So it is for a gameweek locked before this was built, for a player who joined the bench
// after the deadline (the copy names only those on it then), and for one whose keeping failed. A
// failed keeping is logged, and each recording after tries again (`keepMissing`) for the league's
// latest begun gameweek, until one of its matches locks: stars move only when a match locks or the
// scoring changes, so a copy kept before then is the deadline's.
//
// Cost: one row a team a gameweek, each holding its bench players' rated roles: a few kilobytes,
// growing with teams and gameweeks. Scoring a league's gameweek reads its teams' rows, one a team;
// a single team's card or Squad tab reads its own.

/** Each team's bench at the league's deadline for `gameweek`, kept with its stars. Kept once: a
 *  second call for the same gameweek changes nothing. Worked out whole before any is written, so a
 *  failure, logged, keeps none and the next recording tries again. */
export const storeLeague = internalMutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    if ((await keptRows(ctx, leagueId, gameweek)).length > 0) return null;
    let rows: Omit<Doc<"deadlineStars">, "_id" | "_creationTime">[];
    try {
      rows = [];
      const teamIds = (await teamsOf(ctx, leagueId)).map((team) => team._id);
      for (const [teamId, held] of await lineupsInGameweek(ctx, leagueId, teamIds, gameweek)) {
        const stars = await starsOfPlayers(ctx, held.bench);
        const bench = held.bench.map((playerCode) => ({ playerCode, stars: stars.get(playerCode)!.filter((rating) => typeof rating.stars === "number") }));
        rows.push({ leagueId, gameweek, teamId, bench });
      }
    } catch (error: unknown) {
      logFailure(`League ${leagueId}'s stars at gameweek ${gameweek}'s deadline weren't kept, so its auto-subs play the slot's first role until they are`, error);
      return null;
    }
    for (const row of rows) await ctx.db.insert("deadlineStars", row);
    return null;
  },
});

/** Asks again for each league's latest begun gameweek with no stars kept, while none of its matches
 *  has locked. Run by each recording of deadlines. */
export const keepMissing = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const leagues = await takeAllOrThrow(ctx.db.query("leagues"), LEAGUES_RECORDED_MOST, `More than ${LEAGUES_RECORDED_MOST} leagues are held, so some would keep no stars`);
    for (const league of leagues) {
      const latest = await ctx.db
        .query("passedDeadlines")
        .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", league._id))
        .order("desc")
        .first();
      if (latest === null || (await keptRows(ctx, league._id, latest.gameweek)).length > 0) continue;
      if ((await teamsOf(ctx, league._id)).length === 0) continue;
      if (await anyLocked(ctx, latest.gameweek)) continue;
      await ctx.scheduler.runAfter(0, internal.stars.deadlineStars.storeLeague, { leagueId: league._id, gameweek: latest.gameweek });
    }
    return null;
  },
});

/** Whether any of the gameweek's matches has locked, after which stars may have moved. */
async function anyLocked(ctx: QueryCtx, gameweek: number): Promise<boolean> {
  for (const fixture of await heldFixtures(ctx, gameweek)) if ((await statusOf(ctx, fixture.code))?.state === "locked") return true;
  return false;
}

function keptRows(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number, teamId?: Id<"teams">) {
  return takeAllOrThrow(
    ctx.db
      .query("deadlineStars")
      .withIndex("by_leagueId_and_gameweek_and_teamId", (q) =>
        teamId === undefined ? q.eq("leagueId", leagueId).eq("gameweek", gameweek) : q.eq("leagueId", leagueId).eq("gameweek", gameweek).eq("teamId", teamId),
      ),
    MOST_TEAMS,
    `More than ${MOST_TEAMS} teams hold stars kept at gameweek ${gameweek}'s deadline`,
  );
}

/** Each team's bench players' stars kept at the league's deadline for `gameweek`, or only
 *  `teamId`'s when given: none for a team or player with no copy kept. */
export async function deadlineStarsIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  gameweek: number,
  teamId?: Id<"teams">,
): Promise<Map<Id<"teams">, Map<number, RoleStars[]>>> {
  const rows = await keptRows(ctx, leagueId, gameweek, teamId);
  return new Map(rows.map((row) => [row.teamId, new Map(row.bench.map(({ playerCode, stars }) => [playerCode, stars]))]));
}
