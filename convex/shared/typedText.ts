import { refuse } from "./leagueAccess";

/** What a typed text is told when it can't be kept: blank, or longer than its most. */
export type TypedTextRefusals = { blank: string; tooLong: string };

/** How many characters a text holds: a code point each. */
const codePoints = (text: string) => [...text].length;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** How many characters a name holds as it looks, so a flag, a skin-toned or a family emoji is one
 *  (spec/13, Teams, S13.2). */
const nameCharacters = (name: string) => [...graphemes.segment(name)].length;

function kept(typed: string, max: number, refusals: TypedTextRefusals, count: (text: string) => number): string {
  const text = typed.trim();
  if (text === "") refuse(refusals.blank);
  if (count(text) > max) refuse(refusals.tooLong);
  return text;
}

/** Typed text as it is kept: trimmed, refused when blank or longer than `max` characters. A
 *  character is a code point, so an emoji counts as one. */
export function typedText(typed: string, max: number, refusals: TypedTextRefusals): string {
  return kept(typed, max, refusals, codePoints);
}

/** A typed name or subject as it is kept: trimmed, on one line, each run of spaces, tabs and line
 *  breaks one space, so it can never break a list of names, a Mail subject or a line of a recap's
 *  facts. Its characters are counted as they look (`nameCharacters`). */
export function typedName(typed: string, max: number, refusals: TypedTextRefusals): string {
  return kept(typed.replace(/\s+/g, " "), max, refusals, nameCharacters);
}
