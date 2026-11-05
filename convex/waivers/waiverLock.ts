import type { QueryCtx } from "../_generated/server";
import { scoreOf } from "../football/matchScores";
import { isLocked, type LeagueDeadlines } from "../gameweeks/deadline";
import { gameweekFixtures } from "../shared/fixtures";

// The waiver lock (#1197, spec/08: "From the deadline until the gameweek's last match is over,
// there are no claims, drops or free agent pickups"): from the league's own deadline for a
// gameweek until every match the feed still sends in it is at full time.

/** The latest gameweek the league has begun by `now`, or null before its first deadline. */
function latestBegun(deadlines: LeagueDeadlines, now: number): number | null {
  const begun = [...deadlines].flatMap(([gameweek, deadline]) => (isLocked(deadline, now) ? [gameweek] : []));
  return begun.length === 0 ? null : Math.max(...begun);
}

/** Whether the league is in the waiver lock at `now`: its latest begun gameweek has a match not yet
 *  at full time, or with no score read yet. A league with no deadline yet has no lock. */
export async function inWaiverLock(ctx: QueryCtx, deadlines: LeagueDeadlines, now: number): Promise<boolean> {
  const gameweek = latestBegun(deadlines, now);
  if (gameweek === null) return false;
  const matches = await gameweekFixtures(ctx, gameweek, "the waiver lock can't tell whether its last match is over");
  const scores = await Promise.all(matches.map(({ code }) => scoreOf(ctx, code)));
  return scores.some((score) => score?.state !== "fullTime");
}

/** Whether a deadline of the league's passed after `from` and by `now`: once one has, a free agent
 *  picked up at `from` has been in the squad for a deadline (spec/08, the churn rule). */
export function deadlinePassedSince(deadlines: LeagueDeadlines, from: number, now: number): boolean {
  return [...deadlines.values()].some((deadline) => deadline !== null && deadline > from && deadline <= now);
}
