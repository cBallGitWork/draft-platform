import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { recordsOf, statusOf, writeRecords, type DueMatch } from "./matchStats";
import { liveStatsTickFields, playerMatchRecord } from "./schema";
import { LATEST_RUNS } from "./syncRuns";
import { HOUR_MS } from "./time";

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
  handler: async (ctx, { now }): Promise<DueMatch[]> => {
    const kickedOff = ctx.db
      .query("fixtures")
      .withIndex("by_kickoff", (q) => q.gt("kickoff", now - LIVE_WINDOW_MS).lte("kickoff", now));
    const found: DueMatch[] = [];
    for await (const { code, gameweek, droppedAt } of kickedOff) {
      if (droppedAt !== undefined || gameweek === null) continue;
      const status = await statusOf(ctx, code);
      if (status === null || status.state === "provisional") found.push({ fixtureCode: code, gameweek });
    }
    return found;
  },
});

/** One match's records as read before full time, every one provisional. A match already read at
 *  full time (a status row) is `upsertMatch`'s alone, so a tick racing the sync writes nothing.
 *  `changed` names the men whose records moved: each league's scoring set is stored (#120), but no
 *  lineup is yet (#8) and nothing recomputes points from them, so none are recomputed here; once
 *  something does, it recomputes them for these. */
export const upsertLive = internalMutation({
  args: { fixtureCode: v.number(), records: v.array(playerMatchRecord) },
  handler: async (ctx, { fixtureCode, records }) => {
    const status = await statusOf(ctx, fixtureCode);
    if (status !== null) return { state: status.state, inserted: 0, updated: 0, changed: [], lateCorrections: 0 };
    const held = new Map((await recordsOf(ctx, fixtureCode)).map((row) => [row.playerCode, row]));
    const state = "provisional" as const;
    return { state, ...(await writeRecords(ctx, records, held, state)), lateCorrections: 0 };
  },
});

export const recordTick = internalMutation({
  args: liveStatsTickFields,
  handler: async (ctx, row) => {
    await ctx.db.insert("liveStatsTicks", row);
  },
});

export const latestTicks = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("liveStatsTicks").order("desc").take(LATEST_RUNS),
});
