import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { statCorrectionWindowMs } from "./platformSettings";
import { ALWAYS_OWED, failureOf, feedState, judgeFeed, type FeedRuns, type RunOutcome } from "./feedState";
import { takeShown } from "../shared/cappedRead";
import { fixtureByCode } from "../shared/fixtures";
import { adminOf } from "../shared/leagueAccess";
import { findClubByCode, playerByCode } from "../shared/players";
import { FEED_RUN_TABLES, FEED_SCHEDULES, FEEDS, feedValidator, type Feed } from "../shared/feedSchedule";
import { liveMatches } from "../stats/liveStats";
import { dueSheetsAt } from "../football/matchTeamSheets";
import { LINEUPS_OUT_BEFORE_KICKOFF_MS } from "../shared/time";
import { lateStatChange } from "../schema";

// The admin's feeds page (#35; spec/15 The admin): when each feed last arrived and whether it is
// late or failing, the matches whose scoring is behind, and stat corrections after a lock.
//
// Lateness needs the time, and a query must not read the clock: Convex caches a query by its
// arguments and re-runs it only when the data it read changes, so a stopped feed, which changes
// nothing, would never turn late (convex/_generated/ai/guidelines.md). So the screen passes `now`,
// moved on each minute, and the query judges against it: a new minute is a new query.

/** Runs read back per feed, newest first, for its last success and last error: 25 days of the
 *  football sync, or an hour and 40 minutes of live ticks. */
export const RUNS_READ = 100;
/** Matches behind, and late corrections, the page lists at most: newest corrections first. */
export const BEHIND_SHOWN = 20;
export const CORRECTIONS_SHOWN = 20;

const feedReport = v.object({
  feed: feedValidator,
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
  /** Whether more corrections came than `corrections` lists: the page says so, never a silent cut. */
  moreCorrections: v.boolean(),
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
    const provisional = await takeShown(
      ctx.db.query("matchStatsStatus").withIndex("by_state_and_fullTimeAt", (q) => q.eq("state", "provisional").lt("fullTimeAt", now - windowMs)),
      BEHIND_SHOWN,
    );
    const behind = [];
    for (const { fixtureCode, fullTimeAt } of provisional.rows) {
      behind.push({ fixtureCode, match: await matchName(ctx, fixtureCode), fullTimeAt });
    }
    const corrections = [];
    const latestCorrections = await takeShown(ctx.db.query("lateStatCorrections").order("desc"), CORRECTIONS_SHOWN);
    for (const { fixtureCode, playerCode, seenAt, changes } of latestCorrections.rows) {
      const player = await playerByCode(ctx, playerCode);
      corrections.push({ fixtureCode, match: await matchName(ctx, fixtureCode), playerCode, player: player?.name ?? null, seenAt, changes });
    }
    return { now, feeds, behind, moreBehind: provisional.more, moreCorrections: latestCorrections.more, corrections };
  },
});

/** From when each feed owes a success (`judgeFeed`): the live tick, and the team stats and
 *  threshold lines it reads, from the first kickoff of the matches live now; the team sheets from
 *  the first due match's hour before kickoff; none of those between matches; every other feed
 *  always. */
async function owedSinceAt(ctx: QueryCtx, now: number): Promise<Record<Feed, number | null>> {
  const earliest = (times: number[]) => (times.length === 0 ? null : Math.min(...times));
  const liveStats = earliest((await liveMatches(ctx, now)).map((match) => match.kickoff));
  const teamSheets = earliest((await dueSheetsAt(ctx, now)).map((match) => match.kickoff - LINEUPS_OUT_BEFORE_KICKOFF_MS));
  return {
    football: ALWAYS_OWED,
    positions: ALWAYS_OWED,
    matchStats: ALWAYS_OWED,
    liveStats,
    teamSheets,
    teamStats: liveStats,
    thresholdSteps: liveStats,
  };
}

type Run = { ranAt: number; outcome: RunOutcome };
type RunsRead = FeedRuns & { lastError: { at: number; error: string } | null };

/** A feed's run rows, newest first. */
function runsOf(ctx: QueryCtx, feed: Feed): AsyncIterable<Run> {
  return ctx.db.query(FEED_RUN_TABLES[feed]).order("desc");
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
  const fixture = await fixtureByCode(ctx, fixtureCode);
  if (fixture === null) return null;
  const [home, away] = await Promise.all([clubName(ctx, fixture.homeClubCode), clubName(ctx, fixture.awayClubCode)]);
  return home === null || away === null ? null : { home, away };
}

async function clubName(ctx: QueryCtx, code: number): Promise<string | null> {
  return (await findClubByCode(ctx, code))?.name ?? null;
}
