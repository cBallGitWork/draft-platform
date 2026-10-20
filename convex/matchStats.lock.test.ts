import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { MS_PER_MINUTE } from "./deadline";
import {
  FULL_TIME_READ,
  HOUR_MS,
  HULL_EVERTON,
  heldMatch,
  KICKOFF,
  modules,
  syncAt,
  withHullEverton,
  withPlReadEmpty,
} from "./matchStats.harness";
import { MATCHES_PER_RUN } from "./matchStats";
import { FULL_STATS, recordedGw6 } from "./recorded/gw6.payloads";
import schema from "./schema";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type TestConvex = ReturnType<typeof convexTest>;

/** Lets `ms` pass and runs every scheduled function that falls due in it. */
async function pass(t: TestConvex, ms: number) {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}

async function stateOf(t: TestConvex) {
  const { records, status } = await heldMatch(t);
  return { match: status?.state, records: new Set([...records.values()].map((row) => row.state)) };
}

test("a complete match locks an hour after full time, and not before", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  await pass(t, HOUR_MS - MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "complete", records: new Set(["complete"]) });

  await pass(t, MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "locked", records: new Set(["locked"]) });
  expect((await heldMatch(t)).status).toMatchObject({ lockedAt: FULL_TIME_READ + HOUR_MS });
});

test("a record still missing at the hour keeps the match provisional, and it locks an hour after it arrives", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));
  await pass(t, HOUR_MS + MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "provisional", records: new Set(["provisional"]) });

  const arrived = FULL_TIME_READ + 90 * MS_PER_MINUTE;
  await syncAt(t, arrived, recordedGw6());
  await pass(t, HOUR_MS - MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "complete", records: new Set(["complete"]) });

  await pass(t, MS_PER_MINUTE);
  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: arrived + HOUR_MS });
});

test("the window is the admin's setting", async () => {
  const t = await withHullEverton();
  await t.mutation(internal.platformSettings.setStatCorrectionWindow, { minutes: 30 });
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  await pass(t, 30 * MS_PER_MINUTE);

  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: FULL_TIME_READ + 30 * MS_PER_MINUTE });
});

test("a window changed after the lock was scheduled is read again when the lock fires", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await t.mutation(internal.platformSettings.setStatCorrectionWindow, { minutes: 90 });

  await pass(t, HOUR_MS);
  expect(await stateOf(t)).toMatchObject({ match: "complete" });

  await pass(t, 30 * MS_PER_MINUTE);
  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: FULL_TIME_READ + 90 * MS_PER_MINUTE });
});

test.each([-1, 1.5])("a window of %s minutes is refused", async (minutes) => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(internal.platformSettings.setStatCorrectionWindow, { minutes })).rejects.toThrow(
    `whole number of minutes, 0 or more, not ${minutes}`,
  );
});

test("a match is due once it can have reached full time, and not before", async () => {
  const t = await withHullEverton();
  const due = (now: number) => t.query(internal.matchStats.due, { now });

  expect(await due(KICKOFF + 104 * MS_PER_MINUTE)).toEqual([]);
  expect(await due(KICKOFF + 105 * MS_PER_MINUTE)).toEqual([{ fixtureCode: HULL_EVERTON, gameweek: 6 }]);
});

test("a match the football sync has marked dropped is not due", async () => {
  const t = await withHullEverton();
  await t.run(async (ctx) => {
    const fixture = (await ctx.db.query("fixtures").unique())!;
    await ctx.db.patch("fixtures", fixture._id, { droppedAt: KICKOFF });
  });

  expect(await t.query(internal.matchStats.due, { now: FULL_TIME_READ })).toEqual([]);
});

test("a locked match is read again hourly for a day, for late corrections, then no more", async () => {
  const t = await withHullEverton();
  const due = async (now: number) => (await t.query(internal.matchStats.due, { now })).length;
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await pass(t, HOUR_MS);
  const lockedAt = FULL_TIME_READ + HOUR_MS;

  expect(await due(lockedAt)).toBe(1);
  const lateRead = lockedAt + HOUR_MS;
  await syncAt(t, lateRead, recordedGw6());
  expect(await due(lateRead + HOUR_MS - 1)).toBe(0);
  expect(await due(lateRead + HOUR_MS)).toBe(1);
  expect(await due(lockedAt + 24 * HOUR_MS)).toBe(0);
});

test("a run takes the oldest due matches first, a gameweek's worth at most", async () => {
  const t = convexTest(schema, modules);
  const count = MATCHES_PER_RUN + 2;
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      const kickoff = KICKOFF + (count - index) * MS_PER_MINUTE;
      await ctx.db.insert("fixtures", { code: index + 1, gameweek: 6, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
  });

  const due = await t.query(internal.matchStats.due, { now: FULL_TIME_READ + HOUR_MS });

  expect(due.map((match) => match.fixtureCode)).toEqual(
    Array.from({ length: MATCHES_PER_RUN }, (_, index) => count - index),
  );
});
