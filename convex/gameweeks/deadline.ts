// A gameweek's deadline (spec/05, The deadline; #9): one per gameweek, locking every team's whole
// lineup at once. When it falls is the league's rule (spec/03), so the rule is always an argument,
// never a constant: it is held as data with the league's other rules (#25, leagueRules.ts).
//
// Once passed, a deadline stays where it fell, even if the first match is then postponed (#85), and
// the matches no longer show where that was. So each read takes the deadline recorded for the
// gameweek. deadlineRecorder.ts records each league's passed deadlines (`passedDeadlines`, #150)
// before the football sync, the only writer of kickoffs, can move one, and `leagueDeadline` reads
// the record first: a gameweek with one stays begun, whatever then happens to its matches.

import type { Infer } from "convex/values";
import type { fixtureRecord } from "../schema";
import { MINUTE_MS } from "../shared/time";

export interface DeadlineRule {
  /** Whole minutes, 0 or more, before the gameweek's first kickoff. */
  minutesBeforeFirstKickoff: number;
}

/** FPL's own rule, and every league's default: 90 minutes before the first kickoff. It held for
 *  all 38 gameweeks of 2026/27 in FPL's data of 20 Oct 2026. */
export const FPL_DEADLINE_RULE: DeadlineRule = { minutesBeforeFirstKickoff: 90 };

/** All of a match a deadline reads. */
export type ScheduledMatch = Pick<Infer<typeof fixtureRecord>, "gameweek" | "kickoff">;

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

/**
 * The league's own deadline for a gameweek, under the rule in force in it: the one function that
 * decides when a gameweek begins, for every caller (#138, #139). FPL's deadline never decides
 * (Craig, 22 Oct 2026: "ours, we arent fpl so stop copying them"); it stays feed data. `recorded`
 * is the league's passed deadline for the gameweek, null while none is: once there is one, it is
 * the deadline, whatever the matches now say.
 */
export function leagueDeadline(
  gameweek: number,
  matches: readonly ScheduledMatch[],
  rule: DeadlineRule,
  recorded: number | null,
): number | null {
  // Only a passed deadline is recorded, so the reading's time is never needed to judge it.
  return recorded ?? gameweekDeadline(gameweek, matches, rule, { recorded: null, now: 0 });
}

/** Whether a lineup change made `now` is refused: at the deadline and after it, the gameweek is
 *  locked. A gameweek with no deadline yet has no kickoff to lock before. */
export function isLocked(deadline: number | null, now: number): boolean {
  return deadline !== null && now >= deadline;
}
