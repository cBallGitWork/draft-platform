// The lineup tests' shared setup: limits, and a lineup filled from a preset with players who fit.
// For the tests only: it sits outside convex/, so never deploys.

import type { AreaLimit, Lineup, LineupRules, PlayerPositions } from "../../../convex/lineup/lineup";
import { AREAS, LANES, type Area } from "../../../convex/lineup/pitch";
import type { Position } from "../../../convex/positions/positionTables";
import { DEFAULT_PRESETS, type Preset } from "../../../convex/lineup/presets";

/** Every area from none to a full row: limits that refuse nothing. */
export function openLimits(overrides: Partial<Record<Area, AreaLimit>> = {}): LineupRules {
  const open = Object.fromEntries(AREAS.map((area) => [area, { minimum: 0, maximum: LANES.length }]));
  return { areaLimits: { ...(open as Record<Area, AreaLimit>), ...overrides } };
}

/** The most usual position for each area, so a filled preset needs no utility men. */
const USUAL_POSITION: Record<Area, Position> = {
  goalkeeper: "GK",
  defence: "CB",
  defensiveMidfield: "CDM",
  midfield: "CM",
  attackingMidfield: "CAM",
  attack: "ST",
};

/** The first on the bench, whose code follows no starter's. */
export const FIRST_SUB = 101;
const BENCH_SIZE = 4;

export function presetNamed(name: string): Preset {
  const found = DEFAULT_PRESETS.find((preset) => preset.name === name);
  if (!found) throw new Error(`No default preset is named ${name}`);
  return found;
}

/** A lineup standing in the preset's cells, starter n with code n from 1 and each playing his
 *  cell's usual position, and a bench; and the starters' positions. */
export function filledLineup(preset: Preset): { lineup: Lineup; positions: PlayerPositions } {
  const starters = preset.cells.map((cell, index) => ({ playerCode: index + 1, ...cell }));
  const bench = Array.from({ length: BENCH_SIZE }, (_, index) => FIRST_SUB + index);
  const positions = new Map<number, Position[]>(
    starters.map(({ playerCode, area }) => [playerCode, [USUAL_POSITION[area]]]),
  );
  return { lineup: { starters, bench }, positions };
}

/** The positions with one player's swapped for `labels`. */
export function withPositions(positions: PlayerPositions, playerCode: number, labels: Position[]) {
  return new Map(positions).set(playerCode, labels);
}
