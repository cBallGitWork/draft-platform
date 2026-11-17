import { HOUR_MS } from "../shared/time";
import type { LeagueDeadlines } from "./deadline";

// A read asked for by the hour, never the minute (#2008): a query taking the minute runs again,
// uncached, every minute for every open screen. Where what it sends turns on a deadline, it sends
// one answer from the hour's start and one from each deadline in the hour, and the screen picks
// its minute's here. Pure, so the screen and the tests alike.

/** The moments of the hour starting at `hour` a deadline can turn a read at: its start, then each
 *  deadline inside it, in order. */
export function turnsInHour(deadlines: LeagueDeadlines, hour: number): number[] {
  const inside = [...deadlines.values()].filter((deadline): deadline is number => deadline !== null && deadline > hour && deadline < hour + HOUR_MS);
  return [hour, ...new Set(inside.toSorted((one, other) => one - other))];
}

/** The answer in force at `now` of an hour's answers, each from its moment on, the first from the
 *  hour's start; undefined outside that hour, as for an earlier hour's held while `now`'s loads. */
export function answerAt<Answer extends { from: number }>(answers: readonly Answer[], now: number): Answer | undefined {
  const hour = answers[0]?.from;
  if (hour === undefined || now < hour || now >= hour + HOUR_MS) return undefined;
  return answers.findLast(({ from }) => from <= now);
}
