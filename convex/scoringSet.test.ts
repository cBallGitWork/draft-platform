import { expect, test } from "vitest";
import { everyArea, EXAMPLE_SET, MINUTES_BANDS } from "./scoring.example";
import { validateScoringSet } from "./scoringSet";

// What #25 refuses on save, and scoreMatch before scoring, with the reason. Unchecked, many of
// these scored with no error: a typo underpaid a whole category, or text was read as a number.

test("a good set passes, an area with no bands among it", () => {
  expect(() => validateScoringSet(EXAMPLE_SET)).not.toThrow();
});

const goals = (byArea: unknown) => ({ rules: [{ shape: "perAction", stat: "goals", byArea }] });
const saves = (byArea: unknown) => ({ rules: [{ shape: "perCount", stat: "saves", byArea }] });
const minutes = (bands: unknown, stacking: object = { stack: false }) => ({
  rules: [{ shape: "bands", stat: "minutes", ...stacking, byArea: everyArea(bands) }],
});
const { attack: _leftOut, ...noAttack } = everyArea(5);

test.each([
  ["a set with no list of rules", {}, "a scoring set must be a list of rules"],
  ["a rule that is not a rule", { rules: [null] }, "rule 1 of the scoring set is not a rule"],
  [
    "a rule naming no stat",
    { rules: [...goals(everyArea(5)).rules, { shape: "perAction", byArea: everyArea(1) }] },
    "rule 2 of the scoring set names no stat",
  ],
  [
    "a rule of no known shape",
    { rules: [{ shape: "perMinute", stat: "minutes", byArea: everyArea(1) }] },
    'the minutes rule has the shape "perMinute", which is not one of the three',
  ],
  [
    "a band rule that doesn't say whether it stacks",
    minutes(MINUTES_BANDS, {}),
    "the minutes rule must say whether its bands stack, true or false, not undefined",
  ],
  [
    "a band rule whose stack is the text \"false\"",
    minutes(MINUTES_BANDS, { stack: "false" }),
    'the minutes rule must say whether its bands stack, true or false, not "false"',
  ],
  ["a rule with no values by area", goals(undefined), "the goals rule has no values by area"],
  ["a rule with no values for its last area", goals(noAttack), "the goals rule has no values for attack"],
  ["a per-action value of text", goals(everyArea("five")), 'the goals rule in goalkeeper pays "five", not a number'],
  ["a per-action value of null", goals(everyArea(null)), "the goals rule in goalkeeper pays null, not a number"],
  ["a per-action value of NaN", goals(everyArea(NaN)), "the goals rule in goalkeeper pays NaN, not a number"],
  [
    "a per-action value of the text \"5\", in the last area only",
    goals({ ...everyArea(5), attack: "5" }),
    'the goals rule in attack pays "5", not a number',
  ],
  ["a per-count value that is one number", saves(everyArea(3)), "in goalkeeper has no number of actions and points"],
  [
    "a per-count rule of every 0 actions",
    saves(everyArea({ every: 0, points: 1 })),
    "the saves rule in goalkeeper pays for every 0 actions; it must be more than 0",
  ],
  [
    "a per-count rule of every \"3\" actions",
    saves(everyArea({ every: "3", points: 1 })),
    'the saves rule in goalkeeper pays for every "3", not a number',
  ],
  [
    "a per-count rule with no points",
    saves(everyArea({ every: 3 })),
    "the saves rule in goalkeeper pays undefined, not a number",
  ],
  ["band values that are no list", minutes({ atLeast: 60, points: 2 }), "in goalkeeper has no list of bands"],
  ["a band that is not a band", minutes([null]), "the minutes rule in goalkeeper, band 1, is not a band"],
  [
    "a band with no points, in a rule that pays only the highest",
    minutes([{ atLeast: 1, points: 1 }, { atLeast: 60 }]),
    "the minutes rule in goalkeeper, band 2, pays undefined, not a number",
  ],
  [
    "a band starting at NaN",
    minutes([{ atLeast: NaN, points: 2 }]),
    "the minutes rule in goalkeeper, band 1, starts at NaN, not a number",
  ],
  ["a band with no start", minutes([{ points: 2 }]), "band 1, starts at undefined, not a number"],
  [
    "two bands at one threshold",
    minutes([
      { atLeast: 60, points: 1 },
      { atLeast: 60, points: 2 },
    ]),
    "the minutes rule in goalkeeper has two bands at one threshold",
  ],
])("%s is refused, with the reason", (_what, set, reason) => {
  expect(() => validateScoringSet(set)).toThrow(reason);
});
