// The order of a draft's picks (spec/04, The picks; #1088): snake only, so each round runs the
// other way from the one before, and the team picking last in a round picks first in the next.
// The draft runs with the teams that exist, even fewer than the league's maximum (spec/04,
// Starting it). Pure: no I/O.

/** Who makes each pick, first to last: `teams` in the draft order, over `rounds` rounds. */
export function snakeOrder<Team>(teams: readonly Team[], rounds: number): Team[] {
  const reversed = [...teams].reverse();
  return Array.from({ length: rounds }, (_, round) => (round % 2 === 0 ? teams : reversed)).flat();
}
