import { expect, test } from "vitest";
import { codesByOpta } from "../../../convex/football/feedIds";
import { matchSlots } from "../../../convex/football/premierLeague/plMatch";
import { FORMATION_PLACES, labelPositions, placePosition, POSITIONS, positionRank, type Position } from "../../../convex/positions/positionTables";
import { PLAYER, recordedPositions, SHEET } from "../../support/recorded/positions.payloads";

test("each formation draws the lines its label counts, but for Opta's 4-5-1, drawn as a 4-3-2-1", () => {
  const drawn = Object.entries(FORMATION_PLACES).filter(([label, lines]) => lines.map((line) => line.length).join("-") !== label);
  expect(drawn.map(([label, lines]) => [label, lines.map((line) => line.length).join("-")])).toEqual([["4-5-1", "4-3-2-1"]]);
});

test("positions rank in POSITIONS' order, and none ranks last", () => {
  expect(POSITIONS.map(positionRank)).toEqual(POSITIONS.map((_, index) => index));
  expect(positionRank(null)).toBe(POSITIONS.length);
});

test("spec/06's two fixed rows: a 4-2-3-1's deepest two are CDM, a 4-3-3's three are CM", () => {
  expect(FORMATION_PLACES["4-2-3-1"][1]).toEqual(["CDM", "CDM"]);
  expect(FORMATION_PLACES["4-3-3"][1]).toEqual(["CM", "CM", "CM"]);
});

test("a back three is CB, wide in a back four is FB, in a back five WB, and no place is ever SS", () => {
  for (const [label, lines] of Object.entries(FORMATION_PLACES)) {
    const back = lines[0];
    if (back.length === 3) expect(back, label).toEqual(["CB", "CB", "CB"]);
    if (back.length === 4) expect([back[0], back[3]]).toEqual(["FB", "FB"]);
    if (back.length === 5) expect([back[0], back[4]]).toEqual(["WB", "WB"]);
    expect(lines.flat()).not.toContain("SS");
  }
});

/** Each formation's lines past the keeper: the back line, the midfield lines, the front line. */
function linesOf(lines: readonly (readonly Position[])[]) {
  return { back: lines[0], middle: lines.slice(1, -1), front: lines.at(-1)! };
}

test("by the rule, the front line is ST, but for a front three's wide men, W", () => {
  const fronts: Record<number, Position[]> = { 1: ["ST"], 2: ["ST", "ST"], 3: ["W", "ST", "W"] };
  for (const [label, lines] of Object.entries(FORMATION_PLACES)) {
    const { front } = linesOf(lines);
    expect(front, label).toEqual(fronts[front.length]);
  }
});

test("by the rule, midfield's deepest line is CDM for one or two men and CM for three, a lone man behind the forwards CAM, a higher three W CAM W, and a flat midfield WM wide, WB beside a back three, CM between", () => {
  for (const [label, lines] of Object.entries(FORMATION_PLACES)) {
    const { back, middle } = linesOf(lines);
    const [deepest, ...higher] = middle;
    if (deepest.length <= 2) expect(deepest, label).toEqual(deepest.map(() => "CDM"));
    if (deepest.length === 3) expect(deepest, label).toEqual(["CM", "CM", "CM"]);
    if (middle.at(-1)!.length === 1) expect(middle.at(-1), label).toEqual(["CAM"]);
    for (const three of higher.filter((line) => line.length === 3)) expect(three, label).toEqual(["W", "CAM", "W"]);
    const wide = back.length === 3 ? "WB" : "WM";
    for (const flat of middle.filter((line) => line.length >= 4)) expect([flat[0], flat.at(-1)], label).toEqual([wide, wide]);
    for (const four of middle.filter((line) => line.length === 4)) expect(four.slice(1, -1), label).toEqual(["CM", "CM"]);
  }
});

// docs/positions.md: where the rule left a choice, the labels of the men who started there decided.
test.each<[string, Position[], string, number]>([
  ["a 3-4-2-1's two behind the striker", ["W", "W"], "3-4-2-1", 2],
  ["a 4-5-1's two wide men", ["W", "W"], "4-5-1", 2],
  ["a 4-3-2-1's two behind the striker", ["CAM", "CAM"], "4-3-2-1", 2],
  ["a 4-2-2-2's two behind the strikers", ["CAM", "CAM"], "4-2-2-2", 2],
  ["a 3-5-2's midfield", ["WB", "CM", "CDM", "CM", "WB"], "3-5-2", 1],
  ["a 3-5-1-1's midfield", ["WB", "CM", "CDM", "CM", "WB"], "3-5-1-1", 1],
  ["a 4-1-4-1's midfield four", ["WM", "CM", "CM", "WM"], "4-1-4-1", 2],
  ["a 5-4-1's midfield four", ["WM", "CM", "CM", "WM"], "5-4-1", 1],
])("the data decided %s: %j", (_what, positions, formation, line) => {
  expect(FORMATION_PLACES[formation][line]).toEqual(positions);
});

test.each([
  ["the keeper", "4-2-3-1", 0, 0, "GK"],
  ["a 4-2-3-1's right back", "4-2-3-1", 1, 0, "FB"],
  ["a 4-2-3-1's number 10", "4-2-3-1", 3, 1, "CAM"],
  ["a 3-4-2-1's right wing-back", "3-4-2-1", 2, 0, "WB"],
  ["a 5-4-1's left midfielder", "5-4-1", 2, 3, "WM"],
  ["a formation the table does not know", "2-3-5", 1, 0, null],
  ["a second man in goal", "4-2-3-1", 0, 1, null],
  ["a place past the end of a line", "4-2-3-1", 2, 2, null],
  ["a line past the striker", "4-2-3-1", 5, 0, null],
] as const)("%s is %s", (_who, formation, line, place, position) => {
  expect(placePosition(formation, line, place)).toBe(position);
});

test("every starter on the recorded sheets is placed, and the 4-5-1's two wide men are W", () => {
  const payloads = recordedPositions();
  const codeByOpta = codesByOpta(payloads.fplElements);
  const placed = payloads.sheets
    .filter((sheet) => sheet.id !== SHEET.cityCoventryRefused)
    .flatMap((sheet) => matchSlots(sheet, codeByOpta).slots.filter((slot) => slot.started))
    .map((slot) => ({ ...slot, position: placePosition(slot.formation!, slot.line!, slot.place!) }));

  expect(placed.filter((slot) => slot.position === null)).toEqual([]);
  const fourFiveOne = placed.find((slot) => slot.playerCode === PLAYER.barnes && slot.formation === "4-5-1");
  expect(fourFiveOne).toMatchObject({ line: 3, place: 1, position: "W" });
});

// Every label the Premier League gave a man in either season's squads or on any of the 900 team
// sheets to 20 Oct 2026, and what it gives.
test.each<[string, Position[]]>([
  ["Attacking Midfielder", ["CAM", "W"]],
  ["Central Defender", ["CB"]],
  ["Central Midfielder", ["CM"]],
  ["Centre Attacking Midfielder", ["CAM"]],
  ["Centre Central Defender", ["CB"]],
  ["Centre Central Midfielder", ["CM"]],
  ["Centre Defensive Midfielder", ["CDM"]],
  ["Centre Full Back", ["FB"]],
  ["Centre Goalkeeper", ["GK"]],
  ["Centre Second Striker", ["SS"]],
  ["Centre Striker", ["ST"]],
  ["Centre Winger", ["W"]],
  ["Centre/Right Attacking Midfielder", ["CAM", "W"]],
  ["Centre/Right Central Defender", ["CB"]],
  ["Centre/Right Central Midfielder", ["CM"]],
  ["Centre/Right Full Back", ["FB"]],
  ["Centre/Right Wing Back", ["WB"]],
  ["Centre/Right Winger", ["W"]],
  ["Defender", ["CB", "FB"]],
  ["Defensive Midfielder", ["CDM"]],
  ["Forward", ["W", "SS", "ST"]],
  ["Full Back", ["FB"]],
  ["Goalkeeper", ["GK"]],
  ["Left Central Defender", ["CB"]],
  ["Left Central Midfielder", ["CM"]],
  ["Left Full Back", ["FB"]],
  ["Left Wing Back", ["WB"]],
  ["Left Winger", ["W"]],
  ["Left/Centre Attacking Midfielder", ["CAM", "W"]],
  ["Left/Centre Central Defender", ["CB"]],
  ["Left/Centre Central Midfielder", ["CM"]],
  ["Left/Centre Full Back", ["FB"]],
  ["Left/Centre Second Striker", ["SS"]],
  ["Left/Centre Striker", ["ST"]],
  ["Left/Centre Winger", ["W"]],
  ["Left/Centre/Right Attacking Midfielder", ["CAM", "W"]],
  ["Left/Centre/Right Central Defender", ["CB"]],
  ["Left/Centre/Right Central Midfielder", ["CM"]],
  ["Left/Centre/Right Second Striker", ["SS"]],
  ["Left/Centre/Right Striker", ["ST"]],
  ["Left/Centre/Right Winger", ["W"]],
  ["Left/Right Attacking Midfielder", ["W"]],
  ["Left/Right Full Back", ["FB"]],
  ["Left/Right Wing Back", ["WB"]],
  ["Left/Right Winger", ["W"]],
  ["Midfielder", ["CDM", "CM", "WM", "CAM"]],
  ["Right Attacking Midfielder", ["W"]],
  ["Right Central Defender", ["CB"]],
  ["Right Full Back", ["FB"]],
  ["Right Striker", ["ST"]],
  ["Right Winger", ["W"]],
  ["Second Striker", ["SS"]],
  ["Striker", ["ST"]],
  ["Winger", ["W"]],
])("the label %j gives %j", (label, positions) => {
  expect(labelPositions(label)).toEqual(positions);
});

test.each(["Libero", "Left", "Left/Centre", "", "toString", "Upper Central Defender"])(
  "the label %j is not known, so gives no position",
  (label) => {
    expect(labelPositions(label)).toBeNull();
  },
);
