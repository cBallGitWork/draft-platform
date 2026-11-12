import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { MATCH_RECORDS_MOST } from "../../../convex/stats/matchRecordReads";
import { freshConvex, ROWS_TO_THE_CAP, type TestConvex } from "../../support/convex/test.harness";

// #1725: the stat writes read a match's records through matchRecordsOf, as the scorer and the
// screens do, so a match holding more than MATCH_RECORDS_MOST throws at the write, the live write
// and the lock, and nothing is written, rather than saving and failing every later read.

const FIXTURE = 700_002;
/** Where this file's made-up player codes start. */
const MADE_UP_CODES = 900_000;
/** One man's record as a feed sends it, a man the match doesn't hold yet. */
const SENT = { playerCode: MADE_UP_CODES + MATCH_RECORDS_MOST + 1, fixtureCode: FIXTURE, started: true, played: true, arrived: { fpl: true, pl: true }, stats: { minutes: 90 } };
const tooMany = (why: string) => `Match ${FIXTURE} holds more than ${MATCH_RECORDS_MOST} records, so ${why} would be cut short`;
/** What the match holds before each test, and after it, as nothing is written. */
const UNTOUCHED = { states: ["provisional"], count: MATCH_RECORDS_MOST + 1 };

let t: TestConvex;
beforeEach(async () => {
  t = freshConvex();
  await t.run(async (ctx) => {
    for (let index = 0; index <= MATCH_RECORDS_MOST; index += 1) {
      await ctx.db.insert("playerMatchStats", {
        playerCode: MADE_UP_CODES + index,
        fixtureCode: FIXTURE,
        started: false,
        played: false,
        arrived: { fpl: true, pl: true },
        stats: {},
        state: "provisional",
      });
    }
  });
}, ROWS_TO_THE_CAP.timeout);

/** The match's records, their states told once each, and its state, as held: null with no status row. */
async function held() {
  const { states, status } = await t.run(async (ctx) => ({
    states: (await ctx.db.query("playerMatchStats").collect()).map((row) => row.state),
    status: (await ctx.db.query("matchStatsStatus").unique())?.state ?? null,
  }));
  return { records: { states: [...new Set(states)], count: states.length }, status };
}

test("the full-time write throws on a match holding one record past the cap, and writes nothing", async () => {
  await expect(t.mutation(internal.stats.matchStats.upsertMatch, { fixtureCode: FIXTURE, readAt: 0, records: [SENT] })).rejects.toThrow(tooMany("its records' write"));
  expect(await held()).toEqual({ records: UNTOUCHED, status: null });
});

test("the live write throws on a match holding one record past the cap, and writes nothing", async () => {
  await expect(t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode: FIXTURE, minute: 10, records: [SENT] })).rejects.toThrow(tooMany("its live records' write"));
  expect(await held()).toEqual({ records: UNTOUCHED, status: null });
});

test("the lock throws on a match holding one record past the cap, and locks nothing", async () => {
  await t.run((ctx) => ctx.db.insert("matchStatsStatus", { fixtureCode: FIXTURE, state: "complete", fullTimeAt: 0, completeAt: 0, lastReadAt: 0 }));
  await expect(t.mutation(internal.stats.matchStats.lock, { fixtureCode: FIXTURE })).rejects.toThrow(tooMany("its lock"));
  expect(await held()).toEqual({ records: UNTOUCHED, status: "complete" });
});
