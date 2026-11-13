import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import {
  FULL_TIME_READ,
  fakeFeedsMovedTo,
  GAMEWEEK,
  HULL_EVERTON,
  heldMatch,
  withHullEverton,
} from "../../support/convex/matchStats.harness";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";

// #2044: a postponed match FPL moves to another gameweek is still listed by the Premier League
// under the gameweek it was first set in.

beforeEach(() => vi.useFakeTimers());

const MOVED_TO = GAMEWEEK + 1;

test("a match FPL moved to another gameweek is found in the Premier League's season list", async () => {
  const t = await withHullEverton();
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("fixtures").first())!;
    await ctx.db.patch(row._id, { gameweek: MOVED_TO });
  });
  vi.setSystemTime(FULL_TIME_READ);
  vi.stubGlobal("fetch", fakeFeedsMovedTo(recordedGw6(), MOVED_TO));

  await t.action(internal.stats.matchStatsSync.run, { trigger: "manual" });

  const [run] = await t.query(internal.stats.matchStats.latest, {});
  expect(run.outcome).toMatchObject({
    ok: true,
    matches: [{ fixtureCode: HULL_EVERTON, ok: true, state: "complete", players: 40 }],
    scores: { received: 1, written: 1, problems: [] },
  });
  const { records, status } = await heldMatch(t);
  expect(records.size).toBe(40);
  expect(status).toMatchObject({ state: "complete" });
});
