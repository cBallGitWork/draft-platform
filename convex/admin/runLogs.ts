import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { failureOf, type RunOutcome } from "./feedState";
import { FEED_RUN_TABLES, feedValidator, type Feed } from "../shared/feedSchedule";
import { BATCH_SIZE, FAILURE_KEPT_MS, LATEST_RUNS, SUCCESS_KEPT_MS } from "../shared/syncRuns";

// Pruning the feeds' run logs (#146): every run of a sync or tick is a row, and nothing else ever
// deletes one, so liveStatsTicks alone would gain 40-50 thousand a season. A row goes once it is
// older than its retention (syncRuns.ts), but three kinds always stay:
// - a feed's newest `LATEST_RUNS`, which each `latest` reads back;
// - a failure younger than `FAILURE_KEPT_MS`, a run with one failed match counting as a failure;
// - the newest run that succeeded, however old, which positionSettings.ts judges positions from.
//   The oldest rows come first, so an old success is held until a newer one is seen: a later old
//   one, the first one kept for its age, or one among the newest `LATEST_RUNS`.
// A batch of rows a run, oldest first by `_creationTime`, handing on to the next as
// leagueDeletion.deleteForGood does. Once the last feed is done it hands on to the sign-in asks'
// prune (signInLinks.ts), so spec/20's daily clean-up stays one timed job.

/** The order the run logs are pruned in: the live tick's first, as they have by far the most rows. */
export const PRUNE_ORDER = [
  "liveStats",
  "teamStats",
  "thresholdSteps",
  "teamSheets",
  "football",
  "positions",
  "matchStats",
] as const satisfies readonly Feed[];

type RunRow = { _id: string; _creationTime: number; ranAt: number; outcome: RunOutcome };

/** A success as the feeds page counts one: no failed match either. For positions, whose runs
 *  read no matches, that is `outcome.ok`, as positionSettings.ts counts one. */
const succeeded = (row: RunRow) => failureOf(row.outcome) === null;

export const prune = internalMutation({
  args: {
    /** The feed being pruned; the first in `PRUNE_ORDER` when absent. */
    feed: v.optional(feedValidator),
    /** When this pruning began, so every batch keeps the same rows. Now when absent. */
    startedAt: v.optional(v.number()),
    /** The `_creationTime` of the last row the batch before read. */
    after: v.optional(v.number()),
    /** The newest old success read so far, kept until a newer success is seen. */
    heldSuccess: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { feed = PRUNE_ORDER[0], startedAt = Date.now(), after, heldSuccess }) => {
    const table = FEED_RUN_TABLES[feed];
    const idOf = (id: string) => ctx.db.normalizeId(table, id) ?? missing(table, id);
    const newestRows: RunRow[] = await ctx.db.query(table).order("desc").take(LATEST_RUNS);
    const newest = new Set(newestRows.map((row) => row._id));
    const rows: RunRow[] = await ctx.db
      .query(table)
      .withIndex("by_creation_time", (q) => (after === undefined ? q : q.gt("_creationTime", after)))
      .take(BATCH_SIZE);

    let held = heldSuccess ?? null;
    let deleted = 0;
    const remove = async (id: string) => {
      await ctx.db.delete(table, idOf(id));
      deleted += 1;
    };
    let reachedKept = rows.length < BATCH_SIZE;
    for (const row of rows) {
      if (row.ranAt >= startedAt - SUCCESS_KEPT_MS) {
        if (held !== null && succeeded(row)) {
          await remove(held);
          held = null;
        }
        reachedKept = true;
        break;
      }
      const expired = row.ranAt < startedAt - (succeeded(row) ? SUCCESS_KEPT_MS : FAILURE_KEPT_MS) && !newest.has(row._id);
      if (succeeded(row)) {
        if (held !== null) await remove(held);
        held = expired ? row._id : null;
      } else if (expired) {
        await remove(row._id);
      }
    }
    if (reachedKept && held !== null && newestRows.some(succeeded)) await remove(held);
    console.log(`Pruned ${deleted} ${table} rows`);

    const next = PRUNE_ORDER[PRUNE_ORDER.indexOf(feed) + 1];
    const lastRead = rows.at(-1);
    if (!reachedKept && lastRead !== undefined) {
      await ctx.scheduler.runAfter(0, internal.admin.runLogs.prune, { feed, startedAt, after: lastRead._creationTime, heldSuccess: held ?? undefined });
    } else if (next !== undefined) {
      await ctx.scheduler.runAfter(0, internal.admin.runLogs.prune, { feed: next, startedAt });
    } else {
      await ctx.scheduler.runAfter(0, internal.signIn.signInLinks.pruneSignInAsks, {});
    }
    return null;
  },
});

function missing(table: string, id: string): never {
  throw new Error(`${id} is not a row of ${table}, so it can't be pruned`);
}
