import { describe, expect, test } from "vitest";
import { DEFAULT_CLASSIC_FORMATIONS, inClassicFormationShape, standsAsClassicFormation } from "../../../convex/lineup/classics";
import { DEFAULT_PRESETS, presetNameOf } from "../../../convex/lineup/presets";
import { FIRST_INSTRUCTIONS, pairRefusal } from "../../../convex/lineup/instructions";
import { offersRole } from "../../../convex/lineup/roles";
import { classicFormationsOf, FIRST_RULES } from "../../../convex/rules/firstRules";
import { KEEGANS } from "../../support/convex/lineup.harness";

// The classic formations every league starts with (spec/05, The pitch; #991): Craig's three and the
// formation picture's other five (Craig, 6 Nov 2026: "Eight to start"), each on one of the league's
// presets ("Yes, one of ours"), with a role for every slot and one instruction a side.

const roleOf = ({ role }: { role: string }) => role;

describe("the first classics", () => {
  test("are Craig's three, then the picture's other five", () => {
    expect(DEFAULT_CLASSIC_FORMATIONS.map(({ name }) => name)).toEqual([
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
    const hungary = DEFAULT_CLASSIC_FORMATIONS.find(({ name }) => name === "Hungary in the 50s")!;
    expect(presetNameOf(hungary.cells, DEFAULT_PRESETS)).toBe("4-2-4");
    expect(hungary.cells.some(({ role }) => role === "falseNine")).toBe(true);
  });

  test.each(DEFAULT_CLASSIC_FORMATIONS)("$name stands in a preset, every slot on a role it offers there, one instruction a side its shape offers", (classicFormation) => {
    expect(presetNameOf(classicFormation.cells, DEFAULT_PRESETS)).not.toBeNull();
    for (const slot of classicFormation.cells) expect(offersRole(slot, slot.role, classicFormation.cells)).toBe(true);
    expect(pairRefusal(classicFormation.instructions, classicFormation.cells, FIRST_INSTRUCTIONS)).toBeNull();
  });

  test("are the first rules', and a league's rules saved before #991 play them", () => {
    expect(FIRST_RULES.classics).toEqual(DEFAULT_CLASSIC_FORMATIONS);
    const { classics: _none, ...before } = FIRST_RULES;
    expect(classicFormationsOf(before)).toEqual(DEFAULT_CLASSIC_FORMATIONS);
  });
});

describe("a lineup on a classic", () => {
  test("stands as it was picked while every slot keeps its role", () => {
    expect(standsAsClassicFormation(KEEGANS.cells, KEEGANS, roleOf)).toBe(true);
  });

  test("is custom once one role changes (spec/05: 'when a change is made it becomes custom')", () => {
    const changed = KEEGANS.cells.map((slot, index) => (index === 1 ? { ...slot, role: "defensiveFullBack" } : slot));
    expect(standsAsClassicFormation(changed, KEEGANS, roleOf)).toBe(false);
  });

  test("is custom once a slot is left empty, and stays in its shape only with every cell", () => {
    expect(standsAsClassicFormation(KEEGANS.cells.slice(1), KEEGANS, roleOf)).toBe(false);
    expect(inClassicFormationShape(KEEGANS.cells.slice(1), KEEGANS)).toBe(false);
    expect(inClassicFormationShape(KEEGANS.cells.toReversed(), KEEGANS)).toBe(true);
  });
});
