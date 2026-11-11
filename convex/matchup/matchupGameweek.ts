import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { thisGameweekOf } from "../gameweeks/nextGameweek";
import { gameModeOf } from "../rules/gameMode";
import { seasonRules } from "../rules/rulesHistory";
import { memberOf, teamIn } from "../shared/leagueAccess";
import { scheduleOf } from "../table/playedFixtures";
import { gamesOf } from "../table/teamGames";

// Which gameweek the matchup opens on (#1550). It needs the screen's minute, and a query taking the
// minute runs again, uncached, every minute for every open screen, so it is a small query of its
// own: the matchup itself (matchup.ts's `ofTeam`) takes the gameweek, no minute, and is read again
// only when its data changes.

/** The gameweek a team's matchup opens on at `now`, the screen's (a query may not read the clock):
 *  the latest begun, or before any, the first. Null with no head-to-head to show, as `ofTeam` then
 *  says why. The team is the caller's own unless one is named. */
export const thisGameweek = query({
  args: { leagueId: v.id("leagues"), now: v.number(), teamId: v.optional(v.id("teams")) },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { leagueId, now, teamId }) => {
    const opened = await matchupTeam(ctx, leagueId, teamId);
    if (opened.kind !== "team") return null;
    const games = gamesOf(await scheduleOf(ctx, opened.league, opened.season), opened.team._id);
    return thisGameweekOf(games, deadlineOf(await leagueDeadlines(ctx, leagueId)), now)?.gameweek ?? null;
  },
});

/** The league, its rules and the matchup's team, the caller's own unless one is named; or why there
 *  is no head-to-head to show. For anyone with a part in the league. */
export async function matchupTeam(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams"> | undefined) {
  const { league, team: own } = await memberOf(ctx, leagueId);
  const season = await seasonRules(ctx, leagueId);
  if (!gameModeOf(season.latest).hasMatchups) return { kind: "totalPoints" as const };
  const team = teamId === undefined ? own : await teamIn(ctx, leagueId, teamId);
  if (team === undefined) return { kind: "noTeam" as const };
  return { kind: "team" as const, league, season, team };
}
