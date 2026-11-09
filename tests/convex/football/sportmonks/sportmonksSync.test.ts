// Sportmonks' reads stored (#1391): the six-hourly read into its own tables and the live tick's
// match rows, each run a row, nothing read or written where the deployment has no token.

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { leagueUrl, liveFixturesUrl, scheduleUrl, seasonTeamsUrl, SPORTMONKS_TOKEN_ENV } from "../../../../convex/football/sportmonks/sportmonks";
import { MINUTE_MS } from "../../../../convex/shared/time";
import { freshConvex, silenceConsoleError, type TestConvex } from "../../../support/convex/test.harness";
import type { SportmonksPayloads } from "../../../../convex/football/sportmonks/sportmonksRaw";
import { SM, sportmonksLiveRead, sportmonksSeason } from "../../../support/recorded/sportmonks.payloads";

const TOKEN = "test-token";
const SEASON_ID = 25598;
const OLD_FIRM_KICKOFF = Date.parse("2026-11-08T12:00:00Z");
/** The live read's clock: 67 minutes in. */
const LIVE_NOW = OLD_FIRM_KICKOFF + 70 * MINUTE_MS;
const WRITES = (n: number) => ({ received: n, inserted: n, updated: 0, marked: 0, unmarked: 0 });

/** Sportmonks as these payloads, each URL its body; the token asked for in the header. */
function fakeSportmonks({ refuse, season = sportmonksSeason() }: { refuse?: string; season?: SportmonksPayloads } = {}) {
  const bodies: Record<string, unknown> = {
    [leagueUrl()]: { data: season.league },
    [seasonTeamsUrl(SEASON_ID, 1)]: { data: season.teams, pagination: { has_more: false } },
    [scheduleUrl(SEASON_ID)]: { data: season.schedule },
    [liveFixturesUrl([SM.oldFirm])]: sportmonksLiveRead(),
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>).Authorization).toBe(TOKEN);
    if (url === refuse) return Response.json({ message: "You do not have access to this endpoint." }, { status: 403 });
    if (!(url in bodies)) throw new Error(`no fake for ${url}`);
    return Response.json(bodies[url]);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: LIVE_NOW });
  vi.stubEnv(SPORTMONKS_TOKEN_ENV, TOKEN);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const syncs = (t: TestConvex) => t.run((ctx) => ctx.db.query("sportmonksSyncs").collect());
const ticks = (t: TestConvex) => t.run((ctx) => ctx.db.query("sportmonksLiveTicks").collect());

async function sync(t: TestConvex, payloads: Parameters<typeof fakeSportmonks>[0] = {}) {
  vi.stubGlobal("fetch", fakeSportmonks(payloads));
  await t.action(internal.football.sportmonks.sportmonksSync.run, { trigger: "manual" });
}

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
    players: (await ctx.db.query("sportmonksPlayers").collect()).map(({ code, clubCode }) => [code, clubCode]),
    fixtures: (await ctx.db.query("sportmonksFixtures").collect()).map(({ code, gameweek }) => [code, gameweek]),
    scores: (await ctx.db.query("sportmonksScores").collect()).map(({ fixtureCode, state }) => [fixtureCode, state]),
  }));
  expect(held).toEqual({
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

test("a refused read is a failed run's row with Sportmonks' own words, and no table is touched", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await sync(t, { refuse: scheduleUrl(SEASON_ID) });
  // The admin's failure email, which this deployment can't send.
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const [row] = await syncs(t);
  expect(row.outcome).toEqual({ ok: false, error: `${scheduleUrl(SEASON_ID)} answered 403: You do not have access to this endpoint.` });
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
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const [row] = await ticks(t);
  expect(row.outcome).toEqual({ ok: true, matches: [{ fixtureCode: SM.oldFirm, ok: false, error: `Sportmonks sent no match ${SM.oldFirm}` }] });
});
