import { LEAGUE_AVERAGE, type Fixture, type GameweekFixtures } from "./roundRobin";
import { averageOf } from "./standings";

// One team's games in a league's head-to-head schedule (#365; spec/12, My team's tabs: "the team's
// head-to-head fixtures and results for the season"), and each game's score once its gameweek is
// scored (#436), pure so the queries (teamFixtures.ts, leagueTable.ts) and the preview read them
// alike.

/** Who a team meets in one game: another team, the league's average, or nobody, on a bye. */
export const BYE = "bye";
export type Against<Team> = { kind: "team"; team: Team } | { kind: typeof LEAGUE_AVERAGE } | { kind: typeof BYE };

/** One of a team's games: its gameweek, which of the team's games in that gameweek it is (from 1,
 *  more than one in a league playing two a gameweek; #913), and who it meets. */
export type TeamGame<Team> = { gameweek: number; game: number; against: Against<Team> };

/** The first of a team's games in a gameweek, as `gamesOf`, the matchup's address and its switch
 *  number them. */
export const FIRST_GAME = 1;

/** Every game `team` plays in `schedule`, in gameweek order: in a gameweek, its fixtures as drawn
 *  (on either side), then its byes, numbered from 1 in that order. A gameweek it has no part in,
 *  such as one stored before it joined, gives none. */
export function gamesOf<Team>(schedule: readonly GameweekFixtures<Team>[], team: Team): TeamGame<Team>[] {
  return schedule.flatMap(({ gameweek, fixtures, byes }) => {
    const met = fixtures.flatMap((fixture): Against<Team>[] => {
      if (fixture.team === team) return [fixture.opponent === LEAGUE_AVERAGE ? { kind: LEAGUE_AVERAGE } : { kind: "team", team: fixture.opponent }];
      if (fixture.opponent === team) return [{ kind: "team", team: fixture.team }];
      return [];
    });
    const sittingOut = byes.filter((each) => each === team).map((): Against<Team> => ({ kind: BYE }));
    return [...met, ...sittingOut].map((against, index) => ({ gameweek, game: index + FIRST_GAME, against }));
  });
}

/** Which of its `team` side's games in the gameweek a gameweek's fixture at `index` is, numbered
 *  as `gamesOf` numbers them: so each fixture's link opens its own matchup where a team plays two
 *  games a gameweek (spec/10; #913). */
export function gameNumberAt<Team>(fixtures: readonly Fixture<Team>[], index: number): number {
  const { team } = fixtures[index];
  return fixtures.slice(0, index).filter((each) => each.team === team || each.opponent === team).length + FIRST_GAME;
}

/** A team's points in a gameweek scored, and whether they may still move (gameweekScores.ts's
 *  TeamGameweekTotal). */
export type SideScore = { points: number; provisional: boolean };

/** A fixture's score: each side's points, the average's for the league's average, and whether
 *  either may still move (spec/07), the average while any team's may. */
export type GameScore = { team: number; opponent: number; provisional: boolean };

/** The score of `team`'s fixture against `opponent` in a gameweek scored, the league's average over
 *  `teams`, the gameweek's own (standings.ts's `teamsInGameweek`), `scored` holding every one of
 *  them: as the table's fixtures (sentTables.ts) and My team's Fixtures tab show it. A team
 *  missing from it is a gameweek scored short, and throws. */
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
  const average = averageScore(teams, new Map(teams.map((each) => [each, sideOf(each)])), gameweek);
  return { team: own.points, opponent: average.points, provisional: average.provisional };
}

/** The league's average over `teams` in a gameweek scored, `sides` holding each: their points'
 *  average (standings.ts's `averageOf`), a team with no lineup counting as its 0 (spec/07), and
 *  provisional while any team's is. */
export function averageScore<Team>(teams: readonly Team[], sides: ReadonlyMap<Team, SideScore>, gameweek: number): SideScore {
  const points = new Map([...sides].map(([team, side]) => [team, side.points]));
  return { points: averageOf(teams, points, gameweek), provisional: teams.some((team) => sides.get(team)?.provisional === true) };
}
