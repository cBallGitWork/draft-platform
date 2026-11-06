import type { LeagueRules } from "../rules/leagueRulesShape";
import { LONDON_ZONE } from "../shared/moments";
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from "../shared/time";

// When a league's waivers run (#1198; spec/03, spec/08): on each of its runs' weekdays at the hour
// and minute in UK time, whatever the clocks, Wednesday and Thursday at 18:00 by default
// (../rules/firstRules.ts). Pure: no I/O.

type WaiverRun = LeagueRules["waivers"]["runs"][number];

/** The weekdays in Date's own order, Sunday first. */
const DATE_DAYS: readonly WaiverRun["day"][] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const LONDON = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** How far UK time is ahead of UTC at `at`: nothing in winter, an hour in summer. */
function londonOffset(at: number): number {
  const parts = LONDON.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((each) => each.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wall - Math.floor(at / SECOND_MS) * SECOND_MS;
}

/** The moment it is `hour`:`minute` in the UK on the UK day whose midnight, read as UTC, is `day`. */
function ukMoment(day: number, hour: number, minute: number): number {
  const wall = day + hour * HOUR_MS + minute * MINUTE_MS;
  const first = wall - londonOffset(wall);
  return wall - londonOffset(first);
}

/** The latest of the league's waiver runs at or before `now`, or null with no runs. */
export function latestRunAt(runs: readonly WaiverRun[], now: number): number | null {
  const today = Math.floor((now + londonOffset(now)) / DAY_MS) * DAY_MS;
  let latest: number | null = null;
  // A week back from today, and today, holds every weekday's latest.
  for (let back = 0; back <= 7; back += 1) {
    const day = today - back * DAY_MS;
    const weekday = DATE_DAYS[new Date(day).getUTCDay()];
    for (const run of runs) {
      if (run.day !== weekday) continue;
      const at = ukMoment(day, run.hour, run.minute);
      if (at <= now && (latest === null || at > latest)) latest = at;
    }
  }
  return latest;
}
