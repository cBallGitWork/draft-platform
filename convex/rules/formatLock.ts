import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { scoredGameweeksOf } from "../gameweeks/usedGameweeks";
import { refuse } from "../shared/leagueAccess";
import type { LeagueRules } from "./leagueRulesShape";

// A league's format is locked once its season has begun (Craig, 6 Nov 2026; #275): one table with
// one meaning all season, so a head-to-head season never loses the fixtures it has played.
// leagueRules.ts's change refuses a format change with these words.

/** A format as the refusal names it. */
const formatWords: Record<LeagueRules["format"], string> = { headToHead: "head-to-head", totalPoints: "total points" };

/** Why a format change is refused, in the words the commissioner is shown. */
export const formatLocked = (format: LeagueRules["format"]) =>
  `The league's first gameweek has begun, so its format is locked for the season and stays ${formatWords[format]}: ` +
  "one table with one meaning all season.";

/** Whether the league's season has begun by the time a change takes effect from `fromGameweek`: a
 *  gameweek it scores, before that one, began after the league was made, as its scores count only
 *  those (../gameweekScorer/gameweekScores.ts's `begunGameweeks`). So a league made mid-season, or
 *  scoring from a later start, begins at its own first gameweek, not FPL's. */
async function seasonBegun(ctx: QueryCtx, league: Doc<"leagues">, fromGameweek: number): Promise<boolean> {
  const deadlineIn = deadlineOf(await leagueDeadlines(ctx, league._id));
  return scoredGameweeksOf(league, await seasonGameweekCount(ctx)).some((gameweek) => {
    const deadline = deadlineIn(gameweek);
    return gameweek < fromGameweek && deadline !== null && deadline >= league._creationTime;
  });
}

/** Refuses rules changing the league's format from `latest`'s, taking effect from `fromGameweek`,
 *  once its season has begun. */
export async function refuseFormatChange(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  latest: LeagueRules,
  rules: LeagueRules,
  fromGameweek: number,
): Promise<void> {
  if (rules.format !== latest.format && (await seasonBegun(ctx, league, fromGameweek))) refuse(formatLocked(latest.format));
}
