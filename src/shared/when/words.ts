// When things happen, as every screen says it alike: times and days in the viewer's own zone,
// countdowns, gameweeks and seasons.

import { LOCALE } from "../../../convex/shared/moments";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";

/** A gameweek by name, as its tick box and the fixtures' stepper say it. */
export const gameweekWords = (gameweek: number) => `Gameweek ${gameweek}`;
/** A gameweek, short, as a head says it: "GW9" (My team's header band, the player card). */
export const gameweekShort = (gameweek: number) => `GW${gameweek}`;
/** A table's Gameweek column head (the player card, My team's fixtures, Gameweeks). */
export const gameweekColumn = { short: "GW", long: "Gameweek" } as const;
/** When a waiver run or an offer's close falls in `gameweek`'s lock: after its last match, whose
 *  time isn't known ahead (Craig, 11 Nov 2026, on #1467 and #1492): "after GW12's last match". A
 *  line starting with it takes `capitalised` (convex/shared/moments.ts). */
export const afterLastMatchWords = (gameweek: number) => `after ${gameweekShort(gameweek)}'s last match`;

/** A season, short: "25/26" (the draft's list, Scouting, the player card, patch notes, a role card). */
export const seasonShortWords = (startYear: number) => `${String(startYear % 100).padStart(2, "0")}/${String((startYear + 1) % 100).padStart(2, "0")}`;

/** "in 1d 17h", "in 5h 12m", "in 12m": the two largest units, counted down a minute at a time. */
export function countdownWords(left: number): string {
  if (left < MINUTE_MS) return "in under a minute";
  const days = Math.floor(left / DAY_MS);
  const hours = Math.floor((left % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

const whenFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** A time in the viewer's own zone, e.g. "Sat 17 Oct, 13:00": a deadline, a feed's last run. */
export const whenWords = (at: number) => whenFormat.format(at);
const dayFormat = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
/** A day in the viewer's own zone, e.g. "20 Oct": when a letter was filed, or a report written. */
export const dayWords = (at: number) => dayFormat.format(at);
const dateFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short" });
/** A day with its weekday, in the viewer's own zone, e.g. "Tue 27 Oct": when an invite ends, the
 *  day of a league's game. */
export const dateWords = (at: number) => dateFormat.format(at);
const timeOfDayFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
/** The time of day alone, in the viewer's own zone: "15:00", a kickoff or when a letter was filed. */
export const timeOfDayWords = (at: number) => timeOfDayFormat.format(at);
const weekdayTimeFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" });
/** A time within the week, in the viewer's own zone: "Thu 18:00", a kickoff or a waiver run. */
export const weekdayTimeWords = (at: number) => weekdayTimeFormat.format(at);
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
/** The day alone, in the viewer's own zone: "Sun", as a matchup tile's badge says a kickoff. */
export const weekdayWords = (at: number) => weekdayFormat.format(at);
