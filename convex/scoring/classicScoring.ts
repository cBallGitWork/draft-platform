import type { Area, Cell } from "../lineup/pitch";
import type { Line } from "../positions/lines";
import type { StoredScoringSet } from "./scoringSetShape";
import {
  ASSISTS,
  BLOCKS,
  CLEAN_SHEET_MINUTES,
  CLEAN_SHEETS,
  CLEARANCES,
  GOALS,
  GOALS_CONCEDED,
  INTERCEPTIONS,
  MINUTES_STAT,
  OWN_GOALS,
  OWN_STAT_PREFIX,
  PENALTIES_MISSED,
  PENALTIES_SAVED,
  RECOVERIES,
  RED_CARDS,
  SAVES,
  TACKLES,
  YELLOW_CARDS,
} from "./statKeys";

// Classic mode's own base scoring set, by line (spec/22, Scoring, `S22.13` to `S22.18`): what a
// classic league scores with in place of the site's set. A player is scored by his line's row,
// whatever slot he fills (`S22.19`): scoreMatch prices him at his line's cell (`LINE_CELL`), so
// the set is priced by area, each line's area holding its row. Data, as the site's set is.

/** Where a player is priced in a classic league: his line's own area, in its centre lane. */
export const LINE_CELL: Readonly<Record<Line, Cell>> = {
  GK: { area: "goalkeeper", lane: "centre" },
  DEF: { area: "defence", lane: "centre" },
  CM: { area: "midfield", lane: "centre" },
  AM: { area: "attackingMidfield", lane: "centre" },
  FWD: { area: "attack", lane: "centre" },
};

/** A row of spec/22's table, in its order (FWD, AM, CM, DEF, GK), spread over the six areas. The
 *  defensive midfield area, which no line is priced at, takes CM's, the line its CDMs are in. */
function byLine<Value>(fwd: Value, am: Value, cm: Value, def: Value, gk: Value): { byArea: Record<Area, Value> } {
  return { byArea: { goalkeeper: gk, defence: def, defensiveMidfield: cm, midfield: cm, attackingMidfield: am, attack: fwd } };
}

/** The midfield stat: tackles + interceptions + blocked shots + ¼ recoveries (`S22.14`). */
export const MIDFIELD_STAT = `${OWN_STAT_PREFIX}classic_midfield_stat` as const;
/** The defender stat, Fantrax's DFP: tackles + interceptions + blocked shots + ¼ clearances (`S22.14`). */
export const DEFENDER_STAT = `${OWN_STAT_PREFIX}classic_defender_stat` as const;

const BLOCKING = [
  { stat: TACKLES, weight: 1 },
  { stat: INTERCEPTIONS, weight: 1 },
  { stat: BLOCKS, weight: 1 },
];

const NONE_PER_2 = { every: 2, points: 0 };
const NONE_PER_4 = { every: 4, points: 0 };

export const CLASSIC_SCORING: StoredScoringSet = {
  ownStats: [
    { stat: MIDFIELD_STAT, name: "Midfield stat", shortCode: "MIDS", parts: [...BLOCKING, { stat: RECOVERIES, weight: 0.25 }] },
    { stat: DEFENDER_STAT, name: "Defender stat", shortCode: "DEFS", parts: [...BLOCKING, { stat: CLEARANCES, weight: 0.25 }] },
  ],
  rules: [
    // Appearance: 1, or 2 at 60+ minutes, for every line (`S22.18`).
    { shape: "bands", stat: MINUTES_STAT, stack: false, values: { all: [{ atLeast: 1, points: 1 }, { atLeast: CLEAN_SHEET_MINUTES, points: 2 }] } },
    { shape: "perAction", stat: GOALS, values: byLine(4, 5, 5, 5, 5) },
    { shape: "perAction", stat: ASSISTS, values: { all: 3 } },
    { shape: "perAction", stat: CLEAN_SHEETS, values: byLine(0, 0, 2, 4, 4), minMinutes: { all: CLEAN_SHEET_MINUTES } },
    // −1 per 2 conceded for DEF and GK (`S22.17`).
    { shape: "perCount", stat: GOALS_CONCEDED, values: byLine(NONE_PER_2, NONE_PER_2, NONE_PER_2, { every: 2, points: -1 }, { every: 2, points: -1 }) },
    // Defcon counts per action, never FPL's all-or-nothing +2 (`S22.14`).
    { shape: "perCount", stat: MIDFIELD_STAT, values: byLine(NONE_PER_4, { every: 5, points: 1 }, { every: 4, points: 1 }, NONE_PER_4, NONE_PER_4) },
    { shape: "perCount", stat: DEFENDER_STAT, values: byLine(NONE_PER_4, NONE_PER_4, NONE_PER_4, { every: 4, points: 1 }, NONE_PER_4) },
    { shape: "perCount", stat: SAVES, values: byLine(NONE_PER_2, NONE_PER_2, NONE_PER_2, NONE_PER_2, { every: 2, points: 1 }) },
    // Every line (`S22.15`). No FPL bonus: no rule names it (`S22.16`).
    { shape: "perAction", stat: YELLOW_CARDS, values: { all: -1 } },
    { shape: "perAction", stat: RED_CARDS, values: { all: -3 } },
    { shape: "perAction", stat: OWN_GOALS, values: { all: -2 } },
    { shape: "perAction", stat: PENALTIES_MISSED, values: { all: -2 } },
    { shape: "perAction", stat: PENALTIES_SAVED, values: { all: 5 } },
  ],
  wholePointsOnly: false,
};
