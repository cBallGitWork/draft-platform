// How a number is written wherever it is shown, on a screen, in a letter or in a commentary line:
// one minus sign, the true minus (U+2212), never the hyphen (#564). Display only: no points move.
// No imports, so the screens can read it too.

/** The minus sign every shown number carries. */
export const MINUS_SIGN = "−";

/** A number as shown: "4.5", "0", "−3". */
export const figureWords = (value: number) => (value < 0 ? `${MINUS_SIGN}${-value}` : String(value));

/** A number shown with its sign, as a difference or an adjustment is: "+4", "0", "−3". */
export const signedWords = (value: number) => (value > 0 ? `+${value}` : figureWords(value));
