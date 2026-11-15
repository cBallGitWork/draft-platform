import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { draftIsOver } from "../draft/draftRow";
import { begunBy, latestBegun, latestOf, type LeagueDeadlines } from "../gameweeks/deadline";
import { gameweekEnd, gameweekUnderWay } from "../gameweeks/gameweekEnd";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { refuse } from "../shared/leagueAccess";

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

/** The words a drop, pickup or claim is refused with before the draft is over and in the lock. */
export type WaiversShutWords = { notDrafted: string; locked: string };

/** Refused unless a manager may drop, pick up or claim in the league now: once the draft is over
 *  (#1326), then outside the lock (spec/08, `S08.14`). The deadlines and time it read, for the caller. */
export async function waiversOpenFor(ctx: QueryCtx, leagueId: Id<"leagues">, words: WaiversShutWords): Promise<{ deadlines: LeagueDeadlines; now: number }> {
  if (!(await draftIsOver(ctx, leagueId))) refuse(words.notDrafted);
  return await outOfLockFor(ctx, leagueId, words.locked);
}

/** `waiversOpenFor`'s lock half alone, refused with `locked`: changing a claim's drop has no
 *  draft-over check, and withdrawing or ranking one skips the lock on purpose (#1590). */
export async function outOfLockFor(ctx: QueryCtx, leagueId: Id<"leagues">, locked: string): Promise<{ deadlines: LeagueDeadlines; now: number }> {
  const now = Date.now();
  const deadlines = await leagueDeadlines(ctx, leagueId);
  if (await inWaiverLock(ctx, deadlines, now)) refuse(locked);
  return { deadlines, now };
}

/** The gameweek under way at `now`, in the lock, or null outside it: runsAhead.ts's `mayFallInLock`'s `underWay`. */
export async function underWayIn(ctx: QueryCtx, deadlines: LeagueDeadlines, now: number): Promise<number | null> {
  return (await inWaiverLock(ctx, deadlines, now)) ? latestBegun(deadlines, now) : null;
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
