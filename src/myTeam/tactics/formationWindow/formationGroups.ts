// The formation window's groups (the approved formation window; spec/05, The pitch): the league's
// presets by how many stand in defence, back three, four and five. Pure, so the window and its tests
// read them alike.

import type { Cell } from "../../../../convex/lineup/pitch";

/** A league's preset, as its rules hold it. */
export type Shape = { name: string; cells: readonly Cell[] };

/** One group of formations: how many it puts in defence, and its formations in the league's order. */
export type BackGroup = { back: number; shapes: Shape[] };

/** How many of a shape's cells stand in defence: a wing-back's, in a midfield row, isn't one. */
const backOf = ({ cells }: Shape) => cells.filter(({ area }) => area === "defence").length;

/** The league's presets grouped by their back line, fewest at the back first. */
export function backGroups(shapes: readonly Shape[]): BackGroup[] {
  const groups = new Map<number, Shape[]>();
  for (const shape of shapes) groups.set(backOf(shape), [...(groups.get(backOf(shape)) ?? []), shape]);
  return [...groups].toSorted(([one], [other]) => one - other).map(([back, grouped]) => ({ back, shapes: grouped }));
}
