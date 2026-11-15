import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { dueMatch, LIVE_WINDOW_MS, type DueMatch } from "../shared/dueMatches";
import { matchWrites, statusOf, writeRows } from "./matchStats";
import { matchRecordsOf } from "./matchRecordReads";
import { delayPoints, livePrintsOf, recordPrint, undelayPoints } from "./livePrints";
import { isCutOff } from "./matchRecords";
import { countedStats, moveSeasonTotals } from "./seasonStats";
import { liveStatsTickFields, playerMatchRecord, sideMatchOutcome } from "../schema";
import { latestRuns } from "../shared/syncRuns";
import { emailIfFailed } from "../admin/feedFailureEmails";
import { storeThresholdSteps } from "../matchup/thresholdSteps";
import { FULL_TIME_LINE_WAIT_MS, fullTimeLineMissing } from "../football/matchCommentary";
import { anyLiveScores } from "../shared/liveScoreRows";
import { dueSheetsAt } from "../football/matchTeamSheets";

// Issue #28: the stored side of the live poller. `liveStatsSync.tick` asks `due` which matches
// are being played, reads them, and hands each one before full time to `upsertLive`; from full
// time on it goes to `matchStats.upsertMatch`, as the sync's reads do. Each tick is a row.

/** What the tick reads at `now`, in one query (#1999): `live`, the matches being played, kicked off
 *  within the window and not yet complete; and `sheets`, those kicking off within the hour, whose
 *  team sheets it reads (#45, football/matchTeamSheets.ts). A match provisional after full time is
 *  still polled, so its last records land within the minute; and one complete is still polled for
 *  `FULL_TIME_LINE_WAIT_MS` after full time while the commentary it read lacks the full-time line,
 *  as "Match ends" can reach the stream after the status flips (#917). */
export const due = internalQuery({
  args: { now: v.number() },
  returns: v.object({
    live: v.array(dueMatch),
    sheets: v.array(dueMatch),
    /** Whether any league holds a live score row (table/liveScores.ts), which the tick clears once
     *  none is live: asked in the same read, so a quiet minute costs no more calls. */
    liveScoresHeld: v.boolean(),
  }),
  handler: async (ctx, { now }): Promise<{ live: DueMatch[]; sheets: DueMatch[]; liveScoresHeld: boolean }> => ({
    live: (await liveMatches(ctx, now)).map(asDue),
    sheets: (await dueSheetsAt(ctx, now)).map(asDue),
    liveScoresHeld: await anyLiveScores(ctx),
  }),
});

const asDue = ({ fixtureCode, gameweek }: DueMatch): DueMatch => ({ fixtureCode, gameweek });

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
    const awaitingFullTimeLine =
      status?.state === "complete" && now - status.fullTimeAt < FULL_TIME_LINE_WAIT_MS && (await fullTimeLineMissing(ctx, code));
    if (status === null || status.state === "provisional" || awaitingFullTimeLine) found.push({ fixtureCode: code, gameweek, kickoff });
  }
  return found;
}

/** One match's records as read at `readAt` before full time, every one provisional. A match already
 *  read at full time (a status row) is `upsertMatch`'s alone, so a tick racing the sync writes
 *  nothing; so does a read older than the last one written (spec/10 `S10.12`). `changed` names the
 *  men whose records moved. Nothing is recomputed here: the table works its points out on read
 *  (gameweekScorer/gameweekScores.ts), so the records written move it. The totals each passing a
 *  point where a rule's points change are stored as steps with the clock's `minute` (#44). Each
 *  record is checked against the match's compact row, and only a man who moved is read and
 *  written; season totals, season points and Scouting wait for full time (#2006, livePrints.ts).
 *  A read cut off for a man (`isCutOff`), or leaving out a man it named before, keeps what was
 *  held and marks the match's live points delayed; the next full read writes and clears it (`S10.12`). */
export const upsertLive = internalMutation({
  args: { fixtureCode: v.number(), readAt: v.number(), minute: v.union(v.number(), v.null()), records: v.array(playerMatchRecord) },
  returns: v.object({
    ...matchWrites.fields,
    /** How storing the steps went, for the threshold lines feed's row (#522); null when none were
     *  looked for, the match being the sync's or the read older than the last. */
    thresholdSteps: v.union(sideMatchOutcome, v.null()),
  }),
  handler: async (ctx, { fixtureCode, readAt, minute, records }) => {
    const status = await statusOf(ctx, fixtureCode);
    if (status !== null) return { state: status.state, ...UNWRITTEN };
    const prints = (await livePrintsOf(ctx, fixtureCode)) ?? (await startPrints(ctx, fixtureCode));
    const state = "provisional" as const;
    if (prints.readAt !== undefined && readAt < prints.readAt) return { state, ...UNWRITTEN };
    const printed = new Map(prints.prints.map(({ playerCode, print }) => [playerCode, print]));
    const sentCodes = new Set(records.map(({ playerCode }) => playerCode));
    const leftOut = prints.prints.some(({ playerCode }) => !sentCodes.has(playerCode));
    const sent = records.map((record) => ({ record, print: recordPrint(record) }));
    const changed = sent.filter(({ record, print }) => printed.get(record.playerCode) !== print);
    const held = new Map<number, Doc<"playerMatchStats">>();
    for (const { record } of changed) {
      const row = await matchRecordOf(ctx, fixtureCode, record.playerCode);
      if (row !== null) held.set(row.playerCode, row);
    }
    const moved = changed.filter(({ record }) => {
      const row = held.get(record.playerCode);
      return row === undefined || !isCutOff(row, record);
    });
    const movedRecords = moved.map(({ record }) => record);
    const thresholdSteps = await storeThresholdSteps(ctx, fixtureCode, minute, movedRecords, held);
    const written = await writeRows(ctx, movedRecords, held, state);
    for (const { record, print } of moved) printed.set(record.playerCode, print);
    const kept = moved.length > 0 ? { prints: [...printed].map(([playerCode, print]) => ({ playerCode, print })) } : {};
    await ctx.db.patch("liveMatchPrints", prints._id, { ...kept, readAt });
    const cutOff = leftOut || moved.length < changed.length;
    if (cutOff) await delayPoints(ctx, fixtureCode, readAt);
    else await undelayPoints(ctx, fixtureCode);
    return { state, ...written, lateCorrections: 0, thresholdSteps };
  },
});

/** What a write that writes nothing returns, beside its state. */
const UNWRITTEN = { inserted: 0, updated: 0, changed: [], lateCorrections: 0, thresholdSteps: null };

/** Each live match's points marked delayed from `readAt`, as when a tick couldn't read it: they stay
 *  as last read, and the scoreboards say "Live points delayed" until a full read (spec/10 `S10.12`).
 *  A match with no live write yet has no points to hold. */
export const delayLivePoints = internalMutation({
  args: { fixtureCodes: v.array(v.number()), readAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { fixtureCodes, readAt }) => {
    for (const fixtureCode of fixtureCodes) if ((await livePrintsOf(ctx, fixtureCode)) !== null) await delayPoints(ctx, fixtureCode, readAt);
    return null;
  },
});

/** The match's compact row, made at its first live write. Records already held with none were
 *  written live before #2006 and counted in the season totals as they went: taken back out, so
 *  full time counts them once, as it does every live match's. The row is made first, so a player
 *  whose totals are rebuilt in that leaves this match out. */
async function startPrints(ctx: MutationCtx, fixtureCode: number): Promise<Doc<"liveMatchPrints">> {
  const id = await ctx.db.insert("liveMatchPrints", { fixtureCode, prints: [] });
  const earlier = await matchRecordsOf(ctx, fixtureCode, "taking its live records out of the season totals");
  const uncounted = earlier.map(({ playerCode, ...row }) => ({ playerCode, fixtureCode, before: countedStats(row), after: {} }));
  if (uncounted.length > 0) await moveSeasonTotals(ctx, uncounted);
  const made = await ctx.db.get("liveMatchPrints", id);
  if (made === null) throw new Error(`Match ${fixtureCode}'s compact row was made but can't be read`);
  return made;
}

/** One man's record in the match, or null with none held. */
function matchRecordOf(ctx: QueryCtx, fixtureCode: number, playerCode: number) {
  return ctx.db
    .query("playerMatchStats")
    .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode).eq("playerCode", playerCode))
    .unique();
}

export const recordTick = internalMutation({
  args: liveStatsTickFields,
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("liveStatsTicks", row);
    await emailIfFailed(ctx, "liveStats", row);
    return null;
  },
});

export const latest = latestRuns("liveStatsTicks", liveStatsTickFields);
