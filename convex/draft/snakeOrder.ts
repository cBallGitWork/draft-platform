// The order of a draft's picks (spec/04, The picks; #1088): snake only, so each round runs the
// other way from the one before, and the team picking last in a round picks first in the next.
// The draft runs with the teams that exist, even fewer than the league's maximum (spec/04,
// Starting it). A pick traded before the draft (#1096) is a team's pick in a round, not a fixed
// slot: "Just trade '3rd round pick' rather than precise number" (Craig, 8 Nov 2026), so it goes
// wherever that team's turn falls in that round, and its new owner makes it. Pure: no I/O.

/** A pick that has changed hands: `teamId`'s pick in `round`, which `ownerId` holds now. */
export type TradedPick<Team> = { round: number; teamId: Team; ownerId: Team };

/** Who holds `team`'s pick in `round` now: the team itself unless it was traded. */
export function pickOwner<Team>(traded: readonly TradedPick<Team>[], round: number, team: Team): Team {
  return traded.find((each) => each.round === round && each.teamId === team)?.ownerId ?? team;
}

/** Whose turn each pick is, first to last: `teams` in the draft order, over `rounds` rounds. */
export function snakeOrder<Team>(teams: readonly Team[], rounds: number): Team[] {
  const reversed = [...teams].reverse();
  return Array.from({ length: rounds }, (_, round) => (round % 2 === 0 ? teams : reversed)).flat();
}

/** The pick on the clock once `picksMade` picks are made: its number and round, from 1, and the
 *  team making it, which holds it after any trade, with `via` the team whose turn it is, or null
 *  for a pick never traded; null once every pick is made. */
export function pickOnTheClock<Team>(
  teams: readonly Team[],
  rounds: number,
  picksMade: number,
  traded: readonly TradedPick<Team>[] = [],
): { pick: number; round: number; team: Team; via: Team | null } | null {
  const picks = snakeOrder(teams, rounds);
  if (picksMade < 0 || picksMade >= picks.length) return null;
  const round = Math.floor(picksMade / teams.length) + 1;
  const turn = picks[picksMade];
  const team = pickOwner(traded, round, turn);
  return { pick: picksMade + 1, round, team, via: team === turn ? null : turn };
}

/** How many picks `team` still has to make once `picksMade` are made, counting one on the clock:
 *  the picks left that it holds after any trade. A team that traded for another's pick in a round
 *  picks twice in it, so its picks left are never read off the round. */
export function picksLeftFor<Team>(teams: readonly Team[], rounds: number, picksMade: number, traded: readonly TradedPick<Team>[], team: Team): number {
  return snakeOrder(teams, rounds).filter((turn, index) => index >= picksMade && pickOwner(traded, Math.floor(index / teams.length) + 1, turn) === team).length;
}
