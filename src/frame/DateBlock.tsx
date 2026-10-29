import { letterDay, letterTime } from "../mail/words";

/** A day and time in a date block (plate.md): a letter's in Mail, a letter's and a move's on the
 *  league's home. */
export function DateBlock({ at }: { at: number }) {
  return (
    <time dateTime={new Date(at).toISOString()} className="bg-plate px-1 text-center whitespace-nowrap">
      {letterDay(at)} <span className="text-soft">{letterTime(at)}</span>
    </time>
  );
}
