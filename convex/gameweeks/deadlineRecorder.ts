import type { MutationCtx } from "../_generated/server";
import { errorMessage } from "../shared/errors";
import { takeAllOrThrow } from "../shared/cappedRead";
import { isLocked } from "./deadline";
import { passedDeadlinesOf } from "./passedDeadlines";
import { heldSchedule, leagueDeadlinesIn, seasonRules } from "../rules/leagueRules";
import { storeBegunFixtures } from "../table/playedFixtures";

// Records each league's passed deadlines (#150), so a postponement after one can't move it
// (deadline.ts). No kickoff moves without the deadlines it passed recorded first: the football
// sync is the only writer of kickoffs, and both of its mutations that can move one, upsertFixtures
// (each batch) and markDropped (for fixtures), call this first, in the same transaction. Until
// then, the deadline worked out from the kickoffs is the one that passed. A deadline already
// recorded is left as it is, so calling this again does no harm. With them, it stores each begun
// gameweek's head-to-head fixtures (playedFixtures.ts, #137), as harmless to repeat.
//
// It fails closed: if recording or storing throws, for any league, that fixtures mutation fails
// with it, so no kickoff moves; the sync is logged and filed in footballSyncs as failed. The feed
// stands still for every league until it is fixed. A league whose rules can't be read (only a row
// written by hand can be: a commissioner's change is checked) isn't skipped, because skipping it
// would let its kickoffs move with its passed deadlines unrecorded, and that could reopen its
// gameweek.

/** The most leagues one recording reads, all in the fixtures mutation's one transaction: the closed
 *  beta has a handful, and each league reads its rules, deadlines and fixtures. Past it this throws,
 *  failing closed as above, rather than leave a league's deadlines unrecorded; by then the
 *  recording wants splitting across transactions (#214). */
export const LEAGUES_RECORDED_MOST = 200;

/** Records every league's deadlines that have passed and aren't yet recorded, and stores the
 *  fixtures of the gameweeks they began; returns how many deadlines it recorded. */
export async function recordPassedDeadlines(ctx: MutationCtx): Promise<number> {
  const now = Date.now();
  // Read once for every league: the fixtures are the season's 380, the most of any table here.
  const { matches } = await heldSchedule(ctx);
  const leagues = await takeAllOrThrow(
    ctx.db.query("leagues"),
    LEAGUES_RECORDED_MOST,
    `More than ${LEAGUES_RECORDED_MOST} leagues are held, so some would have their deadlines unrecorded`,
  );
  let recorded = 0;
  for (const league of leagues) {
    const passed = await passedDeadlinesOf(ctx, league._id);
    const deadlines = await leagueDeadlinesIn(ctx, league._id, matches).catch((error: unknown) => {
      // Named, so the failed sync's log and run row say which league to fix.
      throw new Error(`League ${league._id} (${league.name}): its deadlines can't be worked out: ${errorMessage(error)}`);
    });
    for (const [gameweek, deadline] of deadlines) {
      if (deadline === null || passed.has(gameweek) || !isLocked(deadline, now)) continue;
      await ctx.db.insert("passedDeadlines", { leagueId: league._id, gameweek, deadline, recordedAt: now });
      recorded += 1;
    }
    // Once a gameweek has begun, its fixtures are stored, so nothing after can redraw them (#137).
    await storeBegunFixtures(ctx, league, await seasonRules(ctx, league._id), deadlines, now);
  }
  return recorded;
}
