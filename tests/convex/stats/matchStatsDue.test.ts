import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { LATE_CORRECTION_WATCH_MS, UNSEEN_LOOKBACK_MS, UNSEEN_MOVE_STEP_MS } from "../../../convex/stats/matchStatsDue";
import { FULL_TIME_READ, GAMEWEEK, HULL_EVERTON, heldMatch, KICKOFF, syncAt, withHullEverton, withHullEvertonLive, withPlReadEmpty } from "../../support/convex/matchStats.harness";
import { FULL_STATS, recordedGw6 } from "../../support/recorded/gw6.payloads";
import { insertLockedStatus } from "../../support/convex/footballRows.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { CURRENT_FIXTURES_MOST } from "../../../convex/shared/fixtures";

// #199: matchStatsDue.due reads only what can still be due, so its reads stay flat across a season.

beforeEach(() => vi.useFakeTimers());

const dueAt = async (t: TestConvex, now: number) => (await t.query(internal.stats.matchStatsDue.due, { now })).matches;
const storedUnseenFrom = (t: TestConvex) => t.run(async (ctx) => (await ctx.db.query("matchStatsUnseenFrom").unique())?.kickoff);

test("matches locked past their watch are not read again: past a season's cap of them, due still reads", async () => {
  const t = freshConvex();
  const holdLocked = (count: number, firstCode: number) =>
    t.run(async (ctx) => {
      for (let code = firstCode; code < firstCode + count; code += 1) {
        await ctx.db.insert("fixtures", { code, gameweek: GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: KICKOFF });
        await insertLockedStatus(ctx, code, FULL_TIME_READ);
      }
    });
  const later = FULL_TIME_READ + 2 * WEEK_MS;
  await holdLocked(CURRENT_FIXTURES_MOST, 1);
  await syncAt(t, later, recordedGw6());
  expect(await storedUnseenFrom(t)).toBe(later - UNSEEN_LOOKBACK_MS);

  await holdLocked(1, CURRENT_FIXTURES_MOST + 1);

  expect(await dueAt(t, later)).toEqual([]);
  // Without the stored kickoff it would read every one of them, and so throw.
  await t.run(async (ctx) => ctx.db.delete("matchStatsUnseenFrom", (await ctx.db.query("matchStatsUnseenFrom").unique())!._id));
  await expect(dueAt(t, later)).rejects.toThrow(`More than ${CURRENT_FIXTURES_MOST} matches are held as current`);
});

test("a match that stays provisional for weeks is still read, after the fixtures' read has moved past it", async () => {
  const t = await withHullEverton();
  const missing = () => withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl);
  await syncAt(t, FULL_TIME_READ, missing());
  await syncAt(t, FULL_TIME_READ + 2 * WEEK_MS, missing());
  expect((await heldMatch(t)).status).toMatchObject({ state: "provisional" });
  expect(await storedUnseenFrom(t)).toBeGreaterThan(KICKOFF);

  expect(await dueAt(t, FULL_TIME_READ + 3 * WEEK_MS)).toEqual([{ fixtureCode: HULL_EVERTON, gameweek: GAMEWEEK }]);
});

test("a match the feed never calls full time is still tried weeks on, and holds the fixtures' read at its kickoff", async () => {
  const t = await withHullEverton();
  const notOver = () => withHullEvertonLive(recordedGw6());
  await syncAt(t, FULL_TIME_READ, notOver());
  const run = await syncAt(t, FULL_TIME_READ + 2 * WEEK_MS, notOver());
  expect(run.outcome).toMatchObject({ ok: true, waiting: [HULL_EVERTON] });
  expect((await heldMatch(t)).status).toBeNull();
  expect(await storedUnseenFrom(t)).toBe(KICKOFF);

  expect(await dueAt(t, FULL_TIME_READ + 3 * WEEK_MS)).toEqual([{ fixtureCode: HULL_EVERTON, gameweek: GAMEWEEK }]);
});

test("a kickoff the football sync learns late, before the last run but within the lookback, is still read", async () => {
  const t = freshConvex();
  const lastRun = FULL_TIME_READ;
  await syncAt(t, lastRun, recordedGw6());
  const learnedLate = lastRun - UNSEEN_LOOKBACK_MS + 1;
  await t.run((ctx) => ctx.db.insert("fixtures", { code: HULL_EVERTON, gameweek: GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: learnedLate }));

  expect(await dueAt(t, lastRun)).toEqual([{ fixtureCode: HULL_EVERTON, gameweek: GAMEWEEK }]);
});

// #2002, the Convex quota: a cron run with no match due writes nothing but, once a day, the kickoff
// to read from; one run by hand still writes its row, for whoever ran it to read back.
test("a cron run with nothing due writes no run row, and stores the kickoff to read from only once it has moved a day", async () => {
  const t = freshConvex();
  const runs = () => t.run((ctx) => ctx.db.query("matchStatsSyncs").collect());
  const quiet = FULL_TIME_READ + 2 * WEEK_MS;
  await syncAt(t, quiet, recordedGw6(), undefined, "cron");
  expect(await runs()).toEqual([]);
  expect(await storedUnseenFrom(t)).toBe(quiet - UNSEEN_LOOKBACK_MS);

  await syncAt(t, quiet + UNSEEN_MOVE_STEP_MS - 1, recordedGw6(), undefined, "cron");
  expect(await storedUnseenFrom(t)).toBe(quiet - UNSEEN_LOOKBACK_MS);
  await syncAt(t, quiet + UNSEEN_MOVE_STEP_MS, recordedGw6(), undefined, "cron");
  expect(await storedUnseenFrom(t)).toBe(quiet + UNSEEN_MOVE_STEP_MS - UNSEEN_LOOKBACK_MS);
  expect(await runs()).toEqual([]);

  const byHand = await syncAt(t, quiet + UNSEEN_MOVE_STEP_MS, recordedGw6());
  expect(byHand).toMatchObject({ trigger: "manual", outcome: { ok: true, matches: [], waiting: [] } });
});

test("a cron run with a match due still writes its row", async () => {
  const t = await withHullEverton();
  const run = await syncAt(t, FULL_TIME_READ, recordedGw6(), undefined, "cron");
  expect(run).toMatchObject({ trigger: "cron", outcome: { ok: true, matches: [{ fixtureCode: HULL_EVERTON }] } });
});

test("a locked match is watched for late corrections for 6 hours (#2002)", () => {
  expect(LATE_CORRECTION_WATCH_MS).toBe(6 * HOUR_MS);
});

test("the stored kickoff never moves back, so an older run's read can't undo a newer one's", async () => {
  const t = freshConvex();
  const newer = FULL_TIME_READ + WEEK_MS;
  await syncAt(t, newer, recordedGw6());
  await t.mutation(internal.stats.matchStats.record, {
    trigger: "manual",
    ranAt: FULL_TIME_READ,
    outcome: { ok: true, matches: [], waiting: [] },
    unseenFrom: KICKOFF,
  });

  expect(await storedUnseenFrom(t)).toBe(newer - UNSEEN_LOOKBACK_MS);
});
