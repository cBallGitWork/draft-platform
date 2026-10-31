// How Scouting shows a stat's season total (#373).

import { figureWords } from "../shared/words";

/** The decimal places a stat's season total shows: expected goals come in hundredths. */
const STAT_DECIMALS_SHOWN = 2;

/** A stat's season total, to two decimal places at most and no trailing zeros. An own stat that
 *  takes one stat from another can fall below 0: "−1.5". */
export const statFigure = (value: number) => figureWords(Number(value.toFixed(STAT_DECIMALS_SHOWN)));
