import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { GAMEWEEKS_MOST } from "../gameweeks/usedGameweeks";
import { takeAllOrThrow } from "./cappedRead";

// The live rows (table/liveScores.ts) as the scorer, the tick and the rescores read them (#2007).
// Plain reads: the scorer (gameweekScorer/gameweekScores.ts) says whether a row still stands, and
// table/liveRescore.ts asks for rows again.

/** The most live rows a league holds: one a gameweek at most. More throws, never a silent cut. */
const LIVE_SCORES_MOST = GAMEWEEKS_MOST;

/** The league's live rows, by gameweek, each as written: gameweekScores.ts's `standsFor` says
 *  whether one still does. */
export async function heldLiveScores(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, Doc<"liveScores">>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("liveScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    LIVE_SCORES_MOST,
    `League ${leagueId} holds more than ${LIVE_SCORES_MOST} live score rows, so some would be left out`,
  );
  return new Map(rows.map((row) => [row.gameweek, row]));
}

/** Whether any league holds a live row: the tick clears them once no match is live. */
export async function anyLiveScores(ctx: QueryCtx): Promise<boolean> {
  return (await ctx.db.query("liveScores").first()) !== null;
}
