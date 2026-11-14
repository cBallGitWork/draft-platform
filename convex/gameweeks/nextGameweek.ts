import { v, type Infer } from "convex/values";
import { isLocked, leagueDeadline, type DeadlineOf, type DeadlineRule, type ScheduledMatch } from "./deadline";
import type { gameweekRecord } from "../schema";

// Which gameweek a rule change made now takes effect from (spec/03, spec/14: "it applies from the
// next gameweek; past gameweeks are locked"; #25), and which is this gameweek (spec/12, League
// home). Pure: the clock is an argument.

type Gameweek = Pick<Infer<typeof gameweekRecord>, "number">;

/** A gameweek with the league's own deadline in it, null where none is known: what a query sends
 *  for the screen to judge at its own minute, as a query taking the minute runs again, uncached,
 *  every minute for every open screen (#2005, #2008). */
export const gameweekDeadline = v.object({ gameweek: v.number(), deadline: v.union(v.number(), v.null()) });
export type GameweekDeadline = Infer<typeof gameweekDeadline>;

/**
 * The first gameweek that hasn't begun after the last that has: begun is past its league deadline
 * (deadline.ts's `leagueDeadline`). FPL's deadline plays no part (#138). A gameweek with no kickoff
 * time behind a begun one has no deadline and never begins, so it is passed over (#413). With no
 * gameweeks held yet, gameweek 1; once all have begun, the one after the last. `deadlineFor` is the
 * league's deadline rule in force in that gameweek, and `passed` its recorded passed deadlines.
 */
export function nextGameweek(
  gameweeks: readonly Gameweek[],
  matches: readonly ScheduledMatch[],
  deadlineFor: (gameweek: number) => DeadlineRule,
  passed: ReadonlyMap<number, number>,
  now: number,
): number {
  return nextGameweekAt(deadlinesOf(gameweeks, matches, deadlineFor, passed), now);
}

/** Each gameweek, in order, with its league deadline (deadline.ts's `leagueDeadline`) under the
 *  rule `deadlineFor` names for it: what `nextGameweek` judges, at any minute. */
export function deadlinesOf(
  gameweeks: readonly Gameweek[],
  matches: readonly ScheduledMatch[],
  deadlineFor: (gameweek: number) => DeadlineRule,
  passed: ReadonlyMap<number, number>,
): GameweekDeadline[] {
  return gameweeks
    .toSorted((one, other) => one.number - other.number)
    .map(({ number }) => ({ gameweek: number, deadline: leagueDeadline(number, matches, deadlineFor(number), passed.get(number) ?? null) }));
}

/** `nextGameweek` at `now`, from `deadlinesOf`'s gameweeks. */
export function nextGameweekAt(inOrder: readonly GameweekDeadline[], now: number): number {
  return nextByDeadlines(inOrder, ({ deadline }) => deadline, now)?.gameweek ?? (inOrder.at(-1)?.gameweek ?? 0) + 1;
}

/** What the gameweek a rule change takes effect from is judged on (leagueRules.ts's
 *  `changesFromTimesOf`):the season's gameweeks with their deadlines under the rules in force in
 *  each, and under the changed rules' own deadline; and the gameweek a change already waiting takes
 *  effect from. A screen editing the rules judges them at its own minute (`changesFromAt`), so its
 *  query takes none and isn't asked again every minute (#2008). */
export const changesFromTimes = v.object({ inForce: v.array(gameweekDeadline), own: v.array(gameweekDeadline), waiting: v.number() });
export type ChangesFromTimes = Infer<typeof changesFromTimes>;

/** The gameweek a rule change made at `now` takes effect from: the next not begun under the rules it
 *  replaces nor under its own deadline, and never earlier than a change already waiting. */
export function changesFromAt({ inForce, own, waiting }: ChangesFromTimes, now: number): number {
  return Math.max(nextGameweekAt(inForce, now), nextGameweekAt(own, now), waiting);
}

/**
 * The one after the last begun of `inOrder` (in gameweek order), by each one's deadline: one with
 * no deadline behind a begun one is passed over (#413). Undefined once the last has begun. The
 * screens call it with their own ticking clock, so they mark the gameweek the server would.
 */
export function nextByDeadlines<G>(inOrder: readonly G[], deadlineOf: (gameweek: G) => number | null, now: number): G | undefined {
  return inOrder[inOrder.findLastIndex((gameweek) => isLocked(deadlineOf(gameweek), now)) + 1];
}

/** The gameweek league home and the matchup show the head-to-heads of: the latest the league has
 *  begun, by its own deadlines, or before any has, the first to come. Undefined with no
 *  head-to-head gameweeks. */
export function thisGameweekOf<Gameweek extends { gameweek: number }>(
  gameweeks: readonly Gameweek[],
  deadlineOf: DeadlineOf,
  now: number,
): Gameweek | undefined {
  return gameweeks.findLast(({ gameweek }) => isLocked(deadlineOf(gameweek), now)) ?? gameweeks[0];
}

/** `thisGameweekOf` among gameweeks sent with their deadlines, in order: null with none. */
export function thisGameweekAt(gameweeks: readonly GameweekDeadline[], now: number): number | null {
  const deadlines = new Map(gameweeks.map(({ gameweek, deadline }) => [gameweek, deadline]));
  return thisGameweekOf(gameweeks, (gameweek) => deadlines.get(gameweek) ?? null, now)?.gameweek ?? null;
}
