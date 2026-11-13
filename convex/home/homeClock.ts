import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { matchdayMargins } from "../admin/platformSettings";
import { leagueDeadlineOf } from "../gameweeks/leagueDeadlines";
import { gameModeOf } from "../rules/gameMode";
import { seasonRules } from "../rules/rulesHistory";
import { takeAllOrThrow } from "../shared/cappedRead";
import { GAMEWEEK_MATCHES_MOST } from "../shared/fixtures";
import { memberOf } from "../shared/leagueAccess";
import { HOUR_MS } from "../shared/time";
import { statusOf } from "../stats/matchStats";
import { scheduleOf } from "../table/playedFixtures";
import { heldClock, NEAR_BEFORE_MS, type HeldClock } from "./homeAt";

// What league home tells the time by (#1550): which gameweek is this, and which matchday is open.
// A query may not read the clock, and one taking the minute runs again, uncached, every minute for
// every open screen (#2005), so this sends the times and the screen judges them at its minute
// (homeAt.ts's `clockAt`); it takes only the hour, for which matches are near. League home's reads
// of the table, the moves and the Vidiprinter take what `clockAt` says (leagueHome.ts) and are read
// again only when their data changes. homeAt.ts puts them together.

/** League home's times for any minute of the hour starting at `hour`: the league's head-to-head
 *  gameweeks with their deadlines, the matchday margins, and the matches kicking off near. For
 *  anyone with a part in the league. */
export const clockOf = query({
  args: { leagueId: v.id("leagues"), hour: v.number() },
  returns: heldClock,
  handler: async (ctx, { leagueId, hour }) => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const schedule = gameModeOf(season.latest).hasMatchups ? await scheduleOf(ctx, league, season) : [];
    const deadlineOf = await leagueDeadlineOf(ctx, leagueId);
    const margins = await matchdayMargins(ctx);
    return {
      gameweeks: schedule.map(({ gameweek }) => ({ gameweek, deadline: deadlineOf(gameweek) })),
      margins,
      matches: await nearMatches(ctx, hour, margins),
    };
  },
});

/** The matches `clockAt` may look at in any minute of the hour starting at `hour`, each with its
 *  full-time read: up to `beforeMs` to come, or kicked off within NEAR_BEFORE_MS and `afterMs`
 *  before (homeAt.ts's `clockAt`). */
async function nearMatches(ctx: QueryCtx, hour: number, margins: HeldClock["margins"]): Promise<HeldClock["matches"]> {
  const near = await takeAllOrThrow(
    ctx.db
      .query("fixtures")
      .withIndex("by_kickoff", (q) => q.gt("kickoff", hour - NEAR_BEFORE_MS - margins.afterMs).lte("kickoff", hour + HOUR_MS + margins.beforeMs)),
    NEAR_MATCHES_MOST,
    `More than ${NEAR_MATCHES_MOST} matches kick off near ${hour}, so league home's matchday would be cut short`,
  );
  const inPlay = near.filter(
    (fixture): fixture is Doc<"fixtures"> & { gameweek: number; kickoff: number } =>
      fixture.droppedAt === undefined && fixture.gameweek !== null && fixture.kickoff !== null,
  );
  return Promise.all(
    inPlay.map(async ({ code, gameweek, kickoff }) => ({ gameweek, fixtureCode: code, kickoff, fullTimeAt: (await statusOf(ctx, code))?.fullTimeAt ?? null })),
  );
}

/** The most matches kicking off in the few days around a matchday: a gameweek's, with room. More
 *  throws, never a silent cut. */
const NEAR_MATCHES_MOST = GAMEWEEK_MATCHES_MOST;
