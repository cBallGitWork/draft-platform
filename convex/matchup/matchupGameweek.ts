import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { leagueDeadlineOf } from "../gameweeks/leagueDeadlines";
import { gameweekDeadline } from "../gameweeks/nextGameweek";
import { gameModeOf } from "../rules/gameMode";
import { seasonRules } from "../rules/rulesHistory";
import { memberOf, teamIn } from "../shared/leagueAccess";
import { scheduleOf } from "../table/playedFixtures";
import { gamesOf } from "../table/teamGames";

// Which gameweek the matchup opens on (#1550): the latest begun, or before any, the first. A query
// taking the minute runs again, uncached, every minute for every open screen, so this one sends the
// team's head-to-head gameweeks with their deadlines and the screen judges them at its own minute
// (nextGameweek.ts's `thisGameweekAt`; #2008); the matchup itself (matchup.ts's `ofTeam`) takes the
// gameweek. Both are read again only when their data changes.

/** A team's head-to-head gameweeks, in order, each with the league's deadline in it: the matchup
 *  opens on `thisGameweekAt` of them at the screen's minute. Null with no head-to-head to show, as
 *  `ofTeam` then says why. The team is the caller's own unless one is named. */
export const gameweeksOf = query({
  args: { leagueId: v.id("leagues"), teamId: v.optional(v.id("teams")) },
  returns: v.union(v.array(gameweekDeadline), v.null()),
  handler: async (ctx, { leagueId, teamId }) => {
    const opened = await matchupTeam(ctx, leagueId, teamId);
    if (opened.kind !== "team") return null;
    const games = gamesOf(await scheduleOf(ctx, opened.league, opened.season), opened.team._id);
    const deadlineOf = await leagueDeadlineOf(ctx, leagueId);
    return [...new Set(games.map(({ gameweek }) => gameweek))].map((gameweek) => ({ gameweek, deadline: deadlineOf(gameweek) }));
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
