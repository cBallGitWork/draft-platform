import { v, type Infer, type PropertyValidators } from "convex/values";
import type { TableNames } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import type { Every } from "./feedSchedule";
import { DAY_MS } from "./time";

// Numbers the feeds' runs share, and the `latest` query each reads its runs back with. Each sync,
// tick and check keeps its own run table (shared/feedSchedule.ts's FEED_RUN_TABLES), and
// admin/runLogs.ts prunes them all.

/** How many run rows each `latest` returns. */
export const LATEST_RUNS = 5;

/** A run table's `latest`: its newest LATEST_RUNS rows, newest first, `fields` being the table's
 *  own (its schema's run fields). TypeScript can't match a generic table's rows to `fields`, so
 *  they are cast; `returns` still checks each row as it is sent. */
export function latestRuns<Table extends TableNames, Fields extends PropertyValidators>(table: Table, fields: Fields) {
  const returns = v.array(v.object({ _id: v.id(table), _creationTime: v.number(), ...fields }));
  return internalQuery({
    args: {},
    returns,
    handler: async (ctx) => (await ctx.db.query(table).order("desc").take(LATEST_RUNS)) as unknown as Infer<typeof returns>,
  });
}

/** Rows per mutation, upserted or checked for a mark: well inside Convex's per-transaction limits,
 *  and a season's ~700 players in four. */
export const BATCH_SIZE = 200;

/** `rows` in slices of `BATCH_SIZE`, in order: what each mutation of a batched write is sent. */
export function* inBatches<Row>(rows: readonly Row[]): Generator<Row[]> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) yield rows.slice(start, start + BATCH_SIZE);
}

/** How long a run row is kept once it is not among a feed's newest `LATEST_RUNS` (Craig, 22 Oct
 *  2026, #146): a success for 30 days, a failure for 180, so an old fault stays on record. */
export const SUCCESS_KEPT_MS = 30 * DAY_MS;
export const FAILURE_KEPT_MS = 180 * DAY_MS;

/** How often `admin/runLogs:prune` clears the rows past those times (spec/20): daily, as they are
 *  counted in days. */
export const PRUNE_EVERY = { hours: 24 } as const satisfies Every;
