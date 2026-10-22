import type { Infer } from "convex/values";
import { gameweekDeadline, isLocked, type DeadlineRule } from "./deadline";
import type { fixtureRecord, gameweekRecord } from "../schema";

// Which gameweek a rule change made now takes effect from (spec/03, spec/14: "it applies from the
// next gameweek; past gameweeks are locked"; #25). Pure: the clock is an argument.

type Gameweek = Pick<Infer<typeof gameweekRecord>, "number" | "deadline">;
type ScheduledMatch = Pick<Infer<typeof fixtureRecord>, "gameweek" | "kickoff">;

/**
 * The first gameweek that hasn't begun: whose league deadline, and FPL's own, are both still
 * ahead. FPL's is read too because a league deadline is worked out from the kickoffs, and one
 * whose first match is postponed after it passed moves back (deadline.ts); FPL's stays put. With
 * no gameweeks held yet, gameweek 1; once all have begun, the one after the last.
 * `deadlineFor` is the league's deadline rule in force in that gameweek.
 */
export function nextGameweek(
  gameweeks: readonly Gameweek[],
  matches: readonly ScheduledMatch[],
  deadlineFor: (gameweek: number) => DeadlineRule,
  now: number,
): number {
  const inOrder = gameweeks.toSorted((one, other) => one.number - other.number);
  const notBegun = inOrder.find(({ number, deadline }) => {
    const leagueDeadline = gameweekDeadline(number, matches, deadlineFor(number), { recorded: null, now });
    return !isLocked(deadline, now) && !isLocked(leagueDeadline, now);
  });
  return notBegun?.number ?? (inOrder.at(-1)?.number ?? 0) + 1;
}
