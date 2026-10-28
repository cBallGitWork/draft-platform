import { getFunctionName } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { errorMessage } from "../shared/errors";
import { takeAllOrThrow } from "../shared/cappedRead";
import { isLocked } from "./deadline";
import { recordGameweekStarts } from "./gameweekStarts";
import { passedDeadlinesOf } from "./passedDeadlines";
import { seasonRules } from "../rules/rulesHistory";
import { heldSchedule, leagueDeadlinesIn } from "./leagueDeadlines";
import { storeBegunFixtures } from "../table/playedFixtures";

// Records each league's passed deadlines (#150), so a postponement after one can't move it
// (deadline.ts). No kickoff moves without the deadlines it passed recorded first: the football
// sync is the only writer of kickoffs, and both of its mutations that can move one, upsertFixtures
// (each batch) and markDropped (for fixtures), call this first, in the same transaction. Until
// then, the deadline worked out from the kickoffs is the one that passed. A deadline already
// recorded is left as it is, so calling this again does no harm. With them, it stores each begun
// gameweek's head-to-head fixtures (playedFixtures.ts, #137), and first of all, for the whole site,
// each gameweek's first kickoff once passed (gameweekStarts.ts, #414): both as harmless to repeat.
//
// It fails closed: if recording or storing throws, for any league, that fixtures mutation fails
// with it, so no kickoff moves; the sync is logged and filed in footballSyncs as failed. The feed
// stands still for every league until it is fixed. A league whose rules can't be read (only a row
// written by hand can be: a commissioner's change is checked) isn't skipped, because skipping it
// would let its kickoffs move with its passed deadlines unrecorded, and that could reopen its
// gameweek.
//
// Recording only on the six-hourly sync would leave a gameweek unbegun for hours after its deadline
// passed: unscored, its matchup "not begun". So each recording also sets one alarm,
// `recordDueDeadlines`, for the soonest deadline still to come in any league, and that alarm records
// again and sets the next. The deadline is worked out from the kickoffs held before the sync writes
// its batch, so a kickoff moved earlier in that batch is caught by the next recording: no later than
// the next sync, or at once if the alarm already set fires first. Lineups lock on the worked-out
// deadline either way (lineups.ts), so this decides only how soon scoring sees the gameweek begun.
// An alarm whose recording throws fails closed as the sync's does, in Convex's logs, and the next
// sync sets the alarm again.

/** The most leagues one recording reads, all in the fixtures mutation's one transaction: the closed
 *  beta has a handful, and each league reads its rules, deadlines and fixtures. Past it this throws,
 *  failing closed as above, rather than leave a league's deadlines unrecorded; by then the
 *  recording wants splitting across transactions (#214). */
export const LEAGUES_RECORDED_MOST = 200;

/** Records each gameweek's first kickoff once passed, every league's deadlines that have passed
 *  and aren't yet recorded, and stores the fixtures of the gameweeks they began; returns how many
 *  deadlines it recorded. */
export async function recordPassedDeadlines(ctx: MutationCtx): Promise<number> {
  const now = Date.now();
  // Read once for every league: the fixtures are the season's 380, the most of any table here.
  const { matches } = await heldSchedule(ctx);
  await recordGameweekStarts(ctx, matches, now);
  const leagues = await takeAllOrThrow(
    ctx.db.query("leagues"),
    LEAGUES_RECORDED_MOST,
    `More than ${LEAGUES_RECORDED_MOST} leagues are held, so some would have their deadlines unrecorded`,
  );
  let recorded = 0;
  let soonestToCome: number | null = null;
  for (const league of leagues) {
    const passed = await passedDeadlinesOf(ctx, league._id);
    const deadlines = await leagueDeadlinesIn(ctx, league._id, matches).catch((error: unknown) => {
      // Named, so the failed sync's log and run row say which league to fix.
      throw new Error(`League ${league._id} (${league.name}): its deadlines can't be worked out: ${errorMessage(error)}`);
    });
    for (const [gameweek, deadline] of deadlines) {
      if (deadline === null) continue;
      if (!isLocked(deadline, now)) {
        soonestToCome = Math.min(soonestToCome ?? deadline, deadline);
        continue;
      }
      if (passed.has(gameweek)) continue;
      await ctx.db.insert("passedDeadlines", { leagueId: league._id, gameweek, deadline, recordedAt: now });
      recorded += 1;
    }
    // Once a gameweek has begun, its fixtures are stored, so nothing after can redraw them (#137).
    await storeBegunFixtures(ctx, league, await seasonRules(ctx, league._id), deadlines, now);
  }
  await setDeadlineAlarm(ctx, soonestToCome);
  return recorded;
}

/** The alarm `recordPassedDeadlines` sets for the soonest deadline to come: it records again, and
 *  that recording sets the next one. */
export const recordDueDeadlines = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await recordPassedDeadlines(ctx);
    return null;
  },
});

/** The alarm's name as `_scheduled_functions` holds it, less any `.js` the deployment adds to the
 *  module's path. */
const DEADLINE_ALARM = getFunctionName(internal.gameweeks.deadlineRecorder.recordDueDeadlines);
const JS_EXTENSION = /\.js(?=:)/;

/** Leaves exactly one alarm pending, at `at`, or none when no deadline is to come. Every sync and
 *  every alarm records, so without this each would start a chain of its own. The scan reads every
 *  scheduled function Convex keeps: those pending, and those finished in the last week. */
async function setDeadlineAlarm(ctx: MutationCtx, at: number | null): Promise<void> {
  let kept = false;
  for await (const job of ctx.db.system.query("_scheduled_functions")) {
    if (job.state.kind !== "pending" || job.name.replace(JS_EXTENSION, "") !== DEADLINE_ALARM) continue;
    if (!kept && job.scheduledTime === at) kept = true;
    else await ctx.scheduler.cancel(job._id);
  }
  if (at !== null && !kept) await ctx.scheduler.runAt(at, internal.gameweeks.deadlineRecorder.recordDueDeadlines, {});
}
