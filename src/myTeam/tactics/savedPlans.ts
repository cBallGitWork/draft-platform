// A manager's saved plans on the Tactics tab (spec/05, Saved plans; #992): what saving one takes
// from the pitch, and the pitch a plan loads onto. Pure, so the formation window and its tests read
// them alike. Loading reshapes the pitch keeping the players, as a preset does (reshaped), then
// gives each slot the plan's role. Under the league's rules as they are now (Craig, 6 Nov 2026): a
// plan whose formation is no longer one of the league's presets can't be loaded, and a slot whose
// role it no longer offers takes the player's best-star role, which the line under the toolbar says.

import type { InstructionPair } from "../../../convex/lineup/instructions";
import { sameCell, type Cell } from "../../../convex/lineup/pitch";
import { offersRole, roleIn, takesRole } from "../../../convex/lineup/roles";
import { droppedStarter } from "../../../convex/stars/bestRole";
import { presetOfCells, reshaped, type EditedLineup, type MoveRules, type RatingsOf } from "./lineupEdits";

/** A saved plan: a formation, each slot's role and both team instructions (#990), by name, never
 *  players. A plan saved before the instructions holds none. */
export type Plan = { name: string; slots: readonly (Cell & { role: string })[]; instructions?: InstructionPair };

/** A league preset, as its rules hold it. */
type Preset = { name: string; cells: readonly Cell[] };

/** What Save preset… keeps of the pitch: each starter's cell and the role he plays there. */
export const planSlotsOf = ({ starters }: EditedLineup): Plan["slots"] =>
  starters.map(({ area, lane, role }) => ({ area, lane, role: roleIn({ area, lane }, role).key }));

/** The league's preset a plan stands in, undefined once the league no longer has it. */
export const presetOfPlan = (plan: Plan, presets: readonly Preset[]): Preset | undefined => presetOfCells(plan.slots, presets);

/** The plan loaded onto the pitch: its preset, the lineup it leaves (on the plan's instructions,
 *  where it holds them), and how many of its roles the league no longer offers in their slot. Null
 *  for a plan whose formation is no longer allowed. */
export function loadedPlan(
  draft: EditedLineup,
  plan: Plan,
  presets: readonly Preset[],
  rules: Pick<MoveRules, "positionsOf">,
  ratingsOf: RatingsOf,
): { preset: Preset; lineup: EditedLineup; rolesLost: number } | null {
  const preset = presetOfPlan(plan, presets);
  if (preset === undefined) return null;
  const formation = preset.cells;
  const keeps = (slot: Plan["slots"][number]) => offersRole(slot, slot.role, formation);
  const shaped = reshaped(draft, formation, rules, ratingsOf);
  const starters = shaped.starters.map((starter) => {
    const slot = plan.slots.find((each) => sameCell(each, starter))!;
    const positions = rules.positionsOf(starter.playerCode);
    // A slot's role he can't take (spec/05 `S05.29`) goes as one the formation no longer offers does.
    return keeps(slot) && takesRole(positions, slot.role)
      ? { ...starter, role: slot.role }
      : droppedStarter(starter.playerCode, starter, formation, ratingsOf(starter.playerCode), positions);
  });
  const { instructions } = plan;
  return { preset, lineup: { starters, bench: shaped.bench, ...(instructions !== undefined && { instructions }) }, rolesLost: plan.slots.filter((slot) => !keeps(slot)).length };
}
