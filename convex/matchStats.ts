import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { isMatchComplete, isWhole, lockTime, statChanges, type PlayerMatchRecord, type StatChange } from "./matchRecords";
import { statCorrectionWindowMs } from "./platformSettings";
import { matchStatsState, matchStatsSyncFields, playerMatchRecord } from "./schema";
import { HOUR_MS, MINUTE_MS } from "./time";

// Issue #27: the stored side of match stats. `matchStatsSync.run` reads the feeds and hands each
// match's records to `upsertMatch`; `lock` closes the window; each run is a row in matchStatsSyncs.

type State = Infer<typeof matchStatsState>;
/** A match to read, and the gameweek its live stats come under. */
export type DueMatch = { fixtureCode: number; gameweek: number };

/** Ninety minutes and a fifteen-minute half-time: no match reaches full time sooner after kickoff,
 *  so none is read before. */
const EARLIEST_FULL_TIME_MS = 105 * MINUTE_MS;
/** How long a locked match is still read, to catch a late correction for the feeds page, and how
 *  often: Claude's choice, not yet Craig's, and no late correction has been recorded to size it. */
export const LATE_CORRECTION_WATCH_MS = 24 * HOUR_MS;
export const LATE_READ_EVERY_MS = HOUR_MS;
/** Matches per run: a gameweek's worth, so a first run behind many keeps inside an action's time. */
export const MATCHES_PER_RUN = 10;
/** How many run rows `latest` returns. */
const LATEST_RUNS = 5;

/** The held matches to read now: each past full time and not locked, or locked within the watch
 *  and not read for an hour. Those never tried come first, then the least lately tried, oldest
 *  kickoff first among equals, so a run's worth that fail, wait or stay provisional every run
 *  cannot keep a newer match from being read. */
export const due = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }): Promise<DueMatch[]> => {
    const found: (DueMatch & { kickoff: number; triedAt: number })[] = [];
    // A season's 380, at most a few seasons' worth: the fixtures table has no kickoff index to range on.
    for await (const { code, gameweek, kickoff, droppedAt } of ctx.db.query("fixtures")) {
      if (droppedAt !== undefined || gameweek === null || kickoff === null) continue;
      if (now < kickoff + EARLIEST_FULL_TIME_MS) continue;
      const status = await statusOf(ctx, code);
      const lateWatched =
        status?.lockedAt !== undefined &&
        now - status.lockedAt < LATE_CORRECTION_WATCH_MS &&
        now - status.lastReadAt >= LATE_READ_EVERY_MS;
      if (status?.state !== "locked" || lateWatched) {
        const triedAt = (await triedOf(ctx, code))?.triedAt ?? Number.NEGATIVE_INFINITY;
        found.push({ fixtureCode: code, gameweek, kickoff, triedAt });
      }
    }
    return found
      .sort((a, b) => a.triedAt - b.triedAt || a.kickoff - b.kickoff)
      .slice(0, MATCHES_PER_RUN)
      .map(({ fixtureCode, gameweek }) => ({ fixtureCode, gameweek }));
  },
});

/** One match's records as read at `readAt`, a match at full time. Before the lock each record is
 *  written as sent, so a correction updates it and a stat taken away is gone (read as 0); the match
 *  is complete once every record is whole, and its lock is scheduled then. After the lock nothing
 *  is written but the changes, for the feeds page. */
export const upsertMatch = internalMutation({
  args: { fixtureCode: v.number(), readAt: v.number(), records: v.array(playerMatchRecord) },
  handler: async (ctx, { fixtureCode, readAt, records }) => {
    const status = await statusOf(ctx, fixtureCode);
    const held = new Map((await recordsOf(ctx, fixtureCode)).map((row) => [row.playerCode, row]));
    if (status?.state === "locked") {
      await ctx.db.patch("matchStatsStatus", status._id, { lastReadAt: readAt });
      const lateCorrections = await recordLateCorrections(ctx, records, held, readAt);
      return { state: status.state, inserted: 0, updated: 0, changed: [], lateCorrections };
    }
    const complete = isMatchComplete(records);
    const state: State = complete ? "complete" : "provisional";
    const fullTimeAt = status?.fullTimeAt ?? readAt;
    const completeAt = complete ? (status?.completeAt ?? readAt) : undefined;
    const fields = { fixtureCode, state, fullTimeAt, completeAt, lastReadAt: readAt };
    if (status === null) await ctx.db.insert("matchStatsStatus", fields);
    else await ctx.db.patch("matchStatsStatus", status._id, fields);
    if (completeAt !== undefined && status?.state !== "complete") {
      const lockAt = lockTime(fullTimeAt, completeAt, await statCorrectionWindowMs(ctx));
      await ctx.scheduler.runAt(lockAt, internal.matchStats.lock, { fixtureCode });
    }
    return { state, ...(await writeRecords(ctx, records, held, state)), lateCorrections: 0 };
  },
});

/** Locks a complete match once its window has passed, reading the window again in case the admin
 *  changed it; too early, it reschedules itself. A match provisional again has its lock scheduled
 *  anew when it is next complete, and one already locked stays as it is. */
export const lock = internalMutation({
  args: { fixtureCode: v.number() },
  handler: async (ctx, { fixtureCode }) => {
    const status = await statusOf(ctx, fixtureCode);
    if (status?.state !== "complete") return;
    if (status.completeAt === undefined) throw new Error(`match ${fixtureCode} is complete with no completeAt`);
    const lockAt = lockTime(status.fullTimeAt, status.completeAt, await statCorrectionWindowMs(ctx));
    const now = Date.now();
    if (now < lockAt) {
      await ctx.scheduler.runAt(lockAt, internal.matchStats.lock, { fixtureCode });
      return;
    }
    await ctx.db.patch("matchStatsStatus", status._id, { state: "locked", lockedAt: now });
    for (const row of await recordsOf(ctx, fixtureCode)) {
      await ctx.db.patch("playerMatchStats", row._id, { state: "locked" });
    }
  },
});

/** The run's row, and every match it tried marked tried then, whether it read, waited or failed. */
export const record = internalMutation({
  args: matchStatsSyncFields,
  handler: async (ctx, row) => {
    await ctx.db.insert("matchStatsSyncs", row);
    if (!row.outcome.ok) return;
    for (const fixtureCode of [...row.outcome.matches.map((match) => match.fixtureCode), ...row.outcome.waiting]) {
      const tried = await triedOf(ctx, fixtureCode);
      if (tried === null) await ctx.db.insert("matchStatsTries", { fixtureCode, triedAt: row.ranAt });
      else await ctx.db.patch("matchStatsTries", tried._id, { triedAt: row.ranAt });
    }
  },
});

export const latest = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("matchStatsSyncs").order("desc").take(LATEST_RUNS),
});

export function statusOf(ctx: QueryCtx, fixtureCode: number) {
  return ctx.db
    .query("matchStatsStatus")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

function triedOf(ctx: QueryCtx, fixtureCode: number) {
  return ctx.db
    .query("matchStatsTries")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** A match's held records: one per man named, so a few dozen. */
export function recordsOf(ctx: MutationCtx, fixtureCode: number) {
  return ctx.db
    .query("playerMatchStats")
    .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode))
    .collect();
}

/** Each record as sent, in the match's state: a new man inserted, a changed one replaced whole.
 *  `changed` names every man inserted or updated: the ones whose points move (#28). */
export async function writeRecords(
  ctx: MutationCtx,
  records: PlayerMatchRecord[],
  held: Map<number, Doc<"playerMatchStats">>,
  state: State,
): Promise<{ inserted: number; updated: number; changed: number[] }> {
  let inserted = 0;
  const changed: number[] = [];
  for (const record of records) {
    const row = held.get(record.playerCode);
    if (row === undefined) {
      await ctx.db.insert("playerMatchStats", { ...record, state });
      inserted += 1;
      changed.push(record.playerCode);
      continue;
    }
    const differs = !sameRecord(row, record);
    if (differs) changed.push(record.playerCode);
    if (differs || row.state !== state) await ctx.db.replace("playerMatchStats", row._id, { ...record, state });
  }
  return { inserted, updated: changed.length - inserted, changed };
}

/** A row for each whole record that differs from the locked one, unless the last row for him
 *  already says the same. A record not whole after the lock is a feed's gap, not a correction. */
async function recordLateCorrections(
  ctx: MutationCtx,
  records: PlayerMatchRecord[],
  held: Map<number, Doc<"playerMatchStats">>,
  seenAt: number,
): Promise<number> {
  let recorded = 0;
  for (const record of records) {
    if (!isWhole(record)) continue;
    const changes = statChanges(held.get(record.playerCode)?.stats ?? {}, record.stats);
    if (changes.length === 0) continue;
    const { fixtureCode, playerCode } = record;
    const last = await ctx.db
      .query("lateStatCorrections")
      .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode).eq("playerCode", playerCode))
      .order("desc")
      .first();
    if (last !== null && sameChanges(last.changes, changes)) continue;
    await ctx.db.insert("lateStatCorrections", { fixtureCode, playerCode, seenAt, changes });
    recorded += 1;
  }
  return recorded;
}

/** The same stats changed to the same values. Field by field: a stored object's keys come back sorted. */
function sameChanges(held: StatChange[], sent: StatChange[]): boolean {
  return (
    held.length === sent.length &&
    held.every((change, index) => {
      const other = sent[index];
      return change.stat === other.stat && change.locked === other.locked && change.sent === other.sent;
    })
  );
}

/** What the feeds sent is what is held; a stat left out and a stat sent as 0 read the same. */
function sameRecord(row: Doc<"playerMatchStats">, record: PlayerMatchRecord): boolean {
  return (
    row.started === record.started &&
    row.played === record.played &&
    row.arrived.fpl === record.arrived.fpl &&
    row.arrived.pl === record.arrived.pl &&
    statChanges(row.stats, record.stats).length === 0
  );
}
