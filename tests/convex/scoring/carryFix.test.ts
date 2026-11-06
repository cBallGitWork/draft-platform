import { describe, expect, test } from "vitest";
import { carryFix } from "../../../convex/scoring/carryFix";
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

  test("a fix that changes nothing leaves the draft as it is", () => {
    const draft = withRule(FIRST_SCORING, "assists", assistsAt(5));

    expect(carryFix(FIRST_SCORING, structuredClone(FIRST_SCORING), draft)).toEqual(draft);
  });
});
