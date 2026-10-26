import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { LEAGUE_AVERAGE, namedFixture, roundsOf } from "./roundRobin";
import { scheduleOf } from "./playedFixtures";
import { averageOf, headToHeadTable, totalPointsTable, type GameweekScores } from "./standings";
import { leagueScores } from "./gameweekScores";
import { shownDeadline } from "../gameweeks/usedGameweeks";

// The league's fixtures and table (#33; spec/09, spec/12 "table and fixtures"), for anyone with a
// part in it. Each gameweek the league has begun has its fixtures as stored once it began, none in
// one begun with no head-to-head (before the league was made, say: #282), and the rest are drawn
// from the teams, the gameweeks the league plays and the rules in force in each (playedFixtures.ts;
// #137, #266). The table counts the same fixtures the screen shows, each scored once its gameweek
// has begun (gameweekScores.ts, #29): live points count, marked provisional until final. The
// commissioner editing fixtures (spec/09) comes later.

export const fixture = v.object({
  /** The team's own, for a link to its matchup (#34). */
  teamId: v.id("teams"),
  team: v.string(),
  /** The opponent's name, or null for the league's average. */
  opponent: v.union(v.string(), v.null()),
});

/** A fixture on the table's screen, with its score. */
const scoredFixture = v.object({
  ...fixture.fields,
  /** Each side's points, the average's for the league's average; null until the gameweek is scored. */
  points: v.union(v.object({ team: v.number(), opponent: v.number() }), v.null()),
});

/** A team's points in a gameweek scored (gameweekScores.ts's TeamGameweek). */
const teamResult = v.object({
  teamId: v.id("teams"),
  teamName: v.string(),
  points: v.number(),
  provisional: v.boolean(),
  noLineup: v.boolean(),
});

const gameweekFixtures = v.object({
  gameweek: v.number(),
  /** The league's own deadline, under the rule in force in the gameweek (#139); the fixtures
   *  open on the first gameweek it hasn't locked. */
  deadline: shownDeadline,
  fixtures: v.array(scoredFixture),
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
  /** Each gameweek the league plays head-to-head, with its fixtures: none in total points, with
   *  fewer than two teams, nor one begun with no head-to-head (playedFixtures.ts). */
  gameweeks: v.array(gameweekFixtures),
  table: v.array(tableRow),
  /** Every team's points in each gameweek begun and scored, in gameweek order: in either format. */
  results: v.array(v.object({ gameweek: v.number(), teams: v.array(teamResult) })),
  /** Each gameweek begun that couldn't be scored, and why: it counts for nothing in the table (#287). */
  unscored: v.array(v.object({ gameweek: v.number(), reason: v.string() })),
});
export type LeagueTable = Infer<typeof leagueTable>;

/** A side's points in a gameweek scored: a team's own, or the league's average. A team with none
 *  is a gameweek scored short, and throws. */
function sidePoints(teamIds: readonly Id<"teams">[], scored: ReadonlyMap<Id<"teams">, number>, gameweek: number, side: Id<"teams"> | typeof LEAGUE_AVERAGE) {
  if (side === LEAGUE_AVERAGE) return averageOf(teamIds, scored, gameweek);
  const points = scored.get(side);
  if (points === undefined) throw new Error(`Gameweek ${gameweek} is scored, but not for team ${side}`);
  return points;
}

/** What a league's table and fixtures are drawn from, as `ofLeague` and league home read them:
 *  the latest rules, the teams, the head-to-head schedule (none in total points), each team's points
 *  in each gameweek begun and those that couldn't be scored (gameweekScores.ts), and the table they
 *  make. */
export async function standingsOf(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules) {
  // The format and tie-breaks are the latest rules'; the draw is each gameweek's own.
  const rules = season.latest;
  const teams = await teamsOf(ctx, league._id);
  const teamIds = teams.map((team) => team._id);
  const nameOf = new Map(teams.map((team) => [team._id, team.name]));
  const named = (teamId: Id<"teams">) => nameOf.get(teamId)!;

  const headToHead = rules.format === "headToHead";
  const schedule = headToHead ? await scheduleOf(ctx, league, season) : [];
  const { scores: results, unscored } = await leagueScores(ctx, league, season, teamIds);
  const scores: GameweekScores<Id<"teams">> = new Map(
    [...results].map(([gameweek, teamScores]) => [gameweek, new Map([...teamScores].map(([teamId, { points }]) => [teamId, points]))]),
  );
  const table = headToHead ? headToHeadTable(teamIds, schedule, scores, rules.tieBreaks) : totalPointsTable(teamIds, scores);
  return { rules, teamIds, schedule, results, unscored, scores, table, named };
}

/** The league's fixtures by gameweek and its table, or null for a league made before rules were
 *  held (#25), which has no format to draw them by. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(leagueTable, v.null()),
  handler: async (ctx, { leagueId }) => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    const { rules, teamIds, schedule, results, unscored, scores, table, named } = await standingsOf(ctx, league, season);
    const deadlines = await leagueDeadlines(ctx, leagueId);
    return {
      format: rules.format,
      roundRobinRounds: schedule.length === 0 ? 0 : roundsOf(teamIds).length,
      gameweeks: schedule.map(({ gameweek, fixtures, byes }) => ({
        gameweek,
        deadline: deadlines.get(gameweek) ?? null,
        fixtures: fixtures.map((each) => {
          const scored = scores.get(gameweek);
          return {
            teamId: each.team,
            ...namedFixture(each, named),
            points:
              scored === undefined
                ? null
                : { team: sidePoints(teamIds, scored, gameweek, each.team), opponent: sidePoints(teamIds, scored, gameweek, each.opponent) },
          };
        }),
        byes: byes.map(named),
      })),
      table: table.map(({ team, ...row }) => ({ teamId: team, teamName: named(team), ...row })),
      results: [...results].map(([gameweek, teamScores]) => ({
        gameweek,
        teams: [...teamScores].map(([teamId, result]) => ({ teamId, teamName: named(teamId), ...result })),
      })),
      unscored,
    };
  },
});
