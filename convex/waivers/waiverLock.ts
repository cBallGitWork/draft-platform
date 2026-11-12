import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { begunBy, isLocked, latestBegun, latestOf, type LeagueDeadlines } from "../gameweeks/deadline";
import { gameweekEnd, gameweekUnderWay } from "../gameweeks/gameweekEnd";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { latestRules } from "../rules/rulesHistory";
import { firstRunFrom } from "./waiverTimes";

// The waiver lock (#1197, spec/08: "From the deadline until the gameweek's last match is over,
// there are no claims, drops or free agent pickups"): from the league's own deadline for a
// gameweek until every match the feed still sends in it is at full time (../gameweeks/gameweekEnd.ts).
// And when a gameweek ends, which the waiver order reads.

/** The latest gameweek the league has seen end by `now`: the latest begun once its last match is
 *  over, and the one begun before it while it is under way; null before any has. Reverse table
 *  order's waiver order is worked out again only then (spec/08, ./waiverOrder.ts). */
export async function latestEnded(ctx: QueryCtx, deadlines: LeagueDeadlines, now: number): Promise<number | null> {
  const begun = begunBy(deadlines, now);
  const latest = latestOf(begun);
  if (latest === null || !(await gameweekUnderWay(ctx, latest))) return latest;
  return latestOf(begun.filter((gameweek) => gameweek < latest));
}

/** Whether the league is in the waiver lock at `now`: its latest begun gameweek has a match not yet
 *  at full time, or with no score read yet. A league with no deadline yet has no lock. */
export async function inWaiverLock(ctx: QueryCtx, deadlines: LeagueDeadlines, now: number): Promise<boolean> {
  const gameweek = latestBegun(deadlines, now);
  return gameweek !== null && (await gameweekUnderWay(ctx, gameweek));
}

/** The gameweek whose lock a run at `at` may fall in, seen from `now`, or null when it surely
 *  doesn't (#1488): the latest gameweek begun by `at`, unless that one had begun by `now` and isn't
 *  `underWay` (the gameweek under way now, null outside the lock), as its last match is then over.
 *  When a gameweek's last match ends isn't known ahead, so a later one's run is only "may" (Craig,
 *  11 Nov 2026: "skipped if GW12 is still on"). Pure. */
export function mayFallInLock(deadlines: LeagueDeadlines, underWay: number | null, now: number, at: number): number | null {
  const gameweek = latestBegun(deadlines, at);
  if (gameweek === null) return null;
  return isLocked(deadlines.get(gameweek) ?? null, now) && gameweek !== underWay ? null : gameweek;
}

/** The gameweek under way at `now`, in the lock, or null outside it: `mayFallInLock`'s `underWay`. */
export async function underWayIn(ctx: QueryCtx, deadlines: LeagueDeadlines, now: number): Promise<number | null> {
  return (await inWaiverLock(ctx, deadlines, now)) ? latestBegun(deadlines, now) : null;
}

/** A waiver run still to come, with the gameweek whose lock it may fall in, and so may be skipped, or null
 *  when it surely won't. */
export const runAhead = v.object({ at: v.number(), skippedIf: v.union(v.number(), v.null()) });
export type RunAhead = Infer<typeof runAhead>;

/** The run that can first take a player a run may take from `claimableFrom` on, seen from `now`
 *  (#1467): never one already gone, as a run that passed him by was skipped; null with no runs.
 *  Where it may fall in a gameweek's lock, `skippedIf` names that gameweek: the run that takes him
 *  is then the first after its last match, which isn't known ahead (Craig, 11 Nov 2026: "after
 *  GW12's last match"), and every later run up to the next deadline is "may" too, so the claims
 *  one run will try together share it. Pure. */
export function firstRunTaking(runs: LeagueRules["waivers"]["runs"], deadlines: LeagueDeadlines, underWay: number | null, claimableFrom: number, now: number): RunAhead | null {
  const at = firstRunFrom(runs, Math.max(claimableFrom, now));
  return at === null ? null : { at, skippedIf: mayFallInLock(deadlines, underWay, now, at) };
}

/** `firstRunTaking` in the league at `now`, its runs, deadlines and lock read once. */
export async function firstRunsIn(ctx: QueryCtx, leagueId: Id<"leagues">, now: number): Promise<(claimableFrom: number) => RunAhead | null> {
  const runs = (await latestRules(ctx, leagueId)).waivers.runs;
  const deadlines = await leagueDeadlines(ctx, leagueId);
  const underWay = await underWayIn(ctx, deadlines, now);
  return (claimableFrom) => firstRunTaking(runs, deadlines, underWay, claimableFrom, now);
}

/** Whether the run at `at`, made at `now`, falls in the lock (Craig, 11 Nov 2026, #1470: "A run
 *  made late keeps its own check on now, and is skipped if its time fell in the lock"): the league
 *  is in the lock now, or the latest gameweek begun by `at` had a match not yet over at `at`. A
 *  gameweek whose last match was at full time before when it ended was kept is taken as over. */
export async function runInWaiverLock(ctx: QueryCtx, deadlines: LeagueDeadlines, now: number, at: number): Promise<boolean> {
  if (await inWaiverLock(ctx, deadlines, now)) return true;
  const gameweek = latestBegun(deadlines, at);
  if (gameweek === null) return false;
  const end = await gameweekEnd(ctx, gameweek);
  return end.underWay || (end.endedAt !== null && end.endedAt > at);
}
