import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, fplLiveUrl } from "./football";
import { LIVE_WINDOW_MS } from "./liveStats";
import { stagedGw6, stageTime, tickAt } from "./liveStats.harness";
import {
  FULL_TIME_READ,
  GAMEWEEK,
  HULL_EVERTON,
  heldMatch,
  KICKOFF,
  mergedHullEverton,
  syncAt,
  withHullEverton,
  withPlReadEmpty,
} from "./matchStats.harness";
import { FULL_STATS, recordedGw6 } from "./recorded/gw6.payloads";
import { refusedError, silenceConsoleError, type TestConvex } from "./test.harness";
import { MINUTE_MS } from "./time";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const liveAt = (t: TestConvex, now: number) => t.query(internal.liveStats.live, { now });
const LIVE = [{ fixtureCode: HULL_EVERTON, gameweek: GAMEWEEK }];

/** The held records, as the merge gives them, without Convex's own fields or the state. */
async function heldStats(t: TestConvex) {
  const { records } = await heldMatch(t);
  return new Map([...records].map(([code, { _id, _creationTime, state, ...record }]) => [code, record]));
}

const asHeld = (payloads: ReturnType<typeof stagedGw6>) =>
  new Map(mergedHullEverton(payloads).map((record) => [record.playerCode, record]));

test("a match is live from its kickoff until the window closes, and not a minute either side", async () => {
  const t = await withHullEverton();

  expect(await liveAt(t, KICKOFF - MINUTE_MS)).toEqual([]);
  expect(await liveAt(t, KICKOFF)).toEqual(LIVE);
  expect(await liveAt(t, KICKOFF + LIVE_WINDOW_MS - MINUTE_MS)).toEqual(LIVE);
  expect(await liveAt(t, KICKOFF + LIVE_WINDOW_MS)).toEqual([]);
});

test("a match read at full time stays live while a record is missing, and stops once complete", async () => {
  const t = await withHullEverton();

  await syncAt(t, FULL_TIME_READ, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));
  expect(await liveAt(t, FULL_TIME_READ + MINUTE_MS)).toEqual(LIVE);

  await syncAt(t, FULL_TIME_READ + MINUTE_MS, recordedGw6());
  expect(await liveAt(t, FULL_TIME_READ + 2 * MINUTE_MS)).toEqual([]);
});

test("a match the feed has dropped, or postponed out of its gameweek, is never live", async () => {
  const t = await withHullEverton();
  const patchFixture = (fields: { droppedAt?: number; gameweek?: null }) =>
    t.run(async (ctx) => ctx.db.patch("fixtures", (await ctx.db.query("fixtures").unique())!._id, fields));

  await patchFixture({ droppedAt: KICKOFF });
  expect(await liveAt(t, KICKOFF)).toEqual([]);
  await patchFixture({ droppedAt: undefined, gameweek: null });
  expect(await liveAt(t, KICKOFF)).toEqual([]);
});

test("a tick outside every match window reads no feed and records no row", async () => {
  const t = await withHullEverton();

  const { fetch, latest } = await tickAt(t, KICKOFF - MINUTE_MS, stagedGw6(0));

  expect(fetch).not.toHaveBeenCalled();
  expect(latest).toBeUndefined();
});

test("a failed tick is recorded and logged, and the next one catches up", async () => {
  const errors = silenceConsoleError();
  const t = await withHullEverton();
  await tickAt(t, stageTime(29), stagedGw6(29));

  const failed = await tickAt(t, stageTime(30), stagedGw6(30), fplLiveUrl(GAMEWEEK));
  const error = refusedError(fplLiveUrl(GAMEWEEK));
  expect(failed.latest.outcome).toEqual({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: false, error }] });
  expect(errors).toHaveBeenCalledWith(`gameweek ${GAMEWEEK}'s reads failed: ${error}`);
  expect(await heldStats(t)).toEqual(asHeld(stagedGw6(29)));

  await tickAt(t, stageTime(31), stagedGw6(31));
  expect(await heldStats(t)).toEqual(asHeld(stagedGw6(31)));
});

test("a tick whose first read fails is recorded failed whole, and the next one catches up", async () => {
  silenceConsoleError();
  const t = await withHullEverton();

  const failed = await tickAt(t, stageTime(10), stagedGw6(10), FPL_BOOTSTRAP_URL);
  expect(failed.latest.outcome).toEqual({ ok: false, error: refusedError(FPL_BOOTSTRAP_URL) });
  expect((await heldMatch(t)).records.size).toBe(0);

  await tickAt(t, stageTime(11), stagedGw6(11));
  expect(await heldStats(t)).toEqual(asHeld(stagedGw6(11)));
});

test("ticks missed altogether are caught up whole by the next one", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(10), stagedGw6(10));

  await tickAt(t, stageTime(40), stagedGw6(40));

  expect(await heldStats(t)).toEqual(asHeld(stagedGw6(40)));
});

test("a live write racing the sync's full-time read changes nothing", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  const before = await heldMatch(t);

  const written = await t.mutation(internal.liveStats.upsertLive, {
    fixtureCode: HULL_EVERTON,
    records: mergedHullEverton(stagedGw6(30)),
  });

  expect(written).toMatchObject({ state: "complete", inserted: 0, updated: 0, changed: [] });
  expect(await heldMatch(t)).toEqual(before);
});
