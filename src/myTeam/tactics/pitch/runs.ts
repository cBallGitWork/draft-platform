// Where a role's run goes on the drawn pitch (spec/05 Runs; #846): the run is held with the role
// (convex/lineup/roles.ts), in metres from the player's place; this turns it into points on the
// pitch's own metres (./pitchMarkings.ts), attack at the top, for ./RoleRuns.tsx to draw.

import { AREAS, LANES, type Cell } from "../../../../convex/lineup/pitch";
import type { Run } from "../../../../convex/lineup/roles";
import { LANE_WIDTH, PITCH_SIZE, ROW_LENGTH } from "./pitchMarkings";
import { EVEN_ROWS, fitDepth, type RowLayout } from "./rowLayout";

/** A point on the drawn pitch, in metres from its top-left corner. */
export interface PitchPoint {
  x: number;
  y: number;
}

/** How far inside the goal lines and touchlines a run stops, in metres, so its arrowhead shows
 *  whole: a run long enough to reach a goal line or touchline would otherwise run off the pitch. */
export const RUN_MARGIN = 3;

const MIDDLE_LANE = (LANES.length - 1) / 2;

/** The middle of a cell on the drawn pitch, its rows laid out by `rows`. A sweeper stands in the
 *  line like any centre-back: there is no drawing him deeper (spec/05 The pitch; Craig, 4 Nov 2026). */
export function placeOf({ area, lane }: Cell, rows: RowLayout = EVEN_ROWS): PitchPoint {
  const rowFromTop = AREAS.length - 1 - AREAS.indexOf(area);
  return {
    x: (LANES.indexOf(lane) + 0.5) * LANE_WIDTH,
    y: fitDepth(rows, (rowFromTop + 0.5) * ROW_LENGTH),
  };
}

const within = (value: number, size: number) => Math.min(size - RUN_MARGIN, Math.max(RUN_MARGIN, value));

/** The run's path on the drawn pitch: his place, then each of its points. Across is toward the
 *  middle, so a run from the right is turned the other way; the centre lane's goes to his right.
 *  Forward is measured on the even pitch, then fitted to `rows`, so a run ends between the same two
 *  rows however many are closed up. */
export function runPath(run: Run, cell: Cell, rows: RowLayout = EVEN_ROWS): PitchPoint[] {
  const place = placeOf(cell);
  const inward = LANES.indexOf(cell.lane) > MIDDLE_LANE ? -1 : 1;
  return [
    placeOf(cell, rows),
    ...run.path.map(({ forward, across }) => ({
      x: within(place.x + inward * across, PITCH_SIZE.width),
      y: within(fitDepth(rows, place.y - forward), PITCH_SIZE.length),
    })),
  ];
}

/** The arrowhead's length and half its width, in metres. */
const ARROWHEAD = { length: 2.4, halfWidth: 1.3 } as const;

/** The arrowhead at the path's end, pointing along its last leg: its tip, then its two barbs. */
export function arrowheadOf(path: readonly PitchPoint[]): PitchPoint[] {
  const tip = path.at(-1)!;
  const from = path.at(-2)!;
  const length = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const along = { x: (tip.x - from.x) / length, y: (tip.y - from.y) / length };
  const base = { x: tip.x - along.x * ARROWHEAD.length, y: tip.y - along.y * ARROWHEAD.length };
  return [
    tip,
    { x: base.x - along.y * ARROWHEAD.halfWidth, y: base.y + along.x * ARROWHEAD.halfWidth },
    { x: base.x + along.y * ARROWHEAD.halfWidth, y: base.y - along.x * ARROWHEAD.halfWidth },
  ];
}

/** The attribute marking a run's drawing with its player's code, for the tests to find it. */
export const RUN_MARK = "data-run";

/** Who sees a run (spec/05 Runs): on the desk every run while the switch shows them, on a phone
 *  only the tapped player's. The CSS utility hiding it where it doesn't show, "" where it shows on
 *  both, or null where it shows on neither and isn't drawn. */
export function runShows(isTapped: boolean, switchedOn: boolean): string | null {
  if (isTapped) return switchedOn ? "" : "lg:hidden";
  return switchedOn ? "max-lg:hidden" : null;
}
