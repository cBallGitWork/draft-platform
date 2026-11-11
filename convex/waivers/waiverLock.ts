import type { QueryCtx } from "../_generated/server";
import { scoreOf } from "../football/matchScores";
import { isLocked, type LeagueDeadlines } from "../gameweeks/deadline";
import { isGameweekUsed, type WithUnusedGameweeks } from "../gameweeks/usedGameweeks";
import { gameweekFixtures } from "../shared/fixtures";

// The waiver lock (#1197, spec/08: "From the deadline until the gameweek's last match is over,
// there are no claims, drops or free agent pickups"): from the league's own deadline for a
// gameweek until every match the feed still sends in it is at full time. And when a gameweek ends,
// which the waiver order reads.

/** The latest gameweek the league has begun by `now`, or null before its first deadline. */
export function latestBegun(deadlines: LeagueDeadlines, now: number): number | null {
  return latestOf(begunBy(deadlines, now));
}

const begunBy = (deadlines: LeagueDeadlines, now: number) => [...deadlines].flatMap(([gameweek, deadline]) => (isLocked(deadline, now) ? [gameweek] : []));
const latestOf = (gameweeks: readonly number[]) => (gameweeks.length === 0 ? null : Math.max(...gameweeks));

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

/** Whether the league is at `now` in a gameweek it doesn't play, from that gameweek's deadline
 *  until its last match is over: spec/13, "Lineups, waivers, free agency and trades are locked
 *  through it". The waiver lock already covers that span for waivers and free agency; trades
 *  (../trades/tradeShut.ts) and lineup saves (../lineup/lineups.ts) read this. */
export async function inUnplayedGameweek(ctx: QueryCtx, league: WithUnusedGameweeks, deadlines: LeagueDeadlines, now: number): Promise<boolean> {
  const gameweek = latestBegun(deadlines, now);
  return gameweek !== null && !isGameweekUsed(league, gameweek) && (await gameweekUnderWay(ctx, gameweek));
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

/** Whether a gameweek has a match not yet at full time, or with no score read yet: it is under way
 *  once begun, until its last match is over. Trades read it too (../trades/tradeShut.ts). */
export async function gameweekUnderWay(ctx: QueryCtx, gameweek: number): Promise<boolean> {
  return (await gameweekEnd(ctx, gameweek)).underWay;
}

/** Whether the gameweek is under way, and once it isn't, when its last match was first read at
 *  full time: null when one was there before that moment was kept (../football/matchScores.ts). */
async function gameweekEnd(ctx: QueryCtx, gameweek: number): Promise<{ underWay: true } | { underWay: false; endedAt: number | null }> {
  const matches = await gameweekFixtures(ctx, gameweek, "the waiver lock can't tell whether its last match is over");
  const scores = await Promise.all(matches.map(({ code }) => scoreOf(ctx, code)));
  const over = scores.flatMap((score) => (score?.state === "fullTime" ? [score.fullTimeAt ?? null] : []));
  if (over.length < scores.length) return { underWay: true };
  const kept = over.filter((at): at is number => at !== null);
  return { underWay: false, endedAt: kept.length < over.length ? null : latestOf(kept) };
}

/** Whether a deadline of the league's passed after `from` and by `now`: once one has, a free agent
 *  picked up at `from` has been in the squad for a deadline (spec/08, the churn rule). */
export function deadlinePassedSince(deadlines: LeagueDeadlines, from: number, now: number): boolean {
  return [...deadlines.values()].some((deadline) => deadline !== null && deadline > from && deadline <= now);
}
