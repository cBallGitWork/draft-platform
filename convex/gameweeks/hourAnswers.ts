import { HOUR_MS } from "../shared/time";

// A read asked for by the hour, never the minute (#2008): a query taking the minute runs again,
// uncached, every minute for every open screen. Where what it sends turns on a moment (a deadline,
// a scoring version taking effect), it sends one answer from the hour's start and one from each
// such moment in the hour, and the screen picks its minute's here. Pure, so the screen and the
// tests alike.

/** The moments of the hour starting at `hour` a read can turn at: its start, then each of
 *  `moments` (a league's deadlines, the site's scoring versions' starts) inside it, in order. */
export function turnsInHour(moments: Iterable<number | null>, hour: number): number[] {
  const inside = [...moments].filter((moment): moment is number => moment !== null && moment > hour && moment < hour + HOUR_MS);
  return [hour, ...new Set(inside.toSorted((one, other) => one - other))];
}

/** The answer in force at `now` of an hour's answers, each from its moment on, the first from the
 *  hour's start; undefined outside that hour, as for an earlier hour's held while `now`'s loads. */
export function answerAt<Answer extends { from: number }>(answers: readonly Answer[], now: number): Answer | undefined {
  const hour = answers[0]?.from;
  if (hour === undefined || now < hour || now >= hour + HOUR_MS) return undefined;
  return answers.findLast(({ from }) => from <= now);
}
