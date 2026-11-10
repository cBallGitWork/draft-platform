import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { AREAS } from "../lineup/pitch";
import { positionsNow } from "../positions/playerPositions";
import { setOf, siteVersions } from "../scoring/siteVersions";
import { memberOf } from "../shared/leagueAccess";
import { periodTotals } from "./period";
import { period, type Period } from "./periods";
import { isRanked, mainArea, per90PanelOf, type Weighed } from "./per90Figures";
import { checkShownStat, withOwnTotals } from "./playersList";

// The selected player's per-90 figures on Scouting (#1028; the approved picture): each stat his
// area's panel lists (per90Figures.ts), and the list's stat, per 90 over the season, with his
// percentile among the players whose main position is in his area and who have played
// RANKED_MINUTES or more over the period (Craig, 9 Nov 2026, on #1028, answer 2). The period is
// the list's (period.ts): the season, or the last 4 or 6 finished gameweeks. Compare (compare.ts)
// weighs its two players the same way.

export const per90Figure = v.object({
  stat: v.string(),
  /** His total over the period. */
  total: v.number(),
  /** His figure per 90 minutes, or null with no minutes played. */
  perNinety: v.union(v.number(), v.null()),
  /** Where it stands among the area's ranked players, 0 to 100, or null while he isn't ranked. */
  percentile: v.union(v.number(), v.null()),
});

const per90Panel = v.object({
  /** His main position's area, which his figures are ranked within; null with no position yet. */
  area: v.union(v.literal(AREAS[0]), ...AREAS.slice(1).map((area) => v.literal(area)), v.null()),
  /** Whether he has played enough minutes to be ranked. */
  ranked: v.boolean(),
  figures: v.array(per90Figure),
});
export type Per90Panel = Infer<typeof per90Panel>;

/** The player's per-90 figures and percentiles over `period` (the season when left out), `stat`
 *  (the list's, a catalogue key, an own stat's of the site's latest set, or null) joining his
 *  area's as the last when it isn't one. Anyone not in the league is refused, as is a stat neither
 *  holds. */
export const figures = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), stat: v.union(v.string(), v.null()), period: v.optional(period) },
  returns: per90Panel,
  handler: async (ctx, { leagueId, playerCode, stat, period }): Promise<Per90Panel> => {
    await memberOf(ctx, leagueId);
    const { weighed, ranked } = await weigher(ctx, leagueId, stat, period ?? "season");
    return per90PanelOf(await weighed(playerCode), ranked, stat);
  },
});

/** How the per-90 figures weigh players over the period `over`: `weighed` gives a player's main area and
 *  totals (the site's own stats worked out when `stat` is one), and `ranked` is every player with
 *  enough minutes to be ranked, weighed. A stat neither the catalogue nor the site's set holds is
 *  refused. */
export async function weigher(ctx: QueryCtx, leagueId: Id<"leagues">, stat: string | null, over: Period) {
  const set = setOf((await siteVersions(ctx)).at(-1));
  if (stat !== null) checkShownStat(stat, set.ownStats ?? []);
  const positionsOf = await positionsNow(ctx, leagueId);
  const { totals } = await periodTotals(ctx, over);
  const weighed = async (code: number): Promise<Weighed> => ({ area: mainArea(await positionsOf(code)), totals: withOwnTotals(totals.get(code), stat, set) ?? {} });
  // Only a ranked player's positions are read: no one else is a peer.
  const ranked = await Promise.all([...totals].filter(([, held]) => isRanked(held)).map(([code]) => weighed(code)));
  return { weighed, ranked };
}
