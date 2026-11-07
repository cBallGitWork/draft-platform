import { describe, expect, test } from "vitest";
import { DEFAULT_CLASSICS, inClassicShape, standsAsClassic } from "../../../convex/lineup/classics";
import { DEFAULT_PRESETS, presetNameOf } from "../../../convex/lineup/presets";
import { FIRST_INSTRUCTIONS, pairRefusal } from "../../../convex/lineup/instructions";
import { offersRole } from "../../../convex/lineup/roles";
import { classicsOf, FIRST_RULES } from "../../../convex/rules/firstRules";

// The classics every league starts with (spec/05, The pitch; #991): Craig's three and the
// formation picture's other five (Craig, 6 Nov 2026: "Eight to start"), each on one of the league's
// presets ("Yes, one of ours"), with a role for every slot and one instruction a side.

const keegans = DEFAULT_CLASSICS.find(({ name }) => name === "Keegan's Newcastle")!;
const roleOf = ({ role }: { role: string }) => role;

describe("the first classics", () => {
  test("are Craig's three, then the picture's other five", () => {
    expect(DEFAULT_CLASSICS.map(({ name }) => name)).toEqual([
      "Keegan's Newcastle",
      "Barcelona's tiki-taka",
      "Hungary in the 50s",
      "Man United",
      "Sacchi's Milan",
      "Arsenal Invincibles",
      "Greece",
      "Conte's Chelsea",
    ]);
  });

  test("Hungary's MM stands on 4-2-4, Hidegkuti a false 9 (Craig, 6 Nov 2026)", () => {
    const hungary = DEFAULT_CLASSICS.find(({ name }) => name === "Hungary in the 50s")!;
    expect(presetNameOf(hungary.cells, DEFAULT_PRESETS)).toBe("4-2-4");
    expect(hungary.cells.some(({ role }) => role === "falseNine")).toBe(true);
  });

  test.each(DEFAULT_CLASSICS)("$name stands in a preset, every slot on a role it offers there, one instruction a side its shape offers", (classic) => {
    expect(presetNameOf(classic.cells, DEFAULT_PRESETS)).not.toBeNull();
    for (const slot of classic.cells) expect(offersRole(slot, slot.role, classic.cells)).toBe(true);
    expect(pairRefusal(classic.instructions, classic.cells, FIRST_INSTRUCTIONS)).toBeNull();
  });

  test("are the first rules', and a league's rules saved before #991 play them", () => {
    expect(FIRST_RULES.classics).toEqual(DEFAULT_CLASSICS);
    const { classics: _none, ...before } = FIRST_RULES;
    expect(classicsOf(before)).toEqual(DEFAULT_CLASSICS);
  });
});

describe("a lineup on a classic", () => {
  test("stands as it was picked while every slot keeps its role", () => {
    expect(standsAsClassic(keegans.cells, keegans, roleOf)).toBe(true);
  });

  test("is custom once one role changes (spec/05: 'when a change is made it becomes custom')", () => {
    const changed = keegans.cells.map((slot, index) => (index === 1 ? { ...slot, role: "defensiveFullBack" } : slot));
    expect(standsAsClassic(changed, keegans, roleOf)).toBe(false);
  });

  test("is custom once a slot is left empty, and stays in its shape only with every cell", () => {
    expect(standsAsClassic(keegans.cells.slice(1), keegans, roleOf)).toBe(false);
    expect(inClassicShape(keegans.cells.slice(1), keegans)).toBe(false);
    expect(inClassicShape(keegans.cells.toReversed(), keegans)).toBe(true);
  });
});
