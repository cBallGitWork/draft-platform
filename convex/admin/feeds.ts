import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { statCorrectionWindowMs } from "./platformSettings";
import { ALWAYS_OWED, failureOf, feedState, judgeFeed, type FeedRuns, type RunOutcome } from "./feedState";
import { adminOf } from "../shared/leagueAccess";
import { FEED_SCHEDULES, FEEDS, type Feed } from "../shared/feedSchedule";
import { liveMatches } from "../stats/liveStats";
import { lateStatChange } from "../schema";

// The admin's feeds page (#35; spec/15 The admin): when each feed last arrived and whether it is
// late or failing, the matches whose scoring is behind, and stat corrections after a lock.
//
// Lateness needs the time, and a query must not read the clock: Convex caches a query by its
// arguments and re-runs it only when the data it read changes, so a stopped feed, which changes
// nothing, would never turn late (convex/_generated/ai/guidelines.md). So the screen passes `now`,
// moved on each minute, and the query judges against it: a new minute is a new query.

/** Runs read back per feed, newest first, for its last success and last error: four days of the
 *  football sync, and a match's first hundred minutes of live ticks. */
export const RUNS_READ = 100;
/** Matches behind, and late corrections, the page lists at most: newest corrections first. */
export const BEHIND_SHOWN = 20;
export const CORRECTIONS_SHOWN = 20;

const feedReport = v.object({
  feed: v.union(...FEEDS.map((feed) => v.literal(feed))),
  state: feedState,
  lastRunAt: v.union(v.number(), v.null()),
  lastSuccessAt: v.union(v.number(), v.null()),
  /** The newest failure among the runs read, and when its run started. */
  lastError: v.union(v.object({ at: v.number(), error: v.string() }), v.null()),
});

/** A match by its clubs' names; null if the football sync holds no such match or club. */
const matchNamed = v.union(v.object({ home: v.string(), away: v.string() }), v.null());

const feedsReport = v.object({
  /** The time the feeds were judged at, for the screen's "ago". */
  now: v.number(),
  feeds: v.array(feedReport),
  /** Matches at full time still provisional when their correction window closed (spec/07):
   *  a feed's record is missing, so their points can't lock. Longest behind first. */
  behind: v.array(v.object({ fixtureCode: v.number(), match: matchNamed, fullTimeAt: v.number() })),
  /** Whether more are behind than `behind` lists. */
  moreBehind: v.boolean(),
  corrections: v.array(
    v.object({
      fixtureCode: v.number(),
      match: matchNamed,
      playerCode: v.number(),
      player: v.union(v.string(), v.null()),
      seenAt: v.number(),
      changes: v.array(lateStatChange),
    }),
  ),
});
export type FeedsReport = Infer<typeof feedsReport>;

export const feeds = query({
  args: { now: v.number() },
  returns: feedsReport,
  handler: async (ctx, { now }) => {
    await adminOf(ctx);
    const owedSince = await owedSinceAt(ctx, now);
    const feeds = [];
    for (const feed of FEEDS) {
      const { lastError, ...runs } = await readRuns(runsOf(ctx, feed));
      const state = judgeFeed(runs, FEED_SCHEDULES[feed], owedSince[feed], now);
      feeds.push({ feed, state, lastRunAt: runs.lastRun?.ranAt ?? null, lastSuccessAt: runs.lastSuccessAt, lastError });
    }
    const windowMs = await statCorrectionWindowMs(ctx);
    const provisional = await ctx.db
      .query("matchStatsStatus")
      .withIndex("by_state_and_fullTimeAt", (q) => q.eq("state", "provisional").lt("fullTimeAt", now - windowMs))
      .take(BEHIND_SHOWN + 1);
    const behind = [];
    for (const { fixtureCode, fullTimeAt } of provisional.slice(0, BEHIND_SHOWN)) {
      behind.push({ fixtureCode, match: await matchName(ctx, fixtureCode), fullTimeAt });
    }
    const corrections = [];
    for (const { fixtureCode, playerCode, seenAt, changes } of await ctx.db.query("lateStatCorrections").order("desc").take(CORRECTIONS_SHOWN)) {
      const player = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", playerCode)).unique();
      corrections.push({ fixtureCode, match: await matchName(ctx, fixtureCode), playerCode, player: player?.name ?? null, seenAt, changes });
    }
    return { now, feeds, behind, moreBehind: provisional.length > BEHIND_SHOWN, corrections };
  },
});

/** From when each feed owes a success (`judgeFeed`): the live tick from the first kickoff of the
 *  matches live now, and none between matches; every other feed always. */
async function owedSinceAt(ctx: QueryCtx, now: number): Promise<Record<Feed, number | null>> {
  const kickoffs = (await liveMatches(ctx, now)).map((match) => match.kickoff);
  const liveStats = kickoffs.length === 0 ? null : Math.min(...kickoffs);
  return { football: ALWAYS_OWED, positions: ALWAYS_OWED, matchStats: ALWAYS_OWED, liveStats };
}

type Run = { ranAt: number; outcome: RunOutcome };
type RunsRead = FeedRuns & { lastError: { at: number; error: string } | null };

/** A feed's run rows, newest first. */
function runsOf(ctx: QueryCtx, feed: Feed): AsyncIterable<Run> {
  const tables = { football: "footballSyncs", positions: "positionsSyncs", matchStats: "matchStatsSyncs", liveStats: "liveStatsTicks" } as const;
  return ctx.db.query(tables[feed]).order("desc");
}

/** The newest run, the newest success and the newest error, among the newest `RUNS_READ`. */
async function readRuns(runs: AsyncIterable<Run>): Promise<RunsRead> {
  const read: RunsRead = { lastRun: null, lastSuccessAt: null, lastError: null };
  let count = 0;
  for await (const { ranAt, outcome } of runs) {
    const failure = failureOf(outcome);
    read.lastRun ??= { ranAt, failure };
    if (failure === null) read.lastSuccessAt ??= ranAt;
    else read.lastError ??= { at: ranAt, error: failure };
    count += 1;
    if ((read.lastSuccessAt !== null && read.lastError !== null) || count === RUNS_READ) break;
  }
  return read;
}

async function matchName(ctx: QueryCtx, fixtureCode: number): Promise<Infer<typeof matchNamed>> {
  const fixture = await ctx.db.query("fixtures").withIndex("by_code", (q) => q.eq("code", fixtureCode)).unique();
  if (fixture === null) return null;
  const [home, away] = await Promise.all([clubName(ctx, fixture.homeClubCode), clubName(ctx, fixture.awayClubCode)]);
  return home === null || away === null ? null : { home, away };
}

async function clubName(ctx: QueryCtx, code: number): Promise<string | null> {
  return (await ctx.db.query("clubs").withIndex("by_code", (q) => q.eq("code", code)).unique())?.name ?? null;
}
