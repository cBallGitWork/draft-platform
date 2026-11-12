import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { leagueDeadline, type DeadlineOf, type LeagueDeadlines, type ScheduledMatch } from "./deadline";
import { fixedDeadlinesOf } from "./passedDeadlines";
import { FIRST_GAMEWEEK, GAMEWEEKS_MOST, seasonGameweeks } from "./usedGameweeks";
import { takeAllOrThrow } from "../shared/cappedRead";
import { heldGameweeksSeason, seasonGameweekCount } from "./seasonGameweeks";
import { currentFixtures } from "../shared/fixtures";
import { historyOf, inForce } from "../rules/rulesHistory";

// The season's schedule as held, and each league's deadlines over it under its rules in force.

/** What `heldSchedule` reads, for a caller that reads it once and hands it on. */
export type HeldSchedule = { gameweeks: { number: number }[]; matches: ScheduledMatch[] };

/** The season's gameweeks and matches as held. A gameweek the football layer no longer sends stays,
 *  keeping its last deadline (spec/05, #202); a match it no longer sends goes. However many the
 *  season holds are read (#1618), up to more than any season has (`GAMEWEEKS_MOST`). */
export async function heldSchedule(ctx: QueryCtx): Promise<HeldSchedule> {
  // Only this season's: each season's gameweeks are kept, last season's beside it (#66). At most
  // one row a gameweek number in a season: the football sync keeps one (footballSync.ts's
  // upsertGameweeks), so more is a bug.
  const season = await heldGameweeksSeason(ctx);
  const seasonRows = await takeAllOrThrow(
    ctx.db.query("gameweeks").withIndex("by_season_and_number", (q) => q.eq("season", season).gte("number", FIRST_GAMEWEEK)),
    GAMEWEEKS_MOST,
    `More than ${GAMEWEEKS_MOST} gameweek rows are held for one season, so its schedule would be cut short`,
  );
  return { gameweeks: seasonRows.map(({ number }) => ({ number })), matches: await scheduledMatches(ctx) };
}

/** The season's matches as held, less those the football layer no longer sends: all of
 *  `heldSchedule` a deadline reads. */
export async function scheduledMatches(ctx: QueryCtx): Promise<ScheduledMatch[]> {
  return (await currentFixtures(ctx)).map(({ gameweek, kickoff }) => ({ gameweek, kickoff }));
}

/** The league's own deadline for each of the season's gameweeks: the one recorded once it passed
 *  (#150), else the one kept when FPL stopped sending the gameweek (#202), else the one under the rule in force in it. When each begins, for its screens, refusals
 *  and recorder (#138, #139). Null where none of the gameweek's matches has a kickoff time held. */
export async function leagueDeadlines(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<LeagueDeadlines> {
  return leagueDeadlinesIn(ctx, leagueId, await scheduledMatches(ctx));
}

/** Reads one gameweek's deadline from `leagueDeadlines`'s map: null where it has none. */
export function deadlineOf(deadlines: LeagueDeadlines): DeadlineOf {
  return (gameweek) => deadlines.get(gameweek) ?? null;
}

/** `leagueDeadlines` read and wrapped in `deadlineOf`, for a caller that wants only each
 *  gameweek's deadline, never the map. */
export async function leagueDeadlineOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<DeadlineOf> {
  return deadlineOf(await leagueDeadlines(ctx, leagueId));
}

/** `leagueDeadlines` against matches already read (`scheduledMatches`), so one read serves every
 *  league. */
export async function leagueDeadlinesIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  matches: readonly ScheduledMatch[],
): Promise<LeagueDeadlines> {
  const history = await historyOf(ctx, leagueId);
  const fixed = await fixedDeadlinesOf(ctx, leagueId);
  return new Map(
    seasonGameweeks(await seasonGameweekCount(ctx)).map((gameweek) => {
      const row = inForce(history, gameweek);
      const recorded = fixed.get(gameweek) ?? null;
      return [gameweek, row === undefined ? recorded : leagueDeadline(gameweek, matches, row.rules.deadline, recorded)];
    }),
  );
}
