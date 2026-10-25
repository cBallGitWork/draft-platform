import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { LEAGUE_NAME_MAX } from "../../../convex/leagues/leagueLimits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused, rulesRevision, rulesWith, HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, adminCreatesLeague, COMMISSIONER, leagueRow, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// League settings that could be saved and then never met, refused when saved instead, with the
// reason (Craig, 22 Oct 2026): games a gameweek beyond the league's opponents, a squad maximum
// above a Premier League squad, an own stat that reads as a catalogue stat (#212), and a league
// name longer than a team's may be.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const change = async (leagueId: Id<"leagues">, rules: LeagueRules) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules, revision: await rulesRevision(t, leagueId) });
const latestRules = async (leagueId: Id<"leagues">) =>
  (await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId }))?.rules;
const setMaxTeams = async (leagueId: Id<"leagues">, maxTeams: number) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams });
const createLeague = async (name: string, maxTeams = 4) =>
  (await actingAs(t, ADMIN)).mutation(api.leagues.leagues.create, { name, maxTeams, commissionerEmail: COMMISSIONER });

describe("games a gameweek, no more than the league's teams can play", () => {
  const FIVE_WITH_FOUR = "With 4 teams, a team can play at most 3 games a gameweek, not 5: one against each of the other 3.";

  test("more than the league's teams have opponents for is refused, naming the most", async () => {
    const leagueId = await adminCreatesLeague(t, 4);
    await expectRefused(change(leagueId, rulesWith({ gamesPerGameweek: 5 })), FIVE_WITH_FOUR);
    await change(leagueId, rulesWith({ gamesPerGameweek: 3 }));
    expect((await latestRules(leagueId))?.gamesPerGameweek).toBe(3);
  });

  test("with an odd number of teams, the refusal counts the game of the team left over", async () => {
    const leagueId = await adminCreatesLeague(t, 5);
    await expectRefused(
      change(leagueId, rulesWith({ gamesPerGameweek: 6 })),
      "With 5 teams, a team can play at most 5 games a gameweek, not 6: one against each of the other 4, and one left over, against the league's average or a bye.",
    );
  });

  test("the maximum of teams can't then be lowered below what they need, and can go down to it", async () => {
    const leagueId = await adminCreatesLeague(t, 6);
    await change(leagueId, rulesWith({ gamesPerGameweek: 5 }));

    await expectRefused(setMaxTeams(leagueId, 4), FIVE_WITH_FOUR);
    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(6);
    await setMaxTeams(leagueId, 5);
    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(5);
  });

  test("a maximum kept or raised is never refused, even under rules saved before the check", async () => {
    const leagueId = await adminCreatesLeague(t, 4);
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("leagueRules").collect()).find((each) => each.leagueId === leagueId)!;
      await ctx.db.patch("leagueRules", row._id, { rules: rulesWith({ gamesPerGameweek: 5 }) });
    });

    await setMaxTeams(leagueId, 4);
    await setMaxTeams(leagueId, 5);
    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(5);
  });

  test("a league too small for the admin's default games a gameweek is refused, naming the defaults", async () => {
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: rulesWith({ gamesPerGameweek: 2 }) });

    await expectRefused(
      createLeague("Two", 2),
      "The admin's default rules play 2 games a gameweek, but with 2 teams a team can play at most 1 game: one against the other team.",
    );
    await createLeague("Three", 3);
  });
});

test("a squad maximum of 26 is refused naming 25, and nothing is saved; 25 is saved (#316)", async () => {
  const leagueId = await adminCreatesLeague(t);
  const withMaximum = (maximum: number) => rulesWith({ squad: { ...FIRST_RULES.squad, size: { minimum: 15, maximum } } });

  await expectRefused(change(leagueId, withMaximum(26)), "The squad's maximum, 26, is above 25, a Premier League squad.");
  expect(await latestRules(leagueId)).toEqual(HELD_FIRST_RULES);
  await change(leagueId, withMaximum(25));
  expect((await latestRules(leagueId))?.squad.size).toEqual({ minimum: 15, maximum: 25 });
});

test("an own stat named as a catalogue stat is, case aside, is refused from the rules editor (#212)", async () => {
  const leagueId = await adminCreatesLeague(t);
  const scoring: LeagueRules["scoring"] = {
    rules: [{ shape: "perAction", stat: "own_assists", values: { all: 3 } }],
    wholePointsOnly: false,
    ownStats: [{ stat: "own_assists", name: "assists", shortCode: "OA", parts: [{ stat: "assists", weight: 1 }] }],
  };

  await expectRefused(
    (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.changeScoring, { leagueId, scoring, revision: await rulesRevision(t, leagueId) }),
    'The scoring set can\'t be saved: the own stat own_assists has the name "assists", which the catalogue\'s Assists has.',
  );
});

test(`a league's name is up to ${LEAGUE_NAME_MAX} characters, a team's limit, and one longer is refused`, async () => {
  const leagueId = await createLeague("x".repeat(LEAGUE_NAME_MAX));
  expect((await leagueRow(t, leagueId))?.name).toBe("x".repeat(LEAGUE_NAME_MAX));

  await expectRefused(createLeague("x".repeat(LEAGUE_NAME_MAX + 1)), refusals.leagueNameTooLong);
  expect(refusals.leagueNameTooLong).toBe("A league's name is up to 30 characters.");
});
