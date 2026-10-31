// The Tactics tab's pitch is drawn to a real pitch's shape and scale (plate.md, Marks: the pitch;
// Craig, 31 Oct 2026: "that pitch ratio is well off"). The measurements are named once
// (pitchMarkings.ts), and the drawing comes from them.

import { describe, expect, it } from "vitest";
import {
  CIRCLE_RADIUS,
  END_MARKINGS,
  GOAL_AREA,
  PENALTY_AREA,
  PENALTY_SPOT_DISTANCE,
  PITCH_ASPECT,
  PITCH_SIZE,
} from "../../../../src/myTeam/tactics/pitchMarkings";
import { openedPitch, pitch } from "../../../support/src/tacticsScreen.harness";

/** The drawing behind the cells: its box is the pitch in metres. */
const drawing = () => pitch().querySelector("svg")!;
const rects = () => Array.from(drawing().querySelectorAll("rect")).map((rect) => ({
  x: Number(rect.getAttribute("x")),
  y: Number(rect.getAttribute("y")),
  width: Number(rect.getAttribute("width")),
  height: Number(rect.getAttribute("height")),
}));

describe("the pitch's measurements, a real pitch's in metres", () => {
  it("is portrait, 68 wide by 105 long", () => {
    expect(PITCH_SIZE).toEqual({ width: 68, length: 105 });
    expect(PITCH_ASPECT).toBeCloseTo(68 / 105);
  });

  it("puts the D where a 9.15m circle round the spot crosses the penalty area's front", () => {
    // 16.5 - 11 = 5.5m from the spot to the front line; √(9.15² - 5.5²) either side of the middle.
    expect(END_MARKINGS.arcHalfWidth).toBeCloseTo(7.31, 2);
    expect(END_MARKINGS.penaltySpot).toEqual({ x: 34, y: PENALTY_SPOT_DISTANCE });
  });
});

describe("the pitch as drawn", () => {
  it("is sized to the pitch's shape, width over length", async () => {
    await openedPitch();
    const room = pitch().closest<HTMLElement>(".pitch-room")!;
    expect(Number(room.style.getPropertyValue("--pitch-aspect"))).toBeCloseTo(68 / 105);
    expect(drawing().getAttribute("viewBox")).toBe("0 0 68 105");
  });

  it("draws both penalty areas and goal areas to scale, centred on each goal line", async () => {
    await openedPitch();
    const drawn = rects();
    const penaltyAreas = drawn.filter(({ width }) => width === PENALTY_AREA.width);
    const goalAreas = drawn.filter(({ width }) => width === GOAL_AREA.width);
    // One at each end: the bottom one is the top one turned half round the centre spot.
    expect(penaltyAreas).toHaveLength(2);
    expect(goalAreas).toHaveLength(2);
    expect(penaltyAreas[0]).toEqual({ x: (68 - 40.32) / 2, y: 0, width: 40.32, height: 16.5 });
    expect(goalAreas[0]).toEqual({ x: (68 - 18.32) / 2, y: 0, width: 18.32, height: 5.5 });
  });

  it("draws the centre circle 9.15m round the centre spot, and a stripe to each of the six rows", async () => {
    await openedPitch();
    const circle = Array.from(drawing().querySelectorAll("circle")).find((each) => Number(each.getAttribute("r")) === CIRCLE_RADIUS)!;
    expect([circle.getAttribute("cx"), circle.getAttribute("cy")]).toEqual(["34", "52.5"]);
    const stripes = rects().filter(({ width }) => width === 68);
    expect(stripes).toHaveLength(6);
    expect(stripes.map(({ height }) => height)).toEqual(Array(6).fill(105 / 6));
  });
});
