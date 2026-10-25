// The rules editor's edits (#30), pure: pricing a rule more or less finely, changing its kind, and
// the parts behind its tick boxes, each giving a set the server's check accepts.

import { describe, expect, it } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { validateScoringSet } from "../../../convex/scoring/scoringSet";
import {
  firstBlankRule,
  nextBand,
  reprice,
  rulePricing,
  withLimit,
  withMinMinutes,
  withPricing,
  withShape,
  withStack,
  withValue,
  type Rule,
} from "../../../src/scoring/editing";

const ruleFor = (stat: string) => structuredClone(FIRST_SCORING.rules.find((rule) => rule.stat === stat)!);
const GOALS = ruleFor("goals_scored");
const DEFENSIVE = ruleFor("defensive_contribution");
const ASSISTS = ruleFor("assists");
const isSound = (rule: Rule) => validateScoringSet({ rules: [rule], wholePointsOnly: false });

describe("pricing", () => {
  it("by position copies each area's value to its positions, and back again exactly", () => {
    const byPosition = withPricing(GOALS, "byPosition");
    expect(byPosition.values).toEqual({ byPosition: { GK: 10, FB: 6, CB: 6, WB: 5, CDM: 5, WM: 5, CM: 5, W: 5, CAM: 5, ST: 4 } });
    expect(withPricing(byPosition, "byArea").values).toEqual(GOALS.values);
  });

  it("the same for all keeps the value most positions share, the first of them on a tie", () => {
    expect(withPricing(GOALS, "all").values).toEqual({ all: 5 });
    expect(reprice({ byPosition: { GK: 1, FB: 2, CB: 1, WB: 2, CDM: 3, WM: 3, CM: 4, W: 4, CAM: 5, ST: 5 } }, "all")).toEqual({ all: 1 });
  });

  it("by area keeps the value most of its positions share, the wide one on a tie", () => {
    const priced = { byPosition: { GK: 1, FB: 2, CB: 3, WB: 4, CDM: 4, WM: 5, CM: 5, W: 6, CAM: 6, ST: 7 } };
    expect(reprice(priced, "byArea")).toEqual({ byArea: { goalkeeper: 1, defence: 2, defensiveMidfield: 4, midfield: 5, attackingMidfield: 6, attack: 7 } });
  });

  it("a rule is priced as finely as its finest part, and every part follows a change of pricing", () => {
    expect(rulePricing(DEFENSIVE)).toBe("byArea");
    expect(DEFENSIVE.limit).toEqual({ all: { max: 2, min: null } });
    const byPosition = withPricing(DEFENSIVE, "byPosition");
    expect(byPosition.limit).toEqual(reprice({ all: { max: 2, min: null } }, "byPosition"));
    isSound(byPosition);
  });
});

describe("editing a row", () => {
  it("prices every part of the rule as the row is, so a limit for all follows values by area", () => {
    const edited = withValue(DEFENSIVE, "defence", [{ atLeast: 9, points: 2 }]);
    expect(edited.limit).toEqual(reprice({ all: { max: 2, min: null } }, "byArea"));
    expect((edited.values as { byArea: Record<string, unknown> }).byArea.defence).toEqual([{ atLeast: 9, points: 2 }]);
  });

  it("never changes the rule it was given", () => {
    const before = structuredClone(DEFENSIVE);
    withValue(DEFENSIVE, "defence", []);
    withPricing(DEFENSIVE, "all");
    withShape(DEFENSIVE, "perAction");
    expect(DEFENSIVE).toEqual(before);
  });
});

describe("the kind of rule", () => {
  it("per action to per number to bands keeps the points, counting from one", () => {
    const perCount = withShape(ASSISTS, "perCount");
    expect(perCount).toEqual({ shape: "perCount", stat: "assists", values: { all: { every: 1, points: 3 } } });
    expect(withShape(perCount, "bands")).toEqual({ shape: "bands", stat: "assists", stack: false, values: { all: [{ atLeast: 1, points: 3 }] } });
  });

  it("bands to per action pays the highest band's points, and nothing where there are no bands", () => {
    const perAction = withShape(DEFENSIVE, "perAction");
    expect(perAction.values).toEqual({ byArea: { goalkeeper: 0, defence: 2, defensiveMidfield: 2, midfield: 2, attackingMidfield: 2, attack: 2 } });
    expect("stack" in perAction).toBe(false);
    expect(perAction.limit).toEqual(DEFENSIVE.limit);
    isSound(perAction);
  });

  it("bands to per number pays the highest band's points for every so many as it starts at", () => {
    expect(withShape(ruleFor("minutes"), "perCount").values).toEqual({ all: { every: 60, points: 2 } });
  });

  it("the same kind again changes nothing", () => {
    expect(withShape(DEFENSIVE, "bands")).toBe(DEFENSIVE);
  });
});

describe("behind the tick boxes", () => {
  it("a points limit starts with no end set, priced as the rule is, and goes", () => {
    const limited = withLimit(GOALS, true);
    expect(limited.limit).toEqual(reprice({ all: { max: null, min: null } }, "byArea"));
    isSound(limited);
    expect("limit" in withLimit(limited, false)).toBe(false);
  });

  it("minutes start at none, priced as the rule is, and go", () => {
    expect(withMinMinutes(ASSISTS, true).minMinutes).toEqual({ all: 0 });
    expect("minMinutes" in withMinMinutes(ruleFor("clean_sheets"), false)).toBe(false);
  });

  it("only a band rule stacks", () => {
    expect(withStack(DEFENSIVE, true)).toMatchObject({ stack: true });
    expect(() => withStack(ASSISTS, true)).toThrow("Only a band rule stacks, not the assists rule");
  });

  it("a band added starts one past the highest, or at one", () => {
    expect(nextBand([{ atLeast: 1, points: 1 }, { atLeast: 60, points: 2 }])).toEqual({ atLeast: 61, points: 0 });
    expect(nextBand([])).toEqual({ atLeast: 1, points: 0 });
  });
});

it("finds the first rule holding a box left without a number", () => {
  const scoring = structuredClone(FIRST_SCORING);
  expect(firstBlankRule(scoring)).toBe(-1);
  scoring.rules[3] = withValue(scoring.rules[3], "midfield", NaN);
  expect(firstBlankRule(scoring)).toBe(3);
});
