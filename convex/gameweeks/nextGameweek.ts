import type { Infer } from "convex/values";
import { isLocked, leagueDeadline, type DeadlineRule } from "./deadline";
import type { fixtureRecord, gameweekRecord } from "../schema";

// Which gameweek a rule change made now takes effect from (spec/03, spec/14: "it applies from the
// next gameweek; past gameweeks are locked"; #25). Pure: the clock is an argument.

type Gameweek = Pick<Infer<typeof gameweekRecord>, "number">;
type ScheduledMatch = Pick<Infer<typeof fixtureRecord>, "gameweek" | "kickoff">;

/**
 * The first gameweek that hasn't begun: whose league deadline (deadline.ts's `leagueDeadline`) is
 * still ahead. FPL's deadline plays no part (#138). With no gameweeks held yet, gameweek 1; once
 * all have begun, the one after the last. `deadlineFor` is the league's deadline rule in force in
 * that gameweek.
 */
export function nextGameweek(
  gameweeks: readonly Gameweek[],
  matches: readonly ScheduledMatch[],
  deadlineFor: (gameweek: number) => DeadlineRule,
  now: number,
): number {
  const inOrder = gameweeks.toSorted((one, other) => one.number - other.number);
  const notBegun = inOrder.find(({ number }) => !isLocked(leagueDeadline(number, matches, deadlineFor(number)), now));
  return notBegun?.number ?? (inOrder.at(-1)?.number ?? 0) + 1;
}
