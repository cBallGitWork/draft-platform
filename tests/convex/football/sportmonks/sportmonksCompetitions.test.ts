// The competitions Sportmonks is read for (#1414): a list held as data, seeded with the beta's two,
// each that is on read in its own run, every row naming its competition, and one the plan refuses
// failing alone while the others still read.

import { expect, test, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { leagueUrl, liveFixturesUrl, SEEDED_COMPETITIONS } from "../../../../convex/football/sportmonks/sportmonks";
import { freshConvex, silenceConsoleError } from "../../../support/convex/test.harness";
import { SM, sportmonksLiveRead } from "../../../support/recorded/sportmonks.payloads";
import {
  fakeSportmonks,
  PL_SHIFT,
  PREMIER_LEAGUE,
  premierLeagueOn,
  REFUSED,
  SCOTTISH,
  sync,
  syncs,
  ticks,
  useSportmonks,
  WRITES,
} from "../../../support/convex/sportmonks.harness";

useSportmonks();

test("a deployment holding no competitions starts from the beta's two, the Scottish Premiership on and the Premier League off, and reads only the one on", async () => {
  const t = freshConvex();
  const fetch = fakeSportmonks();
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.football.sportmonks.sportmonksSync.run, { trigger: "manual" });

  const held = await t.run((ctx) => ctx.db.query("sportmonksCompetitions").collect());
  expect(held.map(({ name, leagueId, on }) => ({ name, leagueId, on }))).toEqual(SEEDED_COMPETITIONS);
  expect(fetch.mock.calls.map(([url]) => url)).not.toContain(leagueUrl(PREMIER_LEAGUE));
  expect((await syncs(t)).map(({ competition }) => competition)).toEqual([SCOTTISH]);
});

test("with two competitions on, a run reads each, and every club, player, fixture and round names its own", async () => {
  const t = freshConvex();
  await premierLeagueOn(t);
  await sync(t);

  expect((await syncs(t)).map(({ competition, outcome }) => ({ competition, ok: outcome.ok }))).toEqual([
    { competition: SCOTTISH, ok: true },
    { competition: PREMIER_LEAGUE, ok: true },
  ]);
  const competitionOf = (code: number) => (code > PL_SHIFT ? PREMIER_LEAGUE : SCOTTISH);
  const tagged = await t.run(async (ctx) => [
    ...(await ctx.db.query("sportmonksClubs").collect()),
    ...(await ctx.db.query("sportmonksPlayers").collect()),
    ...(await ctx.db.query("sportmonksFixtures").collect()),
  ]);
  expect(tagged).toHaveLength(2 * 9);
  for (const { code, competition } of tagged) expect(competition).toBe(competitionOf(code));
  // Both competitions have a round 11 and 12 of the same season: four rounds, two each.
  const rounds = await t.run((ctx) => ctx.db.query("sportmonksRounds").collect());
  expect(rounds.map(({ competition, number }) => [competition, number])).toEqual([
    [SCOTTISH, 11],
    [SCOTTISH, 12],
    [PREMIER_LEAGUE, 11],
    [PREMIER_LEAGUE, 12],
  ]);
});

test("one competition's read the plan refuses (403) is its own failed run, and the other's still reads", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await premierLeagueOn(t);
  await sync(t, { refuse: leagueUrl(PREMIER_LEAGUE) });
  // The admin's failure email, which this deployment can't send.
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const [scottish, premierLeague] = await syncs(t);
  expect(scottish).toMatchObject({ competition: SCOTTISH, outcome: { ok: true, clubs: WRITES(3) } });
  expect(premierLeague).toMatchObject({
    competition: PREMIER_LEAGUE,
    outcome: { ok: false, error: `${leagueUrl(PREMIER_LEAGUE)} answered 403: ${REFUSED}` },
  });
  const clubs = await t.run((ctx) => ctx.db.query("sportmonksClubs").collect());
  expect(clubs.map(({ competition }) => competition)).toEqual([SCOTTISH, SCOTTISH, SCOTTISH]);
});

test("a competition's run marks only its own rows dropped, never another's", async () => {
  const t = freshConvex();
  await premierLeagueOn(t);
  await sync(t);
  await t.run(async (ctx) => {
    const premierLeague = await ctx.db
      .query("sportmonksCompetitions")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", PREMIER_LEAGUE))
      .unique();
    if (premierLeague) await ctx.db.patch("sportmonksCompetitions", premierLeague._id, { on: false });
  });
  await sync(t);

  const [, , again] = await syncs(t);
  expect(again.outcome).toMatchObject({ ok: true, clubs: { received: 3, inserted: 0, marked: 0 }, players: { marked: 0 } });
  const dropped = await t.run(async (ctx) => (await ctx.db.query("sportmonksPlayers").collect()).filter((man) => man.droppedAt !== undefined));
  expect(dropped).toEqual([]);
});

test("rows read before competitions were a list are taken by the next run as its own, never doubled", async () => {
  const t = freshConvex();
  await sync(t);
  await t.run(async (ctx) => {
    for (const table of ["sportmonksClubs", "sportmonksPlayers", "sportmonksFixtures", "sportmonksRounds"] as const) {
      for (const row of await ctx.db.query(table).collect()) await ctx.db.patch(table, row._id, { competition: undefined });
    }
  });
  await sync(t);

  const [, second] = await syncs(t);
  expect(second.outcome).toMatchObject({ ok: true, clubs: { inserted: 0, updated: 3 }, rounds: { inserted: 0, updated: 2 } });
  const rounds = await t.run((ctx) => ctx.db.query("sportmonksRounds").collect());
  expect(rounds.map(({ competition }) => competition)).toEqual([SCOTTISH, SCOTTISH]);
});

test("during matches in two competitions the tick writes a row for each, one refused failing alone", async () => {
  silenceConsoleError();
  const t = freshConvex();
  await premierLeagueOn(t);
  await sync(t);
  const plOldFirm = SM.oldFirm + PL_SHIFT;
  const refused = liveFixturesUrl([plOldFirm]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url === refused ? Response.json({ message: REFUSED }, { status: 403 }) : Response.json(sportmonksLiveRead()))),
  );
  await t.action(internal.football.sportmonks.sportmonksLive.tick, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect((await ticks(t)).map(({ competition, outcome }) => ({ competition, outcome }))).toEqual([
    { competition: SCOTTISH, outcome: { ok: true, matches: [{ fixtureCode: SM.oldFirm, ok: true }] } },
    { competition: PREMIER_LEAGUE, outcome: { ok: false, error: `${refused} answered 403: ${REFUSED}` } },
  ]);
});
