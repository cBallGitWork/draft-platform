// The round robin's tests' shared helpers (#33, #130, #266).

import { drawFixtures, LEAGUE_AVERAGE, type DrawRules, type GameweekFixtures } from "../../../convex/table/roundRobin";
import { usedGameweeksOf } from "../../../convex/gameweeks/usedGameweeks";

export const teamsOf = (count: number) => Array.from({ length: count }, (_, index) => `Team ${index + 1}`);
export const SEED = "league-a";
export const pairKey = (one: string, other: string) => [one, other].toSorted().join(" v ");
export type DrawOptions = DrawRules & { seed: string };
/** The draw of a league whose rules never change. */
export const drawn = (teams: readonly string[], gameweeks: readonly number[], { seed, ...rules }: DrawOptions) =>
  drawFixtures(teams, gameweeks, () => rules, seed);

/** The spread of some counts: the most less the fewest. */
export const spread = (counts: Iterable<number>) => Math.max(...counts) - Math.min(...counts);

/** How often each key comes up, every key in `keys` counted from 0. */
export function tally(keys: readonly string[], seen: readonly string[]): Map<string, number> {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** Each team's opponents in a gameweek, the league's average among them. */
export function opponentsIn({ fixtures }: GameweekFixtures<string>): Map<string, string[]> {
  const opponents = new Map<string, string[]>();
  const add = (team: string, opponent: string) => opponents.set(team, [...(opponents.get(team) ?? []), opponent]);
  for (const { team, opponent } of fixtures) {
    add(team, opponent);
    if (opponent !== LEAGUE_AVERAGE) add(opponent, team);
  }
  return opponents;
}

/** Who is left over in a gameweek: on a bye, or against the league's average. */
export const leftOverIn = ({ fixtures, byes }: GameweekFixtures<string>) => [
  ...byes,
  ...fixtures.filter((fixture) => fixture.opponent === LEAGUE_AVERAGE).map((fixture) => fixture.team),
];

/** A season with a Christmas break and an early end: 33 gameweeks played. */
export const WITH_GAPS = usedGameweeksOf({ unusedGameweeks: [17, 18, 19, 37, 38] });
