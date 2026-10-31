import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { matchStatsState } from "../schema";
import { HOUR_MS, JULY, MINUTE_MS, seasonStartYear, WEEK_MS } from "../shared/time";
import { CURRENT_FIXTURES_MOST, currentFixtures, fixtureByCode } from "../shared/fixtures";
import { takeAllOrThrow } from "../shared/cappedRead";
import { dueMatch, type DueMatch } from "../shared/dueMatches";
import { statusOf, triedOf } from "./matchStats";

// Issue #27, split from matchStats.ts: which held matches `matchStatsSync.run` reads now (#199).

type State = Infer<typeof matchStatsState>;

/** Ninety minutes and a fifteen-minute half-time: no match reaches full time sooner after kickoff,
 *  so none is read before. */
const EARLIEST_FULL_TIME_MS = 105 * MINUTE_MS;
/** How long a locked match is still read, to catch a late correction for the feeds page, and how
 *  often: Claude's choice, not yet Craig's, and no late correction has been recorded to size it. */
export const LATE_CORRECTION_WATCH_MS = 24 * HOUR_MS;
export const LATE_READ_EVERY_MS = HOUR_MS;
/** Matches per run: a gameweek's worth, so a first run behind many keeps inside an action's time. */
export const MATCHES_PER_RUN = 10;

/** How far before a run the next one reads the fixtures again for a match with no status row: a
 *  kickoff the football sync learns late (it reads every six hours) can land before the last run,
 *  and a week covers that sync being down for days. Claude's choice, not yet Craig's (#199). */
export const UNSEEN_LOOKBACK_MS = WEEK_MS;
/** The most status rows read in one state at once: a season's matches, with room. More throws,
 *  never a silent cut. */
export const STATUS_ROWS_MOST = CURRENT_FIXTURES_MOST;

/** What `due` found: the matches to read now, and the kickoff `record` stores for the next run to
 *  read the fixtures from. */
export const dueRead = v.object({ matches: v.array(dueMatch), unseenFrom: v.number() });

/** The held matches to read now: each past full time and not locked, or locked within the watch
 *  and not read for an hour. Those never tried come first, then the least lately tried, oldest
 *  kickoff first among equals, so a run's worth that fail, wait or stay provisional every run
 *  cannot keep a newer match from being read. It reads only what can still be due (#199): this
 *  season's status rows not locked, however old; those locked within the watch; and the fixtures
 *  from the stored kickoff on, for a match not yet read at full time. */
export const due = internalQuery({
  args: { now: v.number() },
  returns: dueRead,
  handler: async (ctx, { now }) => {
    const fullTimeBy = now - EARLIEST_FULL_TIME_MS;
    const candidates = new Map<number, Doc<"fixtures">>();
    for (const { fixtureCode } of await statusesDue(ctx, now)) {
      // Only the current season's (#214): a dropped match is passed over.
      const fixture = await fixtureByCode(ctx, fixtureCode);
      if (fixture !== null && fixture.droppedAt === undefined) candidates.set(fixtureCode, fixture);
    }
    // The next run reads from the oldest kickoff here with no status row, or a lookback ago.
    let unseenFrom = now - UNSEEN_LOOKBACK_MS;
    for (const fixture of await currentFixtures(ctx, fullTimeBy, await storedUnseenFrom(ctx))) {
      if (fixture.kickoff === null || (await statusOf(ctx, fixture.code)) !== null) continue;
      unseenFrom = Math.min(unseenFrom, fixture.kickoff);
      candidates.set(fixture.code, fixture);
    }
    const found: (DueMatch & { kickoff: number; triedAt: number })[] = [];
    for (const { code, gameweek, kickoff } of candidates.values()) {
      if (gameweek === null || kickoff === null || kickoff > fullTimeBy) continue;
      const triedAt = (await triedOf(ctx, code))?.triedAt ?? Number.NEGATIVE_INFINITY;
      found.push({ fixtureCode: code, gameweek, kickoff, triedAt });
    }
    const matches = found
      .sort((a, b) => a.triedAt - b.triedAt || a.kickoff - b.kickoff)
      .slice(0, MATCHES_PER_RUN)
      .map(({ fixtureCode, gameweek }) => ({ fixtureCode, gameweek }));
    return { matches, unseenFrom };
  },
});

/** The status rows that can be due: provisional or complete since the season began, and locked
 *  within the watch and not read for an hour. */
async function statusesDue(ctx: QueryCtx, now: number): Promise<Doc<"matchStatsStatus">[]> {
  const seasonStart = Date.UTC(seasonStartYear(now), JULY, 1);
  const tooMany = (state: State) => `More than ${STATUS_ROWS_MOST} matches are held ${state}, so they would be cut short`;
  const unlocked = (state: Exclude<State, "locked">) =>
    takeAllOrThrow(
      ctx.db.query("matchStatsStatus").withIndex("by_state_and_fullTimeAt", (q) => q.eq("state", state).gte("fullTimeAt", seasonStart)),
      STATUS_ROWS_MOST,
      tooMany(state),
    );
  const watched = await takeAllOrThrow(
    ctx.db
      .query("matchStatsStatus")
      .withIndex("by_state_and_lockedAt", (q) => q.eq("state", "locked").gt("lockedAt", now - LATE_CORRECTION_WATCH_MS)),
    STATUS_ROWS_MOST,
    tooMany("locked"),
  );
  return [
    ...(await unlocked("provisional")),
    ...(await unlocked("complete")),
    ...watched.filter((status) => now - status.lastReadAt >= LATE_READ_EVERY_MS),
  ];
}

/** The kickoff the last run that read said to read the fixtures from; none before the first. */
async function storedUnseenFrom(ctx: QueryCtx): Promise<number | undefined> {
  return (await ctx.db.query("matchStatsUnseenFrom").unique())?.kickoff;
}
