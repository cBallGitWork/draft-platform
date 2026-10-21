// The head-to-head fixtures (#33; spec/09): a round robin drawn over the gameweeks the league plays
// (spec/13, Gameweeks), so an unticked gameweek has none and the round it would have had moves on
// to the next one played. When the league plays more gameweeks than one round robin has rounds,
// the round robin repeats, in the same order. Pure: no I/O.

/** With an odd number of teams, what the team left over plays each gameweek: no one, or the
 *  league's average score that gameweek (spec/09). A league's rule (spec/03), stored as data. */
export const ODD_TEAM_OUTS = ["bye", "leagueAverage"] as const;
export type OddTeamOut = (typeof ODD_TEAM_OUTS)[number];

/** The opponent of the team left over, in a league whose odd team out plays the average. */
export const LEAGUE_AVERAGE = "leagueAverage";

export type Fixture<Team> = { team: Team; opponent: Team | typeof LEAGUE_AVERAGE };
export type GameweekFixtures<Team> = {
  gameweek: number;
  fixtures: Fixture<Team>[];
  /** The team left over, in a league whose odd team out has a bye; otherwise null. */
  bye: Team | null;
};

/** The rounds of one round robin, by the circle method: one team stays put while the rest turn
 *  round it, so each team meets every other once. With an odd number, a gap joins the circle, and
 *  whoever faces it (null) is left over: each team once a round robin. */
export function roundsOf<Team>(teams: readonly Team[]): [Team, Team | null][][] {
  const circle: (Team | null)[] = teams.length % 2 === 0 ? [...teams] : [...teams, null];
  const size = circle.length;
  const rounds: [Team, Team | null][][] = [];
  for (let round = 0; round < size - 1; round += 1) {
    const pairs: [Team, Team | null][] = [];
    for (let index = 0; index < size / 2; index += 1) {
      const [one, other] = [circle[index], circle[size - 1 - index]];
      // Whoever faces the gap comes first.
      pairs.push(one === null ? [other!, null] : [one, other]);
    }
    rounds.push(pairs);
    circle.splice(1, 0, circle.pop()!);
  }
  return rounds;
}

/** The league's fixtures in each gameweek it plays (`gameweeks`, in order), its teams in the
 *  order they were made. Fewer than two teams have no one to play, so no fixtures. */
export function drawFixtures<Team>(
  teams: readonly Team[],
  gameweeks: readonly number[],
  oddTeamOut: OddTeamOut,
): GameweekFixtures<Team>[] {
  if (teams.length < 2) return [];
  const rounds = roundsOf(teams);
  return gameweeks.map((gameweek, index) => {
    const fixtures: Fixture<Team>[] = [];
    let leftOver: Team | null = null;
    for (const [team, opponent] of rounds[index % rounds.length]) {
      if (opponent === null) leftOver = team;
      else fixtures.push({ team, opponent });
    }
    if (leftOver !== null && oddTeamOut === "leagueAverage") {
      fixtures.push({ team: leftOver, opponent: LEAGUE_AVERAGE });
      leftOver = null;
    }
    return { gameweek, fixtures, bye: leftOver };
  });
}
