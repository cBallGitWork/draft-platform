// Live points when the stats stop or a read comes in bad (spec/10 `S10.12`): they stay as last
// read with "Live points delayed" on the scoreboard, a cut-off or repeated read never lowers or
// doubles them, the next full read wins, and an older read never overwrites a newer one, full time
// included.

import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { fplLiveUrl } from "../../../convex/football/football";
import { heldRecords, recordsIn, stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import {
  FULL_TIME_READ,
  GAMEWEEK,
  HULL_EVERTON,
  heldMatch,
  mergedHullEverton,
  syncAt,
  withFplBlocksEmpty,
  withHullEverton,
  withPlReadEmpty,
} from "../../support/convex/matchStats.harness";
import { FULL_STATS, recordedGw6 } from "../../support/recorded/gw6.payloads";
import { silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";

beforeEach(() => vi.useFakeTimers());

/** When Hull v Everton's live points are delayed from, or null while they keep up. */
const delayedFrom = (t: TestConvex) =>
  t.run(async (ctx) => (await ctx.db.query("livePointsDelays").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", HULL_EVERTON)).unique())?.delayedFrom ?? null);

const { mcBurnie, belloumi } = FULL_STATS;

test("a read cut off for a man keeps his last read and flags the points as delayed, and the next full read wins (S10.12)", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(80), stagedGw6(80));
  const before = await heldRecords(t);

  await tickAt(t, stageTime(81), withPlReadEmpty(withFplBlocksEmpty(stagedGw6(81), mcBurnie.code), belloumi.pl));

  const held = await heldRecords(t);
  expect(held.get(mcBurnie.code)).toEqual(before.get(mcBurnie.code));
  expect(held.get(belloumi.code)).toEqual(before.get(belloumi.code));
  expect(held.get(FULL_STATS.grealish.code)).toEqual(recordsIn(stagedGw6(81), "provisional").get(FULL_STATS.grealish.code));
  expect(await delayedFrom(t)).toBe(stageTime(81));

  await tickAt(t, stageTime(82), stagedGw6(82));
  expect(await heldRecords(t)).toEqual(recordsIn(stagedGw6(82), "provisional"));
  expect(await delayedFrom(t)).toBeNull();
});

test("a read that leaves out a man it named before keeps his record and flags the points as delayed (S10.12)", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(30), stagedGw6(30));
  const before = await heldRecords(t);
  const others = mergedHullEverton(stagedGw6(31)).filter((record) => record.playerCode !== mcBurnie.code);

  await t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode: HULL_EVERTON, readAt: stageTime(31), minute: 31, records: others });

  expect((await heldRecords(t)).get(mcBurnie.code)).toEqual(before.get(mcBurnie.code));
  expect(await delayedFrom(t)).toBe(stageTime(31));
});

test("a repeated read, or a man sent twice in one, never doubles anyone's points (S10.12)", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(80), stagedGw6(80));
  const once = await heldRecords(t);

  const twice = stagedGw6(80);
  const element = twice.fpl.live.elements.find((each) => each.id === belloumi.fplId)!;
  twice.fpl.live.elements.push(structuredClone(element));
  const { latest } = await tickAt(t, stageTime(81), twice);

  expect(latest.outcome).toMatchObject({ matches: [{ fixtureCode: HULL_EVERTON, ok: true, changed: [] }] });
  expect(await heldRecords(t)).toEqual(once);
  expect(await delayedFrom(t)).toBeNull();
});

test("a tick that can't read the stats keeps the points as last read and flags them as delayed until a read (S10.12)", async () => {
  silenceConsoleError();
  const t = await withHullEverton();
  await tickAt(t, stageTime(30), stagedGw6(30));

  await tickAt(t, stageTime(31), stagedGw6(31), fplLiveUrl(GAMEWEEK));
  await tickAt(t, stageTime(32), stagedGw6(32), fplLiveUrl(GAMEWEEK));
  expect(await heldRecords(t)).toEqual(recordsIn(stagedGw6(30), "provisional"));
  expect(await delayedFrom(t)).toBe(stageTime(31));

  await tickAt(t, stageTime(33), stagedGw6(33));
  expect(await heldRecords(t)).toEqual(recordsIn(stagedGw6(33), "provisional"));
  expect(await delayedFrom(t)).toBeNull();
});

test("an older live read never overwrites a newer one (S10.12)", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(40), stagedGw6(40));

  const written = await t.mutation(internal.stats.liveStats.upsertLive, {
    fixtureCode: HULL_EVERTON,
    readAt: stageTime(39),
    minute: 39,
    records: mergedHullEverton(stagedGw6(20)),
  });

  expect(written).toMatchObject({ inserted: 0, updated: 0, changed: [] });
  expect(await heldRecords(t)).toEqual(recordsIn(stagedGw6(40), "provisional"));
});

test("a full-time read older than the newest live read writes nothing, and the next full read wins (S10.12)", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(80), stagedGw6(80));

  const written = await t.mutation(internal.stats.matchStats.upsertMatch, {
    fixtureCode: HULL_EVERTON,
    readAt: stageTime(79),
    records: mergedHullEverton(recordedGw6()),
  });

  expect(written).toMatchObject({ state: "provisional", inserted: 0, updated: 0, changed: [] });
  expect((await heldMatch(t)).status).toBeNull();
  expect(await heldRecords(t)).toEqual(recordsIn(stagedGw6(80), "provisional"));

  await syncAt(t, FULL_TIME_READ, recordedGw6());
  expect(await heldRecords(t)).toEqual(recordsIn(recordedGw6(), "complete"));
});

test("a full-time read cut off for a man keeps his last read and the match provisional, and the next full read completes it (S10.12)", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(80), stagedGw6(80));
  const live = await heldRecords(t);

  await syncAt(t, FULL_TIME_READ, withFplBlocksEmpty(recordedGw6(), mcBurnie.code));

  const { status } = await heldMatch(t);
  expect(status?.state).toBe("provisional");
  expect((await heldRecords(t)).get(mcBurnie.code)).toMatchObject({ stats: live.get(mcBurnie.code)!.stats, arrived: { fpl: true, pl: true } });

  await syncAt(t, FULL_TIME_READ + 60_000, recordedGw6());
  expect((await heldMatch(t)).status?.state).toBe("complete");
  expect(await heldRecords(t)).toEqual(recordsIn(recordedGw6(), "complete"));
});
