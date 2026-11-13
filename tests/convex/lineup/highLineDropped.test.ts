import { beforeEach, describe, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { redrawnRules, redrawnSet } from "../../../convex/lineup/highLineDropped";
import { FIRST_INSTRUCTIONS, type Instruction, type InstructionPair } from "../../../convex/lineup/instructions";
import { lostInstructionsLetter } from "../../../convex/lineup/instructionsWords";
import { roleIn } from "../../../convex/lineup/roles";
import { classicFormationsOf, instructionsOf } from "../../../convex/rules/firstRules";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { changeEveryRules, holdGameweeks, HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { addManagers, adminCreatesLeague, ANN, lettersTo, type TestConvex } from "../../support/convex/leagues.harness";
import { presetNamed } from "../../support/convex/lineup.harness";
import { holdSquad, NEXT, SQUAD_CLUB } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { everyJobRuns } from "../../support/convex/test.harness";

// #1452's one-off (spec/05 S05.37, S05.42, S05.48): Hold a high line leaves the leagues already
// made, Press high and Shoot on sight take their redrawn words and need, and a line-up, plan, preset
// or classic formation that loses a pick takes its formation's default, its manager told by Mail.

/** A league's set as the first set was before #1452. */
const SET_BEFORE: Instruction[] = [
  ...FIRST_INSTRUCTIONS.map((each): Instruction => {
    if (each.key === "pressHigh") return { ...each, needs: "threeInARow", description: "Rewards possession won high and in midfield; costs fouls." };
    if (each.key === "shootOnSight") return { ...each, description: "Rewards goals and shots on target from outside the box; costs long shots off target or blocked." };
    return each;
  }),
  { key: "holdAHighLine", side: "defensive", name: "Hold a high line", needs: "backThreeOrFour", description: "Rewards defenders' offsides won and interceptions; costs goals conceded." },
];

/** Rules as a league made before #1452 holds them: the old set, and Keegan's Newcastle holding a high line. */
const rulesBefore = (rules: LeagueRules): LeagueRules => ({
  ...rules,
  instructions: SET_BEFORE,
  classics: classicFormationsOf(rules).map((classic) =>
    classic.name === "Keegan's Newcastle" ? { ...classic, instructions: { ...classic.instructions, defensive: "holdAHighLine" } } : classic,
  ),
});

describe("the redrawn set and rules", () => {
  test("drop Hold a high line and take Press high's and Shoot on sight's new words and need", () => {
    expect(redrawnSet(SET_BEFORE)).toEqual(FIRST_INSTRUCTIONS);
  });

  test("keep a commissioner's own words", () => {
    const own = SET_BEFORE.map((each) => (each.key === "shootOnSight" ? { ...each, description: "Shoot!" } : each));
    expect(redrawnSet(own).find(({ key }) => key === "shootOnSight")?.description).toBe("Shoot!");
  });

  test("keep a commissioner's own need on any instruction but Press high", () => {
    const own = SET_BEFORE.map((each): Instruction => (each.key === "shootOnSight" ? { ...each, needs: "threeInARow" } : each));
    expect(redrawnSet(own).find(({ key }) => key === "shootOnSight")?.needs).toBe("threeInARow");
  });

  test("move a classic formation or preset off a pick its shape no longer offers, to its formation's default", () => {
    const presets = HELD_FIRST_RULES.presets.map((preset) =>
      preset.name === "4-5-1" ? { ...preset, instructions: { attacking: "playOutFromTheBack", defensive: "pressHigh" } } : preset,
    );
    const redrawn = redrawnRules({ ...rulesBefore(HELD_FIRST_RULES), presets });
    expect(classicFormationsOf(redrawn).find(({ name }) => name === "Keegan's Newcastle")?.instructions.defensive).toBe("keepItTightEarly");
    expect(redrawn.presets.find(({ name }) => name === "4-5-1")?.instructions?.defensive).toBe("keepItTightEarly");
    expect(instructionsOf(redrawn)).toEqual(FIRST_INSTRUCTIONS);
  });

  test("leave rules already redrawn as they are", () => {
    expect(redrawnRules(HELD_FIRST_RULES)).toEqual(HELD_FIRST_RULES);
  });
});

describe("the one-off", () => {
  let t: TestConvex;
  let leagueId: Id<"leagues">;
  let annsTeam: Id<"teams">;
  beforeEach(async () => {
    t = await signInDeployment();
    fakeResend();
    await holdGameweeks(t, { next: NEXT });
    leagueId = await adminCreatesLeague(t);
    [annsTeam] = await addManagers(t, leagueId, [ANN]);
    await t.run((ctx) => ctx.db.insert("clubs", SQUAD_CLUB));
    await holdSquad(t, leagueId, annsTeam);
    await changeEveryRules(t, leagueId, rulesBefore);
  });

  const run = async () => {
    const result = await t.mutation(internal.lineup.highLineDropped.dropHighLine, {});
    await everyJobRuns(t);
    return result;
  };
  const lineupPicks = () =>
    t.run(async (ctx) => (await ctx.db.query("lineups").withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", annsTeam)).collect()).map(({ instructions }) => instructions));
  const pickInLineup = (instructions: InstructionPair) =>
    t.run(async (ctx) => {
      for (const row of await ctx.db.query("lineups").withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", annsTeam)).collect()) {
        await ctx.db.patch("lineups", row._id, { instructions });
      }
    });
  const savePlan = (name: string, preset: string, instructions: InstructionPair) =>
    t.run((ctx) => ctx.db.insert("savedPlans", { leagueId, teamId: annsTeam, name, slots: presetNamed(preset).cells.map((cell) => ({ ...cell, role: roleIn(cell, undefined).key })), instructions }));
  const planPicks = () => t.run(async (ctx) => (await ctx.db.query("savedPlans").collect()).map(({ name, instructions }) => [name, instructions]));
  const leagueRules = () => t.run(async (ctx) => (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()).map(({ rules }) => rules));

  test("redraws the league's rules: Hold a high line gone, Keegan's Newcastle on its 4-4-2's default", async () => {
    await run();
    const [rules] = await leagueRules();
    expect(rules?.instructions).toEqual(FIRST_INSTRUCTIONS);
    expect(rules?.classics?.find(({ name }) => name === "Keegan's Newcastle")?.instructions).toEqual({ attacking: "getItWide", defensive: "keepItTightEarly" });
  });

  test("redraws a row of changes in the parts it changes alone", async () => {
    const classics = rulesBefore(HELD_FIRST_RULES).classics!;
    await t.run((ctx) => ctx.db.insert("leagueRules", { leagueId, fromGameweek: NEXT, changes: { classics } }));
    await run();
    const changes = await t.run(async (ctx) => (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()).at(-1)!.changes);
    expect(Object.keys(changes!)).toEqual(["classics"]);
    expect(changes?.classics?.find(({ name }) => name === "Keegan's Newcastle")?.instructions.defensive).toBe("keepItTightEarly");
  });

  test("switches a line-up's Hold a high line and a 4-5-1 plan's Press high to the formation's default, and Mails the manager", async () => {
    await pickInLineup({ attacking: "getItWide", defensive: "holdAHighLine" });
    await savePlan("Midfield five", "4-5-1", { attacking: "shootOnSight", defensive: "pressHigh" });
    await savePlan("Up top", "4-4-2", { attacking: "shootOnSight", defensive: "pressHigh" });
    await run();

    expect(await lineupPicks()).toEqual([{ attacking: "getItWide", defensive: "keepItTightEarly" }]);
    expect(await planPicks()).toEqual([
      ["Midfield five", { attacking: "shootOnSight", defensive: "keepItTightEarly" }],
      ["Up top", { attacking: "shootOnSight", defensive: "pressHigh" }],
    ]);
    expect(await lettersTo(t, ANN)).toContainEqual(
      lostInstructionsLetter([
        { from: "holdAHighLine", fromName: "Hold a high line", toName: "Keep it tight early" },
        { from: "pressHigh", fromName: "Press high", toName: "Keep it tight early", plan: "Midfield five" },
      ]),
    );
  });

  test("Mails no one whose picks stand, and running it again changes nothing", async () => {
    await pickInLineup({ attacking: "getItWide", defensive: "pressHigh" });
    const before = (await lettersTo(t, ANN)).length;
    expect(await run()).toEqual({ defaultsMoved: false });
    expect(await lineupPicks()).toEqual([{ attacking: "getItWide", defensive: "pressHigh" }]);
    expect(await lettersTo(t, ANN)).toHaveLength(before);
    const rules = await leagueRules();
    await run();
    expect(await leagueRules()).toEqual(rules);
  });

  test("redraws the admin's default rules, so the next league made has no Hold a high line", async () => {
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("defaultLeagueRules").unique())!;
      await ctx.db.patch("defaultLeagueRules", row._id, { rules: rulesBefore(row.rules as LeagueRules) });
    });
    expect(await run()).toEqual({ defaultsMoved: true });
    const defaults = await t.run(async (ctx) => (await ctx.db.query("defaultLeagueRules").unique())!.rules);
    expect(defaults.instructions).toEqual(FIRST_INSTRUCTIONS);
  });
});
