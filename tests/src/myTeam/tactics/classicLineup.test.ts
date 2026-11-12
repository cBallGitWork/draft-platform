import { describe, expect, it } from "vitest";
import { FIRST_CLASSIC_FORMATIONS } from "../../../../convex/lineup/classics";
import { sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { FIRST_PRESETS } from "../../../../convex/lineup/presets";
import { roleIn, takesRole } from "../../../../convex/lineup/roles";
import type { Position } from "../../../../convex/positions/positionTables";
import { formationNameOf, onClassicFormation } from "../../../../src/myTeam/tactics/classicLineup";
import type { EditedLineup } from "../../../../src/myTeam/tactics/lineupEdits";
import { customWords } from "../../../../src/myTeam/tactics/words";

// A classic formation picked (spec/05, The pitch; #991) puts each starter on its slot's role, but
// only one he may take (spec/05 `S05.29`; #1543): a number 10 in a striker's slot can't be its
// poacher.

const keegans = FIRST_CLASSIC_FORMATIONS.find(({ name }) => name === "Keegan's Newcastle")!;
const positionsByArea: Record<Cell["area"], Position[]> = {
  goalkeeper: ["GK"],
  defence: ["CB", "FB"],
  defensiveMidfield: ["CDM"],
  midfield: ["CM", "WM"],
  attackingMidfield: ["W", "CAM"],
  attack: ["ST"],
};
/** Eleven on Keegan's 4-4-2, the last, in the poacher's slot, a number 10 only. */
const IN_KEEGANS_SHAPE: EditedLineup = { starters: keegans.cells.map(({ area, lane }, index) => ({ playerCode: index + 1, area, lane })), bench: [] };
const NUMBER_TEN = keegans.cells.length;
const poachersSlot = keegans.cells[NUMBER_TEN - 1];
const rules = {
  positionsOf: (playerCode: number): Position[] =>
    playerCode === NUMBER_TEN ? ["CAM"] : positionsByArea[IN_KEEGANS_SHAPE.starters.find((starter) => starter.playerCode === playerCode)!.area],
};
const noStars = () => [];

describe("picking a classic", () => {
  it("puts every starter who may take it on his slot's role", () => {
    const strikers = { positionsOf: (playerCode: number) => (playerCode === NUMBER_TEN ? (["ST"] as Position[]) : rules.positionsOf(playerCode)) };
    const lineup = onClassicFormation(IN_KEEGANS_SHAPE, keegans, strikers, noStars);
    for (const slot of keegans.cells) expect(lineup.starters.find((starter) => sameCell(starter, slot))?.role).toBe(slot.role);
    expect(formationNameOf(lineup, FIRST_PRESETS, FIRST_CLASSIC_FORMATIONS)).toBe(keegans.name);
  });

  it("starts a number 10 on a striker's slot on a role he may take, never its poacher, and the formation reads custom", () => {
    expect(poachersSlot.role).toBe("poacher");
    const lineup = onClassicFormation(IN_KEEGANS_SHAPE, keegans, rules, noStars);
    const numberTen = lineup.starters.find((starter) => starter.playerCode === NUMBER_TEN)!;
    expect(sameCell(numberTen, poachersSlot)).toBe(true);
    const role = roleIn(numberTen, numberTen.role).key;
    expect(role).not.toBe("poacher");
    expect(takesRole(["CAM"], role)).toBe(true);
    for (const slot of keegans.cells.slice(0, -1)) expect(lineup.starters.find((starter) => sameCell(starter, slot))?.role).toBe(slot.role);
    expect(formationNameOf(lineup, FIRST_PRESETS, FIRST_CLASSIC_FORMATIONS)).toBe(customWords(keegans.name));
  });
});
