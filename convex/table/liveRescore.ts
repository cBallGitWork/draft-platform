import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { everyLeague } from "../shared/cappedRead";
import { anyLiveScores, heldLiveScores } from "../shared/liveScoreRows";

// The live rows (liveScores.ts) as the changes that move them ask for them again, kept apart from
// the scorer they run so a match's records (stats/matchStats.ts), an override or a squad move can
// ask without importing it. Plain helpers: no Convex function lives here.

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
