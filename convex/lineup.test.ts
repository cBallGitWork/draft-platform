import { describe, expect, test } from "vitest";
import { lineupProblems, type Lineup, type Placement } from "./lineup";
import { FIRST_SUB, filledLineup, openLimits, presetNamed, withPositions } from "./lineup.harness";
import type { Area, Lane } from "./pitch";

// 4-4-2, starters 1 to 11 back to front and left to right: 1 the keeper, 2–5 the back four, 6–9
// the midfield four, 10 and 11 the strikers. Each plays his area's usual position.
const { lineup: fourFourTwo, positions } = filledLineup(presetNamed("4-4-2"));
const KEEPER = 1;
const LEFT_BACK = 2;
const RIGHT_BACK = 5;
const LEFT_MIDFIELDER = 6;
const RIGHT_MIDFIELDER = 9;
const STRIKER = 10;
const OTHER_STRIKER = 11;

/** The 4-4-2 with one starter moved to another cell. */
function moved(playerCode: number, area: string, lane: string): Lineup {
  const move = (starter: Placement) => (starter.playerCode === playerCode ? { playerCode, area, lane } : starter);
  return { ...fourFourTwo, starters: fourFourTwo.starters.map(move) };
}

describe("where a player may stand", () => {
  test("a centre back fills a full back's cell on either flank", () => {
    const backFour = fourFourTwo.starters.filter((starter) => starter.area === "defence");
    expect(backFour.map((back) => [back.lane, positions.get(back.playerCode)])).toEqual([
      ["left", ["CB"]],
      ["leftCentre", ["CB"]],
      ["rightCentre", ["CB"]],
      ["right", ["CB"]],
    ]);

    expect(lineupProblems(fourFourTwo, positions, openLimits())).toEqual([]);
  });

  test("a full back plays either flank, and the centre too", () => {
    const fullBacks = withPositions(withPositions(positions, LEFT_BACK, ["FB"]), RIGHT_BACK, ["FB"]);
    const fullBackInTheMiddle = moved(LEFT_BACK, "defence", "centre");

    expect(lineupProblems(fourFourTwo, fullBacks, openLimits())).toEqual([]);
    expect(lineupProblems(fullBackInTheMiddle, fullBacks, openLimits())).toEqual([]);
  });

  test("any one of a player's positions is enough", () => {
    const keeperWhoStrikes = withPositions(positions, STRIKER, ["GK", "ST"]);

    expect(lineupProblems(fourFourTwo, keeperWhoStrikes, openLimits())).toEqual([]);
  });

  // Each cell free in the 4-4-2, or the wing back's own.
  const WING_BACK_CELLS: [Area, Lane, number][] = [
    ["defence", "centre", LEFT_MIDFIELDER],
    ["defensiveMidfield", "left", LEFT_MIDFIELDER],
    ["defensiveMidfield", "right", LEFT_MIDFIELDER],
    ["midfield", "left", LEFT_MIDFIELDER],
    ["midfield", "right", RIGHT_MIDFIELDER],
  ];
  test.each(WING_BACK_CELLS)("a wing back stands in %s, %s", (area, lane, playerCode) => {
    const wingBack = withPositions(positions, playerCode, ["WB"]);

    expect(lineupProblems(moved(playerCode, area, lane), wingBack, openLimits())).toEqual([]);
  });

  const NOT_WING_BACK_CELLS: [Area, Lane][] = [
    ["defensiveMidfield", "centre"],
    ["midfield", "centre"],
    ["attackingMidfield", "left"],
  ];
  test.each(NOT_WING_BACK_CELLS)("a wing back is refused %s, %s", (area, lane) => {
    const wingBack = withPositions(positions, LEFT_MIDFIELDER, ["WB"]);

    expect(lineupProblems(moved(LEFT_MIDFIELDER, area, lane), wingBack, openLimits())).toEqual([
      { kind: "outsideHisAreas", playerCode: LEFT_MIDFIELDER, area, lane, positions: ["WB"] },
    ]);
  });

  test("a striker in goal is outside his areas", () => {
    const strikerInGoal = withPositions(positions, KEEPER, ["ST"]);

    expect(lineupProblems(fourFourTwo, strikerInGoal, openLimits())).toEqual([
      { kind: "outsideHisAreas", playerCode: KEEPER, area: "goalkeeper", lane: "centre", positions: ["ST"] },
    ]);
  });

  test("a starter with no positions given is reported, not taken to fit nowhere or anywhere", () => {
    const unknown = new Map(positions);
    unknown.delete(STRIKER);

    expect(lineupProblems(fourFourTwo, unknown, openLimits())).toEqual([
      { kind: "positionsUnknown", playerCode: STRIKER },
    ]);
  });
});

describe("the grid", () => {
  test.each([
    ["wingBack", "left"],
    ["attack", "farRight"],
  ])("a starter in %s, %s is refused: no such cell", (area, lane) => {
    expect(lineupProblems(moved(STRIKER, area, lane), positions, openLimits())).toEqual([
      { kind: "noSuchCell", playerCode: STRIKER, area, lane },
    ]);
  });

  test("two players in one cell are both named", () => {
    const shared = moved(OTHER_STRIKER, "attack", "leftCentre");

    expect(lineupProblems(shared, positions, openLimits())).toEqual([
      { kind: "cellShared", area: "attack", lane: "leftCentre", playerCodes: [STRIKER, OTHER_STRIKER] },
    ]);
  });
});

describe("who is in the lineup", () => {
  const withBench = (bench: number[]): Lineup => ({ ...fourFourTwo, bench });

  test.each([
    ["ten", fourFourTwo.starters.slice(0, -1)],
    ["twelve", [...fourFourTwo.starters, { playerCode: FIRST_SUB, area: "attack", lane: "centre" }]],
  ])("%s starters is the wrong number", (_, starters) => {
    const lineup: Lineup = { starters, bench: fourFourTwo.bench.filter((code) => code !== FIRST_SUB) };
    const firstSubStrikes = withPositions(positions, FIRST_SUB, ["ST"]);

    expect(lineupProblems(lineup, firstSubStrikes, openLimits())).toEqual([
      { kind: "wrongStarterCount", starterCount: starters.length },
    ]);
  });

  test.each([
    ["a starter also on the bench", STRIKER],
    ["a sub on the bench twice", FIRST_SUB],
  ])("%s is in the lineup twice", (_, playerCode) => {
    const lineup = withBench([...fourFourTwo.bench, playerCode]);

    expect(lineupProblems(lineup, positions, openLimits())).toEqual([{ kind: "playerTwice", playerCode }]);
  });

  test("a starter in two cells is in the lineup twice", () => {
    const twoCells: Lineup = {
      ...fourFourTwo,
      starters: [...fourFourTwo.starters.slice(0, -1), { playerCode: STRIKER, area: "attack", lane: "centre" }],
    };

    expect(lineupProblems(twoCells, positions, openLimits())).toEqual([{ kind: "playerTwice", playerCode: STRIKER }]);
  });

  test("an empty bench is legal: its size isn't a rule", () => {
    expect(lineupProblems(withBench([]), positions, openLimits())).toEqual([]);
  });
});

describe("the league's area limits", () => {
  test("an area over its maximum is refused, with its count", () => {
    const rules = openLimits({ defence: { minimum: 0, maximum: 3 } });

    expect(lineupProblems(fourFourTwo, positions, rules)).toEqual([
      { kind: "aboveMaximum", area: "defence", starterCount: 4, maximum: 3 },
    ]);
  });

  test("an area under its minimum is refused, with its count", () => {
    const rules = openLimits({ defensiveMidfield: { minimum: 1, maximum: 2 } });

    expect(lineupProblems(fourFourTwo, positions, rules)).toEqual([
      { kind: "belowMinimum", area: "defensiveMidfield", starterCount: 0, minimum: 1 },
    ]);
  });

  test("an area exactly at its limits is legal", () => {
    const rules = openLimits({ defence: { minimum: 4, maximum: 4 }, attack: { minimum: 2, maximum: 2 } });

    expect(lineupProblems(fourFourTwo, positions, rules)).toEqual([]);
  });

  test("every reason is given, not only the first", () => {
    const lineup = moved(OTHER_STRIKER, "attack", "leftCentre");
    const rules = openLimits({ defence: { minimum: 0, maximum: 3 }, goalkeeper: { minimum: 2, maximum: 2 } });

    expect(lineupProblems(lineup, positions, rules)).toEqual([
      { kind: "cellShared", area: "attack", lane: "leftCentre", playerCodes: [STRIKER, OTHER_STRIKER] },
      { kind: "belowMinimum", area: "goalkeeper", starterCount: 1, minimum: 2 },
      { kind: "aboveMaximum", area: "defence", starterCount: 4, maximum: 3 },
    ]);
  });

  test.each([
    ["a minimum over its maximum", { minimum: 3, maximum: 2 }],
    ["a negative minimum", { minimum: -1, maximum: 2 }],
    ["a fraction", { minimum: 0, maximum: 2.5 }],
  ])("%s is the league's mistake, thrown", (_, limit) => {
    expect(() => lineupProblems(fourFourTwo, positions, openLimits({ midfield: limit }))).toThrow(
      `not midfield ${limit.minimum}–${limit.maximum}`,
    );
  });
});
