// The auto-subs tests' shared setup: a 4-4-2 with a bench sized to each test, and who played.
// Starters 1 to 11 back to front and left to right: 1 the keeper, 2–5 the back four, 6–9 the
// midfield four, 10 and 11 the strikers. The bench runs from 101, as long as each test needs.

import { expect } from "vitest";
import { autoSubs, type GameweekPlay } from "../../../convex/lineup/autoSubs";
import { lineupProblems, type Lineup, type LineupRules, type PlayerPositions } from "../../../convex/lineup/lineup";
import type { Position } from "../../../convex/positions/positionTables";
import { FIRST_SUB, filledLineup, openLimits, presetNamed, withPositions } from "./lineup.harness";

export const { lineup: fourFourTwo, positions: startersPositions } = filledLineup(presetNamed("4-4-2"));
export const KEEPER = 1;
export const LEFT_BACK = 2;
export const LEFT_CENTRE_BACK = 3;
export const LEFT_MIDFIELDER = 6;
export const STRIKER = 10;
export const OTHER_STRIKER = 11;
export const [FIRST, SECOND, THIRD, FOURTH] = [0, 1, 2, 3].map((index) => FIRST_SUB + index);

/** The 4-4-2 with a bench of one player per label list, first to last, and everyone's positions. */
export function withBench(...benchPositions: Position[][]): { lineup: Lineup; positions: PlayerPositions } {
  const lineup = { ...fourFourTwo, bench: fourFourTwo.bench.slice(0, benchPositions.length) };
  const positions = benchPositions.reduce<PlayerPositions>(
    (soFar, labels, index) => withPositions(soFar, lineup.bench[index], labels),
    startersPositions,
  );
  return { lineup, positions };
}

/** Everyone in the lineup played, but `absent` didn't and `overrides` say otherwise. */
export function plays(lineup: Lineup, absent: number[], overrides: [number, GameweekPlay][] = []) {
  const everyone = [...lineup.starters.map((starter) => starter.playerCode), ...lineup.bench];
  const played = new Map<number, GameweekPlay>(everyone.map((playerCode) => [playerCode, "played"]));
  for (const playerCode of absent) played.set(playerCode, "didNotPlay");
  for (const [playerCode, play] of overrides) played.set(playerCode, play);
  return played;
}

/** Auto-subs, checked to leave a lineup that may stand. */
export function subbed(
  lineup: Lineup,
  positions: PlayerPositions,
  played: ReadonlyMap<number, GameweekPlay>,
  rules: LineupRules = openLimits(),
) {
  const result = autoSubs(lineup, positions, played, rules);
  expect(lineupProblems(result.lineup, positions, rules)).toEqual([]);
  return result;
}

/** What auto-subs give when they change nothing: `unfilled` starters' slots score nothing. */
export const untouched = (lineup: Lineup, unfilled: number[] = []) => ({
  substitutions: [],
  unfilled,
  lineup,
  carriedProblems: [],
});

export const STRIKERS_CELL = { area: "attack", lane: "leftCentre" } as const;
export const strikerReplacedBy = (on: number) => ({ off: STRIKER, on, ...STRIKERS_CELL, into: "theSlot" });
