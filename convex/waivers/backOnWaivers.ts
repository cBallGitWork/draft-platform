import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { draftIsOver } from "../draft/draftRow";
import { undraftedIn } from "../draft/undrafted";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { leagueOpens } from "../leagues/leagueOpens";
import { latestEnded } from "./waiverLock";
import { waiverOrderRow, windowShutSince } from "./waiverOrder";
import { waiverRowsIn } from "./waiverPlayers";
import { FIRST_RUN_WITHIN_MS } from "./waiverRun";

// Free agents back on waivers at the deadline (#1478, spec/08 Waivers and free agency): a free
// agent nobody picks up "goes back on waivers at the deadline, so the next run hands him out by the
// waiver order like any dropped player" (Craig, 11 Nov 2026). The waiver cron (waiverRun.ts
// `runDue`) starts it once the window has shut, once a deadline.

/** Puts every free agent in the league back on waivers as its window shut at `deadline`, a run
 *  taking him from that deadline. A player already on waivers keeps his time. Once a deadline, and
 *  never once the window has opened again: the run made since frees those nobody claimed. */
export const putBackOnWaivers = internalMutation({
  args: { leagueId: v.id("leagues"), deadline: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, deadline }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null || !leagueOpens(league) || !(await draftIsOver(ctx, leagueId))) return null;
    const now = Date.now();
    const deadlines = await leagueDeadlines(ctx, leagueId);
    const held = await waiverOrderRow(ctx, leagueId);
    if (held?.backOnWaivers === deadline || (await windowShutSince(ctx, leagueId, deadlines, now)) !== deadline) return null;
    const onWaivers = new Set((await waiverRowsIn(ctx, leagueId)).map(({ playerCode }) => playerCode));
    for (const { code } of await undraftedIn(ctx, leagueId)) {
      if (!onWaivers.has(code)) await ctx.db.insert("waiverPlayers", { leagueId, playerCode: code, claimableFrom: deadline });
    }
    if (held !== null) await ctx.db.patch("waiverOrders", held._id, { backOnWaivers: deadline });
    else {
      // A league that has never run waivers gets its row here, a run due only if its time came
      // within FIRST_RUN_WITHIN_MS, as with no row.
      const gameweek = await latestEnded(ctx, deadlines, now);
      await ctx.db.insert("waiverOrders", { leagueId, winners: [], gameweek, ranAt: now - FIRST_RUN_WITHIN_MS, backOnWaivers: deadline });
    }
    return null;
  },
});
