import { describe, expect, test } from "vitest";
import type { Cell } from "../../../convex/lineup/pitch";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { centreOf, everyArea, everyPosition } from "../../support/convex/scoring.example";
import { validateScoringSet, type ScoringRule, type ScoringSet } from "../../../convex/scoring/scoringSet";

// What a rule may say beyond its values (spec/14, How a rule scores; #111): priced the same for
// all, by area or by position; held to a points limit; paid only after so many minutes; kept in
// tenths, or in whole points only.

const LEFT_BACK: Cell = { area: "defence", lane: "left" };
const CENTRE_BACK: Cell = { area: "defence", lane: "leftCentre" };
const LEFT_WINGER: Cell = { area: "attackingMidfield", lane: "left" };

const setOf = (...rules: ScoringRule[]): ScoringSet => ({ rules, wholePointsOnly: false });
const pointsFor = (rule: ScoringRule, stats: Record<string, number>, cell: Cell) => scoreMatch({ minutes: 90, ...stats }, setOf(rule), cell).total;

describe("how finely a rule is priced", () => {
  test("by position: a full back and a centre back in one back line are paid apart", () => {
    const tackles: ScoringRule = { shape: "perAction", stat: "won_tackle", values: { byPosition: { ...everyPosition(1), FB: 2 } } };
    expect(pointsFor(tackles, { won_tackle: 3 }, LEFT_BACK)).toBe(6);
    expect(pointsFor(tackles, { won_tackle: 3 }, CENTRE_BACK)).toBe(3);
  });

  test("by area: the same two are paid alike", () => {
    const tackles: ScoringRule = { shape: "perAction", stat: "won_tackle", values: { byArea: { ...everyArea(1), defence: 2 } } };
    expect(pointsFor(tackles, { won_tackle: 3 }, LEFT_BACK)).toBe(6);
    expect(pointsFor(tackles, { won_tackle: 3 }, CENTRE_BACK)).toBe(6);
  });

  test("the same for all: every slot is paid alike", () => {
    const assists: ScoringRule = { shape: "perAction", stat: "assists", values: { all: 3 } };
    for (const cell of [LEFT_BACK, LEFT_WINGER, centreOf("goalkeeper")]) expect(pointsFor(assists, { assists: 1 }, cell)).toBe(3);
  });

  test("by position works for every shape: bands for a winger, per count for a keeper", () => {
    const dribbles: ScoringRule = { shape: "bands", stat: "won_contest", stack: false, values: { byPosition: { ...everyPosition([]), W: [{ atLeast: 3, points: 2 }] } } };
    expect(pointsFor(dribbles, { won_contest: 3 }, LEFT_WINGER)).toBe(2);
    expect(pointsFor(dribbles, { won_contest: 3 }, centreOf("attackingMidfield"))).toBe(0);

    const saves: ScoringRule = { shape: "perCount", stat: "saves", values: { byPosition: { ...everyPosition({ every: 3, points: 0 }), GK: { every: 3, points: 1 } } } };
    expect(pointsFor(saves, { saves: 7 }, centreOf("goalkeeper"))).toBe(2);
  });
});

describe("a points limit", () => {
  test("holds a rule to its most: 12 defensive actions at 0.5 each pay 2, not 6", () => {
    const rule: ScoringRule = { shape: "perAction", stat: "defensive_contribution", values: { all: 0.5 }, limit: { all: { max: 2, min: null } } };
    expect(pointsFor(rule, { defensive_contribution: 12 }, CENTRE_BACK)).toBe(2);
    expect(pointsFor(rule, { defensive_contribution: 3 }, CENTRE_BACK)).toBe(1.5);
  });

  test("holds a rule to its least: 5 conceded at -1 each take only 3", () => {
    const rule: ScoringRule = { shape: "perAction", stat: "goals_conceded", values: { all: -1 }, limit: { all: { max: null, min: -3 } } };
    expect(pointsFor(rule, { goals_conceded: 5 }, CENTRE_BACK)).toBe(-3);
    expect(pointsFor(rule, { goals_conceded: 2 }, CENTRE_BACK)).toBe(-2);
  });

  test("is priced like values: a keeper's saves capped at 3, nobody else's", () => {
    const rule: ScoringRule = {
      shape: "perAction",
      stat: "saves",
      values: { all: 1 },
      limit: { byArea: { ...everyArea({ max: null, min: null }), goalkeeper: { max: 3, min: null } } },
    };
    expect(pointsFor(rule, { saves: 8 }, centreOf("goalkeeper"))).toBe(3);
    expect(pointsFor(rule, { saves: 8 }, CENTRE_BACK)).toBe(8);
  });

  test("holds only the rule's own points: the rest of the match is untouched", () => {
    const set = setOf(
      { shape: "perAction", stat: "defensive_contribution", values: { all: 1 }, limit: { all: { max: 2, min: null } } },
      { shape: "perAction", stat: "goals_scored", values: { all: 6 } },
    );
    expect(scoreMatch({ defensive_contribution: 10, goals_scored: 1 }, set, CENTRE_BACK).total).toBe(8);
  });
});

describe("a minimum of minutes", () => {
  const cleanSheet: ScoringRule = { shape: "perAction", stat: "clean_sheets", values: { all: 4 }, minMinutes: { all: 60 } };

  test.each([
    [59, 0],
    [60, 4],
    [90, 4],
  ])("a clean sheet at %i minutes pays %i", (minutes, points) => {
    expect(scoreMatch({ minutes, clean_sheets: 1 }, setOf(cleanSheet), CENTRE_BACK).total).toBe(points);
  });

  test("a record with no minutes in it is 0 minutes, so a rule behind a minimum pays nothing", () => {
    expect(scoreMatch({ clean_sheets: 1 }, setOf(cleanSheet), CENTRE_BACK).total).toBe(0);
  });

  test("is priced like values: 45 for a forward, 60 for the rest", () => {
    const shots: ScoringRule = {
      shape: "perAction",
      stat: "total_scoring_att",
      values: { all: 1 },
      minMinutes: { byPosition: { ...everyPosition(60), ST: 45 } },
    };
    expect(scoreMatch({ minutes: 50, total_scoring_att: 2 }, setOf(shots), centreOf("attack")).total).toBe(2);
    expect(scoreMatch({ minutes: 50, total_scoring_att: 2 }, setOf(shots), LEFT_WINGER).total).toBe(0);
  });
});

describe("points in tenths", () => {
  test("0.1 a pass three times is 0.3, and two tenths' rules add to 0.3, never floating point's noise", () => {
    const passes: ScoringRule = { shape: "perAction", stat: "accurate_pass", values: { all: 0.1 } };
    const touches: ScoringRule = { shape: "perAction", stat: "touches", values: { all: 0.2 } };
    expect(scoreMatch({ accurate_pass: 3 }, setOf(passes), CENTRE_BACK).categories).toEqual([{ stat: "accurate_pass", points: 0.3 }]);
    expect(scoreMatch({ accurate_pass: 1, touches: 1 }, setOf(passes, touches), CENTRE_BACK).total).toBe(0.3);
  });

  test("tenths that cancel out total 0, never -0", () => {
    const set = setOf(
      { shape: "perAction", stat: "accurate_pass", values: { all: 0.3 } },
      { shape: "perAction", stat: "fouls", values: { all: -0.1 } },
      { shape: "perAction", stat: "dispossessed", values: { all: -0.2 } },
    );
    expect(Object.is(scoreMatch({ accurate_pass: 1, fouls: 1, dispossessed: 1 }, set, CENTRE_BACK).total, 0)).toBe(true);
  });

  test("a league counting whole points only scores as any other", () => {
    const set: ScoringSet = { rules: [{ shape: "perAction", stat: "assists", values: { all: 3 } }], wholePointsOnly: true };
    expect(scoreMatch({ assists: 2 }, set, CENTRE_BACK).total).toBe(6);
  });
});

describe("a set is refused, with the reason", () => {
  const { ST: _leftOut, ...withoutStriker } = everyPosition(5);
  const rule = (extra: object) => ({ shape: "perAction", stat: "goals_scored", values: { all: 5 }, ...extra });
  test.each([
    ["one that doesn't say whether points are whole only", { rules: [] }, "a scoring set must say whether its points are whole only, true or false, not undefined"],
    ["a rule priced two ways", setOf(rule({ values: { all: 5, byArea: everyArea(5) } }) as ScoringRule), "the Goals scored rule must be priced one way, the same for all, by area or by position, not 2"],
    ["a rule priced no way", setOf(rule({ values: {} }) as ScoringRule), "the Goals scored rule must be priced one way, the same for all, by area or by position, not 0"],
    ["a rule by position missing the striker", setOf(rule({ values: { byPosition: withoutStriker } }) as ScoringRule), "the Goals scored rule has no values for ST"],
    ["a value finer than a tenth", setOf(rule({ values: { all: 0.25 } }) as ScoringRule), "the Goals scored rule pays 0.25; points are kept in tenths"],
    ["a points limit whose least is above its most", setOf(rule({ limit: { all: { max: 2, min: 3 } } }) as ScoringRule), "the Goals scored rule's points limit pays at least 3, more than its most, 2"],
    ["a points limit of text", setOf(rule({ limit: { all: { max: "2", min: null } } }) as ScoringRule), 'the Goals scored rule\'s points limit pays at most "2", not a number'],
    ["minimum minutes below 0", setOf(rule({ minMinutes: { all: -1 } }) as ScoringRule), "the Goals scored rule's minimum minutes is -1; it can't be less than 0"],
    ["minimum minutes of text", setOf(rule({ minMinutes: { all: "60" } }) as ScoringRule), 'the Goals scored rule\'s minimum minutes is "60", not a number'],
  ])("%s", (_what, set, reason) => {
    expect(() => validateScoringSet(set)).toThrow(reason);
  });

  test.each([
    ["a per-action value", { shape: "perAction", stat: "tackles", values: { all: 0.5 } }, "the Tackles rule pays 0.5"],
    ["a band's points", { shape: "bands", stat: "minutes", stack: false, values: { all: [{ atLeast: 60, points: 1.5 }] } }, "band 1, pays 1.5"],
    ["a per-count rule's points", { shape: "perCount", stat: "saves", values: { all: { every: 3, points: 0.5 } } }, "the Saves rule pays 0.5"],
    ["a points limit", { shape: "perAction", stat: "tackles", values: { all: 1 }, limit: { all: { max: 2.5, min: null } } }, "pays at most 2.5"],
  ])("in a league counting whole points only, %s that is a fraction", (_what, rule, reason) => {
    expect(() => validateScoringSet({ rules: [rule], wholePointsOnly: true })).toThrow(`${reason}, but the set counts whole points only`);
  });
});
