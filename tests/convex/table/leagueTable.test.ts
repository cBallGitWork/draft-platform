import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused, giveDeadlineRule, holdGameweeks, KICKS_OFF_IN, moveFplDeadline, rulesWith } from "../../support/convex/leagueRules.harness";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { FIRST_RULES } from "../../../convex/rules/firstRules";

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

const read = async (email = ANN) => (await actingAs(t, email)).query(api.table.leagueTable.ofLeague, { leagueId });
const changeRules = async (change: Parameters<typeof rulesWith>[0]) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: rulesWith(change) });

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
    const readOther = async () => (await actingAs(t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId: otherLeague });

    expect((await read())?.gameweeks).toEqual((await read())?.gameweeks);
    expect((await readOther())?.gameweeks).not.toEqual((await read())?.gameweeks);
  });

  test("a gameweek the league doesn't play has none", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    await t.run(async (ctx) => {
      await ctx.db.patch("leagues", leagueId, { unusedGameweeks: [2] });
    });
    const gameweeks = (await read())!.gameweeks;
    expect(gameweeks.map((each) => each.gameweek)).not.toContain(2);
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

// Each gameweek carries the league's own deadline, and the fixtures open on the first it hasn't
// locked (#139): never FPL's (Craig, 22 Oct 2026: "ours, we arent fpl so stop copying them").
describe("each gameweek's deadline", () => {
  /** The first rules' deadline: 90 minutes before the first kickoff, as FPL's. */
  const FIRST_MINUTES = FIRST_RULES.deadline.minutesBeforeFirstKickoff;
  /** Gameweek 9's one match kicks off holdGameweeks' default time from now, each next a week on. */
  const kickoffOf = (gameweek: number) => Date.now() + KICKS_OFF_IN + (gameweek - 9) * WEEK_MS;
  const deadlineIn = async (gameweek: number) => (await read())!.gameweeks.find((each) => each.gameweek === gameweek)?.deadline;
  beforeEach(async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    await holdGameweeks(t, { next: 9 });
  });

  test.each([
    ["earlier than FPL's", 180],
    ["equal to FPL's", FIRST_MINUTES],
    ["later than FPL's", 0],
  ])("is the league's own when it is %s", async (_, minutes) => {
    await giveDeadlineRule(t, leagueId, minutes);
    expect(await deadlineIn(9)).toBe(kickoffOf(9) - minutes * MINUTE_MS);
  });

  test("doesn't move when FPL's does", async () => {
    await moveFplDeadline(t, 9, 1234);
    expect(await deadlineIn(9)).toBe(kickoffOf(9) - FIRST_MINUTES * MINUTE_MS);
  });

  test("is under the rule in force in that gameweek, when the rule changes mid-season", async () => {
    await giveDeadlineRule(t, leagueId, 120, 20);
    expect(await deadlineIn(19)).toBe(kickoffOf(19) - FIRST_MINUTES * MINUTE_MS);
    expect(await deadlineIn(20)).toBe(kickoffOf(20) - 120 * MINUTE_MS);
  });

  test("is none while the gameweek has no kickoff time", async () => {
    await t.run(async (ctx) => {
      for await (const match of ctx.db.query("fixtures")) if (match.gameweek === 30) await ctx.db.patch("fixtures", match._id, { kickoff: null });
    });
    expect(await deadlineIn(30)).toBeNull();
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
