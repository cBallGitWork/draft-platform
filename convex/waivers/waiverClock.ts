import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { gameweekUnderWay } from "../gameweeks/gameweekEnd";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { rulesInForceNow } from "../rules/rulesHistory";
import { memberOf } from "../shared/leagueAccess";
import { heldWaiverClock, lockCandidates, type HeldWaiverClock } from "./runsAhead";

// What the waiver runs still to come are told by (#2008): Scouting's list, the pending claims and
// the player card each show the run that can first take a player, which moves with the clock. A
// query may not read the clock, and one taking the minute runs again, uncached, every minute for
// every open screen, so this takes only the hour and sends the times, and the screen judges them at
// its minute (runsAhead.ts's `firstRunsAt`). It runs again when the runs, a deadline or a match's
// score changes, as before.

/** The waiver runs' times for any minute of the hour starting at `hour`: the league's runs under
 *  the rules in force, as the run reads them (S03.11), its deadlines, and which gameweeks that can be the latest begun in the hour
 *  are under way. For anyone with a part in the league. */
export const clockOf = query({
  args: { leagueId: v.id("leagues"), hour: v.number() },
  returns: heldWaiverClock,
  handler: async (ctx, { leagueId, hour }): Promise<HeldWaiverClock> => {
    await memberOf(ctx, leagueId);
    return await waiverClockOf(ctx, leagueId, await leagueDeadlines(ctx, leagueId), hour);
  },
});

/** `clockOf`'s times for the hour starting at `hour`, with the league's `deadlines` read. */
export async function waiverClockOf(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, hour: number): Promise<HeldWaiverClock> {
  const runs = (await rulesInForceNow(ctx, leagueId)).waivers.runs;
  const candidates = lockCandidates(deadlines, hour);
  const underWay = await Promise.all(candidates.map(async (gameweek) => ((await gameweekUnderWay(ctx, gameweek)) ? [gameweek] : [])));
  return { runs, gameweeks: [...deadlines].map(([gameweek, deadline]) => ({ gameweek, deadline })), underWay: underWay.flat() };
}
