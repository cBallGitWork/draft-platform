// A classic picked on the Tactics tab (spec/05, The pitch; #991): its shape, like any formation's,
// keeping the players, every slot's role and its two team instructions; and the name the formation
// in use goes by, the classic's, marked custom once a manager changes a role or an instruction.
// Pure, so the screen only says what was asked.

import { standsAsClassic, type Classic } from "../../../convex/lineup/classics";
import { sameCell } from "../../../convex/lineup/pitch";
import { roleIn } from "../../../convex/lineup/roles";
import { presetInUse, type EditedLineup, type MoveRules, type RatingsOf } from "./lineupEdits";
import { reshaped } from "./reshape";
import { customWords } from "./words";

/** The lineup on the classic: reshaped to its cells as a preset is, each starter on the role its
 *  slot sets, whatever he played before, and on its instructions. Picking it again resets every
 *  role and both instructions (Craig, 6 Nov 2026). */
export function onClassic(draft: EditedLineup, classic: Classic, rules: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): EditedLineup {
  const { starters, bench } = reshaped(draft, classic.cells, rules, ratingsOf);
  return {
    starters: starters.map((starter) => ({ ...starter, role: classic.cells.find((slot) => sameCell(slot, starter))!.role })),
    bench,
    classic: classic.name,
    instructions: { ...classic.instructions },
  };
}

/** The classic the lineup was picked from, if the league still holds it. */
export const classicInUse = (draft: EditedLineup, classics: readonly Classic[]): Classic | undefined =>
  draft.classic === undefined ? undefined : classics.find(({ name }) => name === draft.classic);

/** Whether the lineup still stands as its classic sets it: every slot on its role and, where the
 *  lineup holds its instructions, both of the classic's. */
const standsAsPicked = (draft: EditedLineup, classic: Classic) =>
  standsAsClassic(draft.starters, classic, (starter) => roleIn(starter, starter.role).key) &&
  (draft.instructions === undefined ||
    (draft.instructions.attacking === classic.instructions.attacking && draft.instructions.defensive === classic.instructions.defensive));

/** What the formation in use is called: its classic's name, "(custom)" once a role or an
 *  instruction changes from it (Craig, 6 Nov 2026: "Keegan's Newcastle (custom)"), else the preset
 *  it stands in, else none. */
export function formationNameOf(draft: EditedLineup, presets: Parameters<typeof presetInUse>[1], classics: readonly Classic[]): string | null {
  const classic = classicInUse(draft, classics);
  if (classic !== undefined) return standsAsPicked(draft, classic) ? classic.name : customWords(classic.name);
  return presetInUse(draft, presets)?.name ?? null;
}
