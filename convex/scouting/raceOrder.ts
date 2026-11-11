// The stat race's order (#800, spec/19 The stat race), apart from its read (statRace.ts), so
// Scouting's preview ranks its teams by the server's own rule. It imports nothing, so the screens can
// read it too.

/** The stats where fewer is better, so the team with fewest is 1st (Craig, 11 Nov 2026, on #1608);
 *  every other stat ranks the team with most 1st. */
export const FEWEST_FIRST: ReadonlySet<string> = new Set(["red_cards", "yellow_cards", "own_goals", "goals_conceded", "penalties_missed"]);

/** Whether the race in `stat` puts the team with most of it 1st. */
export const mostFirst = (stat: string) => !FEWEST_FIRST.has(stat);

/** The teams, most of their `stat` first (fewest with `descending` false), ties by name. */
export function raceOrder<Team extends { name: string; stat: number }>(teams: readonly Team[], descending: boolean): Team[] {
  const direction = descending ? -1 : 1;
  return [...teams].sort((one, other) => direction * (one.stat - other.stat) || one.name.localeCompare(other.name));
}

/** A team's rank in `stat` among `totals`, every team's: one more than the teams ahead of it (with
 *  more, or with fewer where fewer is better), so teams level share a rank ("1 of 8" for each of
 *  eight teams with no red card). */
export const rankAmong = (stat: string, total: number, totals: readonly number[]) =>
  1 + totals.filter((other) => (mostFirst(stat) ? other > total : other < total)).length;
