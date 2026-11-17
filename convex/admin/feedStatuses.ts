import type { Infer } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { emailIfFailed, type FailedCompetition } from "./feedFailureEmails";
import { failureOf, type FeedRuns, type RunOutcome } from "./feedState";
import { FEED_RUN_TABLES, isSportmonksFeed, type Feed } from "../shared/feedSchedule";
import type { feedStatusTables } from "../schema/feeds";

// Each feed's status row (#2500): its last run, last success and last error, kept as each run is
// logged, so the feeds page (admin/feeds.ts) reads one row a feed, where it read up to `RUNS_READ`
// runs each, every minute. Its first run's row is worked out from the runs held, and until a
// feed's next run the page reads its runs, so nothing it shows changes.

/** How far back the page looks for a feed's last success and last error, in runs: 25 days of the
 *  football sync, or an hour and 40 minutes of live ticks. */
export const RUNS_READ = 100;

type Status = Infer<(typeof feedStatusTables)["feedStatuses"]["validator"]>;
type Run = { ranAt: number; outcome: RunOutcome };

/** What the feeds page shows of a feed: its runs, and its newest error. */
export type FeedStatus = FeedRuns & { lastError: { at: number; error: string } | null };

/** What follows a run logged in `feed`'s run table, in the same mutation: its status row kept,
 *  and the admin emailed if it failed (`of`, a Sportmonks feed's competition, for the email). */
export async function afterRunLogged(ctx: MutationCtx, feed: Feed, row: Run & { competition?: number }, of: FailedCompetition | null = null): Promise<void> {
  await keepFeedStatus(ctx, feed, row);
  await emailIfFailed(ctx, feed, row, of);
}

/** Keeps `feed`'s status row (for a Sportmonks feed, `competition`'s) after a run is logged. */
export async function keepFeedStatus(ctx: MutationCtx, feed: Feed, { ranAt, outcome, competition }: Run & { competition?: number }): Promise<void> {
  // A Sportmonks run naming no competition is on no row of the page (schema/sportmonks.ts).
  if (isSportmonksFeed(feed) && competition === undefined) return;
  const held = await statusRowOf(ctx, feed, competition);
  if (held === null) {
    await ctx.db.insert("feedStatuses", { feed, competition, ...(await statusFromRuns(runsOf(ctx, feed, competition))) });
    return;
  }
  const failure = failureOf(outcome);
  await ctx.db.replace("feedStatuses", held._id, {
    feed,
    competition,
    lastRun: { ranAt, failure, betweenSeasons: outcome.ok && outcome.betweenSeasons === true },
    lastSuccessAt: failure === null ? ranAt : held.lastSuccessAt,
    lastError: failure === null ? held.lastError : { at: ranAt, error: failure },
    runsSinceSuccess: failure === null ? 0 : held.runsSinceSuccess + 1,
    runsSinceError: failure === null ? held.runsSinceError + 1 : 0,
  });
}

/** `feed`'s status as the page shows it: a last success or error `RUNS_READ` runs old is dropped. */
export async function feedStatusOf(ctx: QueryCtx, feed: Feed, competition?: number): Promise<FeedStatus> {
  const status = (await statusRowOf(ctx, feed, competition)) ?? (await statusFromRuns(runsOf(ctx, feed, competition)));
  return {
    lastRun: status.lastRun,
    lastSuccessAt: status.runsSinceSuccess < RUNS_READ ? status.lastSuccessAt : null,
    lastError: status.runsSinceError < RUNS_READ ? status.lastError : null,
  };
}

function statusRowOf(ctx: QueryCtx, feed: Feed, competition: number | undefined) {
  return ctx.db
    .query("feedStatuses")
    .withIndex("by_feed_and_competition", (q) => q.eq("feed", feed).eq("competition", competition))
    .unique();
}

/** A feed's run rows, newest first: for a Sportmonks feed, `competition`'s alone. */
function runsOf(ctx: QueryCtx, feed: Feed, competition: number | undefined): AsyncIterable<Run> {
  if (!isSportmonksFeed(feed)) return ctx.db.query(FEED_RUN_TABLES[feed]).order("desc");
  if (competition === undefined) throw new Error(`the ${feed} feed's runs are read a competition at a time`);
  return ctx.db
    .query(FEED_RUN_TABLES[feed])
    .withIndex("by_competition", (q) => q.eq("competition", competition))
    .order("desc");
}

/** A status worked out from the newest `RUNS_READ` runs, its last run null with none on record. A
 *  success or error not among them counts as `RUNS_READ` runs old. */
async function statusFromRuns(runs: AsyncIterable<Run>): Promise<Omit<Status, "feed" | "competition">> {
  const status: Omit<Status, "feed" | "competition"> = {
    lastRun: null,
    lastSuccessAt: null,
    lastError: null,
    runsSinceSuccess: RUNS_READ,
    runsSinceError: RUNS_READ,
  };
  let count = 0;
  for await (const { ranAt, outcome } of runs) {
    const failure = failureOf(outcome);
    status.lastRun ??= { ranAt, failure, betweenSeasons: outcome.ok && outcome.betweenSeasons === true };
    if (failure === null && status.lastSuccessAt === null) Object.assign(status, { lastSuccessAt: ranAt, runsSinceSuccess: count });
    if (failure !== null && status.lastError === null) Object.assign(status, { lastError: { at: ranAt, error: failure }, runsSinceError: count });
    count += 1;
    if ((status.lastSuccessAt !== null && status.lastError !== null) || count === RUNS_READ) break;
  }
  return status;
}
