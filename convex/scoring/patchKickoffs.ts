import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { firstKickoffs, gameweekStartsOf } from "../gameweeks/gameweekStarts";
import { scheduledMatches } from "../gameweeks/leagueDeadlines";
import { seasonStartYear } from "../shared/time";
import { siteVersions } from "./siteVersions";

// A waiting patch follows its gameweek's first kickoff (Craig, 1 Nov 2026, on #901: when the first
// kickoff of the patch's gameweek moves later, "yes", the patch's start moves with it). A patch is
// announced from a gameweek and takes effect at its first kickoff (siteVersions.ts's
// `patchGameweeks`), so if that kickoff moves later, a patch left where it was would land before
// the gameweek began, mid-week for stars and the banner. Only later: a kickoff moved earlier is a
// rule Craig hasn't given, so the patch stays and reaches the gameweek after. The football sync,
// the only writer of kickoffs, calls this after each write that can move one.

/** Schedules what is worked out again under the set in force once a version takes effect at `at`:
 *  stars price every match under today's scoring, so everyone is rated again (stars/starsRefresh.ts,
 *  #11), and last season's points are priced under the set as it stands (spec/19;
 *  pastSeasonPoints.ts). Run again at an older moment, each works under the set then in force,
 *  which is no harm. */
export async function repriceAt(ctx: MutationCtx, at: number): Promise<void> {
  await ctx.scheduler.runAt(at, internal.stars.starsRefresh.refreshAll, { cursor: null });
  await ctx.scheduler.runAt(at, internal.pastSeasons.pastSeasonPoints.reprice, { cursor: null });
}

/** Moves each patch still waiting at `now` to its gameweek's first kickoff, where that is later
 *  than it stands, in the same season, and the gameweek hasn't begun; never past the version after
 *  it, so versions keep the order they were announced in. Returns how many it moved. */
export async function followKickoffs(ctx: MutationCtx, now: number): Promise<number> {
  const history = await siteVersions(ctx);
  if (!history.some((row) => row.gameweek !== undefined && row.takesEffectAt > now)) return 0;
  const matches = await scheduledMatches(ctx);
  const begun = await gameweekStartsOf(ctx, matches);
  const kickoffs = firstKickoffs(matches);
  let moved = 0;
  for (const [index, row] of history.entries()) {
    if (row.gameweek === undefined || row.takesEffectAt <= now || begun.has(row.gameweek)) continue;
    const kickoff = kickoffs.get(row.gameweek);
    if (kickoff === undefined || kickoff <= row.takesEffectAt || seasonStartYear(kickoff) !== row.season) continue;
    const takesEffectAt = Math.min(kickoff, history[index + 1]?.takesEffectAt ?? kickoff);
    if (takesEffectAt <= row.takesEffectAt) continue;
    await ctx.db.patch("siteScoring", row._id, { takesEffectAt });
    await repriceAt(ctx, takesEffectAt);
    moved += 1;
  }
  return moved;
}
