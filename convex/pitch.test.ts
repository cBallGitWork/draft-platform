import { expect, test } from "vitest";
import { AREAS, LANES, playsCell, POSITION_LABELS, type Area, type PositionLabel } from "./pitch";

type WholeAreaPosition = Exclude<PositionLabel, "WB">;

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
function cellsPlayedBy(position: PositionLabel): string[] {
  return AREAS.flatMap((area) =>
    LANES.filter((lane) => playsCell([position], { area, lane })).map((lane) => `${area} ${lane}`),
  );
}

const WHOLE_AREA_POSITIONS = POSITION_LABELS.filter((position): position is WholeAreaPosition => position !== "WB");

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
