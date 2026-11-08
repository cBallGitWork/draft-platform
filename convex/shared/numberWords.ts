// How a number is written wherever it is shown, on a screen, in a letter or in a commentary line:
// one minus sign, the true minus (U+2212), never the hyphen (#564). Display only: no points move.
// No imports, so the screens can read it too.

/** The minus sign every shown number carries. */
export const MINUS_SIGN = "−";

/** A number as shown: "4.5", "0", "−3". */
export const figureWords = (value: number) => (value < 0 ? `${MINUS_SIGN}${-value}` : String(value));

/** A number shown with its sign, as a difference or an adjustment is: "+4", "0", "−3". */
export const signedWords = (value: number) => (value > 0 ? `+${value}` : figureWords(value));

const COUNT_NAMES = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** A small count written out, as a sentence says it: "two teams", "three matches"; past ten, or
 *  not a whole count, its figure. */
export const countInWords =(count: number) => (Number.isInteger(count) && count >= 0 ? (COUNT_NAMES[count] ?? figureWords(count)) : figureWords(count));
