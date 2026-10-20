// A scoring set for the tests only, never a default anyone plays: the first real set is Craig's to
// edit from the Tim Hortons Pro League's values (spec/14, The first scoring set). Keyed on FPL's
// stat names, as `fplStatLines` gives them; the second dot keeps this file out of Convex's deploy.

import { AREAS, type Area, type ByArea, type ScoringSet } from "./scoring";

/** The same value in every area. */
export function everyArea<Value>(value: Value): ByArea<Value> {
  return Object.fromEntries(AREAS.map((area) => [area, value])) as Record<Area, Value>;
}

/** -1 for every two goals conceded, for the keeper and the defence only. */
const CONCEDED_AT_BACK = { every: 2, points: -1 };

/** 1 for playing, 2 for 60 minutes or more. */
export const MINUTES_BANDS = [
  { atLeast: 1, points: 1 },
  { atLeast: 60, points: 2 },
];

/** 2 for 10 defensive actions in defence and defensive midfield, for 12 further up. */
const TWO_FOR_TEN = [{ atLeast: 10, points: 2 }];
const TWO_FOR_TWELVE = [{ atLeast: 12, points: 2 }];

/** One rule of each shape, values set per area, both kinds of band rule. */
export const EXAMPLE_SET: ScoringSet = {
  rules: [
    {
      shape: "perAction",
      stat: "goals_scored",
      byArea: { goalkeeper: 10, defence: 6, defensiveMidfield: 6, midfield: 5, attackingMidfield: 5, attack: 4 },
    },
    {
      shape: "perAction",
      stat: "assists",
      byArea: { ...everyArea(3), attackingMidfield: 4 },
    },
    {
      shape: "bands",
      stat: "minutes",
      stack: false,
      byArea: everyArea(MINUTES_BANDS),
    },
    {
      shape: "perCount",
      stat: "saves",
      byArea: { ...everyArea({ every: 3, points: 0 }), goalkeeper: { every: 3, points: 1 } },
    },
    {
      shape: "perCount",
      stat: "goals_conceded",
      byArea: { ...everyArea({ every: 2, points: 0 }), goalkeeper: CONCEDED_AT_BACK, defence: CONCEDED_AT_BACK },
    },
    {
      shape: "bands",
      stat: "defensive_contribution",
      stack: true,
      byArea: { ...everyArea(TWO_FOR_TWELVE), goalkeeper: [], defence: TWO_FOR_TEN, defensiveMidfield: TWO_FOR_TEN },
    },
    { shape: "perAction", stat: "yellow_cards", byArea: everyArea(-1) },
  ],
};
