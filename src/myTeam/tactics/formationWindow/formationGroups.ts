// The formation window's groups (the approved formation window; spec/05, The pitch): the league's
// presets by how many stand in defence, back three, four and five. Pure, so the window and its tests
// read them alike.

import { backOf } from "../../../../convex/lineup/pitch";
import type { PresetShape as Shape } from "../lineupEdits";

/** One group of formations: how many it puts in defence, and its formations in the league's order. */
export type BackGroup = { back: number; shapes: Shape[] };

/** The league's presets grouped by their back line, fewest at the back first. */
export function backGroups(shapes: readonly Shape[]): BackGroup[] {
  const groups = new Map<number, Shape[]>();
  for (const shape of shapes) {
    const back = backOf(shape.cells);
    groups.set(back, [...(groups.get(back) ?? []), shape]);
  }
  return [...groups].toSorted(([one], [other]) => one - other).map(([back, grouped]) => ({ back, shapes: grouped }));
}
