import type { LeagueRules } from "../rules/leagueRulesShape";
import type { RulesRow } from "../rules/rulesHistory";
import { londonOffset } from "../shared/moments";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../shared/time";

// When a league's waivers run (#1198; spec/03, spec/08): on each of its runs' weekdays at the hour
// and minute in UK time, whatever the clocks, Wednesday and Thursday at 18:00 by default
// (../rules/firstRules.ts). Pure: no I/O.

type WaiverRun = LeagueRules["waivers"]["runs"][number];

/** The weekdays in Date's own order, Sunday first. */
export const DATE_DAYS: readonly WaiverRun["day"][] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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

/** Whether `at` was one of the league's run times when it came, under the rules saved by then: a
 *  run time the commissioner adds or moves to once it has gone never runs, as runs only happen at
 *  times managers were shown (Craig, 11 Nov 2026, #1468; spec/08). */
export function wasRunTime(history: readonly RulesRow[], at: number): boolean {
  const runs = history.findLast((row) => row._creationTime <= at)?.rules.waivers.runs;
  return runs !== undefined && latestRunAt(runs, at) === at;
}

/** The first of the league's waiver runs at or after `from`, or null with no runs: for a player a
 *  run may take from `from` on, the run that can first take him (Craig, 6 Nov 2026, on #1200: "Show
 *  the run's day and time"). */
export function firstRunFrom(runs: readonly WaiverRun[], from: number): number | null {
  const today = Math.floor((from + londonOffset(from)) / DAY_MS) * DAY_MS;
  let first: number | null = null;
  // Today, and a week on from it, holds every weekday's first.
  for (let on = 0; on <= 7; on += 1) {
    const day = today + on * DAY_MS;
    const weekday = DATE_DAYS[new Date(day).getUTCDay()];
    for (const run of runs) {
      if (run.day !== weekday) continue;
      const at = ukMoment(day, run.hour, run.minute);
      if (at >= from && (first === null || at < first)) first = at;
    }
  }
  return first;
}
