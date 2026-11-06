import { beforeEach, expect, test, vi } from "vitest";
import { heldSchedule } from "../../../convex/gameweeks/leagueDeadlines";
import { JULY } from "../../../convex/shared/time";
import { held, NOTHING_CHANGED, syncRun, syncWith } from "../../support/convex/footballSync.harness";
import { RECORDED_COUNT, recordedFpl } from "../../support/recorded/fpl.payloads";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

// #66: each season's gameweeks are their own rows, last season's kept beside the new one's, and an
// empty fixtures list in the summer is FPL between seasons, not a failed sync.

const THIS_SEASON_SYNC = Date.parse("2026-10-19T06:00:00Z");
const SUMMER_SYNC = Date.UTC(2027, JULY, 10);
const NEXT_SEASON_SYNC = Date.UTC(2027, JULY, 20);

/** The recording as FPL sends it next summer: the same gameweek numbers, a year on. */
function nextSeasonFpl() {
  const payloads = recordedFpl();
  payloads.bootstrap.events = payloads.bootstrap.events.map((event) => ({
    ...event,
    deadline_time: event.deadline_time.replace("2026-", "2027-"),
  }));
  return payloads;
}

/** Each held gameweek as season, number and deadline, sorted, with whether it is marked. */
async function gameweeks(t: TestConvex) {
  return (await held(t)).gameweeks
    .map(({ season, number, deadline, droppedAt }) => ({ season, number, deadline, dropped: droppedAt !== undefined }))
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || a.number - b.number);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(THIS_SEASON_SYNC);
});

test("next season's gameweeks are new rows: last season's are kept with their deadlines, marked as no longer sent", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const lastSeason = await gameweeks(t);

  vi.setSystemTime(NEXT_SEASON_SYNC);
  const outcome = await syncWith(t, nextSeasonFpl());

  expect(outcome).toMatchObject({
    ok: true,
    gameweeks: { received: RECORDED_COUNT.gameweeks, inserted: RECORDED_COUNT.gameweeks, updated: 0, marked: RECORDED_COUNT.gameweeks },
  });
  const now = await gameweeks(t);
  expect(now.filter(({ season }) => season === 2026)).toEqual(lastSeason.map((row) => ({ ...row, dropped: true })));
  expect(now.filter(({ season }) => season === 2027).map(({ dropped }) => dropped)).toEqual(
    Array(RECORDED_COUNT.gameweeks).fill(false),
  );
});

test("the season's schedule reads only the newest season's gameweeks once last season's are held beside it", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  vi.setSystemTime(NEXT_SEASON_SYNC);
  await syncWith(t, nextSeasonFpl());

  const schedule = await t.run((ctx) => heldSchedule(ctx));

  expect(schedule.gameweeks).toHaveLength(RECORDED_COUNT.gameweeks);
});

test("a gameweek row from before #66, with no season, is labelled by its season's sync rather than held twice", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("gameweeks").collect()) await ctx.db.replace("gameweeks", row._id, { number: row.number, deadline: row.deadline });
  });

  const outcome = await syncWith(t, recordedFpl());

  expect(outcome).toMatchObject({ ok: true, gameweeks: { inserted: 0, updated: RECORDED_COUNT.gameweeks, marked: 0 } });
  expect((await gameweeks(t)).map(({ season, dropped }) => ({ season, dropped }))).toEqual(
    Array(RECORDED_COUNT.gameweeks).fill({ season: 2026, dropped: false }),
  );
});

test("a gameweek row from before #66 is never taken for next season's: it stays, and the new season's are new rows", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("gameweeks").collect()) await ctx.db.replace("gameweeks", row._id, { number: row.number, deadline: row.deadline });
  });

  vi.setSystemTime(NEXT_SEASON_SYNC);
  await syncWith(t, nextSeasonFpl());

  const rows = await gameweeks(t);
  expect(rows.filter(({ season }) => season === undefined).map(({ dropped }) => dropped)).toEqual(Array(RECORDED_COUNT.gameweeks).fill(true));
  expect(rows.filter(({ season }) => season === 2027)).toHaveLength(RECORDED_COUNT.gameweeks);
});

test("an empty fixtures list in the summer is between seasons: the run is ok, and last season's fixtures stay unmarked", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const fixtures = (await held(t)).fixtures;
  const summer = recordedFpl();
  summer.fixtures = [];

  vi.setSystemTime(SUMMER_SYNC);
  const run = await syncRun(t, summer);

  expect(run.outcome).toMatchObject({ ok: true, betweenSeasons: true, fixtures: { received: 0, ...NOTHING_CHANGED } });
  expect((await held(t)).fixtures).toEqual(fixtures);
});

test("a run with fixtures sent names no between seasons", async () => {
  const t = freshConvex();

  expect(await syncWith(t, recordedFpl())).not.toHaveProperty("betweenSeasons");
});
