// How a stat's season total shows, on Scouting and in the draft room (#373).

import { MINUS_SIGN } from "../../convex/shared/numberWords";
import { figureWords } from "./words";

/** The decimal places a stat's season total shows: expected goals come in hundredths. */
const STAT_DECIMALS_SHOWN = 2;

/** A stat's season total, to two decimal places at most and no trailing zeros. An own stat that
 *  takes one stat from another can fall below 0: "−1.5". */
export const statFigure = (value: number) => figureWords(Number(value.toFixed(STAT_DECIMALS_SHOWN)));

/** Points, kept in tenths (spec/14), always to one place, as the table's F and A columns show them
 *  (approved/table/1440.png): "352.0" beside "271.2", "−3.5". */
export const tenthsFigure = (value: number) => {
  const shown = Math.abs(value).toFixed(1);
  return value < 0 && shown !== "0.0" ? `${MINUS_SIGN}${shown}` : shown;
};
