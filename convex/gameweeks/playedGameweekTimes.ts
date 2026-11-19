import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { seasonOfMatches } from "../shared/fixtures";
import { seasonStartYear } from "../shared/time";
import type { LeagueDeadlines, ScheduledMatch } from "./deadline";
import { firstKickoffs, gameweekStartsOf } from "./gameweekStarts";
import { seasonGameweekCount } from "./seasonGameweeks";
import { usedGameweeksOf } from "./usedGameweeks";

// When each gameweek a league plays starts, for Home's Calendar (spec/12, S12.24): its first
// kickoff and the league's deadline for it.

export type PlayedGameweekTimes = { gameweek: number; firstKickoff: number | null; deadline: number | null };

/** Each gameweek the league plays, in order, with its first kickoff this season, the recorded one
 *  once passed (gameweekStarts.ts), and its deadline in `deadlines` (leagueDeadlines.ts); null where
 *  none is known. Last season's matches, still held while this one's arrive, start nothing. */
export async function playedGameweekTimes(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  matches: readonly ScheduledMatch[],
  deadlines: LeagueDeadlines,
): Promise<PlayedGameweekTimes[]> {
  const season = seasonOfMatches(matches);
  const thisSeason = matches.filter(({ kickoff }) => kickoff !== null && seasonStartYear(kickoff) === season);
  const kickoffs = new Map([...firstKickoffs(thisSeason), ...(await gameweekStartsOf(ctx, matches))]);
  return usedGameweeksOf(league, await seasonGameweekCount(ctx)).map((gameweek) => ({
    gameweek,
    firstKickoff: kickoffs.get(gameweek) ?? null,
    deadline: deadlines.get(gameweek) ?? null,
  }));
}
