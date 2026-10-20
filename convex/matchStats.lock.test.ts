import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { MS_PER_MINUTE } from "./deadline";
import { modules, type TestConvex } from "./footballSync.harness";
import { EARLIEST_FULL_TIME_MS, HOUR_MS, LATE_CORRECTION_WATCH_MS, LATE_READ_EVERY_MS, MATCHES_PER_RUN } from "./matchStats";
import {
  elapse,
  FULL_TIME_READ,
  GAMEWEEK,
  HULL_EVERTON,
  heldMatch,
  KICKOFF,
  syncAt,
  withHullEverton,
  withPlReadEmpty,
} from "./matchStats.harness";
import { FULL_STATS, recordedGw6 } from "./recorded/gw6.payloads";
import schema from "./schema";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function stateOf(t: TestConvex) {
  const { records, status } = await heldMatch(t);
  return { match: status?.state, records: new Set([...records.values()].map((row) => row.state)) };
}

test("a complete match locks an hour after full time, and not before", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  await elapse(t, HOUR_MS - MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "complete", records: new Set(["complete"]) });

  await elapse(t, MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "locked", records: new Set(["locked"]) });
  expect((await heldMatch(t)).status).toMatchObject({ lockedAt: FULL_TIME_READ + HOUR_MS });
});

test("a record still missing at the hour keeps the match provisional, and it locks an hour after it arrives", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));
  await elapse(t, HOUR_MS + MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "provisional", records: new Set(["provisional"]) });

  const arrived = FULL_TIME_READ + 90 * MS_PER_MINUTE;
  await syncAt(t, arrived, recordedGw6());
  await elapse(t, HOUR_MS - MS_PER_MINUTE);
  expect(await stateOf(t)).toEqual({ match: "complete", records: new Set(["complete"]) });

  await elapse(t, MS_PER_MINUTE);
  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: arrived + HOUR_MS });
});

test("a match whose record goes missing again before the lock is provisional again, and locks an hour after it is back", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await syncAt(t, FULL_TIME_READ + 10 * MS_PER_MINUTE, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));
  await elapse(t, HOUR_MS);
  expect((await heldMatch(t)).status).toMatchObject({ state: "provisional" });
  expect((await heldMatch(t)).status).not.toHaveProperty("completeAt");

  const back = FULL_TIME_READ + 2 * HOUR_MS;
  await syncAt(t, back, recordedGw6());
  await elapse(t, HOUR_MS);

  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: back + HOUR_MS });
});

test("the window is the admin's setting", async () => {
  const t = await withHullEverton();
  await t.mutation(internal.platformSettings.setStatCorrectionWindow, { minutes: 30 });
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  await elapse(t, 30 * MS_PER_MINUTE);

  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: FULL_TIME_READ + 30 * MS_PER_MINUTE });
});

test("a window changed after the lock was scheduled is read again when the lock fires", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await t.mutation(internal.platformSettings.setStatCorrectionWindow, { minutes: 90 });

  await elapse(t, HOUR_MS);
  expect(await stateOf(t)).toMatchObject({ match: "complete" });

  await elapse(t, 30 * MS_PER_MINUTE);
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

  expect(await due(KICKOFF + EARLIEST_FULL_TIME_MS - 1)).toEqual([]);
  expect(await due(KICKOFF + EARLIEST_FULL_TIME_MS)).toEqual([{ fixtureCode: HULL_EVERTON, gameweek: GAMEWEEK }]);
});

test("a match the football sync has marked dropped is not due", async () => {
  const t = await withHullEverton();
  await t.run(async (ctx) => {
    const fixture = (await ctx.db.query("fixtures").unique())!;
    await ctx.db.patch("fixtures", fixture._id, { droppedAt: KICKOFF });
  });

  expect(await t.query(internal.matchStats.due, { now: FULL_TIME_READ })).toEqual([]);
});

test("a locked match is read again now and then for late corrections, until the watch ends", async () => {
  const t = await withHullEverton();
  const due = async (now: number) => (await t.query(internal.matchStats.due, { now })).length;
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await elapse(t, HOUR_MS);
  const lockedAt = FULL_TIME_READ + HOUR_MS;

  expect(await due(lockedAt)).toBe(1);
  const lateRead = lockedAt + HOUR_MS;
  await syncAt(t, lateRead, recordedGw6());
  expect(await due(lateRead + LATE_READ_EVERY_MS - 1)).toBe(0);
  expect(await due(lateRead + LATE_READ_EVERY_MS)).toBe(1);
  expect(await due(lockedAt + LATE_CORRECTION_WATCH_MS)).toBe(0);
});

test("a run takes the oldest due matches first, a gameweek's worth at most", async () => {
  const t = convexTest(schema, modules);
  const count = MATCHES_PER_RUN + 2;
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      const kickoff = KICKOFF + (count - index) * MS_PER_MINUTE;
      await ctx.db.insert("fixtures", { code: index + 1, gameweek: GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
  });

  const due = await t.query(internal.matchStats.due, { now: FULL_TIME_READ + HOUR_MS });

  expect(due.map((match) => match.fixtureCode)).toEqual(
    Array.from({ length: MATCHES_PER_RUN }, (_, index) => count - index),
  );
});
