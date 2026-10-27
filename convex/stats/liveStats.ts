import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { recordsOf, statusOf, writeRecords, type DueMatch } from "./matchStats";
import { liveStatsTickFields, playerMatchRecord } from "../schema";
import { LATEST_RUNS } from "../shared/syncRuns";
import { HOUR_MS } from "../shared/time";
import { emailIfFailed } from "../admin/feedFailureEmails";
import { storeThresholdSteps } from "./thresholdSteps";

// Issue #28: the stored side of the live poller. `liveStatsSync.tick` asks `live` which matches
// are being played, reads them, and hands each one before full time to `upsertLive`; from full
// time on it goes to `matchStats.upsertMatch`, as the sync's reads do. Each tick is a row.

/** The longest a match is polled after kickoff: 105 minutes of play and half-time, stoppage time,
 *  a delayed kickoff and the minutes after full time while records still arrive. One the Premier
 *  League has not called full time by then is abandoned or its status is stuck, and is left to
 *  `matchStatsSync`. Claude's choice, as long as `scripts/record-match.mjs` records for. */
export const LIVE_WINDOW_MS = 4 * HOUR_MS;

/** The matches being played at `now`: kicked off within the window, and not yet complete. A match
 *  provisional after full time is still polled, so its last records land within the minute. */
export const live = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }): Promise<DueMatch[]> =>
    (await liveMatches(ctx, now)).map(({ fixtureCode, gameweek }) => ({ fixtureCode, gameweek })),
});

/** A match being played, with its kickoff, which the feeds page judges the tick's lateness from. */
type LiveMatch = DueMatch & { kickoff: number };

/** `live`'s matches, with their kickoffs. */
export async function liveMatches(ctx: QueryCtx, now: number): Promise<LiveMatch[]> {
  const kickedOff = ctx.db
    .query("fixtures")
    .withIndex("by_kickoff", (q) => q.gt("kickoff", now - LIVE_WINDOW_MS).lte("kickoff", now));
  const found: LiveMatch[] = [];
  // Uncapped, as it stays small: matches kicked off within one LIVE_WINDOW_MS, so at most the ten
  // a final day plays at once (#214).
  for await (const { code, gameweek, kickoff, droppedAt } of kickedOff) {
    if (droppedAt !== undefined || gameweek === null || kickoff === null) continue;
    const status = await statusOf(ctx, code);
    if (status === null || status.state === "provisional") found.push({ fixtureCode: code, gameweek, kickoff });
  }
  return found;
}

/** One match's records as read before full time, every one provisional. A match already read at
 *  full time (a status row) is `upsertMatch`'s alone, so a tick racing the sync writes nothing.
 *  `changed` names the men whose records moved. Nothing is recomputed here: the table works its
 *  points out on read (table/gameweekScores.ts), so the records written move it. The totals each
 *  passing a point where a rule's points change are stored as steps with the clock's `minute` (#44). */
export const upsertLive = internalMutation({
  args: { fixtureCode: v.number(), minute: v.union(v.number(), v.null()), records: v.array(playerMatchRecord) },
  handler: async (ctx, { fixtureCode, minute, records }) => {
    const status = await statusOf(ctx, fixtureCode);
    if (status !== null) return { state: status.state, inserted: 0, updated: 0, changed: [], lateCorrections: 0 };
    const held = new Map((await recordsOf(ctx, fixtureCode)).map((row) => [row.playerCode, row]));
    await storeThresholdSteps(ctx, fixtureCode, minute, records, held);
    const state = "provisional" as const;
    return { state, ...(await writeRecords(ctx, records, held, state)), lateCorrections: 0 };
  },
});

export const recordTick = internalMutation({
  args: liveStatsTickFields,
  handler: async (ctx, row) => {
    await ctx.db.insert("liveStatsTicks", row);
    await emailIfFailed(ctx, "liveStats", row);
  },
});

export const latest = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("liveStatsTicks").order("desc").take(LATEST_RUNS),
});
