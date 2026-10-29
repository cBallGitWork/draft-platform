import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { rulesRefusals } from "../../../convex/rules/leagueRules";
import { UnsoundRules } from "../../../convex/rules/leagueRulesCheck";
import {
  checkSquadMaximums,
  squadMaximumFor,
  STARTING_SQUAD_MAXIMUMS,
  withSquadMaximum,
  type SquadMaximumBand,
} from "../../../convex/rules/squadMaximums";
import { rulesWith } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A new league's squad maximum by its size (spec/03, Squad make-up; #316): the site's table, which
// Craig edits, read when a league is made, never after.

const FIRST_BAND_NOT_AT_FEWEST = "The first squad maximum must start at 2 teams, the fewest a league may have.";
const MAXIMUM_OF_26 = "A squad maximum is a whole number from 11 to 25, not 26.";

describe("the bands", () => {
  test.each([
    [2, 20],
    [4, 20],
    [6, 20],
    [7, 16],
    [8, 16],
    [9, 15],
    [10, 15],
    [11, 14],
    [20, 14],
  ])("give a league of %i teams %i, from the starting data", (maxTeams, maximum) => {
    expect(squadMaximumFor(STARTING_SQUAD_MAXIMUMS, maxTeams)).toBe(maximum);
  });

  test("the starting data is sound", () => {
    expect(() => checkSquadMaximums(STARTING_SQUAD_MAXIMUMS)).not.toThrow();
  });

  test.each<[string, SquadMaximumBand[], string]>([
    ["none", [], FIRST_BAND_NOT_AT_FEWEST],
    ["a first band above the fewest teams", [{ fromTeams: 4, maximum: 20 }], FIRST_BAND_NOT_AT_FEWEST],
    [
      "bands out of order",
      [{ fromTeams: 2, maximum: 20 }, { fromTeams: 9, maximum: 15 }, { fromTeams: 7, maximum: 16 }],
      "Each squad maximum starts at a whole number of teams, above the one before and at most 20, not 7.",
    ],
    [
      "a band past the most teams",
      [{ fromTeams: 2, maximum: 20 }, { fromTeams: 21, maximum: 14 }],
      "Each squad maximum starts at a whole number of teams, above the one before and at most 20, not 21.",
    ],
    ["a maximum above a Premier League squad", [{ fromTeams: 2, maximum: 26 }], MAXIMUM_OF_26],
    ["a maximum that can't field a team", [{ fromTeams: 2, maximum: 10 }], "A squad maximum is a whole number from 11 to 25, not 10."],
  ])("refuse %s", (_name, bands, reason) => {
    expect(() => checkSquadMaximums(bands)).toThrow(new UnsoundRules(reason));
  });

  test("leave rules with no squad size limit with none", () => {
    const free = rulesWith({ squad: { size: null, minimumByArea: null, maxPerClub: null } });
    expect(withSquadMaximum(free, 16)).toEqual(free);
  });
});

describe("a new league", () => {
  let t: TestConvex;
  beforeEach(async () => {
    t = await signInDeployment();
    fakeResend();
  });

  const squadSize = async (leagueId: Id<"leagues">) =>
    (await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId }))?.rules.squad.size;
  const setBands = (bands: SquadMaximumBand[]) => t.mutation(internal.rules.leagueRules.setSquadMaximums, { bands });

  test("of 8 teams gets a squad maximum of 16, keeping the defaults' minimum", async () => {
    const leagueId = await adminCreatesLeague(t, 8);
    expect(await squadSize(leagueId)).toEqual({ minimum: FIRST_RULES.squad.size!.minimum, maximum: 16 });
  });

  test("takes the table as it is when made: a change reaches the next league, never one already made", async () => {
    const before = await adminCreatesLeague(t, 8, "Before");
    await setBands([
      { fromTeams: 2, maximum: 22 },
      { fromTeams: 8, maximum: 18 },
    ]);
    const after = await adminCreatesLeague(t, 8, "After");

    expect((await squadSize(before))?.maximum).toBe(16);
    expect((await squadSize(after))?.maximum).toBe(18);
  });

  test("an unsound table is refused with the reason, and the table stays", async () => {
    await expectRefused(setBands([{ fromTeams: 2, maximum: 26 }]), MAXIMUM_OF_26);
    const leagueId = await adminCreatesLeague(t, 8);
    expect((await squadSize(leagueId))?.maximum).toBe(16);
  });

  test("is refused, naming the defaults as the cause, when the maximum for its size is below their minimum", async () => {
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: rulesWith({ squad: { ...FIRST_RULES.squad, size: { minimum: 15, maximum: 20 } } }) });
    await expectRefused(
      adminCreatesLeague(t, 12),
      rulesRefusals.defaultsUnsound(12, "The squad size's minimum, 15, is above its maximum, 14."),
    );
  });
});
