// The stat race's order (#800, spec/19 The stat race), apart from its read (statRace.ts), so
// Scouting's preview ranks its teams by the server's own rule. It imports only the record's stat
// names, so the screens can read it too.

import { GOALS_CONCEDED, OWN_GOALS, PENALTIES_MISSED, RED_CARDS, YELLOW_CARDS } from "../stats/matchRecords";

/** The stats where fewer is better, so the team with fewest is 1st (Craig, 11 Nov 2026, on #1608);
 *  every other stat ranks the team with most 1st. */
export const FEWEST_FIRST: ReadonlySet<string> = new Set([RED_CARDS, YELLOW_CARDS, OWN_GOALS, GOALS_CONCEDED, PENALTIES_MISSED]);

/** Whether the race in `stat` puts the team with most of it 1st. */
export const mostFirst = (stat: string) => !FEWEST_FIRST.has(stat);

/** The teams, most of their `stat` first (fewest with `descending` false), ties by name. */
export function raceOrder<Team extends { name: string; stat: number }>(teams: readonly Team[], descending: boolean): Team[] {
  const direction = descending ? -1 : 1;
  return [...teams].sort((one, other) => direction * (one.stat - other.stat) || one.name.localeCompare(other.name));
}
