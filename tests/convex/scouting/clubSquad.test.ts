import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { squadGroupOf, topScorersOf, type SquadPlayer } from "../../../convex/scouting/clubSquad";
import { inTenths } from "../../../convex/scoring/values";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTES_STAT, STARTS_STAT } from "../../../convex/stats/matchRecords";
import { ARSENAL, CHELSEA, insertLockedStatus, insertPlayers } from "../../support/convex/footballRows.harness";
import { actingAs, ANN, teamName } from "../../support/convex/leagues.harness";
import { keepEveryScoutingPlayer } from "../../support/convex/playersList.harness";
import {
  at,
  cardTotalOf,
  GW1,
  GW2,
  KICKOFF,
  PALMER,
  refresh,
  RICE,
  SAKA,
  SAKA_GW1,
  SAKA_GW2,
  seasonPointsLeague,
  type PointsLeague,
} from "../../support/convex/seasonPoints.harness";
import { expectRefused } from "../../support/convex/test.harness";

// A club page's Squad tab (#1937; spec/18 `S18.7`, `S18.8`, `S18.10`): Arsenal's current players,
// grouped GK, DEF, MID, AM, FWD, each with who holds him in the league, his season points as his
// card adds them up, his points in the last five finished gameweeks, his starts and minutes; and
// the club's top three scorers. Season points' league (seasonPoints.harness.ts): Ann holds Saka;
// Rice (CM, CB) goes on waivers here, and Raya, a keeper with no match, is a free agent.

const ARSENAL_KEEPER = { code: 1005, name: "Raya", fullName: "David Raya", clubCode: ARSENAL.code, positions: ["GK" as const] };

let league: PointsLeague;
beforeEach(async () => {
  league = await seasonPointsLeague();
  await league.t.run(async (ctx) => {
    await insertPlayers(ctx, [ARSENAL_KEEPER]);
    await ctx.db.insert("waiverPlayers", { leagueId: league.leagueId, playerCode: RICE.code, claimableFrom: KICKOFF });
    // Gameweeks 1 and 2 are read at full time; Saka started both.
    for (const { code } of [GW1, GW2]) await insertLockedStatus(ctx, code, KICKOFF);
    await ctx.db.insert("playerSeasonStats", { season: 2026, playerCode: SAKA.code, stats: { [MINUTES_STAT]: 154, [STARTS_STAT]: 2, appearances: 2 } });
  });
  await refresh(league, [SAKA.code, RICE.code, PALMER.code]);
  await keepEveryScoutingPlayer(league.t);
});

const clubSquadOf = async (clubCode = ARSENAL.code) => (await actingAs(league.t, ANN)).query(api.scouting.clubSquad.ofClub, { leagueId: league.leagueId, clubCode });
const squadRowOf = async (code: number) => (await clubSquadOf())!.players.find((player) => player.code === code)!;

test("every current player at the club, by group: GK, then DEF (Rice goes by CB, his first back to front), then AM", async () => {
  const { players } = (await clubSquadOf())!;
  expect(players.map(({ name, group }) => [name, group])).toEqual([
    ["Raya", "GK"],
    ["Rice", "DEF"],
    ["Saka", "AM"],
  ]);
});

test("each row says who holds him: an owner's team, Waivers, or a free agent", async () => {
  const ownerTeam = await league.t.run(async (ctx) => (await ctx.db.query("squadPlayers").first())!.teamId);
  expect(await squadRowOf(SAKA.code)).toMatchObject({ ownerTeamName: await teamName(league.t, ownerTeam), onWaivers: false });
  expect(await squadRowOf(RICE.code)).toMatchObject({ ownerTeamName: null, onWaivers: true });
  expect(await squadRowOf(ARSENAL_KEEPER.code)).toMatchObject({ ownerTeamName: null, onWaivers: false });
});

test("his season points are his card's in the league, and '—' (null) with none priced", async () => {
  for (const code of [SAKA.code, RICE.code]) expect((await squadRowOf(code)).seasonPoints).toBe(await cardTotalOf(league, code));
  expect((await squadRowOf(ARSENAL_KEEPER.code)).seasonPoints).toBeNull();
});

test("the last finished gameweeks are the same for every row, each his card's points there, '—' where he didn't play", async () => {
  const squad = (await clubSquadOf())!;
  expect(squad.gameweeks).toEqual([1, 2]);
  expect((await squadRowOf(SAKA.code)).lastGameweeks).toEqual([at(SAKA_GW1, "W"), at(SAKA_GW2, "W")]);
  expect((await squadRowOf(RICE.code)).lastGameweeks).toEqual([(await cardTotalOf(league, RICE.code)), null]);
  expect((await squadRowOf(ARSENAL_KEEPER.code)).lastGameweeks).toEqual([null, null]);
});

test("his season's starts and minutes, 0 for a player with none", async () => {
  expect(await squadRowOf(SAKA.code)).toMatchObject({ starts: 2, minutes: 154 });
  expect(await squadRowOf(ARSENAL_KEEPER.code)).toMatchObject({ starts: 0, minutes: 0 });
});

test("the top scorers are the club's most season points, a player with none left out", async () => {
  const saka = await cardTotalOf(league, SAKA.code);
  expect((await clubSquadOf())!.topScorers).toEqual(
    [
      { code: SAKA.code, name: "Saka", seasonPoints: saka },
      { code: RICE.code, name: "Rice", seasonPoints: await cardTotalOf(league, RICE.code) },
    ].toSorted((one, other) => other.seasonPoints - one.seasonPoints),
  );
  expect(saka).toBe(inTenths(at(SAKA_GW1, "W") + at(SAKA_GW2, "W")));
});

test("a club not in the Premier League now has no squad", async () => {
  await league.t.run(async (ctx) => {
    const chelsea = (await ctx.db.query("clubs").withIndex("by_code", (q) => q.eq("code", CHELSEA.code)).unique())!;
    await ctx.db.patch("clubs", chelsea._id, { droppedAt: KICKOFF });
  });
  expect(await clubSquadOf(CHELSEA.code)).toBeNull();
  expect(await clubSquadOf(999)).toBeNull();
});

test("someone not in the league is refused", async () => {
  await expectRefused((await actingAs(league.t, "stranger@example.com")).query(api.scouting.clubSquad.ofClub, { leagueId: league.leagueId, clubCode: ARSENAL.code }), refusals.notInLeague);
});

describe("the groups", () => {
  test.each([
    [["GK"], "GK"],
    [["CB", "CDM"], "DEF"],
    [["WB"], "DEF"],
    [["CM"], "MID"],
    [["W", "ST"], "AM"],
    [["CAM"], "AM"],
    [["SS"], "FWD"],
    [["ST"], "FWD"],
    [[], null],
  ] as const)("%j goes in %s", (positions, group) => {
    expect(squadGroupOf(positions)).toBe(group);
  });
});

describe("the top scorers", () => {
  const row = (code: number, name: string, seasonPoints: number | null) =>
    ({ code, name, seasonPoints }) as SquadPlayer;

  test("a tie goes to points per game, and only three are named", () => {
    const rows = [row(1, "Aaa", 20), row(2, "Bbb", 30), row(3, "Ccc", 30), row(4, "Ddd", 10), row(5, "Eee", null)];
    const appearances = new Map([[1, 4], [2, 6], [3, 5], [4, 1]]);
    expect(topScorersOf(rows, (code) => appearances.get(code)!).map(({ name }) => name)).toEqual(["Ccc", "Bbb", "Aaa"]);
  });
});
