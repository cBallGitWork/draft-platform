import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { seasonStartYear } from "../../../convex/football/football";
import { HOUR_MS } from "../../../convex/shared/time";
import { REBUILD_PAGE } from "../../../convex/stats/seasonStats";
import { addStats, sumStats } from "../../../convex/stats/statTotals";
import { FULL_TIME_READ, GAMEWEEK, KICKOFF, heldMatch, syncAt, withBelloumiGoalRemoved, withHullEverton } from "../../support/convex/matchStats.harness";
import type { TestConvex } from "../../support/convex/test.harness";
import { FULL_STATS, recordedGw6 } from "../../support/recorded/gw6.payloads";

// Each player's season totals (#373, seasonStats.ts): kept in step as his match records are
// written, so Scouting sorts by any stat without reading a season of records, and rebuilt afresh
// from the records for those written before the totals were kept.

beforeEach(() => vi.useFakeTimers());

const SEASON = seasonStartYear(KICKOFF);

const totalsHeld = async (t: TestConvex) =>
  new Map((await t.run((ctx) => ctx.db.query("playerSeasonStats").collect())).map((row) => [row.playerCode, row] as const));

/** Each player's held records at Hull v Everton, added up: what his totals should be. */
async function recordsAddedUp(t: TestConvex) {
  return new Map([...(await heldMatch(t)).records].map(([code, row]) => [code, sumStats([row.stats])] as const));
}

test("a match's records written for the first time become each man's totals for its season", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  const totals = await totalsHeld(t);
  const expected = await recordsAddedUp(t);
  expect(totals.size).toBe(expected.size);
  for (const [code, stats] of expected) expect(totals.get(code)).toMatchObject({ season: SEASON, stats });
});

test("a re-read that changes nothing leaves the totals as they were", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  const before = await totalsHeld(t);

  await syncAt(t, FULL_TIME_READ + HOUR_MS / 2, recordedGw6());

  expect(await totalsHeld(t)).toEqual(before);
});

test("a correction moves his totals by the difference: a goal taken away comes off", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  const goalsBefore = (await totalsHeld(t)).get(FULL_STATS.belloumi.code)!.stats.goals_scored;

  await syncAt(t, FULL_TIME_READ + HOUR_MS / 2, withBelloumiGoalRemoved(recordedGw6()));

  const belloumi = (await totalsHeld(t)).get(FULL_STATS.belloumi.code)!;
  expect(goalsBefore).toBeGreaterThan(0);
  expect(belloumi.stats.goals_scored ?? 0).toBe(0);
  expect(belloumi.stats).toEqual((await recordsAddedUp(t)).get(FULL_STATS.belloumi.code));
});

test("two matches in a season add up; one in another season is kept apart", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  const once = (await totalsHeld(t)).get(FULL_STATS.belloumi.code)!.stats;
  const record = (await heldMatch(t)).records.get(FULL_STATS.belloumi.code)!;
  const LATER = 9001;
  const LAST_SEASON = 9002;
  await t.run(async (ctx) => {
    await ctx.db.insert("fixtures", { code: LATER, gameweek: GAMEWEEK + 1, homeClubCode: 1, awayClubCode: 2, kickoff: KICKOFF + 7 * 24 * HOUR_MS });
    await ctx.db.insert("fixtures", { code: LAST_SEASON, gameweek: GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: KICKOFF - 365 * 24 * HOUR_MS });
  });
  const { _id, _creationTime, state: _state, ...again } = record;

  for (const fixtureCode of [LATER, LAST_SEASON]) {
    await t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode, records: [{ ...again, fixtureCode }] });
  }

  const rows = await t.run((ctx) => ctx.db.query("playerSeasonStats").collect());
  const his = rows.filter((row) => row.playerCode === FULL_STATS.belloumi.code);
  expect(his.find((row) => row.season === SEASON)!.stats).toEqual(addStats(once, record.stats));
  expect(his.find((row) => row.season === SEASON - 1)!.stats).toEqual(sumStats([record.stats]));
});

test("a record for a match that isn't held throws rather than going uncounted", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  const { _id, _creationTime, state: _state, ...record } = (await heldMatch(t)).records.get(FULL_STATS.belloumi.code)!;

  await expect(t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode: 404, records: [{ ...record, fixtureCode: 404 }] })).rejects.toThrow(
    "Match 404 has records but isn't held",
  );
});

test("rebuild sets every player's totals to his records added up, however wrong they were, and again changes nothing", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  const right = await totalsHeld(t);
  const codes = [...right.keys()];
  // More than a page's worth, so the rebuild runs on to the next.
  expect(codes.length).toBeGreaterThan(REBUILD_PAGE);
  await t.run(async (ctx) => {
    // The football sync's players, so the rebuild has someone to page through; one row wrong and one gone.
    for (const code of codes) await ctx.db.insert("players", { code, name: `P${code}`, fullName: `Player ${code}`, clubCode: 1 });
    await ctx.db.patch("playerSeasonStats", right.get(codes[0])!._id, { stats: { goals_scored: 99 } });
    await ctx.db.delete("playerSeasonStats", right.get(codes[1])!._id);
  });

  await t.mutation(internal.stats.seasonStats.rebuild, { cursor: null });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const rebuilt = await totalsHeld(t);
  for (const [code, stats] of await recordsAddedUp(t)) expect(rebuilt.get(code)).toMatchObject({ season: SEASON, stats });

  await t.mutation(internal.stats.seasonStats.rebuild, { cursor: null });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect([...(await totalsHeld(t)).values()].map((row) => row.stats)).toEqual([...rebuilt.values()].map((row) => row.stats));
});
