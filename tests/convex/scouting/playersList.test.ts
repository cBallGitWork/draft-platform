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
import { refusals } from "../../../convex/shared/leagueAccess";
import { CLUB_PLAYERS_MOST } from "../../../convex/shared/players";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Scouting's players list (#373, spec/19 The players list): every Premier League player now, for
// anyone in the league, filtered by who holds him, his position and his club, and sorted, on the
// server. Season points are "—" (null) until matches are scored (#29).

const [ANN, BOB] = MANAGERS;
const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
const BRENTFORD = { code: 94, name: "Brentford", shortName: "BRE" };
const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };

const SAKA = { code: 1001, name: "Saka", fullName: "Bukayo Saka", clubCode: ARSENAL.code, positions: ["W"] as Position[] };
const RICE = { code: 1002, name: "Rice", fullName: "Declan Rice", clubCode: ARSENAL.code, positions: ["CDM", "CM"] as Position[] };
const MBEUMO = { code: 1003, name: "Mbeumo", fullName: "Bryan Mbeumo", clubCode: BRENTFORD.code, positions: ["W", "ST"] as Position[] };
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM"] as Position[] };
const GONE = { code: 2001, name: "Gone", fullName: "Long Gone", clubCode: ARSENAL.code, positions: [] as Position[] };

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
    for (const club of [CHELSEA, ARSENAL, BRENTFORD]) await ctx.db.insert("clubs", club);
    for (const { positions, ...player } of [SAKA, RICE, MBEUMO, PALMER]) {
      await ctx.db.insert("players", player);
      await ctx.db.insert("playerPositions", { code: player.code, starts: [], approved: [], set: positions, removed: [] });
    }
    const { positions: _none, ...gone } = GONE;
    await ctx.db.insert("players", { ...gone, droppedAt: Date.now() });
    // Saka is Ann's and Palmer Bob's.
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[1], playerCode: PALMER.code });
  });
});

const listAs = async (email: string, filters: Partial<PlayersFilters> = {}, sort: PlayersSort = BY_NAME) =>
  (await actingAs(t, email)).query(api.scouting.playersList.list, { leagueId, filters: { ...ALL, ...filters }, sort });
const namesListed = async (filters: Partial<PlayersFilters> = {}, sort: PlayersSort = BY_NAME) =>
  (await listAs(ANN, filters, sort)).players.map((player) => player.name);
const teamName = (teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.get("teams", teamId))!.name);

test("every Premier League player now is listed, with his club, positions and owner; one who has left is not", async () => {
  const { players } = await listAs(ANN);
  expect(players.map((player) => player.name)).toEqual(["Mbeumo", "Palmer", "Rice", "Saka"]);
  expect(players.find((player) => player.code === SAKA.code)).toEqual({
    code: SAKA.code,
    name: "Saka",
    fullName: "Bukayo Saka",
    club: ARSENAL,
    positions: ["W"],
    ownerTeamName: await teamName(teams[0]),
    seasonPoints: null,
  });
  expect(players.find((player) => player.code === RICE.code)?.ownerTeamName).toBeNull();
});

test("the club filter's clubs are every club now, by name", async () => {
  expect((await listAs(ANN)).clubs).toEqual([ARSENAL, BRENTFORD, CHELSEA]);
});

test("season points are null, shown as '—', until matches are scored (#29)", async () => {
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

describe("who may read it", () => {
  test("a commissioner running no team reads it", async () => {
    expect((await listAs(COMMISSIONER)).players).toHaveLength(4);
  });

  test("someone not in the league is refused", async () => {
    await expect(listAs(MANAGERS[3])).rejects.toThrow(refusals.notInLeague);
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
