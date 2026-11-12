import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { InstructionPair } from "../../../convex/lineup/instructions";
import type { EditedLineup, MoveRules, PresetShape, RatingsOf } from "./lineupEdits";
import { loadedPlan, planSlotsOf, presetOfPlan } from "./savedPlans";
import type { OpenTactics, TacticsSeam } from "./seam";
import { rolesLostWords } from "./words";

/** The manager's saved plans on the Tactics tab (spec/05, Saved plans; #992), and the one he last
 *  loaded. `read` is undefined while they load: the toolbar has none to load yet, and the window
 *  says they are loading. `onLoad` reshapes the pitch to a loaded plan's preset, with a line under
 *  the toolbar where the league no longer offers some of its roles, on the plan's two instructions
 *  where it holds them (#990). */
export function useSavedPlans({
  leagueId,
  seam,
  draft,
  instructions,
  presets,
  inUse,
  rules,
  ratingsOf,
  onLoad,
}: {
  leagueId: Id<"leagues">;
  seam: Pick<TacticsSeam, "usePlans" | "usePlanChanges">;
  draft: EditedLineup;
  /** The two instructions in force, as a plan saved now keeps them (#990). */
  instructions: InstructionPair;
  presets: OpenTactics["presets"];
  inUse: string | null;
  rules: MoveRules;
  ratingsOf: RatingsOf;
  onLoad(preset: PresetShape, lineup: EditedLineup, said: string | null): void;
}) {
  const read = seam.usePlans(leagueId);
  const plans = read ?? [];
  const changes = seam.usePlanChanges();
  const [loadedName, setLoadedName] = useState<string | null>(null);
  /** A saved plan loaded: the pitch reshaped keeping the players, each slot on the plan's role, or
   *  the player's best-star role where the league no longer offers it (Craig, 6 Nov 2026). The plan
   *  itself changes only when he saves it again. */
  const load = (name: string) => {
    const plan = plans.find((each) => each.name === name);
    const loaded = plan === undefined ? null : loadedPlan(draft, plan, presets, rules, ratingsOf);
    if (loaded === null) return;
    setLoadedName(name);
    onLoad(loaded.preset, loaded.lineup, loaded.rolesLost > 0 ? rolesLostWords(name, loaded.rolesLost) : null);
  };
  const loadedShown = plans.find(({ name }) => name === loadedName);
  return {
    read,
    load,
    /** The plan last loaded, while the pitch still stands in its preset. */
    inUse: loadedShown !== undefined && inUse !== null && presetOfPlan(loadedShown, presets)?.name === inUse ? loadedShown.name : null,
    /** The plans whose formation the league still offers, by name. */
    loadable: plans.filter((plan) => presetOfPlan(plan, presets) !== undefined).map(({ name }) => name),
    save: (name: string) => changes.save(leagueId, name, planSlotsOf(draft), instructions),
    remove: (name: string) => changes.remove(leagueId, name),
  };
}
