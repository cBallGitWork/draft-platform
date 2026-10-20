// A gameweek's deadline (spec/05, The deadline; #9): one per gameweek, locking every team's whole
// lineup at once. When it falls is the league's rule (spec/03), so the rule is always an argument,
// never a constant: #25 is to hold it as data with the league's other rules.
//
// Once passed, a deadline stays where it fell, even if the first match is then postponed (#85), and
// the matches no longer show where that was. So each read takes the deadline recorded for the
// gameweek. The code that locks lineups owns that record, per league and gameweek: it stores what
// gameweekDeadline returns each time the matches change, so the record is never older than them.
// Nothing here can check that it does. A reading with nothing recorded is valid, so a caller that
// never records still type-checks, and a postponement after the deadline reopens the gameweek.

import type { Infer } from "convex/values";
import type { fixtureRecord } from "./schema";
import { MINUTE_MS } from "./time";

export interface DeadlineRule {
  /** Whole minutes, 0 or more, before the gameweek's first kickoff. */
  minutesBeforeFirstKickoff: number;
}

/** FPL's own rule, and every league's default: 90 minutes before the first kickoff. It held for
 *  all 38 gameweeks of 2026/27 in FPL's data of 20 Oct 2026. */
export const FPL_DEADLINE_RULE: DeadlineRule = { minutesBeforeFirstKickoff: 90 };

/** All of a match a deadline reads. */
type ScheduledMatch = Pick<Infer<typeof fixtureRecord>, "gameweek" | "kickoff">;

/** The deadline last recorded for the gameweek (null only before one is), and the time it is read. */
export interface DeadlineReading {
  recorded: number | null;
  now: number;
}

/**
 * When a gameweek locks, in epoch milliseconds. Once the recorded deadline has passed, that one.
 * Before, the rule's minutes before the earliest kickoff of the matches in it now, so a match moved
 * into or out of the gameweek moves its deadline. Null while none of its matches has a kickoff
 * time: there is no deadline yet.
 */
export function gameweekDeadline(
  gameweek: number,
  matches: readonly ScheduledMatch[],
  rule: DeadlineRule,
  { recorded, now }: DeadlineReading,
): number | null {
  const minutes = rule.minutesBeforeFirstKickoff;
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(`A deadline is a whole number of minutes, 0 or more, before the first kickoff, not ${minutes}`);
  }
  if (isLocked(recorded, now)) return recorded;
  const kickoffs = matches.flatMap((match) =>
    match.gameweek === gameweek && match.kickoff !== null ? [match.kickoff] : [],
  );
  if (kickoffs.length === 0) return null;
  return Math.min(...kickoffs) - minutes * MINUTE_MS;
}

/** Whether a lineup change made `now` is refused: at the deadline and after it, the gameweek is
 *  locked. A gameweek with no deadline yet has no kickoff to lock before. */
export function isLocked(deadline: number | null, now: number): boolean {
  return deadline !== null && now >= deadline;
}
