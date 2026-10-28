import type { Id } from "../_generated/dataModel";
import type { LeagueRules } from "../rules/leagueRulesShape";
import type { TeamGameweek } from "./gameweekScores";
import type { LeagueTable } from "./leagueTable";
import { namedFixture, roundsOf, type GameweekFixtures } from "./roundRobin";
import { headToHeadTable, teamsInGameweek, totalPointsTable, type GameweekScores, type TableRow, type TieBreak } from "./standings";
import type { TeamFixtures } from "./teamFixtures";
import { BYE, gameScore, gamesOf } from "./teamGames";

// What the table's queries send, worked out from what they read: the league's table and fixtures
// (leagueTable.ts's ofLeague) and one team's games (teamFixtures.ts's ofMyTeam). Pure, with no
// server import, so the preview and the screen tests (src/table/drawnTable.ts) draw exactly what
// the server sends.

type TeamId = Id<"teams">;

/** Each team's points in each gameweek scored, in gameweek order (gameweekScores.ts). */
export type Results = ReadonlyMap<number, ReadonlyMap<TeamId, TeamGameweek>>;

/** A gameweek begun that couldn't be scored, and why. */
type Unscored = LeagueTable["unscored"];

/** The league's own deadline in a gameweek, or null while none is known. */
type DeadlineOf = (gameweek: number) => number | null;

/** The points alone of each team in each gameweek scored, as the table counts them. */
export const pointsOf = (results: Results): GameweekScores<TeamId> =>
  new Map([...results].map(([gameweek, teamScores]) => [gameweek, new Map([...teamScores].map(([teamId, { points }]) => [teamId, points]))]));

/** The league's table in its format: from the head-to-head schedule, or by points for. */
export function tableOf(
  format: LeagueRules["format"],
  teamIds: readonly TeamId[],
  schedule: readonly GameweekFixtures<TeamId>[],
  scores: GameweekScores<TeamId>,
  tieBreaks: readonly TieBreak[],
): TableRow<TeamId>[] {
  return format === "headToHead" ? headToHeadTable(teamIds, schedule, scores, tieBreaks) : totalPointsTable(teamIds, scores);
}

/** The league's fixtures by gameweek, each scored once its gameweek is, and its table, as
 *  `ofLeague` sends them. */
export function leagueTableFrom({
  format,
  teamIds,
  schedule,
  results,
  unscored,
  table,
  deadlineOf,
  named,
}: {
  format: LeagueRules["format"];
  teamIds: readonly TeamId[];
  schedule: readonly GameweekFixtures<TeamId>[];
  results: Results;
  unscored: Unscored;
  table: readonly TableRow<TeamId>[];
  deadlineOf: DeadlineOf;
  named: (teamId: TeamId) => string;
}): LeagueTable {
  return {
    format,
    roundRobinRounds: schedule.length === 0 ? 0 : roundsOf(teamIds).length,
    gameweeks: schedule.map((drawn) => ({
      gameweek: drawn.gameweek,
      deadline: deadlineOf(drawn.gameweek),
      fixtures: drawn.fixtures.map((each) => {
        const scored = results.get(drawn.gameweek);
        const score = scored === undefined ? null : gameScore(teamsInGameweek(drawn), scored, drawn.gameweek, each.team, each.opponent);
        return { teamId: each.team, ...namedFixture(each, named), points: score === null ? null : { team: score.team, opponent: score.opponent } };
      }),
      byes: drawn.byes.map(named),
    })),
    table: table.map(({ team, ...row }) => ({ teamId: team, teamName: named(team), ...row })),
    results: [...results].map(([gameweek, teamScores]) => ({
      gameweek,
      teams: [...teamScores].map(([teamId, result]) => ({ teamId, teamName: named(teamId), ...result })),
    })),
    unscored,
  };
}

/** `team`'s games in the league, each scored once its gameweek is, as `ofMyTeam` sends them. */
export function teamFixturesFrom({
  team,
  format,
  schedule,
  results,
  unscored,
  deadlineOf,
  named,
}: {
  team: { id: TeamId; name: string };
  format: LeagueRules["format"];
  schedule: readonly GameweekFixtures<TeamId>[];
  results: Results;
  unscored: Unscored;
  deadlineOf: DeadlineOf;
  named: (teamId: TeamId) => string;
}): TeamFixtures {
  const games = gamesOf(schedule, team.id);
  // Each game is one of the schedule's, so its gameweek is there.
  const drawnIn = new Map(schedule.map((drawn) => [drawn.gameweek, drawn]));
  return {
    teamId: team.id,
    teamName: team.name,
    format,
    games: games.map(({ gameweek, against }) => {
      const scored = results.get(gameweek);
      const opponent = against.kind === "team" ? against.team : against.kind;
      return {
        gameweek,
        deadline: deadlineOf(gameweek),
        against: against.kind === "team" ? { kind: "team" as const, teamName: named(against.team) } : against,
        score: scored === undefined || opponent === BYE ? null : gameScore(teamsInGameweek(drawnIn.get(gameweek)!), scored, gameweek, team.id, opponent),
      };
    }),
    unscored: unscored.filter(({ gameweek }) => games.some((game) => game.gameweek === gameweek)),
  };
}
