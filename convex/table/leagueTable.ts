import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { drawRulesOf } from "../rules/firstRules";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { seasonRules } from "../rules/leagueRules";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { drawFixtures, LEAGUE_AVERAGE, roundsOf } from "./roundRobin";
import { headToHeadTable, totalPointsTable, type GameweekScores } from "./standings";
import { fplDeadline, fplDeadlines, usedGameweeksOf } from "../gameweeks/usedGameweeks";

// The league's fixtures and table (#33; spec/09, spec/12 "table and fixtures"), for anyone with a
// part in it. The fixtures are drawn afresh on every read from the teams, the gameweeks the league
// plays and the rules in force in each, so a change of rules never moves a gameweek before it
// takes effect (#266). None is stored, so a team joining redraws them all (#29). No
// matchup is scored yet (no lineups or scores are kept), so the table is all noughts until #29's
// scores reach it; the commissioner editing fixtures (spec/09) comes later.

const fixture = v.object({
  team: v.string(),
  /** The opponent's name, or null for the league's average. */
  opponent: v.union(v.string(), v.null()),
});

const gameweekFixtures = v.object({
  gameweek: v.number(),
  deadline: fplDeadline,
  fixtures: v.array(fixture),
  /** The teams with a bye, in a league whose odd team out has one: one a game. */
  byes: v.array(v.string()),
});

const tableRow = v.object({
  teamId: v.id("teams"),
  teamName: v.string(),
  played: v.number(),
  won: v.number(),
  drawn: v.number(),
  lost: v.number(),
  pointsFor: v.number(),
  pointsAgainst: v.number(),
  difference: v.number(),
  points: v.number(),
});

export const leagueTable = v.object({
  format: leagueRulesShape.fields.format,
  /** How many rounds one round robin has, every team meeting every other once; 0 with no fixtures. */
  roundRobinRounds: v.number(),
  /** Each gameweek the league plays, with its fixtures; none in total points, or with fewer than
   *  two teams. */
  gameweeks: v.array(gameweekFixtures),
  table: v.array(tableRow),
});
export type LeagueTable = Infer<typeof leagueTable>;

/** The league's fixtures by gameweek and its table, or null for a league made before rules were
 *  held (#25), which has no format to draw them by. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(leagueTable, v.null()),
  handler: async (ctx, { leagueId }) => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    // The format and tie-breaks are the latest rules'; the draw is each gameweek's own.
    const rules = season.latest;
    const teams = await teamsOf(ctx, leagueId);
    const teamIds = teams.map((team) => team._id);
    const nameOf = new Map(teams.map((team) => [team._id, team.name]));
    const named = (teamId: Id<"teams">) => nameOf.get(teamId)!;

    const headToHead = rules.format === "headToHead";
    // Seeded by the league, so its draw comes out the same each time it's read.
    const drawRulesIn = (gameweek: number) => drawRulesOf(season.inGameweek(gameweek));
    const schedule = headToHead ? drawFixtures(teamIds, usedGameweeksOf(league), drawRulesIn, leagueId) : [];
    const scores: GameweekScores<Id<"teams">> = new Map();
    const table = headToHead ? headToHeadTable(teamIds, schedule, scores, rules.tieBreaks) : totalPointsTable(teamIds, scores);

    const deadlines = await fplDeadlines(ctx);
    return {
      format: rules.format,
      roundRobinRounds: schedule.length === 0 ? 0 : roundsOf(teamIds).length,
      gameweeks: schedule.map(({ gameweek, fixtures, byes }) => ({
        gameweek,
        deadline: deadlines.get(gameweek) ?? null,
        fixtures: fixtures.map(({ team, opponent }) => ({
          team: named(team),
          opponent: opponent === LEAGUE_AVERAGE ? null : named(opponent),
        })),
        byes: byes.map(named),
      })),
      table: table.map(({ team, ...row }) => ({ teamId: team, teamName: named(team), ...row })),
    };
  },
});
