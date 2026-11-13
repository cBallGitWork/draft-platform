import { nextDeadline, type LeagueDeadlines } from "../gameweeks/deadline";
import { NEVER_DUE } from "../leagues/leagueChecks";
import type { LeagueRules } from "../rules/leagueRulesShape";
import type { RulesRow } from "../rules/rulesHistory";
import { londonOffset } from "../shared/moments";
import { DAY_MS, HOUR_MS, MINUTE_MS, WEEK_MS } from "../shared/time";

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

/** Each of the league's run times on the UK day `moment` falls in and the 7 days back from it
 *  (`way` -1) or on (`way` 1): every weekday's latest before it, or first after, is among them. */
function* runsAround(runs: readonly WaiverRun[], moment: number, way: -1 | 1): Generator<number> {
  const today = Math.floor((moment + londonOffset(moment)) / DAY_MS) * DAY_MS;
  for (let step = 0; step <= WEEK_MS / DAY_MS; step += 1) {
    const day = today + way * step * DAY_MS;
    const weekday = DATE_DAYS[new Date(day).getUTCDay()];
    for (const run of runs) if (run.day === weekday) yield ukMoment(day, run.hour, run.minute);
  }
}

/** The latest of the league's waiver runs at or before `now`, or null with no runs. */
export function latestRunAt(runs: readonly WaiverRun[], now: number): number | null {
  let latest: number | null = null;
  for (const at of runsAround(runs, now, -1)) if (at <= now && (latest === null || at > latest)) latest = at;
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
  let first: number | null = null;
  for (const at of runsAround(runs, from, 1)) if (at >= from && (first === null || at < first)) first = at;
  return first;
}

/** When a league with nothing waiting is next worth the waiver cron's look at `now` (#1998): its
 *  next run time under its latest rules, or its next deadline, when its window shuts and its free
 *  agents go back on waivers, whichever comes first; `NEVER_DUE` with neither. A rules save or a
 *  moved kickoff wakes the league sooner (../leagues/leagueChecks.ts). */
export function nextWaiverCheck(runs: readonly WaiverRun[], deadlines: LeagueDeadlines, now: number): number {
  const times = [firstRunFrom(runs, now + 1), nextDeadline(deadlines, now)?.at ?? null].filter((at): at is number => at !== null);
  return times.length === 0 ? NEVER_DUE : Math.min(...times);
}
