import { momentIn } from "../shared/moments";

// A letter's times are told in the reader's zone as they read it, not the one it was filed in
// (Craig, 1 Nov 2026: "users time zone"; #912), so a manager who travels reads every letter, old
// ones too, in the zone they are in now. A letter keeps each moment it names in `moments`, and its
// words hold a mark for each, told when it is read.

/** How a letter's words tell a moment. */
export type TellMoment = (at: number) => string;

/** Tells a moment in `zone`, the reader's, or London's while it isn't known. */
export const tellIn =
  (zone: string | undefined): TellMoment =>
  (at) =>
    momentIn(at, zone);

const markOf = (index: number) => `{moment:${index}}`;
const MARK = /\{moment:(\d+)\}/g;

/** A `TellMoment` that marks each moment it is given and keeps it in `moments`, for filing. */
export function marking(): { tell: TellMoment; moments: number[] } {
  const moments: number[] = [];
  return { moments, tell: (at) => markOf(moments.push(at) - 1) };
}

/** `text` with each of its marks told in `zone`. A letter with no `moments` is left as written,
 *  so a mark someone typed stays as they typed it. */
export function toldIn(text: string, moments: readonly number[] | undefined, zone: string | undefined): string {
  if (moments === undefined) return text;
  return text.replace(MARK, (mark, index: string) => {
    const at = moments[Number(index)];
    return at === undefined ? mark : momentIn(at, zone);
  });
}

/** A letter's subject and body as someone in `zone` reads them. */
export const letterAsRead = (
  { subject, body, moments }: { subject: string; body: string; moments?: readonly number[] },
  zone: string | undefined,
) => ({ subject: toldIn(subject, moments, zone), body: toldIn(body, moments, zone) });
