// Sportmonks' reads stored (#1391): the six-hourly read into its own tables and the live tick's
// match rows, each run a row, nothing read or written where the deployment has no token. More than
// one competition: sportmonksCompetitions.test.ts.

import { expect, test, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { scheduleUrl, SPORTMONKS_TOKEN_ENV } from "../../../../convex/football/sportmonks/sportmonks";
import { writeScore } from "../../../../convex/football/sportmonks/sportmonksSync";
import type { ScoreRead } from "../../../../convex/football/scoreReads";
import { freshConvex, silenceConsoleError, everyJobRuns } from "../../../support/convex/test.harness";
import { SM, sportmonksLiveRead, sportmonksSeason } from "../../../support/recorded/sportmonks.payloads";
import { fakeSportmonks, LIVE_NOW, REFUSED, SEASON_ID, sync, syncs, ticks, useSportmonks, WRITES } from "../../../support/convex/sportmonks.harness";

useSportmonks();

test("a run fills the Scottish clubs, players, fixtures and rounds by Sportmonks' ids, with each score, and records what it wrote", async () => {
  const t = freshConvex();
  await sync(t);

  const [row] = await syncs(t);
  expect(row).toMatchObject({
    trigger: "manual",
    ranAt: LIVE_NOW,
    outcome: { ok: true, clubs: WRITES(3), players: WRITES(3), fixtures: WRITES(3), rounds: WRITES(2), scores: { received: 3, written: 3, problems: [] } },
  });
  const held = await t.run(async (ctx) => ({
    clubs: (await ctx.db.query("sportmonksClubs").collect()).map(({ code, stadium, capacity, manager }) => [code, stadium ?? null, capacity ?? null, manager ?? null]),
    players: (await ctx.db.query("sportmonksPlayers").collect()).map(({ code, clubCode }) => [code, clubCode]),
    fixtures: (await ctx.db.query("sportmonksFixtures").collect()).map(({ code, gameweek }) => [code, gameweek]),
    scores: (await ctx.db.query("sportmonksScores").collect()).map(({ fixtureCode, state }) => [fixtureCode, state]),
  }));
  expect(held).toEqual({
    // Each club's ground, capacity and manager where sent (#1938).
    clubs: [
      [SM.celtic, "Celtic Park", 60411, "Martin O'Neill"],
      [SM.rangers, "Ibrox Stadium", null, null],
      [SM.hearts, null, null, null],
    ],
    players: [[SM.schmeichel, SM.celtic], [SM.kyogo, SM.celtic], [SM.tavernier, SM.rangers]],
    fixtures: [[SM.rangersHearts, 11], [SM.oldFirm, 12], [SM.heartsCeltic, 12]],
    scores: [[SM.rangersHearts, "fullTime"], [SM.oldFirm, "live"], [SM.heartsCeltic, "upcoming"]],
  });
});

test("a run again changes nothing held, and marks a man no squad sends any more as dropped, kept", async () => {
  const t = freshConvex();
  await sync(t);
  const season = sportmonksSeason();
  season.teams[1].players = [];
  await sync(t, { season });

  const [, second] = await syncs(t);
  expect(second.outcome).toMatchObject({ ok: true, clubs: { ...WRITES(3), inserted: 0 }, players: { received: 2, inserted: 0, updated: 0, marked: 1, unmarked: 0 } });
  const tavernier = await t.run((ctx) => ctx.db.query("sportmonksPlayers").withIndex("by_code", (q) => q.eq("code", SM.tavernier)).unique());
  expect(tavernier?.droppedAt).toBe(LIVE_NOW);
});

test("a run that no longer sends a club's ground, capacity or manager clears the held ones (#1938)", async () => {
  const t = freshConvex();
  await sync(t);
  const season = sportmonksSeason();
  const celtic = season.teams.find((team) => team.id === SM.celtic)!;
  celtic.venue = null;
  celtic.coaches = [];
  await sync(t, { season });

  const [, second] = await syncs(t);
  expect(second.outcome).toMatchObject({ ok: true, clubs: { received: 3, inserted: 0, updated: 1 } });
  const held = await t.run((ctx) => ctx.db.query("sportmonksClubs").withIndex("by_code", (q) => q.eq("code", SM.celtic)).unique());
  expect([held?.stadium, held?.capacity, held?.manager]).toEqual([undefined, undefined, undefined]);
});

test("a refused read is a failed run's row with Sportmonks' own words, and no table is touched", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await sync(t, { refuse: scheduleUrl(SEASON_ID) });
  // The admin's failure email, which this deployment can't send.
  await everyJobRuns(t);

  const [row] = await syncs(t);
  expect(row.outcome).toEqual({ ok: false, error: `${scheduleUrl(SEASON_ID)} answered 403: ${REFUSED}` });
  expect(await t.run((ctx) => ctx.db.query("sportmonksClubs").collect())).toEqual([]);
});

test("with no token set nothing is read and no row is written, on either job", async () => {
  vi.stubEnv(SPORTMONKS_TOKEN_ENV, "");
  const t = freshConvex();
  const fetch = fakeSportmonks();
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.football.sportmonks.sportmonksSync.run, { trigger: "cron" });
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});
  expect(fetch).not.toHaveBeenCalled();
  expect([...(await syncs(t)), ...(await ticks(t))]).toEqual([]);
});

test("during a Scottish match the tick reads it in one call and writes its lineups, stats, events and score, and its row", async () => {
  const t = freshConvex();
  await sync(t);
  const fetch = fakeSportmonks();
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});

  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await ticks(t)).map(({ ranAt, outcome }) => ({ ranAt, outcome }))).toEqual([
    { ranAt: LIVE_NOW, outcome: { ok: true, matches: [{ fixtureCode: SM.oldFirm, ok: true }] } },
  ]);
  const match = await t.run((ctx) => ctx.db.query("sportmonksMatches").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", SM.oldFirm)).unique());
  expect(match?.men.map(({ playerId, started }) => [playerId, started])).toEqual([
    [SM.schmeichel, true],
    [SM.kyogo, true],
    [SM.mcCowan, false],
    [SM.tavernier, true],
  ]);
  expect(match?.events).toHaveLength(6);
  const score = await t.run((ctx) => ctx.db.query("sportmonksScores").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", SM.oldFirm)).unique());
  expect(score).toMatchObject({ state: "live", homeGoals: 2, awayGoals: 1, minutes: 67, readAt: LIVE_NOW });
});

test("a match read at full time is no longer live, so the next tick calls nothing and writes no row", async () => {
  const t = freshConvex();
  await sync(t);
  const read = sportmonksLiveRead();
  read.data[0].state_id = 5;
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(read)));
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});
  const fetch = fakeSportmonks();
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});

  expect(fetch).not.toHaveBeenCalled();
  expect(await ticks(t)).toHaveLength(1);
});

test("a match the live read leaves out fails on its own in the tick's row", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await sync(t);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [] })));
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});
  await everyJobRuns(t);

  const [row] = await ticks(t);
  expect(row.outcome).toEqual({ ok: true, matches: [{ fixtureCode: SM.oldFirm, ok: false, error: `Sportmonks sent no match ${SM.oldFirm}` }] });
});

// Two readers write a match's score (#1546), by matchScores.ts's rule, and the six-hourly read,
// which sends a live match with no minute, never blanks the minute the tick wrote.
type Convex = ReturnType<typeof freshConvex>;
const oldFirmLive: ScoreRead = { fixtureCode: SM.oldFirm, state: "live", homeGoals: 2, awayGoals: 1, minutes: null, clockLabel: null };
const writeAs = (t: Convex, reader: "sync" | "live", read: ScoreRead, readAt: number) => t.run((ctx) => writeScore(ctx, read, readAt, reader));
const oldFirmScore = (t: Convex) =>
  t.run((ctx) => ctx.db.query("sportmonksScores").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", SM.oldFirm)).unique());

test("the six-hourly read during a match keeps the minute the tick wrote", async () => {
  const t = freshConvex();
  await writeAs(t, "live", { ...oldFirmLive, minutes: 67 }, LIVE_NOW);
  expect(await writeAs(t, "sync", oldFirmLive, LIVE_NOW + 1)).toBe(false);
  await writeAs(t, "sync", { ...oldFirmLive, homeGoals: 3 }, LIVE_NOW + 2);

  expect(await oldFirmScore(t)).toMatchObject({ state: "live", homeGoals: 3, minutes: 67, readAt: LIVE_NOW + 2, reader: "sync" });
});

test("a six-hourly read older than the tick's full time, or newer but still live, never sets the match back to live", async () => {
  const t = freshConvex();
  await writeAs(t, "live", { ...oldFirmLive, state: "fullTime", minutes: 90 }, LIVE_NOW);
  expect(await writeAs(t, "sync", oldFirmLive, LIVE_NOW - 1)).toBe(false);
  expect(await writeAs(t, "sync", oldFirmLive, LIVE_NOW + 1)).toBe(false);

  expect(await oldFirmScore(t)).toMatchObject({ state: "fullTime", minutes: 90, reader: "live" });
});

test("a reader may move its own read back a state, as for a match abandoned and reset", async () => {
  const t = freshConvex();
  await writeAs(t, "sync", oldFirmLive, LIVE_NOW);
  expect(await writeAs(t, "sync", { ...oldFirmLive, state: "upcoming", homeGoals: null, awayGoals: null }, LIVE_NOW + 1)).toBe(true);

  expect(await oldFirmScore(t)).toMatchObject({ state: "upcoming", minutes: null });
});
