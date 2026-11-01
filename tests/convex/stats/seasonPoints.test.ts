import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { inTenths } from "../../../convex/scoring/values";
import { WEEK_MS } from "../../../convex/shared/time";
import { REBUILD_PAGE } from "../../../convex/stats/seasonStats";
import { COMMISSIONER, actingAs, adminCreatesLeague } from "../../support/convex/leagues.harness";
import { CHELSEA } from "../../support/convex/footballRows.harness";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";
import {
  ANN,
  GW1,
  GW2,
  KICKOFF,
  LAST_SEASON,
  PALMER,
  PALMER_GW1,
  RICE,
  RICE_GW1,
  SAKA,
  SAKA_GW1,
  SAKA_GW2,
  at,
  fixture,
  list,
  pointsListed,
  refresh,
  seasonPointsLeague,
  type PointsLeague,
} from "../../support/convex/seasonPoints.harness";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";

// Each player's season points on Scouting (#525; spec/19, The players list: "with season points
// under the site's scoring"): his card's matches this season added up in the league, at his main
// position, the league's overrides in (Craig, 1 Nov 2026), owned or not. When they are re-priced
// is seasonPointsQueue.test.ts's.

let league: PointsLeague;
beforeEach(async () => {
  league = await seasonPointsLeague();
});

/** His card's matches added up as Scouting adds them: each at the card's first position, or the
 *  league's override. */
async function cardTotal(playerCode: number) {
  const card = (await (await actingAs(league.t, ANN)).query(api.playerCard.playerCard.card, { leagueId: league.leagueId, playerCode, now: KICKOFF }))!;
  return inTenths(card.matches.reduce((total, match) => total + (match.override?.points ?? match.points[0].total ?? 0), 0));
}

const overrides = (playerCode: number, { code: fixtureCode, gameweek }: { code: number; gameweek: number | null }, points: number, leagueId = league.leagueId) =>
  league.t.run(async (ctx) => {
    await ctx.db.insert("pointsOverrides", { leagueId, gameweek: gameweek!, fixtureCode, playerCode, points, reason: "The feed was wrong", by: COMMISSIONER, at: KICKOFF });
  });

const sakaPoints = async () => (await pointsListed(league)).get(SAKA.code);

describe("what a player's season points are", () => {
  beforeEach(() => refresh(league));

  test("his card's matches this season added up: not last season's, not one whose record isn't whole", async () => {
    expect(await sakaPoints()).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
    expect(await sakaPoints()).toBe(await cardTotal(SAKA.code));
  });

  test("a player with more than one position is priced at his main one, where his card opens", async () => {
    expect(at(RICE_GW1, "CB")).not.toBe(at(RICE_GW1, "CM"));
    expect((await pointsListed(league)).get(RICE.code)).toBe(at(RICE_GW1, "CB"));
    expect((await pointsListed(league)).get(RICE.code)).toBe(await cardTotal(RICE.code));
  });

  test("a free agent's show as an owned player's do", async () => {
    expect((await pointsListed(league)).get(PALMER.code)).toBe(at(PALMER_GW1, "CAM"));
  });

  test("the league's override takes the match's place; another league's doesn't count", async () => {
    const OVERRIDDEN = 20;
    const otherLeague: Id<"leagues"> = await adminCreatesLeague(league.t);
    await overrides(SAKA.code, GW1, OVERRIDDEN);
    await overrides(SAKA.code, GW2, 0, otherLeague);

    expect(await sakaPoints()).toBe(inTenths(OVERRIDDEN + at(SAKA_GW2, "W")));
    expect(await sakaPoints()).toBe(await cardTotal(SAKA.code));
  });

  test("an override of last season's match changes nothing", async () => {
    await overrides(SAKA.code, LAST_SEASON, 99);
    expect(await sakaPoints()).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
  });

  test("the list sorts by them, most first", async () => {
    const order = (await list(league, { by: "seasonPoints", descending: true })).players.map((player) => player.code);
    const expected = [...(await pointsListed(league)).entries()].toSorted(([, one], [, other]) => other! - one!).map(([code]) => code);
    expect(order).toEqual(expected);
  });

  test("the two compared show the same figures as the list", async () => {
    const { t, leagueId } = league;
    const compared = await (await actingAs(t, ANN)).query(api.scouting.compare.players, { leagueId, codes: [SAKA.code, RICE.code] });
    const listed = await pointsListed(league);
    expect(compared.map((player) => player.seasonPoints)).toEqual([listed.get(SAKA.code), listed.get(RICE.code)]);
  });

  test("before the new season's first match, with only last season's priced, they are '—' (null)", async () => {
    await league.t.run(async (ctx) => {
      await ctx.db.insert("fixtures", { ...fixture(9, 1), kickoff: KICKOFF + 52 * WEEK_MS });
    });
    expect([...(await pointsListed(league)).values()].every((points) => points === null)).toBe(true);
  });
});

test("before any of his matches is priced, a player's are '—' (null)", async () => {
  expect([...(await pointsListed(league)).values()].every((points) => points === null)).toBe(true);
});

test("each match is priced under the site's set in force in its gameweek: a patch from gameweek 2 prices only gameweek 2 by it", async () => {
  const PATCHED: ScoringSet = {
    ...EXAMPLE_SET,
    rules: EXAMPLE_SET.rules.map((rule) => (rule.stat === "goals_scored" ? { ...rule, values: { all: 9 } } : rule)),
  } as ScoringSet;
  await league.t.run((ctx) => holdSiteScoring(ctx, { scoring: structuredClone(PATCHED) as StoredScoringSet, kind: "fix", season: 2026, number: 1, at: GW2.kickoff }));
  await refresh(league);

  expect(at(SAKA_GW2, "W", PATCHED)).not.toBe(at(SAKA_GW2, "W"));
  expect(await sakaPoints()).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W", PATCHED)));
  expect(await sakaPoints()).toBe(await cardTotal(SAKA.code));
});

test("rebuild sets every player's row afresh, however wrong, paging through, and again changes nothing", async () => {
  const { t } = league;
  await t.run(async (ctx) => {
    // More than a page of players with nothing priced, so the rebuild runs on to the next page.
    for (let count = 0; count < REBUILD_PAGE; count += 1) {
      await ctx.db.insert("players", { code: 60_000 + count, name: `P${count}`, fullName: `Player ${count}`, clubCode: CHELSEA.code });
    }
  });
  await refresh(league);
  const right = await pointsListed(league);
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("playerSeasonPoints").collect();
    await ctx.db.patch("playerSeasonPoints", rows[0]._id, { points: { W: 99, CB: 99, CAM: 99 } });
    await ctx.db.delete("playerSeasonPoints", rows[1]._id);
  });

  for (let run = 0; run < 2; run += 1) {
    await t.mutation(internal.stats.seasonPoints.rebuild, { cursor: null });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await pointsListed(league)).toEqual(right);
  }
});
