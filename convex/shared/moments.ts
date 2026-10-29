// scripts/record-match.mjs loads this under plain node: import only types, or other files by explicit `.ts` path.
// A moment as a person reads it: in their own zone, with the zone named (Craig, 26 Oct 2026, #442:
// managers are around the world), and on the Premier League's own clock while theirs isn't known.
// No imports, so the screens can read it too.

/** The English every date and list is written in, on a screen or in an email. */
export const LOCALE = "en-GB";

/** The Premier League's own zone: a moment's zone while the reader's isn't known; the tests run in it too. */
export const LONDON_ZONE = "Europe/London";

/** "A", "A and B", "A, B and C": no comma before the last "and". Written out rather than through
 *  Intl.ListFormat, so it reads the same whatever locale data a runtime holds. */
export function andListWords(items: readonly string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const MOMENT = { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZoneName: "short" } as const;
const formats = new Map<string, Intl.DateTimeFormat>();

/** Whether `zone` is a time zone this runtime knows, as a browser names it ("Australia/Sydney"). */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** "Wednesday 21 October at 10:00 BST": `at` in `zone`, the reader's own, or London's when it
 *  isn't known. */
export function momentIn(at: number, zone: string | undefined): string {
  const key = zone ?? LONDON_ZONE;
  let format = formats.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(LOCALE, { ...MOMENT, timeZone: key });
    formats.set(key, format);
  }
  return format.format(at);
}

/** The zone this browser is in: on a screen, the reader's own. */
export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** `at` on a screen, in the zone of whoever is looking at it. */
export const screenMoment = (at: number) => momentIn(at, browserZone());
