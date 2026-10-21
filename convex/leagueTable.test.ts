import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { refusals } from "./leagueAccess";
import { expectRefused, rulesWith } from "./leagueRules.harness";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "./leagues.harness";
import { fakeResend, resetSignInDeployment, signInDeployment } from "./signIn.harness";
import { GAMEWEEKS } from "./usedGameweeks";

// The league's fixtures and table (#33), read from its teams, the gameweeks it plays and its
// rules, by anyone with a part in it. No matchup is scored yet, so the table is all noughts.

const [ANN, BOB, CAT, DAN] = MANAGERS;
const STRANGER = "stranger@example.com";

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
});
afterEach(resetSignInDeployment);

const read = async (email = ANN) => (await actingAs(t, email)).query(api.leagueTable.ofLeague, { leagueId });
const changeRules = async (change: Parameters<typeof rulesWith>[0]) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.leagueRules.change, { leagueId, rules: rulesWith(change) });

describe("who may read it", () => {
  beforeEach(() => addManagers(t, leagueId, [ANN, BOB]));

  test.each([ANN, COMMISSIONER, ADMIN])("%s, with a part in the league or the admin, may", async (email) => {
    expect((await read(email))?.table).toHaveLength(2);
  });

  test("anyone else is refused", async () => {
    await expectRefused(read(STRANGER), refusals.notInLeague);
  });
});

describe("the fixtures", () => {
  test("three teams' round robin has three rounds, every gameweek the league plays has fixtures, and the team left over plays the league's average by default", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT]);
    const league = await read();

    expect(league?.roundRobinRounds).toBe(3);
    expect(league?.gameweeks).toHaveLength(GAMEWEEKS);
    const [first] = league!.gameweeks;
    expect(first.fixtures.map((fixture) => fixture.opponent === null)).toEqual([false, true]);
    expect(first.byes).toEqual([]);
  });

  test("with byes, the team left over plays nobody", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT]);
    await changeRules({ oddTeamOut: "bye" });
    const [first] = (await read())!.gameweeks;
    expect(first.fixtures).toHaveLength(1);
    expect(first.byes).toHaveLength(1);
    expect([first.fixtures[0].team, first.fixtures[0].opponent, first.byes[0]].toSorted()).toEqual(["Team 1", "Team 2", "Team 3"]);
  });

  test("with two games a gameweek, each team plays two every gameweek", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
    await changeRules({ gamesPerGameweek: 2 });
    for (const { fixtures } of (await read())!.gameweeks) {
      const named = fixtures.flatMap(({ team, opponent }) => [team, opponent]);
      expect(["Team 1", "Team 2", "Team 3", "Team 4"].map((team) => named.filter((each) => each === team).length)).toEqual([2, 2, 2, 2]);
    }
  });

  test("are the same on every read, drawn from the league's own seed", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT]);
    const otherLeague = await adminCreatesLeague(t, 4, "Other");
    await addManagers(t, otherLeague, [ANN, BOB, CAT]);
    const readOther = async () => (await actingAs(t, ANN)).query(api.leagueTable.ofLeague, { leagueId: otherLeague });

    expect((await read())?.gameweeks).toEqual((await read())?.gameweeks);
    expect((await readOther())?.gameweeks).not.toEqual((await read())?.gameweeks);
  });

  test("a gameweek the league doesn't play has none, and each gameweek carries FPL's deadline", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    await t.run(async (ctx) => {
      await ctx.db.patch("leagues", leagueId, { unusedGameweeks: [2] });
      await ctx.db.insert("gameweeks", { number: 3, deadline: 1234 });
    });
    const gameweeks = (await read())!.gameweeks;
    expect(gameweeks.map((each) => each.gameweek)).not.toContain(2);
    expect(gameweeks.find((each) => each.gameweek === 3)?.deadline).toBe(1234);
  });

  test("a league of one team has none", async () => {
    await addManagers(t, leagueId, [ANN]);
    expect(await read()).toMatchObject({ roundRobinRounds: 0, gameweeks: [] });
  });

  test("a total-points league has none", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    await changeRules({ format: "totalPoints" });
    expect(await read()).toMatchObject({ format: "totalPoints", roundRobinRounds: 0, gameweeks: [] });
  });
});

test("the table has every team on nothing, in the order they were made, until matchups are scored", async () => {
  const [annTeam, bobTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  const nothing = { played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, difference: 0, points: 0 };
  expect((await read())?.table).toEqual([
    { teamId: annTeam, teamName: "Team 1", ...nothing },
    { teamId: bobTeam, teamName: "Team 2", ...nothing },
  ]);
});

test("a league made before rules were held has no fixtures or table to draw", async () => {
  await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    for await (const row of ctx.db.query("leagueRules")) await ctx.db.delete("leagueRules", row._id);
  });
  expect(await read()).toBeNull();
});
