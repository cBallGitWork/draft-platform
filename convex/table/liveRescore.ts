import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { GAMEWEEKS_MOST } from "../gameweeks/usedGameweeks";
import { everyLeague, takeAllOrThrow } from "../shared/cappedRead";

// The live rows (liveScores.ts) as the changes that move them ask for them again, kept apart from
// the scorer they run so a match's records (stats/matchStats.ts), an override or a squad move can
// ask without importing it. Plain helpers: no Convex function lives here.

/** The most live rows a league holds: one a gameweek at most. More throws, never a silent cut. */
const LIVE_SCORES_MOST = GAMEWEEKS_MOST;

/** The league's live rows, by gameweek, each as written: storedScores.ts's `standsFor` says
 *  whether one still does. */
export async function heldLiveScores(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, Doc<"liveScores">>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("liveScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    LIVE_SCORES_MOST,
    `League ${leagueId} holds more than ${LIVE_SCORES_MOST} live score rows, so some would be left out`,
  );
  return new Map(rows.map((row) => [row.gameweek, row]));
}

/** Asks for the league's live rows again, now, where it holds any: for a change between ticks
 *  that moves the gameweek's scores. */
export async function rescoreLive(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  const gameweeks = [...(await heldLiveScores(ctx, leagueId)).keys()];
  if (gameweeks.length > 0) await ctx.scheduler.runAfter(0, internal.table.liveScores.scoreLeague, { leagueId, gameweeks });
}

/** `rescoreLive` for every league holding a row: for a match's records or state written between
 *  ticks, a correction, full time or the lock. */
export async function rescoreEveryLive(ctx: MutationCtx): Promise<void> {
  if (!(await anyLiveScores(ctx))) return;
  for (const league of await everyLeague(ctx, "so some would keep a stale live score")) await rescoreLive(ctx, league._id);
}

/** Whether any league holds a live row: the tick clears them once no match is live. */
export async function anyLiveScores(ctx: QueryCtx): Promise<boolean> {
  return (await ctx.db.query("liveScores").first()) !== null;
}
