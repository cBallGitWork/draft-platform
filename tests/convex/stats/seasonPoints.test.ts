import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pointsAt } from "../../../convex/playerCard/cardPoints";
import type { Position } from "../../../convex/positions/positionTables";
import type { PlayersSort } from "../../../convex/scouting/playersList";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { inTenths } from "../../../convex/scoring/values";
import { WEEK_MS } from "../../../convex/shared/time";
import { LEAGUE_OVERRIDES_MOST } from "../../../convex/stats/seasonPoints";
import { REBUILD_PAGE } from "../../../convex/stats/seasonStats";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, SAKA, completeRecord, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { ROWS_TO_THE_CAP } from "../../support/convex/test.harness";

// Each player's season points on Scouting (#525; spec/19, The players list: "with season points
// under the site's scoring"): his card's matches this season added up in the league, at his main
// position, the league's overrides in (Craig, 1 Nov 2026), owned or not. The site-wide part is kept
// a row a player and season, set afresh as his records are written; the site plays EXAMPLE_SET.

const [ANN] = MANAGERS;
/** Two positions in different areas, so they price a goal differently: his card opens on CB. */
const RICE = { code: 1002, name: "Rice", fullName: "Declan Rice", clubCode: ARSENAL.code, positions: ["CM", "CB"] as Position[] };
/** A free agent: his points show though no team holds him. */
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM"] as Position[] };

const KICKOFF = Date.parse("2026-08-22T14:00:00Z");
const fixture = (code: number, gameweek: number | null, dropped = false) => ({
  code,
  gameweek,
  homeClubCode: ARSENAL.code,
  awayClubCode: CHELSEA.code,
  kickoff: KICKOFF + code * WEEK_MS,
  ...(dropped ? { droppedAt: KICKOFF } : {}),
});
const GW1 = fixture(1, 1);
const GW2 = fixture(2, 2);
const GW3 = fixture(3, 3);
/** Last season's, which the feed no longer sends. */
const LAST_SEASON = { ...fixture(4, 30, true), kickoff: KICKOFF - 52 * WEEK_MS };

const SAKA_GW1 = { minutes: 90, goals_scored: 1 };
const SAKA_GW2 = { minutes: 64, goals_scored: 2, assists: 1 };
const RICE_GW1 = { minutes: 90, goals_scored: 1 };
const PALMER_GW1 = { minutes: 90, assists: 2 };

const record = (playerCode: number, fixtureCode: number, stats: Record<string, number>, pl = true) =>
  completeRecord(playerCode, fixtureCode, stats, { pl });

const BY_POINTS: PlayersSort = { by: "seasonPoints", descending: true };

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  const [annTeam] = await addManagers(t, leagueId, [ANN]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, RICE, PALMER]);
    for (const each of [GW1, GW2, GW3, LAST_SEASON]) await ctx.db.insert("fixtures", each);
    await holdSiteScoring(ctx, { scoring: structuredClone(EXAMPLE_SET) as StoredScoringSet, kind: "fix", season: 2025, number: 1, at: 0 });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: annTeam, playerCode: SAKA.code });
    for (const each of [
      record(SAKA.code, GW1.code, SAKA_GW1),
      record(SAKA.code, GW2.code, SAKA_GW2),
      record(SAKA.code, LAST_SEASON.code, { minutes: 90, goals_scored: 3 }),
      // Only FPL's part has arrived, so it isn't priced yet.
      record(SAKA.code, GW3.code, { minutes: 90, goals_scored: 4 }, false),
      record(RICE.code, GW1.code, RICE_GW1),
      record(PALMER.code, GW1.code, PALMER_GW1),
    ]) {
      await ctx.db.insert("playerMatchStats", each);
    }
  });
});

const ALL_CODES = [SAKA.code, RICE.code, PALMER.code];
const refresh = (playerCodes = ALL_CODES) => t.mutation(internal.stats.seasonPoints.refresh, { playerCodes });
const list = async (sort: PlayersSort = { by: "name", descending: false }, league = leagueId) =>
  (await actingAs(t, ANN)).query(api.scouting.playersList.list, {
    leagueId: league,
    filters: { availability: "all", position: null, clubCode: null },
    sort,
    stat: null,
  });
const pointsListed = async (league = leagueId) => new Map((await list(undefined, league)).players.map((player) => [player.code, player.seasonPoints]));
/** His points in a match under EXAMPLE_SET at `position`. */
const at = (stats: Record<string, number>, position: "W" | "CB" | "CM" | "CAM") => pointsAt(stats, EXAMPLE_SET, position).total!;

/** His card's matches added up as Scouting adds them: each at the card's first position, or the
 *  league's override. */
async function cardTotal(playerCode: number) {
  const card = (await (await actingAs(t, ANN)).query(api.playerCard.playerCard.card, { leagueId, playerCode, now: KICKOFF }))!;
  return inTenths(card.matches.reduce((total, match) => total + (match.override?.points ?? match.points[0].total ?? 0), 0));
}

const overrides = (playerCode: number, { code: fixtureCode, gameweek }: { code: number; gameweek: number | null }, points: number, league = leagueId) =>
  t.run(async (ctx) => {
    await ctx.db.insert("pointsOverrides", { leagueId: league, gameweek: gameweek!, fixtureCode, playerCode, points, reason: "The feed was wrong", by: COMMISSIONER, at: KICKOFF });
  });

describe("what a player's season points are", () => {
  beforeEach(() => refresh());

  test("his card's matches this season added up: not last season's, not one whose record isn't whole", async () => {
    const points = await pointsListed();
    expect(points.get(SAKA.code)).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
    expect(points.get(SAKA.code)).toBe(await cardTotal(SAKA.code));
  });

  test("a player with more than one position is priced at his main one, where his card opens", async () => {
    expect(at(RICE_GW1, "CB")).not.toBe(at(RICE_GW1, "CM"));
    expect((await pointsListed()).get(RICE.code)).toBe(at(RICE_GW1, "CB"));
    expect((await pointsListed()).get(RICE.code)).toBe(await cardTotal(RICE.code));
  });

  test("a free agent's show as an owned player's do", async () => {
    expect((await pointsListed()).get(PALMER.code)).toBe(at(PALMER_GW1, "CAM"));
  });

  test("the league's override takes the match's place; another league's doesn't count", async () => {
    const OVERRIDDEN = 20;
    const otherLeague = await adminCreatesLeague(t);
    await overrides(SAKA.code, GW1, OVERRIDDEN);
    await overrides(SAKA.code, GW2, 0, otherLeague);

    expect((await pointsListed()).get(SAKA.code)).toBe(inTenths(OVERRIDDEN + at(SAKA_GW2, "W")));
    expect((await pointsListed()).get(SAKA.code)).toBe(await cardTotal(SAKA.code));
  });

  test("an override of last season's match changes nothing", async () => {
    await overrides(SAKA.code, LAST_SEASON, 99);
    expect((await pointsListed()).get(SAKA.code)).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
  });

  test("the list sorts by them, most first", async () => {
    const order = (await list(BY_POINTS)).players.map((player) => player.code);
    const expected = [...(await pointsListed()).entries()].toSorted(([, one], [, other]) => other! - one!).map(([code]) => code);
    expect(order).toEqual(expected);
  });

  test("the two compared show the same figures as the list", async () => {
    const compared = await (await actingAs(t, ANN)).query(api.scouting.compare.players, { leagueId, codes: [SAKA.code, RICE.code] });
    const listed = await pointsListed();
    expect(compared.map((player) => player.seasonPoints)).toEqual([listed.get(SAKA.code), listed.get(RICE.code)]);
  });

  test("before the new season's first match, with only last season's priced, they are '—' (null)", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("fixtures", { ...fixture(9, 1), kickoff: KICKOFF + 52 * WEEK_MS });
    });
    expect([...(await pointsListed()).values()].every((points) => points === null)).toBe(true);
  });

  test(`more than ${LEAGUE_OVERRIDES_MOST} overrides in a league throws, never a silent cut`, ROWS_TO_THE_CAP, async () => {
    await t.run(async (ctx) => {
      for (let count = 0; count < LEAGUE_OVERRIDES_MOST; count += 1) {
        await ctx.db.insert("pointsOverrides", { leagueId, gameweek: 1, fixtureCode: GW1.code, playerCode: 50_000 + count, points: 1, reason: "r", by: COMMISSIONER, at: 0 });
      }
    });
    await list();
    await overrides(SAKA.code, GW2, 1);
    await expect(list()).rejects.toThrow(`holds more than ${LEAGUE_OVERRIDES_MOST} overrides`);
  });
});

test("before any of his matches is priced, a player's are '—' (null)", async () => {
  expect([...(await pointsListed()).values()].every((points) => points === null)).toBe(true);
});

describe("kept as records are written", () => {
  const { state: _state, ...sakaGw3 } = record(SAKA.code, GW3.code, { minutes: 90, goals_scored: 4 });
  const writeLive = async (records: (typeof sakaGw3)[]) => {
    await t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode: GW3.code, minute: null, records });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  };

  test("a record made whole re-prices his season; one still waiting on a feed leaves it be", async () => {
    await refresh();
    const before = (await pointsListed()).get(SAKA.code)!;

    await writeLive([{ ...sakaGw3, arrived: { fpl: true, pl: false }, stats: { minutes: 90, goals_scored: 5 } }]);
    expect((await pointsListed()).get(SAKA.code)).toBe(before);

    await writeLive([sakaGw3]);
    expect((await pointsListed()).get(SAKA.code)).toBe(inTenths(before + at(sakaGw3.stats, "W")));
  });

  test("a correction re-prices it: a goal taken away comes off", async () => {
    await writeLive([sakaGw3]);
    await refresh();
    const withGoals = (await pointsListed()).get(SAKA.code)!;

    await writeLive([{ ...sakaGw3, stats: { minutes: 90, goals_scored: 3 } }]);

    expect((await pointsListed()).get(SAKA.code)).toBe(inTenths(withGoals - at({ goals_scored: 1 }, "W")));
  });
});

test("rebuild sets every player's row afresh, however wrong, paging through, and again changes nothing", async () => {
  await t.run(async (ctx) => {
    // More than a page of players with nothing priced, so the rebuild runs on to the next page.
    for (let count = 0; count < REBUILD_PAGE; count += 1) {
      await ctx.db.insert("players", { code: 60_000 + count, name: `P${count}`, fullName: `Player ${count}`, clubCode: CHELSEA.code });
    }
  });
  await refresh();
  const right = await pointsListed();
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("playerSeasonPoints").collect();
    await ctx.db.patch("playerSeasonPoints", rows[0]._id, { points: { W: 99, CB: 99, CAM: 99 } });
    await ctx.db.delete("playerSeasonPoints", rows[1]._id);
  });

  for (let run = 0; run < 2; run += 1) {
    await t.mutation(internal.stats.seasonPoints.rebuild, { cursor: null });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await pointsListed()).toEqual(right);
  }
});
