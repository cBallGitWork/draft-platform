import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { leagueDeadline, type DeadlineOf, type LeagueDeadlines, type ScheduledMatch } from "./deadline";
import { passedDeadlinesOf } from "./passedDeadlines";
import { SEASON_GAMEWEEKS } from "./usedGameweeks";
import { currentFixtures } from "../shared/fixtures";
import { historyOf, inForce } from "../rules/rulesHistory";

// The season's schedule as held, and each league's deadlines over it under its rules in force.

/** The season's gameweeks and matches as held, less those the football layer no longer sends. */
export async function heldSchedule(ctx: QueryCtx) {
  const gameweeks = [];
  // At most FPL's 38, whatever the seasons: the football sync keeps one row per gameweek number,
  // a new season's updating the last's (footballSync.ts's upsertGameweeks).
  for await (const { number, droppedAt } of ctx.db.query("gameweeks")) {
    if (droppedAt === undefined) gameweeks.push({ number });
  }
  const matches = (await currentFixtures(ctx)).map(({ gameweek, kickoff }) => ({ gameweek, kickoff }));
  return { gameweeks, matches };
}

/** The league's own deadline for each of gameweeks 1 to 38: the one recorded once it passed
 *  (#150), else the one under the rule in force in it. When each begins, for its screens, refusals
 *  and recorder (#138, #139). Null where none of the gameweek's matches has a kickoff time held,
 *  and for every gameweek of a league made before rules were held, which has no deadline rule. */
export async function leagueDeadlines(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<LeagueDeadlines> {
  return leagueDeadlinesIn(ctx, leagueId, (await heldSchedule(ctx)).matches);
}

/** Reads one gameweek's deadline from `leagueDeadlines`'s map: null where it has none. */
export function deadlineOf(deadlines: LeagueDeadlines): DeadlineOf {
  return (gameweek) => deadlines.get(gameweek) ?? null;
}

/** `leagueDeadlines` against matches already read (`heldSchedule`), so one read serves every
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
