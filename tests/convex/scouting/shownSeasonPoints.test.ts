import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { POSITIONS } from "../../../convex/positions/positionTables";
import { COMMISSIONER, actingAs } from "../../support/convex/leagues.harness";
import {
  ANN,
  GW1,
  KICKOFF,
  PALMER,
  RICE,
  SAKA,
  list,
  pointsListed,
  refresh,
  seasonPointsLeague,
  type PointsLeague,
} from "../../support/convex/seasonPoints.harness";

// Scouting's season points before the new season's first match (spec/19; #956): last season's,
// under the site's scoring as it stands (pastSeasons/pastSeasonPoints.ts prices them), at his main
// position now, with no league's overrides; a newcomer not in last season's data is "—" (null),
// sorted below every figure; and the list names the season they are from, for "Pts 25/26" (Craig,
// 6 Nov 2026). The harness holds 2026/27's matches, none priced until `refresh`.

const LAST_SEASON = 2025;
/** The same points at every position. */
const everywhere = (points: number) => Object.fromEntries(POSITIONS.map((position) => [position, points]));

let league: PointsLeague;
beforeEach(async () => {
  league = await seasonPointsLeague();
  // Saka was on 0 at every position, Rice is a CB now (his card opens there); Palmer is a newcomer.
  await league.t.run(async (ctx) => {
    await ctx.db.insert("pastSeasonPoints", { season: LAST_SEASON, playerCode: SAKA.code, points: everywhere(0) });
    await ctx.db.insert("pastSeasonPoints", { season: LAST_SEASON, playerCode: RICE.code, points: { ...everywhere(150), CB: 180 } });
  });
});

test("before the first match is priced, each player's points are last season's at his main position now, null for a newcomer", async () => {
  expect(Object.fromEntries(await pointsListed(league))).toEqual({ [SAKA.code]: 0, [RICE.code]: 180, [PALMER.code]: null });
  expect((await list(league)).pointsSeason).toBe(LAST_SEASON);
});

test("sorted by points, a newcomer goes below every figure, 0 included, either way", async () => {
  const names = async (descending: boolean) => (await list(league, { by: "seasonPoints", descending })).players.map((player) => player.name);
  expect(await names(true)).toEqual(["Rice", "Saka", "Palmer"]);
  expect(await names(false)).toEqual(["Saka", "Rice", "Palmer"]);
});

test("a league's override doesn't count in last season's points: every league sees the same figure", async () => {
  await league.t.run(async (ctx) => {
    await ctx.db.insert("pointsOverrides", {
      leagueId: league.leagueId,
      gameweek: GW1.gameweek,
      fixtureCode: GW1.code,
      playerCode: RICE.code,
      points: 20,
      reason: "The feed was wrong",
      by: COMMISSIONER,
      at: KICKOFF,
    });
  });
  expect((await pointsListed(league)).get(RICE.code)).toBe(180);
});

test("once the new season's first match is priced, they are this season's, and the list no longer names a season", async () => {
  await refresh(league);
  const points = await pointsListed(league);
  expect(points.get(RICE.code)).not.toBe(180);
  expect(points.get(RICE.code)).not.toBeNull();
  expect((await list(league)).pointsSeason).toBeNull();
});

test("with no past season priced, the list shows this season's, all null before the first match", async () => {
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("pastSeasonPoints").collect()) await ctx.db.delete("pastSeasonPoints", row._id);
  });
  expect([...(await pointsListed(league)).values()].every((points) => points === null)).toBe(true);
  expect((await list(league)).pointsSeason).toBeNull();
});

test("compare shows the same last-season figures", async () => {
  const compared = await (await actingAs(league.t, ANN)).query(api.scouting.compare.players, {
    leagueId: league.leagueId,
    codes: [RICE.code, PALMER.code],
  });
  expect(compared.map((player) => player.seasonPoints)).toEqual([180, null]);
});
