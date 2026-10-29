// A scoring set for the tests only, never a default anyone plays: the first real set is FPL's,
// in firstRules.ts (spec/14, The first scoring set). Keyed on FPL's stat names, as `fplStatLines`
// gives them.

import { SLOT_POSITIONS, type Cell, type SlotPosition } from "../../../convex/lineup/pitch";
import { AREAS, type Area, type ByArea, type ByPosition, type OwnStat, type ScoringSet } from "../../../convex/scoring/scoringSet";

/** The slot in the centre of an area: where the tests stand a player when only his area matters. */
export const centreOf = (area: Area): Cell => ({ area, lane: "centre" });

/** The same value in every area. */
export function everyArea<Value>(value: Value): ByArea<Value> {
  return Object.fromEntries(AREAS.map((area) => [area, value])) as Record<Area, Value>;
}

/** The same value for every position a slot can be. */
export function everyPosition<Value>(value: Value): ByPosition<Value> {
  return Object.fromEntries(SLOT_POSITIONS.map((position) => [position, value])) as Record<SlotPosition, Value>;
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

/** One rule of each shape, values set per area and the same for all, both kinds of band rule. */
export const EXAMPLE_SET: ScoringSet = {
  rules: [
    {
      shape: "perAction",
      stat: "goals_scored",
      values: { byArea: { goalkeeper: 10, defence: 6, defensiveMidfield: 6, midfield: 5, attackingMidfield: 5, attack: 4 } },
    },
    {
      shape: "perAction",
      stat: "assists",
      values: { byArea: { ...everyArea(3), attackingMidfield: 4 } },
    },
    {
      shape: "bands",
      stat: "minutes",
      stack: false,
      values: { byArea: everyArea(MINUTES_BANDS) },
    },
    {
      shape: "perCount",
      stat: "saves",
      values: { byArea: { ...everyArea({ every: 3, points: 0 }), goalkeeper: { every: 3, points: 1 } } },
    },
    {
      shape: "perCount",
      stat: "goals_conceded",
      values: { byArea: { ...everyArea({ every: 2, points: 0 }), goalkeeper: CONCEDED_AT_BACK, defence: CONCEDED_AT_BACK } },
    },
    {
      shape: "bands",
      stat: "defensive_contribution",
      stack: true,
      values: { byArea: { ...everyArea(TWO_FOR_TWELVE), goalkeeper: [], defence: TWO_FOR_TEN, defensiveMidfield: TWO_FOR_TEN } },
    },
    { shape: "perAction", stat: "yellow_cards", values: { all: -1 } },
  ],
  wholePointsOnly: false,
};

/** One of the site's own stats (spec/14, Own stats): tackles won + 0.5 × clearances. */
export const TACKLES_AND_CLEARANCES: OwnStat = {
  stat: "own_tackles_and_clearances",
  name: "Tackles and clearances",
  shortCode: "T+C",
  parts: [
    { stat: "won_tackle", weight: 1 },
    { stat: "total_clearance", weight: 0.5 },
  ],
};
