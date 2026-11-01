import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { inTenths } from "../../../convex/scoring/values";
import { seasonStartYear } from "../../../convex/shared/time";
import { TOTALS_REBUILD_COMMAND } from "../../../convex/stats/seasonRebuilds";
import { seasonTotals } from "../../../convex/stats/seasonStats";
import { addStats } from "../../../convex/stats/statTotals";
import { holdStatus } from "../../support/convex/feeds.harness";
import { pendingJobs, silenceConsoleError } from "../../support/convex/test.harness";
import {
  ALL_CODES,
  GW1,
  GW3,
  KICKOFF,
  LAST_SEASON,
  SAKA,
  SAKA_GW1,
  SAKA_GW2,
  at,
  pointsListed,
  record,
  seasonPointsLeague,
  type PointsLeague,
} from "../../support/convex/seasonPoints.harness";

// The season rows' self-starts (#959, seasonRebuilds.ts): a deployment whose match records were
// held before season totals were kept starts the totals rebuild by itself, and its last page
// starts season points', which wait on totals. The harness holds records, no totals and no points.

let league: PointsLeague;
beforeEach(async () => {
  league = await seasonPointsLeague();
});

const SEASON = seasonStartYear(KICKOFF);
const runQueued = () => league.t.finishAllScheduledFunctions(vi.runAllTimers);
const totalsRebuilds = () => pendingJobs(league.t, internal.stats.seasonStats.rebuild);
const pointsJobs = async () => [
  ...(await pendingJobs(league.t, internal.stats.seasonPoints.rebuild)),
  ...(await pendingJobs(league.t, internal.stats.seasonPoints.refresh)),
];
const totalsKept = async () => new Map(await league.t.run(async (ctx) => [...(await seasonTotals(ctx, SEASON))]));
const sync = () => league.t.mutation(internal.football.footballSync.upsertFixtures, { rows: [] });

const { state: _state, ...sakaGw3 } = record(SAKA.code, GW3.code, { minutes: 90, goals_scored: 4 });
const writeLive = (records: (typeof sakaGw3)[]) => league.t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode: GW3.code, minute: null, records });
/** Saka's whole records this season added up, GW3's included. */
const sakaWithGw3 = addStats(addStats(SAKA_GW1, SAKA_GW2), sakaGw3.stats);

/** The match-stats sync read GW1 at full time and found it in `state`. */
const holdGw1 = (state: "provisional" | "complete") => holdStatus(league.t, GW1.code, GW1.kickoff, state);

describe("started by itself once a match of the season held is whole", () => {
  beforeEach(() => holdGw1("complete"));

  test("the next football sync rebuilds every player's totals, then his season points", async () => {
    await sync();
    expect(await totalsRebuilds()).toHaveLength(1);
    expect(await pointsJobs()).toHaveLength(0);

    await runQueued();

    const totals = await totalsKept();
    expect([...totals.keys()].sort()).toEqual([...ALL_CODES].sort());
    expect(totals.get(SAKA.code)).toEqual(addStats(SAKA_GW1, SAKA_GW2));
    expect((await pointsListed(league)).get(SAKA.code)).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
  });

  test("the next record write starts it before moving any totals, so every player is counted, not just its own", async () => {
    await writeLive([sakaGw3]);
    expect(await totalsRebuilds()).toHaveLength(1);
    // The rebuild re-prices every season when it finishes, so the write queues no re-pricing.
    expect(await pointsJobs()).toHaveLength(0);

    await runQueued();

    const totals = await totalsKept();
    expect([...totals.keys()].sort()).toEqual([...ALL_CODES].sort());
    expect(totals.get(SAKA.code)).toEqual(sakaWithGw3);
    expect((await pointsListed(league)).get(SAKA.code)).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W") + at(sakaGw3.stats, "W")));
  });

  test("with a totals row kept, a sync or a write starts no totals rebuild", async () => {
    await league.t.run((ctx) => ctx.db.insert("playerSeasonStats", { season: SEASON, playerCode: SAKA.code, stats: { minutes: 1 } }));

    await sync();
    await writeLive([sakaGw3]);

    expect(await totalsRebuilds()).toHaveLength(0);
  });
});

describe("no rebuild while it would write no row", () => {
  test("a match of the season held still provisional starts none, however often it syncs and writes", async () => {
    await holdGw1("provisional");

    for (const goals of [1, 2, 3]) {
      await writeLive([{ ...sakaGw3, stats: { minutes: 90, goals_scored: goals } }]);
      await sync();
    }

    expect(await totalsRebuilds()).toHaveLength(0);
  });

  test("the match being written is the season's first whole one: its own write moves its totals, so none starts", async () => {
    await league.t.mutation(internal.stats.matchStats.upsertMatch, { fixtureCode: GW3.code, readAt: GW3.kickoff, records: [sakaGw3] });

    expect(await totalsRebuilds()).toHaveLength(0);
    // His record held before the totals were kept sets his from all his records (seasonStats.ts).
    expect((await totalsKept()).get(SAKA.code)).toEqual(sakaWithGw3);
  });

  test("only last season's matches whole starts none", async () => {
    await holdStatus(league.t, LAST_SEASON.code, LAST_SEASON.kickoff, "complete");

    await sync();

    expect(await totalsRebuilds()).toHaveLength(0);
  });
});

test("a check that can't be read logs the repair and never stops the sync", async () => {
  const logged = silenceConsoleError();
  await holdGw1("complete");
  // Two matches under one code: reading GW1 back throws.
  await league.t.run((ctx) => ctx.db.insert("fixtures", { ...GW1, gameweek: null }));

  await sync();

  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`the season rows weren't checked for a rebuild; run ${TOTALS_REBUILD_COMMAND}`));
  expect(await totalsRebuilds()).toHaveLength(0);
});
