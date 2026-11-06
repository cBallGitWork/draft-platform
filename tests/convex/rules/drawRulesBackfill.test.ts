import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { holdGameweeks, rulesWith, savedBeforeTheyWereRules } from "../../support/convex/leagueRules.harness";
import { adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The #147 backfill: rules saved before #33 and #130 get the odd team out and games a gameweek
// they already play by, the first rules', and rules holding both are left alone.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
});

const fill = () => t.mutation(internal.rules.drawRulesBackfill.fillDrawRules, {});
const leagueRulesRows = () => t.run((ctx) => ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect());
const defaultRules = async () => (await t.run((ctx) => ctx.db.query("defaultLeagueRules").first()))!;

test("rules saved before the draw rules were rules get the first rules' odd team out and games a gameweek", async () => {
  await savedBeforeTheyWereRules(t, leagueId);
  const { _id, rules } = await defaultRules();
  const { oddTeamOut: _odd, gamesPerGameweek: _games, ...older } = rules;
  await t.run((ctx) => ctx.db.patch("defaultLeagueRules", _id, { rules: older }));

  expect(await fill()).toEqual({ leagueRows: 1, defaultRows: 1 });

  for (const row of await leagueRulesRows()) {
    expect(row.rules).toMatchObject({ oddTeamOut: FIRST_RULES.oddTeamOut, gamesPerGameweek: FIRST_RULES.gamesPerGameweek });
  }
  expect((await defaultRules()).rules).toEqual(rules);
});

test("rules holding both are left alone, so running it again does nothing", async () => {
  const chosen = rulesWith({ oddTeamOut: "bye", gamesPerGameweek: 2 });
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("leagueRules").collect()) await ctx.db.patch("leagueRules", row._id, { rules: chosen });
  });
  const before = await leagueRulesRows();

  expect(await fill()).toEqual({ leagueRows: 0, defaultRows: 0 });
  expect(await leagueRulesRows()).toEqual(before);
});
