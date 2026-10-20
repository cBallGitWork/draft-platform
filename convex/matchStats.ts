import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { MS_PER_MINUTE } from "./deadline";
import { isMatchComplete, isWhole, lockTime, statChanges, type PlayerMatchRecord } from "./matchRecords";
import { statCorrectionWindowMs } from "./platformSettings";
import { lateStatChange, matchStatsState, matchStatsSyncFields, playerMatchRecord } from "./schema";

// Issue #27: the stored side of match stats. `matchStatsSync.run` reads the feeds and hands each
// match's records to `upsertMatch`; `lock` closes the window; each run is a row in matchStatsSyncs.

type State = Infer<typeof matchStatsState>;
type StatChange = Infer<typeof lateStatChange>;
const HOUR_MS = 60 * MS_PER_MINUTE;

/** Ninety minutes and a fifteen-minute half-time: no match reaches full time sooner after kickoff,
 *  so none is read before. */
const EARLIEST_FULL_TIME_MS = 105 * MS_PER_MINUTE;
/** How long a locked match is still read, to catch a late correction for the feeds page, and how
 *  often. Claude's choice: FPL's corrections seen so far land the same day. */
const LATE_CORRECTION_WATCH_MS = 24 * HOUR_MS;
const LATE_READ_EVERY_MS = HOUR_MS;
/** Matches per run, oldest first: a gameweek's worth, so a first run behind many keeps inside an action's time. */
export const MATCHES_PER_RUN = 10;
/** How many run rows `latest` returns. */
const LATEST_RUNS = 5;

/** The held matches to read now, oldest kickoff first: each past full time and not locked, or
 *  locked within the watch and not read for an hour. */
export const due = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }): Promise<{ fixtureCode: number; gameweek: number }[]> => {
    const due: { fixtureCode: number; gameweek: number; kickoff: number }[] = [];
    // A season's 380, at most a few seasons' worth: the fixtures table has no kickoff index to range on.
    for await (const { code, gameweek, kickoff, droppedAt } of ctx.db.query("fixtures")) {
      if (droppedAt !== undefined || gameweek === null || kickoff === null) continue;
      if (now < kickoff + EARLIEST_FULL_TIME_MS) continue;
      const status = await statusOf(ctx, code);
      const lateWatched =
        status?.lockedAt !== undefined &&
        now - status.lockedAt < LATE_CORRECTION_WATCH_MS &&
        now - status.lastReadAt >= LATE_READ_EVERY_MS;
      if (status?.state !== "locked" || lateWatched) due.push({ fixtureCode: code, gameweek, kickoff });
    }
    return due
      .sort((a, b) => a.kickoff - b.kickoff)
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
      return { state: status.state, inserted: 0, updated: 0, lateCorrections };
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
    let inserted = 0;
    let updated = 0;
    for (const record of records) {
      const row = held.get(record.playerCode);
      if (row === undefined) {
        await ctx.db.insert("playerMatchStats", { ...record, state });
        inserted += 1;
        continue;
      }
      const changed = !sameRecord(row, record);
      if (changed) updated += 1;
      if (changed || row.state !== state) await ctx.db.replace("playerMatchStats", row._id, { ...record, state });
    }
    return { state, inserted, updated, lateCorrections: 0 };
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

export const record = internalMutation({
  args: matchStatsSyncFields,
  handler: async (ctx, row) => {
    await ctx.db.insert("matchStatsSyncs", row);
  },
});

export const latest = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("matchStatsSyncs").order("desc").take(LATEST_RUNS),
});

function statusOf(ctx: QueryCtx, fixtureCode: number) {
  return ctx.db
    .query("matchStatsStatus")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** A match's held records: one per man named, so a few dozen. */
function recordsOf(ctx: MutationCtx, fixtureCode: number) {
  return ctx.db
    .query("playerMatchStats")
    .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode))
    .collect();
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
