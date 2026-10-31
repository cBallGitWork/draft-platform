import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { leagueDeadline, type DeadlineOf, type LeagueDeadlines, type ScheduledMatch } from "./deadline";
import { passedDeadlinesOf } from "./passedDeadlines";
import { FIRST_GAMEWEEK, GAMEWEEKS, SEASON_GAMEWEEKS } from "./usedGameweeks";
import { takeAllOrThrow } from "../shared/cappedRead";
import { currentFixtures } from "../shared/fixtures";
import { historyOf, inForce } from "../rules/rulesHistory";

// The season's schedule as held, and each league's deadlines over it under its rules in force.

/** The season's gameweeks and matches as held, less those the football layer no longer sends. Only
 *  gameweeks 1 to 38 are read: a row past FPL's 38 can only be written by hand, and a lineup save
 *  or a rules change must not stop on one (#872). */
export async function heldSchedule(ctx: QueryCtx) {
  // At most one row a gameweek number: the football sync keeps one, a new season's updating the
  // last's (footballSync.ts's upsertGameweeks), so more is a bug.
  const seasonRows = await takeAllOrThrow(
    ctx.db.query("gameweeks").withIndex("by_number", (q) => q.gte("number", FIRST_GAMEWEEK).lte("number", GAMEWEEKS)),
    GAMEWEEKS,
    `More than ${GAMEWEEKS} gameweek rows are held for gameweeks ${FIRST_GAMEWEEK} to ${GAMEWEEKS}, so the season's schedule would be cut short`,
  );
  const currentGameweeks = seasonRows.filter(({ droppedAt }) => droppedAt === undefined);
  return { gameweeks: currentGameweeks.map(({ number }) => ({ number })), matches: await scheduledMatches(ctx) };
}

/** The season's matches as held, less those the football layer no longer sends: all of
 *  `heldSchedule` a deadline reads. */
export async function scheduledMatches(ctx: QueryCtx): Promise<ScheduledMatch[]> {
  return (await currentFixtures(ctx)).map(({ gameweek, kickoff }) => ({ gameweek, kickoff }));
}

/** The league's own deadline for each of gameweeks 1 to 38: the one recorded once it passed
 *  (#150), else the one under the rule in force in it. When each begins, for its screens, refusals
 *  and recorder (#138, #139). Null where none of the gameweek's matches has a kickoff time held,
 *  and for every gameweek of a league made before rules were held, which has no deadline rule. */
export async function leagueDeadlines(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<LeagueDeadlines> {
  return leagueDeadlinesIn(ctx, leagueId, await scheduledMatches(ctx));
}

/** Reads one gameweek's deadline from `leagueDeadlines`'s map: null where it has none. */
export function deadlineOf(deadlines: LeagueDeadlines): DeadlineOf {
  return (gameweek) => deadlines.get(gameweek) ?? null;
}

/** `leagueDeadlines` against matches already read (`scheduledMatches`), so one read serves every
 *  league. */
export async function leagueDeadlinesIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  matches: readonly ScheduledMatch[],
): Promise<LeagueDeadlines> {
  const history = await historyOf(ctx, leagueId);
  const passed = await passedDeadlinesOf(ctx, leagueId);
  return new Map(
    SEASON_GAMEWEEKS.map((gameweek) => {
      const row = inForce(history, gameweek);
      const recorded = passed.get(gameweek) ?? null;
      return [gameweek, row === undefined ? recorded : leagueDeadline(gameweek, matches, row.rules.deadline, recorded)];
    }),
  );
}
