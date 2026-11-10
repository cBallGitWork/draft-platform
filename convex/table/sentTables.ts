import type { Id } from "../_generated/dataModel";
import type { DeadlineOf } from "../gameweeks/deadline";
import type { LeagueRules } from "../rules/leagueRulesShape";
import type { TeamGameweekTotal } from "../gameweekScorer/gameweekScores";
import type { LeagueTable } from "./leagueTable";
import { namedFixture, type GameweekFixtures } from "./roundRobin";
import { headToHeadTable, teamsInGameweek, totalPointsTable, type GameweekScores, type TableRow, type TieBreak } from "./standings";
import type { TeamFixtures } from "./teamFixtures";
import { BYE, gameNumberAt, gameScore, gamesOf } from "./teamGames";

// What the table's queries send, worked out from what they read: the league's table and fixtures
// (leagueTable.ts's ofLeague) and one team's games (teamFixtures.ts's ofMyTeam). Pure, with no
// server import, so the preview and the screen tests (src/table/drawnTable.ts) draw exactly what
// the server sends.

type TeamId = Id<"teams">;

/** Each team's points in each gameweek scored, in gameweek order (gameweekScores.ts). */
export type Results = ReadonlyMap<number, ReadonlyMap<TeamId, TeamGameweekTotal>>;

/** A gameweek begun that couldn't be scored, and why. */
type Unscored = LeagueTable["unscored"];

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
  schedule,
  results,
  unscored,
  table,
  deadlineOf,
  named,
  autoTeams,
}: {
  format: LeagueRules["format"];
  schedule: readonly GameweekFixtures<TeamId>[];
  results: Results;
  unscored: Unscored;
  table: readonly TableRow<TeamId>[];
  deadlineOf: DeadlineOf;
  named: (teamId: TeamId) => string;
  /** The teams on the auto team now, which the table marks (spec/09). */
  autoTeams: ReadonlySet<TeamId>;
}): LeagueTable {
  return {
    format,
    gameweeks: schedule.map((drawn) => ({
      gameweek: drawn.gameweek,
      deadline: deadlineOf(drawn.gameweek),
      fixtures: scoredFixtures(drawn, results, named),
      byes: drawn.byes.map(named),
    })),
    table: table.map(({ team, ...row }) => ({ teamId: team, teamName: named(team), ...row, onAutoTeam: autoTeams.has(team) })),
    results: [...results].map(([gameweek, teamScores]) => ({
      gameweek,
      teams: [...teamScores].map(([teamId, result]) => ({ teamId, teamName: named(teamId), ...result })),
    })),
    unscored,
  };
}

/** The gameweek's fixtures, each with both sides' points once the gameweek is scored, live until
 *  final: the table's and league home's. */
export function scoredFixtures(drawn: GameweekFixtures<TeamId>, results: Results, named: (teamId: TeamId) => string): LeagueTable["gameweeks"][number]["fixtures"] {
  const scored = results.get(drawn.gameweek);
  return drawn.fixtures.map((each, index) => {
    const score = scored === undefined ? null : gameScore(teamsInGameweek(drawn), scored, drawn.gameweek, each.team, each.opponent);
    const points = score === null ? null : { team: score.team, opponent: score.opponent };
    return { teamId: each.team, game: gameNumberAt(drawn.fixtures, index), ...namedFixture(each, named), points };
  });
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
    games: games.map(({ gameweek, game, against }) => {
      const scored = results.get(gameweek);
      const opponent = against.kind === "team" ? against.team : against.kind;
      return {
        gameweek,
        game,
        deadline: deadlineOf(gameweek),
        against: against.kind === "team" ? { kind: "team" as const, teamName: named(against.team) } : against,
        score: scored === undefined || opponent === BYE ? null : gameScore(teamsInGameweek(drawnIn.get(gameweek)!), scored, gameweek, team.id, opponent),
      };
    }),
    unscored: unscored.filter(({ gameweek }) => games.some((game) => game.gameweek === gameweek)),
  };
}
