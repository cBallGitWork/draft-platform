import { getFunctionName } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { emailIfFailed } from "../admin/feedFailureEmails";
import { logFailure } from "../shared/errors";
import { takeAllOrThrow } from "../shared/cappedRead";
import { isLocked, type ScheduledMatch } from "./deadline";
import { recordGameweekStarts } from "./gameweekStarts";
import { fixedDeadlinesOf, passedDeadlinesOf } from "./passedDeadlines";
import { seasonRules } from "../rules/rulesHistory";
import { leagueDeadlinesIn, scheduledMatches } from "./leagueDeadlines";
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
// One league whose rules are broken never stops the feed for the others (spec/15, #896): a league
// whose deadlines or rules can't be read or applied (only a row written by hand can be: a
// commissioner's change is checked) is skipped, named in the log and emailed to the admin, and the
// other leagues' recording commits with the mutation. Craig took the cost: while it is skipped, its
// kickoffs can move with its passed deadlines unrecorded, which can reopen its gameweek. The email
// goes through the football feed's failure email, so the admin hears at most once a day however
// often the batches, pages and alarms skip it, and never past the day's email limit.
//
// Anything else that throws still fails closed: recording the gameweek starts, which is the whole
// site's, or reading the leagues. That fixtures mutation fails with it, so no kickoff moves; the
// sync is logged and filed in footballSyncs as failed.
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

/** What the log and the admin's email say after a skipped league's name, before why. */
export const LEAGUE_SKIPPED = "was skipped by the football feed, and the other leagues carried on, as its rules can't be read or applied";

/** Records each gameweek's first kickoff once passed, every league's deadlines that have passed
 *  and aren't yet recorded, and stores the fixtures of the gameweeks they began; returns how many
 *  deadlines it recorded. */
export async function recordPassedDeadlines(ctx: MutationCtx): Promise<number> {
  const now = Date.now();
  // Read once for every league: the fixtures are the season's 380, the most of any table here.
  const matches = await scheduledMatches(ctx);
  await recordGameweekStarts(ctx, matches, now);
  const leagues = await takeAllOrThrow(
    ctx.db.query("leagues"),
    LEAGUES_RECORDED_MOST,
    `More than ${LEAGUES_RECORDED_MOST} leagues are held, so some would have their deadlines unrecorded`,
  );
  let recorded = 0;
  let soonestToCome: number | null = null;
  for (const league of leagues) {
    try {
      const step = await recordLeague(ctx, league, matches, now);
      recorded += step.recorded;
      if (step.soonestToCome !== null) soonestToCome = Math.min(soonestToCome ?? step.soonestToCome, step.soonestToCome);
    } catch (error: unknown) {
      await skipBrokenLeague(ctx, league, error, now);
    }
  }
  await setDeadlineAlarm(ctx, soonestToCome);
  // A keeping of stars that failed is asked for again (deadlineStars.ts, #11).
  await ctx.scheduler.runAfter(0, internal.stars.deadlineStars.keepMissing, {});
  return recorded;
}

/** Keeps each league's deadline for each of `gameweeks` as it stands now, the gameweeks FPL just
 *  stopped sending: "Keeps its last deadline" (Craig, 1 Nov 2026; spec/05, #202). Called before
 *  they are marked dropped and before this sync moves any match (footballSync.ts syncs gameweeks
 *  first), so the matches still say where each deadline was. A deadline already kept, or already
 *  passed and recorded, stays; a gameweek with no deadline yet has none to keep. A broken league is
 *  skipped as `recordPassedDeadlines` skips it. Returns how many it kept. */
export async function keepDroppedDeadlines(ctx: MutationCtx, gameweeks: readonly number[]): Promise<number> {
  if (gameweeks.length === 0) return 0;
  const now = Date.now();
  const matches = await scheduledMatches(ctx);
  const leagues = await takeAllOrThrow(
    ctx.db.query("leagues"),
    LEAGUES_RECORDED_MOST,
    `More than ${LEAGUES_RECORDED_MOST} leagues are held, so some would lose the deadlines of gameweeks FPL stopped sending`,
  );
  let kept = 0;
  for (const league of leagues) {
    try {
      const deadlines = await leagueDeadlinesIn(ctx, league._id, matches);
      const fixed = await fixedDeadlinesOf(ctx, league._id);
      for (const gameweek of gameweeks) {
        const deadline = deadlines.get(gameweek) ?? null;
        if (deadline === null || fixed.has(gameweek)) continue;
        await ctx.db.insert("keptDeadlines", { leagueId: league._id, gameweek, deadline, keptAt: now });
        kept += 1;
      }
    } catch (error: unknown) {
      await skipBrokenLeague(ctx, league, error, now);
    }
  }
  return kept;
}

/** One league's step: its passed deadlines recorded and its begun gameweeks' fixtures stored, with
 *  how many it recorded and its soonest deadline still to come. Its deadlines and rules are read
 *  before its first write, so a league whose rules can't be read is left as it was; one whose rules
 *  break only the fixtures' draw still has the deadlines it passed recorded. */
async function recordLeague(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  matches: readonly ScheduledMatch[],
  now: number,
): Promise<{ recorded: number; soonestToCome: number | null }> {
  const passed = await passedDeadlinesOf(ctx, league._id);
  const deadlines = await leagueDeadlinesIn(ctx, league._id, matches);
  const rules = await seasonRules(ctx, league._id);
  let recorded = 0;
  let soonestToCome: number | null = null;
  for (const [gameweek, deadline] of deadlines) {
    if (deadline === null) continue;
    if (!isLocked(deadline, now)) {
      soonestToCome = Math.min(soonestToCome ?? deadline, deadline);
      continue;
    }
    if (passed.has(gameweek)) continue;
    await ctx.db.insert("passedDeadlines", { leagueId: league._id, gameweek, deadline, recordedAt: now });
    // Its teams' benches kept with their stars, which pick an auto-sub's role (#11), in a
    // transaction of their own, so a failure there never holds a kickoff back.
    await ctx.scheduler.runAfter(0, internal.stars.deadlineStars.storeLeague, { leagueId: league._id, gameweek });
    recorded += 1;
  }
  // Once a gameweek has begun, its fixtures are stored, so nothing after can redraw them (#137).
  await storeBegunFixtures(ctx, league, rules, deadlines, now);
  return { recorded, soonestToCome };
}

/** A league whose step threw: named in the log, and emailed to the admin as the comment above says. */
async function skipBrokenLeague(ctx: MutationCtx, league: Doc<"leagues">, error: unknown, now: number): Promise<void> {
  const skipped = `League ${league._id} (${league.name}) ${LEAGUE_SKIPPED}`;
  const reason = logFailure(skipped, error);
  await emailIfFailed(ctx, "skippedLeague", { ranAt: now, outcome: { ok: false, error: `${skipped}: ${reason}` } });
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
