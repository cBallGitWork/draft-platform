// scripts/record-match.mjs loads this under plain node: import only types, or other files by explicit `.ts` path.
// A moment as the league reads it: on the Premier League's own clock, with its zone named, so an
// email and a screen say one moment the same way. No imports, so the screens can read it too.

/** The English every date and list is written in, on a screen or in an email. */
export const LOCALE = "en-GB";

/** The Premier League's own zone, every moment is told in; vitest.config.ts runs the tests in it. */
export const LONDON_ZONE = "Europe/London";

const londonFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: LONDON_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

/** "Wednesday 21 October at 10:00 BST". */
export const londonTime = (at: number) => londonFormat.format(at);
