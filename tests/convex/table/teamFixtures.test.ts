import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { expectRefused, holdGameweeks, rulesRevision, rulesWith } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// My team's Fixtures tab (#365): the caller's team's head-to-head games for the season, in
// gameweek order, from the schedule the table and fixtures screen reads. No matchup is scored yet
// (#29), so every game is a fixture.

const [ANN, BOB, CAT, DAN] = MANAGERS;
const STRANGER = "stranger@example.com";

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
});

const readOf = async (league: Id<"leagues">, email = ANN) => (await actingAs(t, email)).query(api.table.teamFixtures.ofMyTeam, { leagueId: league });
const read = (email = ANN) => readOf(leagueId, email);
const readTable = async () => (await actingAs(t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId });
const changeRules = async (change: Parameters<typeof rulesWith>[0]) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: rulesWith(change), revision: await rulesRevision(t, leagueId) });
type Games = NonNullable<Awaited<ReturnType<typeof read>>>["games"];
/** Who a game is against: the team's name, "leagueAverage" or "bye". */
const opponentOf = ({ against }: Games[number]) => (against.kind === "team" ? against.teamName : against.kind);
/** Each game as a line: "3 Team 2", "4 leagueAverage", "5 bye". */
const lines = (games: Games) => games.map((game) => `${game.gameweek} ${opponentOf(game)}`);

describe("who may read it", () => {
  beforeEach(() => addManagers(t, leagueId, [ANN, BOB]));

  test("a manager reads his own team's", async () => {
    expect((await read())?.teamName).toBe("Team 1");
    expect((await read(BOB))?.teamName).toBe("Team 2");
  });

  test.each([COMMISSIONER, STRANGER])("%s, running no team in it, is refused", async (email) => {
    await expectRefused(read(email), refusals.runsNoTeam);
  });
});

describe("the games", () => {
  test("are in gameweek order, one a gameweek, against the others and the league's average in turn", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT]);
    const { games, format } = (await read())!;

    expect(format).toBe("headToHead");
    expect(games.map(({ gameweek }) => gameweek)).toEqual(Array.from({ length: GAMEWEEKS }, (_, index) => index + 1));
    // Three teams' round robin has three rounds: Ann meets Bob, Cat and the league's average once each.
    expect(games.slice(0, 3).map(opponentOf).toSorted()).toEqual(["Team 2", "Team 3", "leagueAverage"]);
  });

  test("are the table's fixtures that hold the team, and none of another team's", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
    const table = (await readTable())!;
    const fromTable = table.gameweeks.flatMap(({ gameweek, fixtures }) =>
      fixtures.flatMap(({ team, opponent }) => (team === "Team 1" ? [`${gameweek} ${opponent}`] : opponent === "Team 1" ? [`${gameweek} ${team}`] : [])),
    );
    expect(lines((await read())!.games)).toEqual(fromTable);
  });

  test("carry each gameweek's deadline as the table's fixtures do", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    await holdGameweeks(t, { next: 1 });
    const deadlines = new Map((await readTable())!.gameweeks.map(({ gameweek, deadline }) => [gameweek, deadline]));
    const games = (await read())!.games;
    expect(games[0].deadline).not.toBeNull();
    for (const { gameweek, deadline } of games) expect(deadline).toBe(deadlines.get(gameweek));
  });

  test("with byes, the team sits one out instead of meeting the league's average", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT]);
    await changeRules({ oddTeamOut: "bye" });
    const kinds = (await read())!.games.slice(0, 3).map(({ against }) => against.kind);
    expect(kinds.toSorted()).toEqual(["bye", "team", "team"]);
  });

  test("with two games a gameweek, there are two in each", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
    await changeRules({ gamesPerGameweek: 2 });
    const games = (await read())!.games;
    expect(games).toHaveLength(2 * GAMEWEEKS);
    expect(new Set(games.map(({ gameweek }) => gameweek)).size).toBe(GAMEWEEKS);
  });

  test("a league made mid-season has none in the gameweeks begun before it existed (#282)", async () => {
    const played = 5;
    const kicksOffIn = 2 * HOUR_MS;
    const seasonStart = Date.now();
    await holdGameweeks(t, { next: 1, kicksOffIn });
    vi.setSystemTime(seasonStart + (played - 1) * WEEK_MS + kicksOffIn);
    const later = await adminCreatesLeague(t, 4, "Later");
    await addManagers(t, later, [ANN, BOB]);
    expect((await readOf(later))!.games[0].gameweek).toBe(played + 1);
  });

  test("none with one team, nor in total points", async () => {
    await addManagers(t, leagueId, [ANN]);
    expect((await read())!.games).toEqual([]);
    await addManagers(t, leagueId, [BOB]);
    await changeRules({ format: "totalPoints" });
    expect(await read()).toEqual({ teamName: "Team 1", format: "totalPoints", games: [] });
  });
});

test("a league made before rules were held has none to draw", async () => {
  await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    for await (const row of ctx.db.query("leagueRules")) await ctx.db.delete("leagueRules", row._id);
  });
  expect(await read()).toBeNull();
});
