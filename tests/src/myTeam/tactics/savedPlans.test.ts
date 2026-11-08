import { describe, expect, it } from "vitest";
import { positionOfSlot, sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { DEFAULT_PRESETS } from "../../../../convex/lineup/presets";
import { DEFAULT_ROLES, rolesOfSlot } from "../../../../convex/lineup/roles";
import type { Position } from "../../../../convex/positions/positionTables";
import { reshaped, swapped, type EditedLineup } from "../../../../src/myTeam/tactics/lineupEdits";
import { loadedPlan, planSlotsOf, presetOfPlan, type Plan } from "../../../../src/myTeam/tactics/savedPlans";

// Saved plans (spec/05, Saved plans; #992): saving keeps the formation and every slot's role, never
// players; loading reshapes keeping the players, as a preset does, each slot on the plan's role;
// under the league's rules as they are now (Craig, 6 Nov 2026).

const [FOUR_FOUR_TWO, FOUR_THREE_THREE] = DEFAULT_PRESETS;
const positionsByArea: Record<Cell["area"], Position[]> = {
  goalkeeper: ["GK"],
  defence: ["CB", "FB"],
  defensiveMidfield: ["CDM"],
  midfield: ["CM", "WM"],
  attackingMidfield: ["W", "CAM"],
  attack: ["ST"],
};
/** Eleven in the 4-4-2, each on his slot's first role, and two on the bench. */
const IN_A_442: EditedLineup = { starters: FOUR_FOUR_TWO.cells.map((cell, index) => ({ playerCode: index + 1, ...cell })), bench: [12, 13] };
const areaOf = new Map(IN_A_442.starters.map(({ playerCode, area }) => [playerCode, area]));
const rules = { positionsOf: (playerCode: number) => [...(positionsByArea[areaOf.get(playerCode) ?? "midfield"] ?? []), "CM" as Position] };
const noStars = () => [];
/** The 4-3-3 with each slot on the last role it offers: none a slot's first. */
const PRESS: Plan = { name: "Press", slots: FOUR_THREE_THREE.cells.map((cell) => ({ ...cell, role: rolesOfSlot(cell, FOUR_THREE_THREE.cells).at(-1)!.key })) };
const roleAt = (lineup: EditedLineup, cell: Cell) => lineup.starters.find((starter) => sameCell(starter, cell))?.role;

describe("saving a plan", () => {
  it("keeps each starter's cell and the role he plays, a slot's first where none is given, never players", () => {
    const slots = planSlotsOf(IN_A_442);
    expect(slots).toEqual(FOUR_FOUR_TWO.cells.map((cell) => ({ ...cell, role: DEFAULT_ROLES[positionOfSlot(cell)][0].key })));
    expect(slots.some((slot) => "playerCode" in slot)).toBe(false);
  });
});

describe("loading a plan", () => {
  it("reshapes the pitch keeping the players, as the preset does, each slot on the plan's role", () => {
    const loaded = loadedPlan(IN_A_442, PRESS, DEFAULT_PRESETS, rules, noStars)!;
    const asThePreset = reshaped(IN_A_442, FOUR_THREE_THREE.cells, rules, noStars);
    expect(loaded.preset.name).toBe(FOUR_THREE_THREE.name);
    expect(loaded.lineup.starters.map(({ playerCode, area, lane }) => ({ playerCode, area, lane }))).toEqual(
      asThePreset.starters.map(({ playerCode, area, lane }) => ({ playerCode, area, lane })),
    );
    expect(loaded.lineup.bench).toEqual(asThePreset.bench);
    for (const slot of PRESS.slots) expect(roleAt(loaded.lineup, slot)).toBe(slot.role);
    expect(loaded.rolesLost).toBe(0);
  });

  it("a move after loading changes only the lineup: the plan stays as saved", () => {
    const saved = structuredClone(PRESS);
    const loaded = loadedPlan(IN_A_442, PRESS, DEFAULT_PRESETS, rules, noStars)!;
    swapped(loaded.lineup, loaded.lineup.starters[1].playerCode, loaded.lineup.bench[0] ?? loaded.lineup.starters[2].playerCode, noStars);
    expect(PRESS).toEqual(saved);
  });

  it("a slot whose role the league no longer offers there takes the player's best-star role, and says how many", () => {
    const keeper = FOUR_FOUR_TWO.cells[0];
    const centreBack = FOUR_FOUR_TWO.cells.find((cell) => positionOfSlot(cell) === "CB")!;
    // A sweeper needs a back three: in a back four the slot no longer offers it.
    const plan: Plan = { name: "Sweeper", slots: FOUR_FOUR_TWO.cells.map((cell) => ({ ...cell, role: sameCell(cell, centreBack) ? "sweeper" : DEFAULT_ROLES[positionOfSlot(cell)][0].key })) };
    const loaded = loadedPlan(IN_A_442, plan, DEFAULT_PRESETS, rules, noStars)!;
    expect(loaded.rolesLost).toBe(1);
    expect(roleAt(loaded.lineup, centreBack)).not.toBe("sweeper");
    expect(roleAt(loaded.lineup, keeper)).toBe(DEFAULT_ROLES.GK[0].key);
  });

  it("a plan whose formation the league no longer has can't be loaded", () => {
    const without433 = DEFAULT_PRESETS.filter(({ name }) => name !== FOUR_THREE_THREE.name);
    expect(presetOfPlan(PRESS, without433)).toBeUndefined();
    expect(loadedPlan(IN_A_442, PRESS, without433, rules, noStars)).toBeNull();
  });
});
