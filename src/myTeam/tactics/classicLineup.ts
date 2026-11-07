// A classic picked on the Tactics tab (spec/05, The pitch; #991): its shape, like any formation's,
// keeping the players, and every slot's role; and the name the formation in use goes by, the
// classic's, marked custom once a manager changes a role. Its team instructions apply once picking
// them is built (#990). Pure, so the screen only says what was asked.

import { standsAsClassic, type Classic } from "../../../convex/lineup/classics";
import { sameCell } from "../../../convex/lineup/pitch";
import { roleIn } from "../../../convex/lineup/roles";
import { presetInUse, reshaped, type DraftLineup, type MoveRules, type RatingsOf } from "./lineupDraft";
import { customWords } from "./words";

/** The lineup on the classic: reshaped to its cells as a preset is, each starter on the role its
 *  slot sets, whatever he played before. Picking it again resets every role (Craig, 6 Nov 2026). */
export function onClassic(draft: DraftLineup, classic: Classic, rules: Pick<MoveRules, "positionsOf">, ratingsOf: RatingsOf): DraftLineup {
  const { starters, bench } = reshaped(draft, classic.cells, rules, ratingsOf);
  return {
    starters: starters.map((starter) => ({ ...starter, role: classic.cells.find((slot) => sameCell(slot, starter))!.role })),
    bench,
    classic: classic.name,
  };
}

/** The classic the lineup was picked from, if the league still holds it. */
export const classicInUse = (draft: DraftLineup, classics: readonly Classic[]): Classic | undefined =>
  draft.classic === undefined ? undefined : classics.find(({ name }) => name === draft.classic);

/** What the formation in use is called: its classic's name, "(custom)" once changed from it
 *  (Craig, 6 Nov 2026: "Keegan's Newcastle (custom)"), else the preset it stands in, else none. */
export function formationNameOf(draft: DraftLineup, presets: Parameters<typeof presetInUse>[1], classics: readonly Classic[]): string | null {
  const classic = classicInUse(draft, classics);
  if (classic !== undefined) return standsAsClassic(draft.starters, classic, (starter) => roleIn(starter, starter.role).key) ? classic.name : customWords(classic.name);
  return presetInUse(draft, presets)?.name ?? null;
}
