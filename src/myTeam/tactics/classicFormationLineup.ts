// A classic formation picked on the Tactics tab (spec/05, The pitch; #991): its shape, like any
// formation's, keeping the players, every slot's role and its two team instructions; and the name
// the formation in use goes by, the classic formation's, marked custom once a manager changes a
// role or an instruction. Pure, so the screen only says what was asked.

import { standsAsClassicFormation, type ClassicFormation } from "../../../convex/lineup/classicFormations";
import { sameCell } from "../../../convex/lineup/pitch";
import { roleIn } from "../../../convex/lineup/roles";
import { onSetRole, presetInUse, type EditedLineup, type MoveRules, type RatingsOf } from "./lineupEdits";
import { reshaped } from "./reshape";
import { customWords } from "./words";

/** The lineup on the classic formation: reshaped to its cells as a preset is, each starter on the
 *  role its slot sets, whatever he played before, and on its instructions. Picking it again resets
 *  every role and both instructions (Craig, 6 Nov 2026). One who can't take his slot's role
 *  (spec/05 `S05.29`), such as a number 10 on a poacher's slot, starts on his best-star role there
 *  instead, as a saved plan's does, and the formation reads custom. */
export function onClassicFormation(draft: EditedLineup, classicFormation: ClassicFormation, rules: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): EditedLineup {
  const { cells } = classicFormation;
  const { starters, bench } = reshaped(draft, cells, rules, ratingsOf);
  return {
    starters: starters.map((starter) => onSetRole(starter, cells.find((slot) => sameCell(slot, starter))!.role, cells, ratingsOf, rules.positionsOf)),
    bench,
    classicFormation: classicFormation.name,
    instructions: { ...classicFormation.instructions },
  };
}

/** The classic formation the lineup was picked from, if the league still holds it. */
export const classicFormationInUse = (draft: EditedLineup, classicFormations: readonly ClassicFormation[]): ClassicFormation | undefined =>
  draft.classicFormation === undefined ? undefined : classicFormations.find(({ name }) => name === draft.classicFormation);

/** Whether the lineup still stands as its classic formation sets it: every slot on its role and,
 *  where the lineup holds its instructions, both of the classic formation's. */
const standsAsPicked = (draft: EditedLineup, classicFormation: ClassicFormation) =>
  standsAsClassicFormation(draft.starters, classicFormation, (starter) => roleIn(starter, starter.role).key) &&
  (draft.instructions === undefined ||
    (draft.instructions.attacking === classicFormation.instructions.attacking && draft.instructions.defensive === classicFormation.instructions.defensive));

/** What the formation in use is called: its classic formation's name, "(custom)" once a role or an
 *  instruction changes from it (Craig, 6 Nov 2026: "Keegan's Newcastle (custom)"), else the preset
 *  it stands in, else none. */
export function formationNameOf(draft: EditedLineup, presets: Parameters<typeof presetInUse>[1], classicFormations: readonly ClassicFormation[]): string | null {
  const classicFormation = classicFormationInUse(draft, classicFormations);
  if (classicFormation !== undefined) return standsAsPicked(draft, classicFormation) ? classicFormation.name : customWords(classicFormation.name);
  return presetInUse(draft, presets)?.name ?? null;
}
