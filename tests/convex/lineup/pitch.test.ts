import { expect, test } from "vitest";
import {
  ALL_CELLS,
  AREAS,
  cellKey,
  isOnPitch,
  LANES,
  playsCell,
  positionOfSlot,
  SLOT_POSITIONS,
  type Area,
  type Cell,
} from "../../../convex/lineup/pitch";
import { POSITIONS, type Position } from "../../../convex/positions/positionTables";

type WholeAreaPosition = Exclude<Position, "WB">;

/** spec/06, The labels: the areas each position plays, every lane of them. The wing back, who
 *  plays only some lanes of two areas, has his own test below. */
const SPEC_AREAS: Record<WholeAreaPosition, Area[]> = {
  GK: ["goalkeeper"],
  CB: ["defence"],
  FB: ["defence"],
  CDM: ["defensiveMidfield"],
  CM: ["midfield"],
  WM: ["midfield"],
  CAM: ["attackingMidfield"],
  W: ["attackingMidfield"],
  SS: ["attackingMidfield", "attack"],
  ST: ["attack"],
};

/** Every cell of the grid a position plays, as "area lane". */
function cellsPlayedBy(position: Position): string[] {
  return AREAS.flatMap((area) =>
    LANES.filter((lane) => playsCell([position], { area, lane })).map((lane) => `${area} ${lane}`),
  );
}

const WHOLE_AREA_POSITIONS = POSITIONS.filter((position): position is WholeAreaPosition => position !== "WB");

test.each(WHOLE_AREA_POSITIONS)("%s plays every cell of its areas and no other", (position) => {
  const expected = SPEC_AREAS[position].flatMap((area) => LANES.map((lane) => `${area} ${lane}`));

  expect(cellsPlayedBy(position)).toEqual(expected);
});

test("a wing back plays defence and the wide lanes of the two midfield rows, and no other", () => {
  expect(cellsPlayedBy("WB")).toEqual([
    ...LANES.map((lane) => `defence ${lane}`),
    "defensiveMidfield left",
    "defensiveMidfield right",
    "midfield left",
    "midfield right",
  ]);
});

// A slot's position (spec/14, How a rule scores): from its area and lane, left and right alike.
test.each([
  ["goalkeeper", "GK", "GK"],
  ["defence", "FB", "CB"],
  ["defensiveMidfield", "WB", "CDM"],
  ["midfield", "WM", "CM"],
  ["attackingMidfield", "W", "CAM"],
  ["attack", "ST", "ST"],
] as const)("a slot in %s is %s in the wide lanes and %s in the three centre ones", (area, wide, centre) => {
  expect(LANES.map((lane) => positionOfSlot({ area, lane }))).toEqual([wide, centre, centre, centre, wide]);
});

test("every slot position is a position label, and SS is none of them", () => {
  expect(SLOT_POSITIONS.every((position) => POSITIONS.includes(position))).toBe(true);
  expect(SLOT_POSITIONS).not.toContain("SS");
});

test("the pitch's cells are its six areas by its five lanes, back to front and left to right", () => {
  expect(ALL_CELLS).toHaveLength(30);
  expect(ALL_CELLS[0]).toEqual({ area: "goalkeeper", lane: "left" });
  expect(ALL_CELLS[1]).toEqual({ area: "goalkeeper", lane: "leftCentre" });
  expect(ALL_CELLS[5]).toEqual({ area: "defence", lane: "left" });
  expect(ALL_CELLS.at(-1)).toEqual({ area: "attack", lane: "right" });
  expect(new Set(ALL_CELLS.map(cellKey)).size).toBe(30);
});

test("a cell's key is its area and lane, so a message naming it reads the same as before", () => {
  expect(cellKey({ area: "defensiveMidfield", lane: "rightCentre" })).toBe("defensiveMidfield/rightCentre");
});

test("a cell is on the pitch only when both its area and its lane are", () => {
  expect(isOnPitch({ area: "midfield", lane: "centre" })).toBe(true);
  expect(isOnPitch({ area: "wingBack", lane: "centre" } as unknown as Cell)).toBe(false);
  expect(isOnPitch({ area: "midfield", lane: "middle" } as unknown as Cell)).toBe(false);
});
