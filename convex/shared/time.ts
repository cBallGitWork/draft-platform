// scripts/record-match.mjs and scripts/with-deadline.mjs load this under plain node: import only types, or other files by explicit `.ts` path.
// Units of time in milliseconds, the unit Date.now() and Convex's scheduler count in, and the
// season's calendar. They are the calendar's and the Premier League's, not any league rule's, so
// they are constants with one home.

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

/** `Date.UTC`'s month for July: a season's last match is in May and the next one's first in August,
 *  so a season is counted from 1 July. */
export const JULY = 6;
/** `Date.UTC`'s month for June: from 1 June after its season, FPL may send no fixtures until it
 *  publishes the next season's (#66). */
export const JUNE = 5;
/** The year the season `at` falls in starts, 2026 for 2026/27: a season runs from 1 July (JULY)
 *  to 30 June. The one way the platform knows a season (#355). */
export function seasonStartYear(at: number): number {
  const date = new Date(at);
  return date.getUTCFullYear() - (date.getUTCMonth() < JULY ? 1 : 0);
}

/** When the season `at` falls in began: 1 July of `seasonStartYear`, UTC. */
export const seasonStartAt = (at: number): number => Date.UTC(seasonStartYear(at), JULY, 1);

/** About when a match's lineups are out before kickoff: spec/10's "about an hour". The Premier
 *  League had them out at the first read 58 minutes before (docs/pl-commentary.md, What a live
 *  match showed). The live tick reads the team sheets from then, and the matchup's commentary
 *  sorts an untimed line there. */
export const LINEUPS_OUT_BEFORE_KICKOFF_MS = HOUR_MS;

/** A span in whole units as words say it; a span that isn't whole is a slip in a constant, so it
 *  throws rather than be worded wrong. */
function spanWords(ms: number, unitMs: number, unit: string, one: string): string {
  const count = ms / unitMs;
  if (!Number.isInteger(count) || count < 1) throw new Error(`${ms} ms is no whole number of ${unit}s`);
  return count === 1 ? one : `${count} ${unit}s`;
}

/** A span in hours, as a letter or a screen says it: "an hour", "24 hours". */
export const hoursWords = (ms: number) => spanWords(ms, HOUR_MS, "hour", "an hour");
/** A span in days: "a day", "7 days". */
export const daysWords = (ms: number) => spanWords(ms, DAY_MS, "day", "a day");
