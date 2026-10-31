import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { UNSEEN_LOOKBACK_MS } from "../../../convex/stats/matchStatsDue";
import { FULL_TIME_READ, GAMEWEEK, HULL_EVERTON, heldMatch, KICKOFF, syncAt, withHullEverton, withHullEvertonLive, withPlReadEmpty } from "../../support/convex/matchStats.harness";
import { FULL_STATS, recordedGw6 } from "../../support/recorded/gw6.payloads";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";
import { WEEK_MS } from "../../../convex/shared/time";
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
        await ctx.db.insert("matchStatsStatus", { fixtureCode: code, state: "locked", fullTimeAt: FULL_TIME_READ, lockedAt: FULL_TIME_READ, lastReadAt: FULL_TIME_READ });
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
