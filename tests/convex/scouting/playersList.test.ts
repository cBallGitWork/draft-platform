import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Position } from "../../../convex/positions/positionTables";
import {
  LISTED_PLAYERS_MOST,
  type ListedPlayer,
  type PlayersFilters,
  type PlayersSort,
} from "../../../convex/scouting/playersList";
import { listOf } from "../../../convex/scouting/playersOrder";
import { PL_SEASON_START_YEAR } from "../../../convex/football/football";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SEASON_PLAYERS_MOST } from "../../../convex/stats/matchRecords";
import { CLUB_PLAYERS_MOST } from "../../../convex/shared/players";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, teamName, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, GONE, SAKA, insertClubs, insertDroppedPlayer, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Scouting's players list (#373, spec/19 The players list): every Premier League player now, for
// anyone in the league, filtered by who holds him, his position and his club, and sorted, on the
// server. Season points are "—" (null) here, with no match priced; what they add up to is
// tests/convex/stats/seasonPoints.test.ts's.

const [ANN, BOB] = MANAGERS;
const BRENTFORD = { code: 94, name: "Brentford", shortName: "BRE" };

const RICE = { code: 1002, name: "Rice", fullName: "Declan Rice", clubCode: ARSENAL.code, positions: ["CDM", "CM"] as Position[] };
const MBEUMO = { code: 1003, name: "Mbeumo", fullName: "Bryan Mbeumo", clubCode: BRENTFORD.code, positions: ["W", "ST"] as Position[] };
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM"] as Position[] };

const ALL: PlayersFilters = { availability: "all", position: null, clubCode: null };
const BY_NAME: PlayersSort = { by: "name", descending: false };

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [CHELSEA, ARSENAL, BRENTFORD]);
    await insertPlayers(ctx, [SAKA, RICE, MBEUMO, PALMER]);
    await insertDroppedPlayer(ctx, GONE, Date.now());
    // Saka is Ann's and Palmer Bob's.
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[1], playerCode: PALMER.code });
  });
});

const listAs = async (email: string, filters: Partial<PlayersFilters> = {}, sort: PlayersSort = BY_NAME, stat: string | null = null) =>
  (await actingAs(t, email)).query(api.scouting.playersList.list, { leagueId, filters: { ...ALL, ...filters }, sort, stat });
const namesListed = async (filters: Partial<PlayersFilters> = {}, sort: PlayersSort = BY_NAME) =>
  (await listAs(ANN, filters, sort)).players.map((player) => player.name);

test("every Premier League player now is listed, with his club, positions and owner; one who has left is not", async () => {
  const { players } = await listAs(ANN);
  expect(players.map((player) => player.name)).toEqual(["Mbeumo", "Palmer", "Rice", "Saka"]);
  expect(players.find((player) => player.code === SAKA.code)).toEqual({
    code: SAKA.code,
    name: "Saka",
    fullName: "Bukayo Saka",
    club: ARSENAL,
    positions: ["W"],
    ownerTeamName: await teamName(t, teams[0]),
    seasonPoints: null,
    stat: null,
  });
  expect(players.find((player) => player.code === RICE.code)?.ownerTeamName).toBeNull();
});

test("the club filter's clubs are every club now, by name", async () => {
  expect((await listAs(ANN)).clubs).toEqual([ARSENAL, BRENTFORD, CHELSEA]);
});

test("season points are null, shown as '—', while none of a player's matches is priced", async () => {
  expect((await listAs(ANN)).players.every((player) => player.seasonPoints === null)).toBe(true);
});

describe("the filters", () => {
  test.each([
    ["all", ["Mbeumo", "Palmer", "Rice", "Saka"]],
    ["freeAgents", ["Mbeumo", "Rice"]],
    ["owned", ["Palmer", "Saka"]],
    ["onWaivers", []],
  ] as const)("by who holds him: %s", async (availability, names) => {
    expect(await namesListed({ availability })).toEqual(names);
  });

  test("by position: a player with it among his positions", async () => {
    expect(await namesListed({ position: "W" })).toEqual(["Mbeumo", "Saka"]);
    expect(await namesListed({ position: "CM" })).toEqual(["Rice"]);
    expect(await namesListed({ position: "GK" })).toEqual([]);
  });

  test("by club", async () => {
    expect(await namesListed({ clubCode: ARSENAL.code })).toEqual(["Rice", "Saka"]);
  });

  test("together: Arsenal's free agents who play CDM", async () => {
    expect(await namesListed({ availability: "freeAgents", clubCode: ARSENAL.code, position: "CDM" })).toEqual(["Rice"]);
    expect(await namesListed({ availability: "owned", clubCode: BRENTFORD.code })).toEqual([]);
  });

  test("a player owned in another league is a free agent in this one", async () => {
    const otherLeague = await adminCreatesLeague(t, 4, "Another league");
    const [otherTeam] = await addManagers(t, otherLeague, [MANAGERS[2]]);
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId: otherLeague, teamId: otherTeam, playerCode: RICE.code }));
    expect(await namesListed({ availability: "freeAgents" })).toEqual(["Mbeumo", "Rice"]);
  });
});

describe("the sort", () => {
  test("by name, either way", async () => {
    expect(await namesListed({}, { by: "name", descending: true })).toEqual(["Saka", "Rice", "Palmer", "Mbeumo"]);
  });

  test("by club, then by name within one", async () => {
    expect(await namesListed({}, { by: "club", descending: false })).toEqual(["Rice", "Saka", "Mbeumo", "Palmer"]);
    expect(await namesListed({}, { by: "club", descending: true })).toEqual(["Palmer", "Mbeumo", "Rice", "Saka"]);
  });

  test("by season points, all null before scoring, falls back to the name", async () => {
    expect(await namesListed({}, { by: "seasonPoints", descending: true })).toEqual(["Mbeumo", "Palmer", "Rice", "Saka"]);
  });
});

describe("sorting by a figure", () => {
  const withPoints = (name: string, code: number, seasonPoints: number | null): ListedPlayer => ({
    code,
    name,
    fullName: name,
    club: ARSENAL,
    positions: [],
    ownerTeamName: null,
    seasonPoints,
    stat: null,
  });
  const players = [withPoints("Ann", 1, 4), withPoints("Bea", 2, null), withPoints("Cal", 3, 12), withPoints("Dee", 4, 4)];
  const order = (descending: boolean) => listOf(players, ALL, { by: "seasonPoints", descending }).map((player) => player.name);

  test("most first, a tie by name, a null last", () => {
    expect(order(true)).toEqual(["Cal", "Ann", "Dee", "Bea"]);
  });

  test("fewest first, and a null still last", () => {
    expect(order(false)).toEqual(["Ann", "Dee", "Cal", "Bea"]);
  });
});

describe("any stat, as a season total (spec/19, sortable by any stat)", () => {
  const THIS_SEASON = PL_SEASON_START_YEAR;
  // Saka and Mbeumo have goals this season, Palmer more last season, and Rice no totals at all.
  beforeEach(() =>
    t.run(async (ctx) => {
      await ctx.db.insert("playerSeasonStats", { season: THIS_SEASON, playerCode: SAKA.code, stats: { goals_scored: 3, expected_goals: 2.5 } });
      await ctx.db.insert("playerSeasonStats", { season: THIS_SEASON, playerCode: MBEUMO.code, stats: { goals_scored: 5, expected_goals: 1.25 } });
      await ctx.db.insert("playerSeasonStats", { season: THIS_SEASON, playerCode: PALMER.code, stats: { expected_goals: 0.5 } });
      await ctx.db.insert("playerSeasonStats", { season: THIS_SEASON - 1, playerCode: PALMER.code, stats: { goals_scored: 22 } });
    }),
  );
  const totalsListed = async (stat: string, sort: PlayersSort = { by: "stat", descending: true }, filters: Partial<PlayersFilters> = {}) =>
    (await listAs(ANN, filters, sort, stat)).players.map((player) => [player.name, player.stat]);

  test("each player has this season's total of the shown stat, 0 with none held, sorted the most first", async () => {
    expect(await totalsListed("goals_scored")).toEqual([
      ["Mbeumo", 5],
      ["Saka", 3],
      ["Palmer", 0],
      ["Rice", 0],
    ]);
  });

  test("the fewest first, ties by name", async () => {
    expect(await totalsListed("expected_goals", { by: "stat", descending: false })).toEqual([
      ["Rice", 0],
      ["Palmer", 0.5],
      ["Mbeumo", 1.25],
      ["Saka", 2.5],
    ]);
  });

  test("shown while another column sorts, and with the filters", async () => {
    expect(await totalsListed("goals_scored", BY_NAME, { clubCode: ARSENAL.code })).toEqual([
      ["Rice", 0],
      ["Saka", 3],
    ]);
  });

  test("before the new season's first match, last season's totals are shown (#647)", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("playerSeasonStats").collect()) {
        if (row.season === THIS_SEASON) await ctx.db.delete("playerSeasonStats", row._id);
      }
    });
    expect(await totalsListed("goals_scored")).toEqual([
      ["Palmer", 22],
      ["Mbeumo", 0],
      ["Rice", 0],
      ["Saka", 0],
    ]);
  });

  test("with no totals held in any season, every player's total is 0", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("playerSeasonStats").collect()) await ctx.db.delete("playerSeasonStats", row._id);
    });
    expect((await totalsListed("goals_scored")).every(([, total]) => total === 0)).toBe(true);
  });

  test("with no stat shown, no player has one", async () => {
    expect((await listAs(ANN)).players.every((player) => player.stat === null)).toBe(true);
  });

  test("a stat the catalogue doesn't hold is refused", async () => {
    await expect(listAs(ANN, {}, BY_NAME, "not_a_stat")).rejects.toThrow("No stat not_a_stat is in the catalogue");
  });

  test("a sort by the stat with none shown is refused", async () => {
    await expect(listAs(ANN, {}, { by: "stat", descending: true })).rejects.toThrow("with none shown");
  });

  test(`more than ${SEASON_PLAYERS_MOST} players with totals in a season throws, never a silent cut`, async () => {
    await t.run(async (ctx) => {
      for (let code = 0; code < SEASON_PLAYERS_MOST; code += 1) {
        await ctx.db.insert("playerSeasonStats", { season: THIS_SEASON, playerCode: 50_000 + code, stats: {} });
      }
    });
    await expect(listAs(ANN, {}, BY_NAME, "goals_scored")).rejects.toThrow(`More than ${SEASON_PLAYERS_MOST} players have totals`);
  });
});

describe("who may read it", () => {
  test("a commissioner running no team reads it", async () => {
    expect((await listAs(COMMISSIONER)).players).toHaveLength(4);
  });

  test("someone not in the league is refused", async () => {
    await expectRefused(listAs(MANAGERS[3]), refusals.notInLeague);
  });
});

test(`more than ${LISTED_PLAYERS_MOST} current players throws, never a silent cut`, async () => {
  const clubsNeeded = Math.ceil((LISTED_PLAYERS_MOST + 1) / CLUB_PLAYERS_MOST);
  await t.run(async (ctx) => {
    let code = 10_000;
    for (let club = 0; club < clubsNeeded; club += 1) {
      const clubCode = 500 + club;
      await ctx.db.insert("clubs", { code: clubCode, name: `Club ${club}`, shortName: `C${club}` });
      for (let each = 0; each < CLUB_PLAYERS_MOST; each += 1) {
        code += 1;
        await ctx.db.insert("players", { code, name: `P${code}`, fullName: `Player ${code}`, clubCode });
      }
    }
  });
  await expect(listAs(ANN)).rejects.toThrow(`More than ${LISTED_PLAYERS_MOST} players`);
});
