import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { shownDeadline } from "../gameweeks/usedGameweeks";
import { seasonRules } from "../rules/rulesHistory";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { callerEmail, getLeague, refuse, refusals, teamOf, teamsOf } from "../shared/leagueAccess";
import { scheduleOf } from "./playedFixtures";
import { LEAGUE_AVERAGE } from "./roundRobin";
import { BYE, gamesOf } from "./teamGames";

// My team's Fixtures tab (#365; spec/12, My team's tabs): the caller's team's head-to-head games
// for the season, from the same schedule the table and fixtures screen reads (leagueTable.ts), so
// a gameweek begun is as stored and one begun before the league existed has none (#282). No
// matchup is scored yet, so each game is a fixture until #29's scores give it a result.

const against = v.union(
  v.object({ kind: v.literal("team"), teamName: v.string() }),
  v.object({ kind: v.literal(LEAGUE_AVERAGE) }),
  v.object({ kind: v.literal(BYE) }),
);

const teamGame = v.object({
  gameweek: v.number(),
  /** The league's own deadline in the gameweek (#139), as the table's fixtures show it. */
  deadline: shownDeadline,
  against,
});

export const teamFixtures = v.object({
  teamName: v.string(),
  format: leagueRulesShape.fields.format,
  /** Every game the team plays, in gameweek order: none in total points, with fewer than two
   *  teams, or in a gameweek begun with no head-to-head (playedFixtures.ts). */
  games: v.array(teamGame),
});
export type TeamFixtures = Infer<typeof teamFixtures>;

/** The caller's team's games in the league, or null for a league made before rules were held
 *  (#25), which has no format to draw them by. Refused for anyone who runs no team in it. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(teamFixtures, v.null()),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    const league = await getLeague(ctx, leagueId);
    const team = (await teamOf(ctx, leagueId, email)) ?? refuse(refusals.runsNoTeam);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    // As the table reads it: the format is the latest rules', the draw each gameweek's own.
    const format = season.latest.format;
    const schedule = format === "headToHead" ? await scheduleOf(ctx, league, season) : [];
    const nameOf = new Map((await teamsOf(ctx, leagueId)).map(({ _id, name }) => [_id, name]));
    const named = (teamId: Id<"teams">) => nameOf.get(teamId)!;
    const deadlines = await leagueDeadlines(ctx, leagueId);
    return {
      teamName: team.name,
      format,
      games: gamesOf(schedule, team._id).map(({ gameweek, against }) => ({
        gameweek,
        deadline: deadlines.get(gameweek) ?? null,
        against: against.kind === "team" ? { kind: "team" as const, teamName: named(against.team) } : against,
      })),
    };
  },
});
