// The order of a draft's picks (spec/04, The picks; #1088): snake only, so each round runs the
// other way from the one before, and the team picking last in a round picks first in the next.
// The draft runs with the teams that exist, even fewer than the league's maximum (spec/04,
// Starting it). Pure: no I/O.

/** Who makes each pick, first to last: `teams` in the draft order, over `rounds` rounds. */
export function snakeOrder<Team>(teams: readonly Team[], rounds: number): Team[] {
  const reversed = [...teams].reverse();
  return Array.from({ length: rounds }, (_, round) => (round % 2 === 0 ? teams : reversed)).flat();
}

/** The pick on the clock once `picksMade` picks are made: its number and round, from 1, and the
 *  team making it; null once every pick is made. */
export function pickOnTheClock<Team>(teams: readonly Team[], rounds: number, picksMade: number): { pick: number; round: number; team: Team } | null {
  const team = snakeOrder(teams, rounds).at(picksMade);
  if (team === undefined || picksMade < 0) return null;
  return { pick: picksMade + 1, round: Math.floor(picksMade / teams.length) + 1, team };
}
