import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { MATCH_RECORDS_MOST } from "../../../convex/gameweekScorer/heldMatches";
import { inTenths } from "../../../convex/scoring/values";
import { PLAYERS_PAGE } from "../../../convex/stats/matchRecords";
import { REBUILD_COMMAND } from "../../../convex/stats/seasonPointsMoves";
import { changesSeasonPoints, queueRefresh } from "../../../convex/stats/seasonPointsQueue";
import { completeRecord } from "../../support/convex/footballRows.harness";
import { pendingJobs, silenceConsoleError } from "../../support/convex/test.harness";
import {
  GW1,
  GW2,
  GW3,
  KICKOFF,
  LAST_SEASON,
  SAKA,
  SAKA_GW1,
  SAKA_GW2,
  at,
  pointsListed,
  record,
  refresh,
  seasonPointsLeague,
  type PointsLeague,
} from "../../support/convex/seasonPoints.harness";

// When season points are re-priced (#525, seasonPointsQueue.ts): just after a record write changes
// what a player counts, or a played match leaves the feed or moves gameweek, each as its own job;
// and on a deployment holding records but no row, the whole rebuild starts by itself.

let league: PointsLeague;
beforeEach(async () => {
  league = await seasonPointsLeague();
});

const sakaPoints = async () => (await pointsListed(league)).get(SAKA.code);
const runQueued = () => league.t.finishAllScheduledFunctions(vi.runAllTimers);
const rowsKept = () => league.t.run(async (ctx) => (await ctx.db.query("playerSeasonPoints").collect()).length);

const { state: _state, ...sakaGw3 } = record(SAKA.code, GW3.code, { minutes: 90, goals_scored: 4 });
const writeLive = async (records: (typeof sakaGw3)[]) => {
  await league.t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode: GW3.code, minute: null, records });
  await runQueued();
};

describe("kept as records are written", () => {
  test("a record made whole re-prices his season; one still waiting on a feed leaves it be", async () => {
    await refresh(league);
    const before = (await sakaPoints())!;

    await writeLive([{ ...sakaGw3, arrived: { fpl: true, pl: false }, stats: { minutes: 90, goals_scored: 5 } }]);
    expect(await sakaPoints()).toBe(before);

    await writeLive([sakaGw3]);
    expect(await sakaPoints()).toBe(inTenths(before + at(sakaGw3.stats, "W")));
  });

  test("a correction re-prices it: a goal taken away comes off", async () => {
    await writeLive([sakaGw3]);
    const withGoals = (await sakaPoints())!;

    await writeLive([{ ...sakaGw3, stats: { minutes: 90, goals_scored: 3 } }]);

    expect(await sakaPoints()).toBe(inTenths(withGoals - at({ goals_scored: 1 }, "W")));
  });

  test("a record turned to an unused substitute's, its stats as they were, comes off his season", async () => {
    await writeLive([sakaGw3]);
    const withGw3 = (await sakaPoints())!;

    await writeLive([{ ...sakaGw3, played: false }]);

    expect(await sakaPoints()).toBe(inTenths(withGw3 - at(sakaGw3.stats, "W")));
  });

  test("what counts as a change: counted stats or whether he played, never a record still waiting on a feed", () => {
    const whole = completeRecord(SAKA.code, GW3.code, { minutes: 90 });
    const waiting = completeRecord(SAKA.code, GW3.code, { minutes: 90 }, { pl: false });
    expect(changesSeasonPoints(undefined, whole)).toBe(true);
    expect(changesSeasonPoints(undefined, waiting)).toBe(false);
    expect(changesSeasonPoints(waiting, { ...waiting, stats: { minutes: 91 } })).toBe(false);
    expect(changesSeasonPoints(whole, whole)).toBe(false);
    expect(changesSeasonPoints(whole, { ...whole, played: false })).toBe(true);
    expect(changesSeasonPoints(whole, { ...whole, stats: { minutes: 89 } })).toBe(true);
  });
});

describe("kept as matches move", () => {
  beforeEach(() => refresh(league));

  test("a played match postponed out of its gameweek comes off his season", async () => {
    await league.t.mutation(internal.football.footballSync.upsertFixtures, { rows: [{ ...GW2, gameweek: null }] });
    await runQueued();

    expect(await sakaPoints()).toBe(at(SAKA_GW1, "W"));
  });

  test("a played match the feed stops sending comes off his season, and goes back on when it is sent again", async () => {
    await league.t.mutation(internal.football.footballSync.markDropped, {
      table: "fixtures",
      sentKeys: [GW2.code, GW3.code],
      droppedAt: KICKOFF,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    await runQueued();
    expect(await sakaPoints()).toBe(at(SAKA_GW2, "W"));

    await league.t.mutation(internal.football.footballSync.upsertFixtures, { rows: [GW1] });
    await runQueued();
    expect(await sakaPoints()).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
  });
});

describe("started by itself on a deployment with records but no rows", () => {
  test("the next football sync starts the rebuild, once the season's totals show someone played", async () => {
    expect(await rowsKept()).toBe(0);
    await league.t.mutation(internal.stats.seasonStats.rebuild, { cursor: null });
    await runQueued();

    await league.t.mutation(internal.football.footballSync.upsertFixtures, { rows: [] });
    await runQueued();

    expect(await sakaPoints()).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
  });

  test("the next record write starts the rebuild, for every player, not just its own", async () => {
    await writeLive([sakaGw3]);

    expect(await rowsKept()).toBe(3);
  });

  test("with rows kept, a sync starts nothing", async () => {
    await refresh(league);
    await league.t.run(async (ctx) => {
      const row = (await ctx.db.query("playerSeasonPoints").first())!;
      await ctx.db.patch("playerSeasonPoints", row._id, { points: { W: 99 } });
    });

    await league.t.mutation(internal.football.footballSync.upsertFixtures, { rows: [] });
    await runQueued();

    expect(await league.t.run(async (ctx) => (await ctx.db.query("playerSeasonPoints").first())!.points)).toEqual({ W: 99 });
  });
});

test("a live-only deployment, its records all waiting on a feed, starts no rebuild however often it writes", async () => {
  const { t } = league;
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("playerMatchStats").collect()) await ctx.db.delete("playerMatchStats", row._id);
  });

  for (const goals of [1, 2, 3]) {
    await t.mutation(internal.stats.liveStats.upsertLive, {
      fixtureCode: GW3.code,
      minute: null,
      records: [{ ...sakaGw3, arrived: { fpl: true, pl: false }, stats: { minutes: 90, goals_scored: goals } }],
    });
    await t.mutation(internal.football.footballSync.upsertFixtures, { rows: [] });
  }

  expect(await pendingJobs(t, internal.stats.seasonPoints.rebuild)).toHaveLength(0);
  expect(await pendingJobs(t, internal.stats.seasonPoints.refresh)).toHaveLength(0);
});

test("a re-pricing of more players than a job takes is queued as several jobs", async () => {
  const { t } = league;
  await refresh(league);
  const codes = Array.from({ length: PLAYERS_PAGE + 1 }, (_, index) => 70_000 + index);

  await t.run((ctx) => queueRefresh(ctx, codes));

  const jobs = await pendingJobs(t, internal.stats.seasonPoints.refresh);
  expect(jobs.map((job) => (job.args[0] as { playerCodes: number[] }).playerCodes)).toEqual([codes.slice(0, PLAYERS_PAGE), codes.slice(PLAYERS_PAGE)]);
});

describe("a match move never stops the sync", () => {
  beforeEach(() => refresh(league));

  test(`a match holding more than ${MATCH_RECORDS_MOST} records: the sync still commits, and its job logs the repair and queues nothing`, async () => {
    const { t } = league;
    const logged = silenceConsoleError();
    await t.run(async (ctx) => {
      for (let index = 0; index <= MATCH_RECORDS_MOST; index += 1) await ctx.db.insert("playerMatchStats", record(80_000 + index, GW2.code, { minutes: 1 }));
    });

    await t.mutation(internal.football.footballSync.upsertFixtures, { rows: [{ ...GW2, gameweek: null }] });
    expect(await t.run(async (ctx) => (await ctx.db.query("fixtures").withIndex("by_code", (q) => q.eq("code", GW2.code)).unique())!.gameweek)).toBeNull();
    expect(await pendingJobs(t, internal.stats.seasonPointsMoves.repriceMatch)).toHaveLength(1);

    await runQueued();

    expect(logged).toHaveBeenCalledWith(expect.stringContaining(`match ${GW2.code}'s players' season points weren't re-priced; run ${REBUILD_COMMAND}`));
    // Nobody was re-priced, so the match left still counts until a rebuild.
    expect(await sakaPoints()).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
  });

  test("dropping last season's matches at the rollover re-prices nobody", async () => {
    const { t } = league;
    const { droppedAt: _dropped, ...lastSeasonHeld } = LAST_SEASON;
    await t.run(async (ctx) => {
      const held = (await ctx.db.query("fixtures").withIndex("by_code", (q) => q.eq("code", LAST_SEASON.code)).unique())!;
      await ctx.db.replace("fixtures", held._id, lastSeasonHeld);
    });

    await t.mutation(internal.football.footballSync.markDropped, {
      table: "fixtures",
      sentKeys: [GW1.code, GW2.code, GW3.code],
      droppedAt: KICKOFF,
      paginationOpts: { cursor: null, numItems: 10 },
    });

    expect(await pendingJobs(t, internal.stats.seasonPointsMoves.repriceMatch)).toHaveLength(0);
    expect(await pendingJobs(t, internal.stats.seasonPoints.refresh)).toHaveLength(0);
  });
});
