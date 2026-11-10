// The stat race's order (#800, spec/19 The stat race), apart from its read (statRace.ts), so
// Scouting's preview ranks its teams by the server's own rule. It imports nothing, so the screens can
// read it too.

/** The teams, most of their `stat` first (fewest with `descending` false), ties by name. */
export function raceOrder<Team extends { name: string; stat: number }>(teams: readonly Team[], descending: boolean): Team[] {
  const direction = descending ? -1 : 1;
  return [...teams].sort((one, other) => direction * (one.stat - other.stat) || one.name.localeCompare(other.name));
}

/** A team's rank in a category among `totals`, every team's: one more than the teams with more, so
 *  teams level share a rank ("1 of 8" for each of eight teams with no red card). */
export const rankAmong = (total: number, totals: readonly number[]) => 1 + totals.filter((other) => other > total).length;
