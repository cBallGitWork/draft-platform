// The lineup being set on the Tactics tab (#14): moves between cells and the bench, swaps, where a
// player picked up can go under the area limits (#851), and when two lineups stand the same.

import { describe, expect, it } from "vitest";
import { ALL_CELLS, AREAS, type Cell } from "../../../../convex/lineup/pitch";
import type { Position } from "../../../../convex/positions/positionTables";
import {
  benched,
  benchedAt,
  canStandIn,
  canSwap,
  movedTo,
  openingLineup,
  placed,
  reachOf,
  reshaped,
  sameLineup,
  shownLineup,
  swapped,
  withRole,
  type MoveRules,
  type RatingsOf,
} from "../../../../src/myTeam/tactics/lineupDraft";
import type { RoleStars } from "../../../../convex/stars/starsShape";

const KEEPER = { playerCode: 1, area: "goalkeeper", lane: "centre" } as const;
const BACK = { playerCode: 2, area: "defence", lane: "left" } as const;
const DRAFT = { starters: [KEEPER, BACK], bench: [3, 4] };
/** No stars: everyone dropped starts on the slot's first role. */
const NO_STARS: RatingsOf = () => [];

describe("a move", () => {
  it("off the bench into a free cell makes him a starter", () => {
    expect(placed(DRAFT, 3, { area: "midfield", lane: "centre" }, NO_STARS)).toEqual({
      starters: [KEEPER, BACK, { playerCode: 3, area: "midfield", lane: "centre" }],
      bench: [4],
    });
  });

  it("into a cell another player stands in throws: the screen offers only free ones", () => {
    expect(() => placed(DRAFT, 3, { area: "defence", lane: "left" }, NO_STARS)).toThrow(/taken by player 2/);
  });

  it("to the bench puts him at its end", () => {
    expect(benched(DRAFT, 2)).toEqual({ starters: [KEEPER], bench: [3, 4, 2] });
  });

  it("to a place on the bench puts him there, from the pitch or along the bench", () => {
    expect(benchedAt(DRAFT, 2, 0)).toEqual({ starters: [KEEPER], bench: [2, 3, 4] });
    expect(benchedAt(DRAFT, 3, 1)).toEqual({ starters: [KEEPER, BACK], bench: [4, 3] }); // down one
    expect(benchedAt(DRAFT, 4, 0)).toEqual({ starters: [KEEPER, BACK], bench: [4, 3] }); // up one
  });

  it("past either end of the bench is that end", () => {
    expect(benchedAt(DRAFT, 2, -1).bench).toEqual([2, 3, 4]);
    expect(benchedAt(DRAFT, 3, 9).bench).toEqual([4, 3]);
  });
});

describe("the same lineup", () => {
  it("is the same players in the same cells whatever order the starters are listed in", () => {
    expect(sameLineup(DRAFT, { starters: [BACK, KEEPER], bench: [3, 4] })).toBe(true);
  });

  it("isn't with the bench in another order", () => {
    expect(sameLineup(DRAFT, { starters: [KEEPER, BACK], bench: [4, 3] })).toBe(false);
  });
});

it("opens on the lineup the server holds, a team's first until its manager saves one (spec/05)", () => {
  const lineup = { fromGameweek: null, noLineup: false, starters: [KEEPER], bench: [7, 5, 6], leftSquad: [], joinedBench: [], vacated: [] };
  expect(openingLineup({ lineup })).toEqual({ starters: [KEEPER], bench: [7, 5, 6] });
});

describe("the lineup shown", () => {
  /** The lineup the server holds, which the screen opened on. */
  const OPENING = { starters: [KEEPER], bench: [2, 3, 4] };

  it("is the manager's edit against the squad now: who left drops out and who joined goes to the end of the bench", () => {
    expect(shownLineup(DRAFT, OPENING, [1, 3, 4, 9])).toEqual({ starters: [KEEPER], bench: [3, 4, 9] });
  });

  it("is the held lineup while there is no edit", () => {
    expect(shownLineup(null, OPENING, [1, 3, 4, 9])).toBe(OPENING);
  });
});

describe("a preset picked (spec/05; Craig, 26 Oct 2026)", () => {
  const cell = (area: Cell["area"], lane: Cell["lane"]) => ({ area, lane });
  const FOUR_BACK = [cell("goalkeeper", "centre"), cell("defence", "left"), cell("defence", "leftCentre"), cell("defence", "rightCentre"), cell("defence", "right")];

  it("moves each starter to a free cell of the shape in his own area, the nearest lane first", () => {
    const draft = { starters: [KEEPER, { playerCode: 2, area: "defence", lane: "centre" } as const], bench: [3] };
    expect(reshaped(draft, FOUR_BACK, NO_STARS)).toEqual({
      starters: [KEEPER, { playerCode: 2, area: "defence", lane: "leftCentre" }],
      bench: [3],
    });
  });

  it("puts anyone the shape has no room for at the front of the bench, back to front", () => {
    const draft = {
      starters: [KEEPER, { playerCode: 5, area: "attack", lane: "centre" } as const, { playerCode: 6, area: "midfield", lane: "left" } as const],
      bench: [3],
    };
    expect(reshaped(draft, FOUR_BACK, NO_STARS)).toEqual({ starters: [KEEPER], bench: [6, 5, 3] });
  });

  it("two starters in an area take its cells in turn, never the same one", () => {
    const draft = { starters: [{ playerCode: 2, area: "defence", lane: "left" } as const, { playerCode: 7, area: "defence", lane: "leftCentre" } as const], bench: [] };
    const result = reshaped(draft, [cell("defence", "left"), cell("defence", "right")], NO_STARS);
    expect(result.starters).toEqual([{ playerCode: 2, area: "defence", lane: "left" }, { playerCode: 7, area: "defence", lane: "right" }]);
  });
});

describe("a role (spec/05 Roles)", () => {
  it("given, is the starter's until he moves; the same lineup with another role isn't the same", () => {
    const given = withRole(DRAFT, 2, "attackingFullBack");
    expect(given.starters[1]).toEqual({ ...BACK, role: "attackingFullBack" });
    expect(sameLineup(given, DRAFT)).toBe(false);
    expect(placed(given, 2, { area: "defence", lane: "centre" }, NO_STARS).starters.at(-1)).toEqual({ playerCode: 2, area: "defence", lane: "centre" });
  });

  it("kept by a preset that puts him in a slot offering it, dropped where it isn't offered", () => {
    const given = withRole(DRAFT, 2, "attackingFullBack");
    expect(reshaped(given, [KEEPER, { area: "defence", lane: "left" }], NO_STARS).starters[1]).toEqual({ ...BACK, role: "attackingFullBack" });
    expect(reshaped(given, [KEEPER, { area: "defence", lane: "centre" }], NO_STARS).starters[1]).toEqual({ playerCode: 2, area: "defence", lane: "centre" });
  });
});

describe("the role a player dropped into a slot starts on: his most stars there (spec/05 Roles; #11)", () => {
  const DEFENCE_STARS: RoleStars[] = [
    { area: "defence", role: "defensiveFullBack", stars: 2 },
    { area: "defence", role: "attackingFullBack", stars: 4 },
    { area: "defence", role: "ballPlayingDefender", stars: 3.5 },
  ];
  const ratingsOf: RatingsOf = (playerCode) => (playerCode === 3 || playerCode === 2 ? DEFENCE_STARS : []);
  const RIGHT_BACK = { area: "defence", lane: "right" } as const;
  const CENTRE_BACK = { area: "defence", lane: "centre" } as const;

  it("placed off the bench, or moved to a free cell", () => {
    expect(placed(DRAFT, 3, RIGHT_BACK, ratingsOf).starters.at(-1)).toEqual({ playerCode: 3, ...RIGHT_BACK, role: "attackingFullBack" });
    expect(movedTo(DRAFT, 3, CENTRE_BACK, ratingsOf).starters.at(-1)).toEqual({ playerCode: 3, ...CENTRE_BACK, role: "ballPlayingDefender" });
  });

  it("the slot's first, saved as none, on a tie or with no stars", () => {
    const level: RatingsOf = () => [
      { area: "defence", role: "defensiveFullBack", stars: 3 },
      { area: "defence", role: "attackingFullBack", stars: 3 },
    ];
    expect(placed(DRAFT, 3, RIGHT_BACK, level).starters.at(-1)).toEqual({ playerCode: 3, ...RIGHT_BACK });
    expect(placed(DRAFT, 4, RIGHT_BACK, ratingsOf).starters.at(-1)).toEqual({ playerCode: 4, ...RIGHT_BACK });
  });

  it("swapped: each on his best role in the other's slot", () => {
    expect(swapped(DRAFT, 3, 2, ratingsOf).starters[1]).toEqual({ ...BACK, playerCode: 3, role: "attackingFullBack" });
  });

  it("moved by a preset: his role kept where offered, his old slot's first included; his best role where it isn't", () => {
    expect(reshaped(DRAFT, [KEEPER, RIGHT_BACK], ratingsOf).starters[1]).toEqual({ playerCode: 2, ...RIGHT_BACK });
    expect(reshaped(DRAFT, [KEEPER, CENTRE_BACK], ratingsOf).starters[1]).toEqual({ playerCode: 2, ...CENTRE_BACK, role: "ballPlayingDefender" });
  });
});

describe("a swap (spec/05, Moving players; #851)", () => {
  const MIDFIELDER = { playerCode: 5, area: "midfield", lane: "centre" } as const;
  const WITH_ROLES = { starters: [{ ...BACK, role: "attackingFullBack" }, { ...MIDFIELDER, role: "boxToBox" }], bench: [3, 4] };

  it("of two starters puts each in the other's cell, on its first role", () => {
    expect(swapped(WITH_ROLES, 2, 5, NO_STARS)).toEqual({
      starters: [{ playerCode: 5, area: "defence", lane: "left" }, { playerCode: 2, area: "midfield", lane: "centre" }],
      bench: [3, 4],
    });
  });

  it("of a bench player and a starter puts the starter in the bench player's place in the order", () => {
    expect(swapped(DRAFT, 4, 2, NO_STARS)).toEqual({ starters: [KEEPER, { playerCode: 4, area: "defence", lane: "left" }], bench: [3, 2] });
  });

  it("of two bench players throws: the bench is put in order, not swapped", () => {
    expect(() => swapped(DRAFT, 3, 4, NO_STARS)).toThrow(/both on the bench/);
  });

  it("is what sending a player to a taken cell does; a free cell takes him in", () => {
    expect(movedTo(DRAFT, 3, BACK, NO_STARS)).toEqual(swapped(DRAFT, 3, 2, NO_STARS));
    expect(movedTo(DRAFT, 3, { area: "midfield", lane: "centre" }, NO_STARS)).toEqual(placed(DRAFT, 3, { area: "midfield", lane: "centre" }, NO_STARS));
  });
});

describe("where a player picked up can go (spec/05, Moving players; #851)", () => {
  const limit = (minimum: number, maximum: number) => ({ minimum, maximum });
  const POSITIONS: Record<number, Position[]> = { 1: ["GK"], 2: ["CB"], 3: ["GK"], 4: ["CB", "CM"] };
  /** One keeper exactly, at most two in defence, anyone anywhere else. */
  const RULES: MoveRules = {
    areaLimits: { ...Object.fromEntries(AREAS.map((area) => [area, limit(0, 10)])), goalkeeper: limit(1, 1), defence: limit(0, 2) } as MoveRules["areaLimits"],
    positionsOf: (playerCode) => POSITIONS[playerCode] ?? [],
  };
  const DEFENCE_FULL = { starters: [KEEPER, BACK, { playerCode: 6, area: "defence", lane: "right" } as const], bench: [3, 4] };

  it("lights no free cell that breaks the area limits: no second keeper, no third in defence", () => {
    expect(canStandIn(DRAFT, 3, { area: "goalkeeper", lane: "left" }, RULES)).toBe(false);
    expect(canStandIn(DRAFT, 4, { area: "defence", lane: "centre" }, RULES)).toBe(true);
    expect(canStandIn(DEFENCE_FULL, 4, { area: "defence", lane: "centre" }, RULES)).toBe(false);
    expect(canStandIn(DEFENCE_FULL, 4, { area: "midfield", lane: "centre" }, RULES)).toBe(true);
  });

  it("lights no move that takes an area below its minimum, nor a twelfth starter", () => {
    expect(canStandIn(DRAFT, 1, { area: "goalkeeper", lane: "left" }, RULES)).toBe(true);
    const keeperAnywhere: MoveRules = { ...RULES, positionsOf: () => ["GK", "CB"] };
    expect(canStandIn(DRAFT, 1, { area: "defence", lane: "centre" }, keeperAnywhere)).toBe(false);
    const eleven = { starters: Array.from({ length: 11 }, (_, index) => ({ playerCode: 10 + index, area: "midfield", lane: "centre" }) as const), bench: [4] };
    expect(canStandIn(eleven, 4, { area: "defence", lane: "left" }, RULES)).toBe(false);
  });

  it("lights a taken cell he may swap into, and only where both play the cell they land in", () => {
    expect(canStandIn(DRAFT, 3, KEEPER, RULES)).toBe(true);
    expect(canSwap(DRAFT, 3, 1, RULES)).toBe(true);
    // A centre back can't go in goal, so the keeper can't swap with him.
    expect(canStandIn(DRAFT, 1, BACK, RULES)).toBe(false);
    expect(canSwap(DRAFT, 3, 4, RULES)).toBe(false);
    expect(canStandIn(DRAFT, 2, BACK, RULES)).toBe(false);
  });

  it("is every cell and every player canStandIn and canSwap allow", () => {
    for (const draft of [DRAFT, DEFENCE_FULL]) {
      for (const playerCode of [1, 2, 3, 4]) {
        expect(reachOf(draft, playerCode, RULES)).toEqual({
          cells: ALL_CELLS.filter((cell) => canStandIn(draft, playerCode, cell, RULES)),
          players: [...draft.starters.map((starter) => starter.playerCode), ...draft.bench].filter((other) => canSwap(draft, playerCode, other, RULES)),
        });
      }
    }
    expect(reachOf(DRAFT, 3, RULES)).toEqual({ cells: [{ area: "goalkeeper", lane: "centre" }], players: [1] });
  });
});
