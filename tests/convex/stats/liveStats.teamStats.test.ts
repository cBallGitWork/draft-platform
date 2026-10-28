import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { plTeamStatsUrl } from "../../../convex/football/football";
import type { RawPlTeamStats } from "../../../convex/football/premierLeague";
import { OPTA_TEAM_STAT } from "../../../convex/football/plTeamStats";
import { stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import { fakeFeeds, FULL_TIME_READ, HULL_EVERTON, HULL_EVERTON_TEAM_STATS, syncAt, withHullEverton } from "../../support/convex/matchStats.harness";
import { refusedError, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";
import { recordedTeamStats } from "../../support/recorded/commentary.payloads";
import { MATCH, recordedGw6 } from "../../support/recorded/gw6.payloads";

// The match page's five team stats (#45; spec/10, The match page): the live tick reads each live
// match's `/stats/match/{id}` with its points, and the match stats sync once more at full time;
// one row a match, replaced by each read. A read that fails is logged, the held five stand, and
// the match's points carry on. The mapping itself is tests/convex/football/plTeamStats.test.ts's.

beforeEach(() => vi.useFakeTimers());

const TEAM_STATS_URL = plTeamStatsUrl(MATCH.hullEverton.pl);
const MINUTE = 30;

async function heldTeamStats(t: TestConvex) {
  return t.run((ctx) => ctx.db.query("matchTeamStats").unique());
}

/** One tick at `minute` with Hull v Everton's team stats read as `read`. */
async function tickWith(t: TestConvex, minute: number, read: RawPlTeamStats) {
  const served = fakeFeeds(stagedGw6(minute));
  vi.setSystemTime(stageTime(minute));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url === TEAM_STATS_URL ? Response.json(read) : served(url))),
  );
  await t.action(internal.stats.liveStatsSync.tick, {});
}

/** The recorded read with Hull's shots changed. */
function withHullShots(shots: number): RawPlTeamStats {
  const read = recordedTeamStats(MATCH.hullEverton.pl);
  const hull = String(read.entity.teams![0].team.id);
  read.data![hull].M = read.data![hull].M.map((metric) => (metric.name === OPTA_TEAM_STAT.shots ? { ...metric, value: shots } : metric));
  return read;
}

test("a tick stores the live match's five team stats alongside its points, home and away as the match has them", async () => {
  const t = await withHullEverton();

  const { latest } = await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));

  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] });
  expect(await heldTeamStats(t)).toMatchObject({ fixtureCode: HULL_EVERTON, ...HULL_EVERTON_TEAM_STATS });
});

test("each read replaces the held five, as the totals run on", async () => {
  const t = await withHullEverton();
  await tickWith(t, MINUTE, withHullShots(3));
  expect((await heldTeamStats(t))?.home.shots).toBe(3);

  await tickWith(t, MINUTE + 1, withHullShots(4));

  expect(await heldTeamStats(t)).toMatchObject({ home: { ...HULL_EVERTON_TEAM_STATS.home, shots: 4 }, away: HULL_EVERTON_TEAM_STATS.away });
});

test("a read before kickoff, with no stats in it, leaves the held five", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));
  const { data: _none, ...empty } = recordedTeamStats(MATCH.hullEverton.pl);

  await tickWith(t, MINUTE + 1, empty);

  expect(await heldTeamStats(t)).toMatchObject(HULL_EVERTON_TEAM_STATS);
});

test("team stats that will not read are logged, the held five stand, and the points and commentary carry on", async () => {
  const errors = silenceConsoleError();
  const t = await withHullEverton();
  await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));

  const { latest } = await tickAt(t, stageTime(MINUTE + 1), stagedGw6(MINUTE + 1), TEAM_STATS_URL);

  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] });
  expect(errors).toHaveBeenCalledWith(`match ${HULL_EVERTON}'s team stats failed: ${refusedError(TEAM_STATS_URL)}`);
  expect(await heldTeamStats(t)).toMatchObject(HULL_EVERTON_TEAM_STATS);
  expect(await t.run((ctx) => ctx.db.query("matchCommentary").unique())).toMatchObject({ delayed: null });
});

test("the full-time sync stores the final five, and leaves a match not yet at full time unread", async () => {
  const waiting = await withHullEverton();
  const fetch = vi.fn(fakeFeeds(stagedGw6(MINUTE)));
  vi.setSystemTime(FULL_TIME_READ);
  vi.stubGlobal("fetch", fetch);
  await waiting.action(internal.stats.matchStatsSync.run, { trigger: "manual" });
  expect(fetch.mock.calls.map(([url]) => url)).not.toContain(TEAM_STATS_URL);
  expect(await heldTeamStats(waiting)).toBeNull();

  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  expect(await heldTeamStats(t)).toMatchObject({ fixtureCode: HULL_EVERTON, ...HULL_EVERTON_TEAM_STATS });
});
