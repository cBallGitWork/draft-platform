// How the pitch's rows share its length (plate.md, Marks: the pitch; Craig, 5 Nov 2026: "pitch view
// should be dynamic so it fills out correctly"): only the rows a formation uses get room, so a row
// nobody stands in leaves no gap, and a run still ends between the same two rows.

import { describe, expect, it } from "vitest";
import { ALL_CELLS, type Area } from "../../../../../convex/lineup/pitch";
import { everyRoleOf } from "../../../../../convex/lineup/roles";
import { PITCH_SIZE, ROW_LENGTH } from "../../../../../src/myTeam/tactics/pitch/pitchMarkings";
import { cellGridOf, EVEN_ROWS, ROWS_DRAWN, rowLayoutOf } from "../../../../../src/myTeam/tactics/pitch/rowLayout";
import { placeOf, runPath } from "../../../../../src/myTeam/tactics/pitch/runs";
import { firstRunOf } from "../../../../support/src/tactics.harness";

/** A 4-2-3-1's rows: nobody in midfield, the gap Craig saw. */
const FOUR_TWO_THREE_ONE: { area: Area }[] = [
  { area: "goalkeeper" },
  { area: "defence" },
  { area: "defensiveMidfield" },
  { area: "attackingMidfield" },
  { area: "attack" },
];
const rows = rowLayoutOf(FOUR_TWO_THREE_ONE);
const heightOf = (area: Area) => rows.heights[ROWS_DRAWN.indexOf(area)];

describe("the pitch's rows", () => {
  it("share the length equally among the rows the players stand in, and give an empty row none", () => {
    expect(heightOf("midfield")).toBe(0);
    for (const { area } of FOUR_TWO_THREE_ONE) expect(heightOf(area)).toBe(PITCH_SIZE.length / FOUR_TWO_THREE_ONE.length);
    expect(rows.tops.at(-1)! + rows.heights.at(-1)!).toBeCloseTo(PITCH_SIZE.length);
  });

  it("are all six, equal, with nobody given", () => {
    expect(EVEN_ROWS.heights).toEqual(ROWS_DRAWN.map(() => ROW_LENGTH));
    expect(cellGridOf(EVEN_ROWS).gridTemplateRows).toBe(ROWS_DRAWN.map(() => `minmax(0, ${ROW_LENGTH}fr)`).join(" "));
  });

  it("put each player in the middle of his row as it is drawn", () => {
    const keeper = placeOf({ area: "goalkeeper", lane: "centre" }, rows);
    expect(keeper.y).toBeCloseTo(PITCH_SIZE.length - heightOf("goalkeeper") / 2);
  });

  it("fit a run so one ending where two rows meet on the even pitch ends where they meet as drawn", () => {
    const meetings = rows.tops.concat(PITCH_SIZE.length);
    for (const cell of ALL_CELLS.filter(({ area }) => heightOf(area) > 0)) {
      for (const { key } of everyRoleOf(cell)) {
        const run = firstRunOf(key);
        if (run === null || run.path.some(({ across }) => across !== 0)) continue;
        const evenEnd = runPath(run, cell).at(-1)!.y;
        if (Math.abs(evenEnd - Math.round(evenEnd / ROW_LENGTH) * ROW_LENGTH) > 1e-9) continue;
        const end = runPath(run, cell, rows).at(-1)!.y;
        expect(meetings.some((meeting) => Math.abs(meeting - end) < 1e-9), `${key} from ${cell.area} ${cell.lane}`).toBe(true);
      }
    }
  });
});
