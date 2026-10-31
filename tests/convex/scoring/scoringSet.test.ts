import { describe, expect, test } from "vitest";
import { everyArea, EXAMPLE_SET, MINUTES_BANDS, TACKLES_AND_CLEARANCES } from "../../support/convex/scoring.example";
import { checkOwnStatsAgainstCatalogue } from "../../../convex/scoring/ownStats";
import { validateScoringSet } from "../../../convex/scoring/scoringSet";
import { inTenths, UnsoundScoring } from "../../../convex/scoring/values";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import ownStatsSource from "../../../convex/scoring/ownStats.ts?raw";
import scoringSetSource from "../../../convex/scoring/scoringSet.ts?raw";
import valuesSource from "../../../convex/scoring/values.ts?raw";

// What #25 refuses on save, and scoreMatch before scoring, with the reason. Unchecked, many of
// these scored with no error: a typo underpaid a whole category, or text was read as a number.

test("a good set passes, an area with no bands among it", () => {
  expect(() => validateScoringSet(EXAMPLE_SET)).not.toThrow();
});

/** A set of these rules, fractions allowed. */
const setOf = (...rules: unknown[]) => ({ rules, wholePointsOnly: false });
const goals = (byArea: unknown) => setOf({ shape: "perAction", stat: "goals_scored", values: { byArea } });
const saves = (byArea: unknown) => setOf({ shape: "perCount", stat: "saves", values: { byArea } });
const minutes = (bands: unknown, stacking: object = { stack: false }) =>
  setOf({ shape: "bands", stat: "minutes", ...stacking, values: { byArea: everyArea(bands) } });
const { attack: _leftOut, ...noAttack } = everyArea(5);

test.each([
  ["a set with no list of rules", {}, "a scoring set must be a list of rules"],
  ["a rule that is not a rule", setOf(null), "rule 1 of the scoring set is not a rule"],
  [
    "a rule naming no stat",
    setOf(...goals(everyArea(5)).rules, { shape: "perAction", values: { all: 1 } }),
    "rule 2 of the scoring set names no stat",
  ],
  [
    "a rule of no known shape",
    setOf({ shape: "perMinute", stat: "minutes", values: { all: 1 } }),
    'the Minutes rule has the shape "perMinute", which is not one of the three',
  ],
  [
    "a band rule that doesn't say whether it stacks",
    minutes(MINUTES_BANDS, {}),
    "the Minutes rule must say whether its bands stack, true or false, not undefined",
  ],
  [
    "a band rule whose stack is the text \"false\"",
    minutes(MINUTES_BANDS, { stack: "false" }),
    'the Minutes rule must say whether its bands stack, true or false, not "false"',
  ],
  ["a rule with no values by area", goals(undefined), "the Goals scored rule has no values by area"],
  ["a rule with no values for its last area", goals(noAttack), "the Goals scored rule has no values for attack"],
  ["a per-action value of text", goals(everyArea("five")), 'the Goals scored rule in goalkeeper is worth "five", not a number'],
  ["a per-action value of null", goals(everyArea(null)), "the Goals scored rule in goalkeeper is worth null, not a number"],
  ["a per-action value of NaN", goals(everyArea(NaN)), "the Goals scored rule in goalkeeper is worth NaN, not a number"],
  [
    "a per-action value of the text \"5\", in the last area only",
    goals({ ...everyArea(5), attack: "5" }),
    'the Goals scored rule in attack is worth "5", not a number',
  ],
  ["a per-count value that is one number", saves(everyArea(3)), "in goalkeeper has no number of actions and points"],
  [
    "a per-count rule of every 0 actions",
    saves(everyArea({ every: 0, points: 1 })),
    "the Saves rule in goalkeeper is worth points for every 0 actions; it must be more than 0",
  ],
  [
    "a per-count rule of every \"3\" actions",
    saves(everyArea({ every: "3", points: 1 })),
    'the Saves rule in goalkeeper is worth points for every "3", not a number',
  ],
  [
    "a per-count rule with no points",
    saves(everyArea({ every: 3 })),
    "the Saves rule in goalkeeper is worth undefined, not a number",
  ],
  ["band values that are no list", minutes({ atLeast: 60, points: 2 }), "in goalkeeper has no list of bands"],
  ["a band that is not a band", minutes([null]), "the Minutes rule in goalkeeper, band 1, is not a band"],
  [
    "a band with no points, in a rule that scores only the highest",
    minutes([{ atLeast: 1, points: 1 }, { atLeast: 60 }]),
    "the Minutes rule in goalkeeper, band 2, is worth undefined, not a number",
  ],
  [
    "a band starting at NaN",
    minutes([{ atLeast: NaN, points: 2 }]),
    "the Minutes rule in goalkeeper, band 1, starts at NaN, not a number",
  ],
  ["a band with no start", minutes([{ points: 2 }]), "band 1, starts at undefined, not a number"],
  [
    "two bands at one threshold",
    minutes([
      { atLeast: 60, points: 1 },
      { atLeast: 60, points: 2 },
    ]),
    "the Minutes rule in goalkeeper has two bands at one threshold",
  ],
])("%s is refused, with the reason", (_what, set, reason) => {
  expect(() => validateScoringSet(set)).toThrow(reason);
});

describe("a rule scores a catalogue stat or one of the site's own, never a key no record holds (#135)", () => {
  const perAction = (stat: string) => ({ shape: "perAction", stat, values: { all: 1 } });

  test("a typo of a catalogue stat is refused, naming it", () => {
    expect(() => validateScoringSet(setOf(perAction("goals_scroed")))).toThrow(
      `rule 1 of the scoring set scores "goals_scroed", which is neither a catalogue stat nor one of the set's own stats`,
    );
  });

  test("a catalogue stat passes", () => {
    expect(() => validateScoringSet(setOf(perAction("won_tackle")))).not.toThrow();
  });

  test("the key of one of the site's own stats passes", () => {
    const set = { ...setOf(perAction(TACKLES_AND_CLEARANCES.stat)), ownStats: [TACKLES_AND_CLEARANCES] };
    expect(() => validateScoringSet(set)).not.toThrow();
  });

  test("an own stat's key is refused in a set that doesn't make it, naming the rule's place", () => {
    expect(() => validateScoringSet(setOf(perAction("won_tackle"), perAction(TACKLES_AND_CLEARANCES.stat)))).toThrow(
      `rule 2 of the scoring set scores "${TACKLES_AND_CLEARANCES.stat}"`,
    );
  });

  test("the first rules every league starts from still pass", () => {
    expect(() => validateScoringSet(FIRST_SCORING)).not.toThrow();
  });
});

test("inTenths never gives -0: not for a sum just under 0, nor for 0 times -1 (#422)", () => {
  expect(Object.is(inTenths(-0.04), 0)).toBe(true);
  expect(Object.is(inTenths(0 * -1), 0)).toBe(true);
  expect(inTenths(-0.06)).toBe(-0.1);
});

describe("every reason a set is unsound is an UnsoundScoring, so saving refuses it and a bug is never a reason", () => {
  const tackles = (rule: object = {}) => ({ shape: "perAction", stat: "tackles", values: { all: 1 }, ...rule });
  const minutesAll = (all: unknown) => setOf({ shape: "bands", stat: "minutes", stack: false, values: { all } });
  const roles = (roleAdjustments: unknown) => ({ ...setOf(), roleAdjustments });
  const anchor = (adjustments: unknown) => ({ role: "anchor", adjustments });
  const own = (ownStats: unknown) => ({ ...setOf(), ownStats });
  const ownWith = (change: object) => own([{ ...TACKLES_AND_CLEARANCES, ...change }]);
  const T_C = TACKLES_AND_CLEARANCES.stat;

  // One case for each throw in scoringSet.ts and ownStats.ts but the last, in their order.
  const SWEEP: readonly (readonly [unknown, string])[] = [
    [{}, "a scoring set must be a list of rules"],
    [{ rules: [] }, "a scoring set must say whether its points are whole only, true or false, not undefined"],
    [roles({}), "a scoring set's role adjustments must be a list"],
    [roles([{ role: "" }]), "a role adjustment names no role"],
    [roles([anchor([]), anchor([])]), 'the role "anchor" is adjusted twice'],
    [roles([{ role: "anchor" }]), 'the role "anchor" has no list of adjustments'],
    [
      roles([anchor([{ stat: "goals_scroed", points: 1 }])]),
      `the role "anchor" adjusts "goals_scroed", which is neither a catalogue stat nor one of the set's own stats`,
    ],
    [roles([anchor([{ stat: "tackles", points: 1 }, { stat: "tackles", points: 1 }])]), 'the role "anchor" adjusts Tackles twice'],
    [setOf(null), "rule 1 of the scoring set is not a rule"],
    [setOf(tackles({ stat: "" })), "rule 1 of the scoring set names no stat"],
    [setOf(tackles({ stat: "goals_scroed" })), `rule 1 of the scoring set scores "goals_scroed", which is neither a catalogue stat nor one of the set's own stats`],
    [setOf(tackles({ shape: "perMinute" })), 'the Tackles rule has the shape "perMinute", which is not one of the three'],
    [setOf({ shape: "bands", stat: "minutes", values: { all: [] } }), "the Minutes rule must say whether its bands stack, true or false, not undefined"],
    [setOf(tackles({ values: undefined })), "the Tackles rule has no values"],
    [setOf(tackles({ values: { all: 1, byArea: everyArea(1) } })), "the Tackles rule must be priced one way, the same for all, by area or by position, not 2"],
    [setOf(tackles({ values: { byPosition: null } })), "the Tackles rule has no values by position"],
    [setOf(tackles({ values: { byArea: {} } })), "the Tackles rule has no values for goalkeeper"],
    [setOf({ shape: "perCount", stat: "saves", values: { all: 3 } }), "the Saves rule has no number of actions and points"],
    [setOf({ shape: "perCount", stat: "saves", values: { all: { every: 0, points: 1 } } }), "the Saves rule is worth points for every 0 actions; it must be more than 0"],
    [minutesAll({ atLeast: 60, points: 2 }), "the Minutes rule has no list of bands"],
    [minutesAll([null]), "the Minutes rule, band 1, is not a band"],
    [
      minutesAll([
        { atLeast: 60, points: 1 },
        { atLeast: 60, points: 2 },
      ]),
      "the Minutes rule has two bands at one threshold",
    ],
    [setOf(tackles({ limit: { all: null } })), "the Tackles rule's points limit has no most and least"],
    [setOf(tackles({ limit: { all: { max: 1, min: 2 } } })), "the Tackles rule's points limit is worth at least 2, more than its most, 1"],
    [setOf(tackles({ minMinutes: { all: -1 } })), "the Tackles rule's minimum minutes is -1; it can't be less than 0"],
    [{ rules: [tackles({ values: { all: 0.5 } })], wholePointsOnly: true }, "the Tackles rule is worth 0.5, but the set counts whole points only"],
    [setOf(tackles({ values: { all: 0.25 } })), "the Tackles rule is worth 0.25; points are kept in tenths"],
    [setOf(tackles({ values: { all: "1" } })), 'the Tackles rule is worth "1", not a number'],
    [own({}), "a scoring set's own stats must be a list"],
    [own([{ stat: "" }]), "own stat 1 has no key"],
    [ownWith({ stat: "tackles" }), "the own stat tackles has a catalogue stat's key"],
    [own([TACKLES_AND_CLEARANCES, TACKLES_AND_CLEARANCES]), `the own stat ${T_C} is made twice`],
    [ownWith({ name: " " }), `the own stat ${T_C} has no name`],
    [
      own([TACKLES_AND_CLEARANCES, { ...TACKLES_AND_CLEARANCES, stat: "own_other" }]),
      'the own stat own_other has the name "Tackles and clearances", which another own stat has',
    ],
    [ownWith({ parts: [] }), `the own stat ${T_C} adds up no stats`],
    [ownWith({ parts: [null] }), `the own stat ${T_C} has a part that names no stat`],
    [ownWith({ parts: [{ stat: "goals_scroed", weight: 1 }] }), `the own stat ${T_C} adds "goals_scroed", which isn't a catalogue stat`],
  ];

  const thrownBy = (check: () => void): unknown => {
    try {
      check();
    } catch (error) {
      return error;
    }
    return null;
  };

  test.each(SWEEP)("%j is refused as unsound, with the reason %j", (set, reason) => {
    const error = thrownBy(() => validateScoringSet(set));
    expect(error).toBeInstanceOf(UnsoundScoring);
    expect((error as Error).message).toBe(reason);
  });

  test("the last, checked on saving only: an own stat named as a catalogue stat is refused as unsound, with the reason", () => {
    const error = thrownBy(() => checkOwnStatsAgainstCatalogue([{ ...TACKLES_AND_CLEARANCES, name: "Won tackle" }]));
    expect(error).toBeInstanceOf(UnsoundScoring);
    expect((error as Error).message).toBe(`the own stat ${T_C} has the name "Won tackle", which the catalogue's Won tackle has`);
  });

  test("the sweep has a case for each throw, and every throw is an UnsoundScoring", () => {
    const source = `${scoringSetSource}\n${ownStatsSource}\n${valuesSource}`;
    expect(source.match(/throw new (?!UnsoundScoring\()/g)).toBeNull();
    expect(source.match(/throw new UnsoundScoring\(/g)?.length).toBe(SWEEP.length + 1);
  });
});
