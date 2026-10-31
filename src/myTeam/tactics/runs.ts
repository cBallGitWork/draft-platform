// Where a role's run goes on the drawn pitch (spec/05 Runs; #846): the run is held with the role
// (convex/lineup/roles.ts), in metres from the player's place; this turns it into points on the
// pitch's own metres (./pitchMarkings.ts), attack at the top, for ./RoleRuns.tsx to draw.

import { AREAS, LANES, type Cell } from "../../../convex/lineup/pitch";
import type { Run } from "../../../convex/lineup/roles";
import { LANE_WIDTH, PITCH_SIZE, ROW_LENGTH } from "./pitchMarkings";

/** A point on the drawn pitch, in metres from its top-left corner. */
export interface PitchPoint {
  x: number;
  y: number;
}

/** How much of a row deeper a sweeper's cell is drawn than the line (spec/05 The pitch): the one
 *  home of it, which the CSS `pitch-sweeper` reads through `--sweeper-depth` (./Pitch.tsx). */
export const SWEEPER_DEPTH_SHARE = 0.125;

/** How far inside the goal lines and touchlines a run stops, in metres, so its arrowhead shows
 *  whole: a rough run from a slot further up than its role's usual one (a shadow striker up front)
 *  would otherwise run off the pitch. */
export const RUN_MARGIN = 3;

const MIDDLE_LANE = (LANES.length - 1) / 2;

/** The middle of a cell on the drawn pitch, a sweeper's a little deeper (`deeper`). */
export function placeOf({ area, lane }: Cell, deeper = false): PitchPoint {
  const rowFromTop = AREAS.length - 1 - AREAS.indexOf(area);
  return {
    x: (LANES.indexOf(lane) + 0.5) * LANE_WIDTH,
    y: (rowFromTop + 0.5 + (deeper ? SWEEPER_DEPTH_SHARE : 0)) * ROW_LENGTH,
  };
}

const within = (value: number, size: number) => Math.min(size - RUN_MARGIN, Math.max(RUN_MARGIN, value));

/** The run's path on the drawn pitch: his place, then each of its points. Across is toward the
 *  middle, so a run from the right is turned the other way; the centre lane's goes to his right. */
export function runPath(run: Run, cell: Cell, deeper = false): PitchPoint[] {
  const place = placeOf(cell, deeper);
  const inward = LANES.indexOf(cell.lane) > MIDDLE_LANE ? -1 : 1;
  return [
    place,
    ...run.path.map(({ forward, across }) => ({
      x: within(place.x + inward * across, PITCH_SIZE.width),
      y: within(place.y - forward, PITCH_SIZE.length),
    })),
  ];
}

/** The arrowhead's length and half its width, in metres. */
export const ARROWHEAD = { length: 2.4, halfWidth: 1.3 } as const;

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
