import { LEAGUE_AVERAGE, type GameweekFixtures } from "./roundRobin";
import { averageOf } from "./standings";

// One team's games in a league's head-to-head schedule (#365; spec/12, My team's tabs: "the team's
// head-to-head fixtures and results for the season"), and each game's score once its gameweek is
// scored (#436), pure so the queries (teamFixtures.ts, leagueTable.ts) and the preview read them
// alike.

/** Who a team meets in one game: another team, the league's average, or nobody, on a bye. */
export const BYE = "bye";
export type Against<Team> = { kind: "team"; team: Team } | { kind: typeof LEAGUE_AVERAGE } | { kind: typeof BYE };

export type TeamGame<Team> = { gameweek: number; against: Against<Team> };

/** Every game `team` plays in `schedule`, in gameweek order: in a gameweek, its fixtures as drawn
 *  (on either side), then its byes. A gameweek it has no part in, such as one stored before it
 *  joined, gives none. */
export function gamesOf<Team>(schedule: readonly GameweekFixtures<Team>[], team: Team): TeamGame<Team>[] {
  return schedule.flatMap(({ gameweek, fixtures, byes }) => {
    const met = fixtures.flatMap((fixture): Against<Team>[] => {
      if (fixture.team === team) return [fixture.opponent === LEAGUE_AVERAGE ? { kind: LEAGUE_AVERAGE } : { kind: "team", team: fixture.opponent }];
      if (fixture.opponent === team) return [{ kind: "team", team: fixture.team }];
      return [];
    });
    const sittingOut = byes.filter((each) => each === team).map((): Against<Team> => ({ kind: BYE }));
    return [...met, ...sittingOut].map((against) => ({ gameweek, against }));
  });
}

/** A team's points in a gameweek scored, and whether they may still move (gameweekScores.ts's
 *  TeamGameweek). */
export type SideScore = { points: number; provisional: boolean };

/** A fixture's score: each side's points, the average's for the league's average, and whether
 *  either may still move (spec/07), the average while any team's may. */
export type GameScore = { team: number; opponent: number; provisional: boolean };

/** The score of `team`'s fixture against `opponent` in a gameweek scored, `scored` holding every
 *  one of `teams`: as the table's fixtures (leagueTable.ts) and My team's Fixtures tab show it. A
 *  team missing from it is a gameweek scored short, and throws. */
export function gameScore<Team>(
  teams: readonly Team[],
  scored: ReadonlyMap<Team, SideScore>,
  gameweek: number,
  team: Team,
  opponent: Team | typeof LEAGUE_AVERAGE,
): GameScore {
  const sideOf = (side: Team): SideScore => {
    const score = scored.get(side);
    if (score === undefined) throw new Error(`Gameweek ${gameweek} is scored, but not for team ${String(side)}`);
    return score;
  };
  const own = sideOf(team);
  if (opponent !== LEAGUE_AVERAGE) {
    const other = sideOf(opponent);
    return { team: own.points, opponent: other.points, provisional: own.provisional || other.provisional };
  }
  const every = teams.map(sideOf);
  const points = new Map(teams.map((each, index) => [each, every[index].points]));
  return { team: own.points, opponent: averageOf(teams, points, gameweek), provisional: every.some((each) => each.provisional) };
}
