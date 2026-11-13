// How the pitch's length is shared among its six rows (plate.md, Marks: the pitch): only the rows a
// formation uses get room, equally, so a shape with no one in a row shows no gap where it would be
// ("pitch view should be dynamic so it fills out correctly", Craig, 5 Nov 2026). The markings stay
// to scale (./PitchLines.tsx); the rows, their stripes and the roles' runs (./runs.ts) follow this.

import type { CSSProperties } from "react";
import { AREAS, LANES, type Area } from "../../../convex/lineup/pitch";
import { PITCH_SIZE, ROW_LENGTH } from "./pitchMarkings";

/** Top to bottom as the pitch is drawn: attack first. */
export const ROWS_DRAWN = AREAS.toReversed();

/** Each drawn row's top and height in metres down the pitch, in ROWS_DRAWN's order; a row nobody
 *  stands in has no height. */
export interface RowLayout {
  tops: readonly number[];
  heights: readonly number[];
}

/** The rows the cells stand in share the pitch's length; every row does with none given. */
export function rowLayoutOf(cells: readonly { area: Area }[]): RowLayout {
  const used = new Set(cells.map(({ area }) => area));
  const shown = (area: Area) => used.size === 0 || used.has(area);
  const share = PITCH_SIZE.length / ROWS_DRAWN.filter(shown).length;
  const heights = ROWS_DRAWN.map((area) => (shown(area) ? share : 0));
  const tops = heights.map((_, row) => heights.slice(0, row).reduce((sum, height) => sum + height, 0));
  return { tops, heights };
}

/** All six rows, equal: the formation window's thumbnails, and a run's shape before it is fitted. */
export const EVEN_ROWS = rowLayoutOf([]);

/** A grid of the pitch's cells laid out by `rows`, each lane an equal share of the width. */
export const cellGridOf = (rows: RowLayout): CSSProperties => ({
  gridTemplateRows: rows.heights.map((height) => `minmax(0, ${height}fr)`).join(" "),
  gridTemplateColumns: `repeat(${LANES.length}, minmax(0, 1fr))`,
});

/** A point's depth on the even pitch, in metres from the top, moved to the same place in its row
 *  on `rows`: a run that ends between two rows still does once the empty rows close up. */
export function fitDepth(rows: RowLayout, evenDepth: number): number {
  const depth = Math.min(PITCH_SIZE.length, Math.max(0, evenDepth));
  const row = Math.min(ROWS_DRAWN.length - 1, Math.floor(depth / ROW_LENGTH));
  return rows.tops[row] + (depth / ROW_LENGTH - row) * rows.heights[row];
}
