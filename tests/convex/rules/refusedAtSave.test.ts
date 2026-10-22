import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { LEAGUE_NAME_MAX, MOST_IN_SQUAD } from "../../../convex/leagues/leagueLimits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused, rulesWith } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, adminCreatesLeague, COMMISSIONER, leagueRow, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// League settings that could be saved and then never met, refused when saved instead, with the
// reason (Craig, 22 Oct 2026): games a gameweek beyond the league's opponents, a squad maximum
// beyond what any team can hold, an own stat that reads as a catalogue stat (#212), and a league
// name longer than a team's may be.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const change = async (leagueId: Id<"leagues">, rules: LeagueRules) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules });
const latestRules = async (leagueId: Id<"leagues">) =>
  (await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId }))?.rules;
const setMaxTeams = async (leagueId: Id<"leagues">, maxTeams: number) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams });
const createLeague = async (name: string, maxTeams = 4) =>
  (await actingAs(t, ADMIN)).mutation(api.leagues.leagues.create, { name, maxTeams, commissionerEmail: COMMISSIONER });

describe("games a gameweek, each against a different opponent", () => {
  const FIVE_WITH_FOUR = "With 4 teams, a team can play at most 3 games a gameweek, each against a different opponent, not 5.";

  test("more than the league's teams have opponents for is refused, naming the most", async () => {
    const leagueId = await adminCreatesLeague(t, 4);
    await expectRefused(change(leagueId, rulesWith({ gamesPerGameweek: 5 })), FIVE_WITH_FOUR);
    await change(leagueId, rulesWith({ gamesPerGameweek: 3 }));
    expect((await latestRules(leagueId))?.gamesPerGameweek).toBe(3);
  });

  test("the maximum of teams can't then go below what they need, and can go down to it", async () => {
    const leagueId = await adminCreatesLeague(t, 6);
    await change(leagueId, rulesWith({ gamesPerGameweek: 5 }));

    await expectRefused(setMaxTeams(leagueId, 4), FIVE_WITH_FOUR);
    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(6);
    await setMaxTeams(leagueId, 5);
    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(5);
  });

  test("a league is refused when too small for the admin's default games a gameweek", async () => {
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: rulesWith({ gamesPerGameweek: 2 }) });

    await expectRefused(createLeague("Two", 2), "With 2 teams, a team can play at most 1 game a gameweek, each against a different opponent, not 2.");
    await createLeague("Three", 3);
  });
});

test(`a squad maximum above the ${MOST_IN_SQUAD} any team can hold is refused, and nothing is saved`, async () => {
  const leagueId = await adminCreatesLeague(t);
  const tooBig = rulesWith({ squad: { ...FIRST_RULES.squad, size: { minimum: 15, maximum: MOST_IN_SQUAD + 1 } } });

  await expectRefused(change(leagueId, tooBig), `The squad's maximum, ${MOST_IN_SQUAD + 1}, is above the ${MOST_IN_SQUAD} players any team can hold.`);
  expect(await latestRules(leagueId)).toEqual(FIRST_RULES);
});

test("an own stat named as a catalogue stat is, case aside, is refused from the rules editor (#212)", async () => {
  const leagueId = await adminCreatesLeague(t);
  const scoring: LeagueRules["scoring"] = {
    rules: [{ shape: "perAction", stat: "own_assists", values: { all: 3 } }],
    wholePointsOnly: false,
    ownStats: [{ stat: "own_assists", name: "assists", shortCode: "OA", parts: [{ stat: "assists", weight: 1 }] }],
  };

  await expectRefused(
    (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.changeScoring, { leagueId, scoring }),
    'The scoring set can\'t be saved: the own stat own_assists has the name "assists", which the catalogue\'s Assists has.',
  );
});

test(`a league's name is up to ${LEAGUE_NAME_MAX} characters, a team's limit, and one longer is refused`, async () => {
  const leagueId = await createLeague("x".repeat(LEAGUE_NAME_MAX));
  expect((await leagueRow(t, leagueId))?.name).toBe("x".repeat(LEAGUE_NAME_MAX));

  await expectRefused(createLeague("x".repeat(LEAGUE_NAME_MAX + 1)), refusals.leagueNameTooLong);
  expect(refusals.leagueNameTooLong).toBe("A league's name is up to 30 characters.");
});
