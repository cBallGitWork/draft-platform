import { refuse } from "./leagueAccess";

/** What a typed text is told when it can't be kept: blank, or longer than its most. */
export type TypedTextRefusals = { blank: string; tooLong: string };

/** Typed text as it is kept: trimmed, refused when blank or longer than `max` characters. A
 *  character is a code point, so an emoji counts as one. */
export function typedText(typed: string, max: number, refusals: TypedTextRefusals): string {
  const text = typed.trim();
  if (text === "") refuse(refusals.blank);
  if ([...text].length > max) refuse(refusals.tooLong);
  return text;
}
