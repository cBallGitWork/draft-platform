// A gameweek's deadline (spec/05, The deadline; #9): one per gameweek, locking every team's whole
// lineup at once. When it falls is the league's rule (spec/03), so the rule is always an argument,
// never a constant: #25 holds it as data with the league's other rules.

import type { Infer } from "convex/values";
import type { fixtureRecord } from "./schema";

/** A league's deadline rule. */
export interface DeadlineRule {
  /** Whole minutes, 0 or more, before the gameweek's first kickoff. */
  minutesBeforeFirstKickoff: number;
}

/** FPL's own rule, and every league's default: 90 minutes before the first kickoff. It held for
 *  all 38 gameweeks of 2026/27 in FPL's data of 20 Oct 2026. */
export const FPL_DEADLINE_RULE: DeadlineRule = { minutesBeforeFirstKickoff: 90 };

const MS_PER_MINUTE = 60_000;

type Kickoff = Pick<Infer<typeof fixtureRecord>, "gameweek" | "kickoff">;

/**
 * When a gameweek locks, in epoch milliseconds: the rule's minutes before the earliest kickoff of
 * the matches in it now, so a match moved into or out of the gameweek moves its deadline.
 * Null while none of its matches has a kickoff time: there is no deadline yet.
 */
export function gameweekDeadline(gameweek: number, fixtures: readonly Kickoff[], rule: DeadlineRule): number | null {
  const minutes = rule.minutesBeforeFirstKickoff;
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(`A deadline is a whole number of minutes, 0 or more, before the first kickoff, not ${minutes}`);
  }
  const kickoffs = fixtures.flatMap((fixture) =>
    fixture.gameweek === gameweek && fixture.kickoff !== null ? [fixture.kickoff] : [],
  );
  if (kickoffs.length === 0) return null;
  return Math.min(...kickoffs) - minutes * MS_PER_MINUTE;
}

/** Whether a lineup change made `now` is refused: at the deadline and after it, the gameweek is
 *  locked. A gameweek with no deadline yet has no kickoff to lock before. */
export function isLocked(deadline: number | null, now: number): boolean {
  return deadline !== null && now >= deadline;
}
