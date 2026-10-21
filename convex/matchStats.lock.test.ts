import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { LATE_CORRECTION_WATCH_MS, LATE_READ_EVERY_MS, MATCHES_PER_RUN } from "./matchStats";
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
import { FULL_STATS, recordedGw6, type Gw6Payloads } from "./recorded/gw6.payloads";
import { freshConvex, type TestConvex } from "./test.harness";
import { HOUR_MS, MINUTE_MS } from "./time";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function stateOf(t: TestConvex) {
  const { records, status } = await heldMatch(t);
  return { match: status?.state, records: new Set([...records.values()].map((row) => row.state)) };
}

test("a complete match locks an hour after full time, and not before", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  await elapse(t, HOUR_MS - MINUTE_MS);
  expect(await stateOf(t)).toEqual({ match: "complete", records: new Set(["complete"]) });

  await elapse(t, MINUTE_MS);
  expect(await stateOf(t)).toEqual({ match: "locked", records: new Set(["locked"]) });
  expect((await heldMatch(t)).status).toMatchObject({ lockedAt: FULL_TIME_READ + HOUR_MS });
});

test("a match read every ten minutes still locks an hour after the first read found full time", async () => {
  const t = await withHullEverton();
  const readEvery = 10 * MINUTE_MS;
  for (let read = FULL_TIME_READ; read < FULL_TIME_READ + HOUR_MS; read += readEvery) {
    if (read > FULL_TIME_READ) await elapse(t, readEvery);
    await syncAt(t, read, recordedGw6());
  }

  await elapse(t, readEvery);

  expect((await heldMatch(t)).status).toMatchObject({
    state: "locked",
    fullTimeAt: FULL_TIME_READ,
    lockedAt: FULL_TIME_READ + HOUR_MS,
  });
});

test("a complete match read again before its lock schedules no second lock", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await elapse(t, 10 * MINUTE_MS);
  await syncAt(t, FULL_TIME_READ + 10 * MINUTE_MS, recordedGw6());

  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled.filter((job) => job.state.kind === "pending")).toHaveLength(1);
});

test("a record still missing at the hour keeps the match provisional, and it locks an hour after it arrives", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));
  await elapse(t, HOUR_MS + MINUTE_MS);
  expect(await stateOf(t)).toEqual({ match: "provisional", records: new Set(["provisional"]) });

  const arrived = FULL_TIME_READ + 90 * MINUTE_MS;
  await syncAt(t, arrived, recordedGw6());
  await elapse(t, HOUR_MS - MINUTE_MS);
  expect(await stateOf(t)).toEqual({ match: "complete", records: new Set(["complete"]) });

  await elapse(t, MINUTE_MS);
  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: arrived + HOUR_MS });
});

test("a match whose record goes missing again before the lock is provisional again, and locks an hour after it is back", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await syncAt(t, FULL_TIME_READ + 10 * MINUTE_MS, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));
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

  await elapse(t, 30 * MINUTE_MS);

  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: FULL_TIME_READ + 30 * MINUTE_MS });
});

test("a window changed after the lock was scheduled is read again when the lock fires", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await t.mutation(internal.platformSettings.setStatCorrectionWindow, { minutes: 90 });

  await elapse(t, HOUR_MS);
  expect(await stateOf(t)).toMatchObject({ match: "complete" });

  await elapse(t, 30 * MINUTE_MS);
  expect((await heldMatch(t)).status).toMatchObject({ state: "locked", lockedAt: FULL_TIME_READ + 90 * MINUTE_MS });
});

test.each([-1, 1.5])("a window of %s minutes is refused", async (minutes) => {
  const t = freshConvex();
  await expect(t.mutation(internal.platformSettings.setStatCorrectionWindow, { minutes })).rejects.toThrow(
    `whole number of minutes, 0 or more, not ${minutes}`,
  );
});

test("a match is due 105 minutes after kickoff, the soonest it can reach full time, and not before", async () => {
  const t = await withHullEverton();
  const due = (now: number) => t.query(internal.matchStats.due, { now });

  expect(await due(KICKOFF + 105 * MINUTE_MS - 1)).toEqual([]);
  expect(await due(KICKOFF + 105 * MINUTE_MS)).toEqual([{ fixtureCode: HULL_EVERTON, gameweek: GAMEWEEK }]);
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

test("a run takes due matches never tried oldest first, a gameweek's worth at most", async () => {
  const t = freshConvex();
  const count = MATCHES_PER_RUN + 2;
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      const kickoff = KICKOFF + (count - index) * MINUTE_MS;
      await ctx.db.insert("fixtures", { code: index + 1, gameweek: GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
  });

  const due = await t.query(internal.matchStats.due, { now: FULL_TIME_READ + HOUR_MS });

  expect(due.map((match) => match.fixtureCode)).toEqual(
    Array.from({ length: MATCHES_PER_RUN }, (_, index) => count - index),
  );
});

/** A Premier League id for each stuck match the list names, clear of the recorded ones. */
const STUCK_PL_ID = 900_000;
/** Not yet over: any status but `PL_FULL_TIME`. */
const NOT_OVER = "U";

test.each([
  ["fails", "failed", (payloads: Gw6Payloads) => payloads],
  [
    "waits",
    "waiting",
    (payloads: Gw6Payloads, codes: number[]) => {
      const notOver = codes.map((code, index) => ({ id: STUCK_PL_ID + index, altIds: { opta: `g${code}` }, status: NOT_OVER }));
      payloads.pl.round.content.push(...notOver);
      return payloads;
    },
  ],
] as const)("a run's worth of older matches that %s every run keeps no newer match from being read", async (_what, stuckAs, stick) => {
  const t = await withHullEverton();
  // Older than Hull v Everton; the Premier League's list leaves each out (so it fails) or has it not over.
  const stuck = Array.from({ length: MATCHES_PER_RUN + 1 }, (_, index) => index + 1);
  await t.run(async (ctx) => {
    for (const code of stuck) {
      await ctx.db.insert("fixtures", { code, gameweek: GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: KICKOFF - code * MINUTE_MS });
    }
  });
  const tried = new Map<number, string>();
  const run = async (time: number) => {
    const { outcome } = await syncAt(t, time, stick(recordedGw6(), stuck));
    if (!outcome.ok) throw new Error(outcome.error);
    for (const match of outcome.matches) tried.set(match.fixtureCode, match.ok ? match.state : "failed");
    for (const fixtureCode of outcome.waiting) tried.set(fixtureCode, "waiting");
  };

  const secondRun = FULL_TIME_READ + 10 * MINUTE_MS;
  await run(FULL_TIME_READ);
  await run(secondRun);

  expect((await heldMatch(t)).status).toMatchObject({ state: "complete", fullTimeAt: secondRun });
  expect(Object.fromEntries(tried)).toEqual({
    ...Object.fromEntries(stuck.map((code) => [code, stuckAs])),
    [HULL_EVERTON]: "complete",
  });
});
