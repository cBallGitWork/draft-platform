// Scoring sets for the tests only, never a default anyone plays: the first real set is Craig's to
// edit from the Tim Hortons Pro League's values (spec/14, The first scoring set). Keyed on FPL's
// stat names, as `fplStatLines` gives them; the second dot keeps this file out of Convex's deploy.

import { AREAS, type Area, type Band, type ByArea, type ScoringSet } from "./scoring";

/** The same value in every area. */
export function everyArea<Value>(value: Value): ByArea<Value> {
  return Object.fromEntries(AREAS.map((area) => [area, value])) as Record<Area, Value>;
}

const NO_BANDS: readonly Band[] = [];
/** -1 for every two goals conceded, for the keeper and the defence only. */
const CONCEDED_AT_BACK = { every: 2, points: -1 };

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
      byArea: everyArea([
        { atLeast: 1, points: 1 },
        { atLeast: 60, points: 2 },
      ]),
    },
    {
      shape: "perCount",
      stat: "saves",
      byArea: { ...everyArea({ every: 3, points: 0 }), goalkeeper: { every: 3, points: 1 } },
    },
    {
      shape: "perCount",
      stat: "goals_conceded",
      byArea: {
        ...everyArea({ every: 2, points: 0 }),
        goalkeeper: CONCEDED_AT_BACK,
        defence: CONCEDED_AT_BACK,
      },
    },
    {
      shape: "bands",
      stat: "defensive_contribution",
      stack: true,
      byArea: {
        goalkeeper: NO_BANDS,
        defence: [{ atLeast: 10, points: 2 }],
        defensiveMidfield: [{ atLeast: 10, points: 2 }],
        midfield: [{ atLeast: 12, points: 2 }],
        attackingMidfield: [{ atLeast: 12, points: 2 }],
        attack: [{ atLeast: 12, points: 2 }],
      },
    },
    { shape: "perAction", stat: "yellow_cards", byArea: everyArea(-1) },
  ],
};
