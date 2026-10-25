// How Scouting shows a stat's season total (#373).

/** The decimal places a stat's season total shows: expected goals come in hundredths. */
const STAT_DECIMALS_SHOWN = 2;

/** A stat's season total, to two decimal places at most and no trailing zeros. */
export const statFigure = (value: number) => String(Number(value.toFixed(STAT_DECIMALS_SHOWN)));
