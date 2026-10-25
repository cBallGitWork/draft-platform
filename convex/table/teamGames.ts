import { LEAGUE_AVERAGE, type GameweekFixtures } from "./roundRobin";

// One team's games in a league's head-to-head schedule (#365; spec/12, My team's tabs: "the team's
// head-to-head fixtures and results for the season"), pure so the query (teamFixtures.ts) and the
// preview read them alike.

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
