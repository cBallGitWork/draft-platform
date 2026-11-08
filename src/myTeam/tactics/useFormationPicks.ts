import type { Id } from "../../../convex/_generated/dataModel";
import { keptOrSwitched, type InstructionPair, type Side } from "../../../convex/lineup/instructions";
import { switchedWords } from "../../../convex/lineup/instructionsWords";
import type { Cell } from "../../../convex/lineup/pitch";
import { onClassic } from "./classicLineup";
import { reshaped, withInstruction, type EditedLineup, type MoveRules, type RatingsOf } from "./lineupEdits";
import type { OpenTactics, TacticsSeam } from "./seam";
import type { useLineupEdits } from "./useLineupEdits";
import { useSavedPlans } from "./useSavedPlans";

/** What the Tactics toolbar and the formation window pick (spec/05): a preset, a classic, a saved
 *  plan or one side's team instruction, each a move on `edits` that puts down the player in hand
 *  (`putDown`) first. */
export function useFormationPicks({
  leagueId,
  seam,
  tactics,
  edits,
  instructions,
  inUse,
  rules,
  ratingsOf,
  putDown,
}: {
  leagueId: Id<"leagues">;
  seam: Pick<TacticsSeam, "usePlans" | "usePlanChanges">;
  tactics: OpenTactics;
  edits: ReturnType<typeof useLineupEdits>;
  /** The two instructions in force. */
  instructions: InstructionPair;
  /** The preset the eleven stand in, by name; none while on a classic. */
  inUse: string | null;
  rules: MoveRules;
  ratingsOf: RatingsOf;
  putDown(): void;
}) {
  const { draft } = edits;
  /** The pitch reshaped to a preset, or a plan loaded on its own pair (spec/05; #990): an instruction
   *  the new shape offers stays, one it blocks switches to its default. */
  const reshapeTo = (preset: { name: string; cells: readonly Cell[] }, next: EditedLineup, said: string | null = null) => {
    putDown();
    const { pair, switched } = keptOrSwitched(next.instructions ?? instructions, preset.cells, tactics.presets, tactics.instructions);
    edits.reshape(preset.name, { ...next, instructions: pair }, switchedWords(switched), said);
  };
  /** A preset picked reshapes the pitch, keeping the players (spec/05; Craig, 26 Oct 2026). */
  const pickPreset = (name: string) => {
    const preset = tactics.presets.find((each) => each.name === name);
    if (preset !== undefined) reshapeTo(preset, reshaped(draft, preset.cells, rules, ratingsOf));
  };
  /** A classic picked sets its shape, every slot's role and its instructions (spec/05; #991). */
  const pickClassic = (name: string) => {
    const classic = tactics.classics.find((each) => each.name === name);
    if (classic === undefined) return;
    putDown();
    edits.reshape(name, onClassic(draft, classic, rules, ratingsOf), null);
  };
  /** One side's team instruction picked (spec/05, Team instructions). */
  const pickInstruction = (side: Side, key: string) => {
    putDown();
    edits.edit(withInstruction(draft, instructions, side, key));
  };
  const plans = useSavedPlans({ leagueId, seam, draft, instructions, presets: tactics.presets, inUse, rules, ratingsOf, onLoad: reshapeTo });
  return { pickPreset, pickClassic, pickInstruction, plans };
}
