import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { matchdayMargins } from "../admin/platformSettings";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { thisGameweekOf } from "../gameweeks/nextGameweek";
import { seasonRules } from "../rules/rulesHistory";
import { takeAllOrThrow } from "../shared/cappedRead";
import { GAMEWEEK_MATCHES_MOST } from "../shared/fixtures";
import { groupedBy } from "../shared/groupedBy";
import { memberOf } from "../shared/leagueAccess";
import { DAY_MS } from "../shared/time";
import { LIVE_WINDOW_MS } from "../stats/liveStats";
import { statusOf } from "../stats/matchStats";
import { scheduleOf } from "../table/playedFixtures";
import { matchdayAt } from "./matchday";

// What league home needs the screen's minute for (#1550): which gameweek is this, and which
// matchday is open. A query may not read the clock, and one taking the minute runs again, uncached,
// every minute for every open screen, so this is the small one; league home's reads of the table,
// the moves and the Vidiprinter take what it says (leagueHome.ts) and are read again only when
// their data changes. homeAt.ts puts them together.

export const homeClock = v.object({
  /** This gameweek (nextGameweek.ts's `thisGameweekOf`) among the league's head-to-heads; null
   *  with none, as in total points or with fewer than two teams. */
  gameweek: v.union(v.number(), v.null()),
  /** The matchday open at `now`, by its gameweek and its matches' codes, smallest first; null
   *  while the home is quiet. */
  matchday: v.union(v.null(), v.object({ gameweek: v.number(), fixtureCodes: v.array(v.number()) })),
});

/** League home's clock at `now`, the screen's minute. For anyone with a part in the league. */
export const clockOf = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: homeClock,
  handler: async (ctx, { leagueId, now }) => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const schedule = season.latest.format === "headToHead" ? await scheduleOf(ctx, league, season) : [];
    return {
      gameweek: thisGameweekOf(schedule, deadlineOf(await leagueDeadlines(ctx, leagueId)), now)?.gameweek ?? null,
      matchday: await matchdayOpen(ctx, now),
    };
  },
});

/** The matchday open at `now`, or null while none is. Read from the matches kicking off near `now`,
 *  not this gameweek's: a gameweek's first matchday opens hours before its first kickoff, while its
 *  deadline, and so the head-to-heads shown, may still be to come. */
async function matchdayOpen(ctx: QueryCtx, now: number): Promise<{ gameweek: number; fixtureCodes: number[] } | null> {
  const margins = await matchdayMargins(ctx);
  // Any match whose matchday may be open: up to `beforeMs` to come, or kicked off within the day
  // before its latest final whistle and `afterMs` (matchday.ts). A window joined across more days
  // than that would leave its first day's lines out, while staying open.
  const near = await takeAllOrThrow(
    ctx.db.query("fixtures").withIndex("by_kickoff", (q) => q.gt("kickoff", now - DAY_MS - LIVE_WINDOW_MS - margins.afterMs).lte("kickoff", now + margins.beforeMs)),
    NEAR_MATCHES_MOST,
    `More than ${NEAR_MATCHES_MOST} matches kick off near ${now}, so league home's matchday would be cut short`,
  );
  const inPlay = near.filter((fixture): fixture is Doc<"fixtures"> & { gameweek: number } => fixture.droppedAt === undefined && fixture.gameweek !== null);
  const byGameweek = groupedBy(inPlay, ({ gameweek }) => gameweek);
  for (const [gameweek, fixtures] of [...byGameweek].toSorted(([one], [other]) => one - other)) {
    const matches = await Promise.all(
      fixtures.map(async ({ code, kickoff }) => ({ fixtureCode: code, kickoff, fullTimeAt: (await statusOf(ctx, code))?.fullTimeAt ?? null })),
    );
    const open = matchdayAt(matches, margins, now);
    if (open !== null) return { gameweek, fixtureCodes: open.fixtureCodes.toSorted((one, other) => one - other) };
  }
  return null;
}

/** The most matches kicking off in the few days around a matchday: a gameweek's, with room. More
 *  throws, never a silent cut. */
const NEAR_MATCHES_MOST = GAMEWEEK_MATCHES_MOST;
