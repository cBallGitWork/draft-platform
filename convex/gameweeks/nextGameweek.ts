import type { Infer } from "convex/values";
import { isLocked, leagueDeadline, type DeadlineRule, type ScheduledMatch } from "./deadline";
import type { gameweekRecord } from "../schema";

// Which gameweek a rule change made now takes effect from (spec/03, spec/14: "it applies from the
// next gameweek; past gameweeks are locked"; #25). Pure: the clock is an argument.

type Gameweek = Pick<Infer<typeof gameweekRecord>, "number">;

/**
 * The first gameweek that hasn't begun after the last that has: begun is past its league deadline
 * (deadline.ts's `leagueDeadline`). FPL's deadline plays no part (#138). A gameweek with no kickoff
 * time behind a begun one has no deadline and never begins, so it is passed over (#413). With no
 * gameweeks held yet, gameweek 1; once all have begun, the one after the last. `deadlineFor` is the league's deadline rule in force in that gameweek,
 * and `passed` its recorded passed deadlines, by gameweek.
 */
export function nextGameweek(
  gameweeks: readonly Gameweek[],
  matches: readonly ScheduledMatch[],
  deadlineFor: (gameweek: number) => DeadlineRule,
  passed: ReadonlyMap<number, number>,
  now: number,
): number {
  const inOrder = gameweeks.toSorted((one, other) => one.number - other.number);
  const lastBegunIndex = inOrder.findLastIndex(({ number }) =>
    isLocked(leagueDeadline(number, matches, deadlineFor(number), passed.get(number) ?? null), now),
  );
  return inOrder[lastBegunIndex + 1]?.number ?? (inOrder.at(-1)?.number ?? 0) + 1;
}
