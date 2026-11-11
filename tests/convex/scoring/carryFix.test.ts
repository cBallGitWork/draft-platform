import { describe, expect, test } from "vitest";
import { carryFix } from "../../../convex/scoring/carryFix";
import { FIRST_INSTRUCTION_SCORING } from "../../../convex/scoring/draftedInstructionScoring";
import { FIRST_SCORING_WITH_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";

// A fix carried into the draft patch (Craig, 6 Nov 2026, on #368: "the fix changes the live
// scoring at once and the same value in the draft, unless the draft already changes that value").

type Rule = StoredScoringSet["rules"][number];

/** FIRST_SCORING with `stat`'s rule changed by `change`. */
function withRule(set: StoredScoringSet, stat: string, change: (rule: Rule) => Rule | null): StoredScoringSet {
  return { ...structuredClone(set), rules: set.rules.flatMap((rule) => (rule.stat === stat ? [change(structuredClone(rule))].filter((each) => each !== null) : [structuredClone(rule)])) };
}
const assistsAt = (points: number) => (rule: Rule): Rule => ({ ...rule, values: { all: points } }) as Rule;
const cleanSheets = (set: StoredScoringSet) => set.rules.find((rule) => rule.stat === "clean_sheets")!;
const goalkeeperCleanSheetAt = (points: number) => (rule: Rule): Rule =>
  ({ ...rule, values: { byArea: { ...(rule.values as { byArea: Record<string, number> }).byArea, goalkeeper: points } } }) as Rule;
const defenceCleanSheetAt = (points: number) => (rule: Rule): Rule =>
  ({ ...rule, values: { byArea: { ...(rule.values as { byArea: Record<string, number> }).byArea, defence: points } } }) as Rule;

describe("carrying a fix into the draft", () => {
  test("a value the draft doesn't change takes the fix", () => {
    const fixed = withRule(FIRST_SCORING, "assists", assistsAt(4));
    const draft = { ...structuredClone(FIRST_SCORING), wholePointsOnly: !FIRST_SCORING.wholePointsOnly };

    expect(carryFix(FIRST_SCORING, fixed, draft)).toEqual({ ...fixed, wholePointsOnly: draft.wholePointsOnly });
  });

  test("a value the draft changes keeps the draft's", () => {
    const fixed = withRule(FIRST_SCORING, "assists", assistsAt(4));
    const draft = withRule(FIRST_SCORING, "assists", assistsAt(5));

    expect(carryFix(FIRST_SCORING, fixed, draft)).toEqual(draft);
  });

  test("Craig's case: a clean sheet worth 40 fixed to 4 reaches the draft, which changed another area of it", () => {
    const live = withRule(FIRST_SCORING, "clean_sheets", goalkeeperCleanSheetAt(40));
    const fixed = withRule(live, "clean_sheets", goalkeeperCleanSheetAt(4));
    const draft = withRule(live, "clean_sheets", defenceCleanSheetAt(5));

    const carried = carryFix(live, fixed, draft);
    expect(cleanSheets(carried).values).toEqual({ byArea: { ...(cleanSheets(live).values as { byArea: object }).byArea, goalkeeper: 4, defence: 5 } });
  });

  test("a category the fix adds is added after the draft's; one it removes goes, unless the draft changed it", () => {
    const tackles: Rule = { shape: "perAction", stat: "tackles", values: { all: 1 } };
    const fixed = { ...withRule(FIRST_SCORING, "assists", () => null), rules: [...withRule(FIRST_SCORING, "assists", () => null).rules, tackles] };
    const draft = withRule(FIRST_SCORING, "penalties_saved", assistsAt(6));

    const carried = carryFix(FIRST_SCORING, fixed, draft);
    expect(carried.rules.map((rule) => rule.stat)).toEqual([...draft.rules.map((rule) => rule.stat).filter((stat) => stat !== "assists"), "tackles"]);

    expect(carryFix(FIRST_SCORING, fixed, withRule(FIRST_SCORING, "assists", assistsAt(5))).rules.find((rule) => rule.stat === "assists")).toEqual(
      withRule(FIRST_SCORING, "assists", assistsAt(5)).rules.find((rule) => rule.stat === "assists"),
    );
  });

  test("a value priced for all by the fix and by area by the draft keeps the draft's whole, never a mix of both", () => {
    const fixed = withRule(FIRST_SCORING, "clean_sheets", assistsAt(4));
    const draft = withRule(FIRST_SCORING, "clean_sheets", defenceCleanSheetAt(5));

    expect(cleanSheets(carryFix(FIRST_SCORING, fixed, draft))).toEqual(cleanSheets(draft));
  });

  test("two categories for one stat both survive a fix, each matched to its own (Craig, 11 Nov 2026, on #1616)", () => {
    const hatTrick: Rule = { shape: "bands", stat: "goals_scored", stack: false, values: { all: [{ atLeast: 3, points: 5 }] } } as Rule;
    const live: StoredScoringSet = { ...structuredClone(FIRST_SCORING), rules: [...structuredClone(FIRST_SCORING.rules), hatTrick] };
    const fixed = withRule(live, "assists", assistsAt(4));
    const draft: StoredScoringSet = {
      ...structuredClone(live),
      rules: live.rules.map((rule) => (rule === live.rules.at(-1) ? { ...hatTrick, values: { all: [{ atLeast: 3, points: 8 }] } } : structuredClone(rule))) as Rule[],
    };

    const carried = carryFix(live, fixed, draft);
    const goals = carried.rules.filter((rule) => rule.stat === "goals_scored");
    expect(goals).toEqual(draft.rules.filter((rule) => rule.stat === "goals_scored"));
    expect(goals).toHaveLength(2);
    expect(carried.rules.find((rule) => rule.stat === "assists")).toEqual(fixed.rules.find((rule) => rule.stat === "assists"));
  });

  test("a fix that changes nothing leaves the draft as it is", () => {
    const draft = withRule(FIRST_SCORING, "assists", assistsAt(5));

    expect(carryFix(FIRST_SCORING, structuredClone(FIRST_SCORING), draft)).toEqual(draft);
  });

  // Roles and team instructions are lists too, each entry known by its own key.
  const WITH_ALL: StoredScoringSet = { ...FIRST_SCORING_WITH_ROLES, instructions: structuredClone([...FIRST_INSTRUCTION_SCORING]) };
  const [ONE_ROLE, OTHER_ROLE] = WITH_ALL.roles!.map(({ role }) => role);
  const [ONE_INSTRUCTION, OTHER_INSTRUCTION] = WITH_ALL.instructions!.map(({ instruction }) => instruction);
  const withBars = (set: StoredScoringSet, role: string, bars: number[]): StoredScoringSet => ({
    ...structuredClone(set),
    roles: set.roles!.map((each) => (each.role === role ? { ...structuredClone(each), bonus: { ...structuredClone(each.bonus), bars } } : structuredClone(each))),
  });
  const withFirstLinePoints = (set: StoredScoringSet, instruction: string, points: number): StoredScoringSet => ({
    ...structuredClone(set),
    instructions: set.instructions!.map((each) =>
      each.instruction === instruction ? { ...each, lines: each.lines.map((line, index) => (index === 0 ? { ...line, points } : { ...line })) } : structuredClone(each),
    ),
  });
  const barsOf = (set: StoredScoringSet, role: string) => set.roles!.find((each) => each.role === role)!.bonus.bars;
  const firstPointsOf = (set: StoredScoringSet, instruction: string) => set.instructions!.find((each) => each.instruction === instruction)!.lines[0].points;

  test("a fix to one role reaches a draft that changes another role", () => {
    const fixed = withBars(WITH_ALL, ONE_ROLE, [7, 8, 9]);
    const draft = withBars(WITH_ALL, OTHER_ROLE, [4, 5, 6]);

    const carried = carryFix(WITH_ALL, fixed, draft);
    expect(barsOf(carried, ONE_ROLE)).toEqual([7, 8, 9]);
    expect(barsOf(carried, OTHER_ROLE)).toEqual([4, 5, 6]);
  });

  test("a role the draft changes keeps the draft's", () => {
    const fixed = withBars(WITH_ALL, ONE_ROLE, [7, 8, 9]);
    const draft = withBars(WITH_ALL, ONE_ROLE, [4, 5, 6]);

    expect(carryFix(WITH_ALL, fixed, draft)).toEqual(draft);
  });

  test("a fix to one team instruction reaches a draft that changes another", () => {
    const fixed = withFirstLinePoints(WITH_ALL, ONE_INSTRUCTION, 9);
    const draft = withFirstLinePoints(WITH_ALL, OTHER_INSTRUCTION, 8);

    const carried = carryFix(WITH_ALL, fixed, draft);
    expect(firstPointsOf(carried, ONE_INSTRUCTION)).toBe(9);
    expect(firstPointsOf(carried, OTHER_INSTRUCTION)).toBe(8);
  });

  test("an instruction's lines are one value: a draft that changes one keeps its own whole", () => {
    const fixed = withFirstLinePoints(WITH_ALL, ONE_INSTRUCTION, 9);
    const draft: StoredScoringSet = {
      ...structuredClone(WITH_ALL),
      instructions: WITH_ALL.instructions!.map((each) => (each.instruction === ONE_INSTRUCTION ? { ...each, lines: each.lines.slice(0, 1) } : structuredClone(each))),
    };

    expect(carryFix(WITH_ALL, fixed, draft)).toEqual(draft);
  });
});
