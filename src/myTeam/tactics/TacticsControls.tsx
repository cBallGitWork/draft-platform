import { Choice } from "../../ui/Choice";
import { Problem, Status } from "../../ui/Panel";
import { TickBox } from "../../ui/TickBox";
import { nextGlyph } from "../../shared/words";
import type { OpenTactics } from "./seam";
import {
  allFormationsWords,
  presetLabel,
  presetsWords,
  quickPickWords,
  runsWords,
  savedWords,
  savePresetWords,
  SIDE_WORDS,
  instructionLabel,
  toolbarLabel,
  undoWords,
} from "./words";
import { offeredOn, SIDES, type Instruction, type InstructionPair, type Side } from "../../../convex/lineup/instructions";
import type { Cell } from "../../../convex/lineup/pitch";

// The Tactics tab's controls (#14; spec/05; the approved Tactics picture): the toolbar over the
// pitch and the table, with the Formation keys, All formations, the attacking and defensive
// instruction, Presets, Undo and Quick Pick, and what the last save and formation change said; and
// the desk's switch for the roles' runs. The lineup they change is kept in ./useLineupEdits.ts,
// called from ./LineupEditor.tsx.

/** How many of the league's presets the Formation keys show, in its order: the rest are in the
 *  formation window (the approved picture draws five). */
export const FORMATION_KEYS = 5;

/** The keys' radio group's name. */
const FORMATION_KEYS_NAME = "formation";
/** The saved plans' keys' radio group's name: none is pressed in, as loading one is a move. */
const PLAN_KEYS_NAME = "plan";

/** The presets the Formation keys show: the league's first, and the one in use where it is not one
 *  of them, so the shape the eleven stand in is always pressed in. */
export function keyedPresets(presets: OpenTactics["presets"], inUse: string | null): string[] {
  const first = presets.slice(0, FORMATION_KEYS).map(({ name }) => name);
  return inUse === null || first.includes(inUse) ? first : [...first, inUse];
}

/** The toolbar, with the line the last save left under it: when it landed, or the refusal in the
 *  server's words, read where the move was made, even on a phone. */
export function TacticsToolbar({
  presets,
  inUse,
  onPreset,
  windowOpen,
  onAllFormations,
  plans,
  onPlan,
  onSavePreset,
  canUndo,
  onUndo,
  onQuickPick,
  savedAt,
  switchedNote,
  problem,
  cells,
  instructions,
  picked,
  onInstruction,
}: {
  presets: OpenTactics["presets"];
  inUse: string | null;
  onPreset: (name: string) => void;
  /** Where the eleven stand: the shape that decides which instructions are offered. */
  cells: readonly Cell[];
  instructions: readonly Instruction[];
  picked: InstructionPair;
  onInstruction: (side: Side, key: string) => void;
  /** Which instruction the last formation change switched, in words. */
  switchedNote: string | null;
  windowOpen: boolean;
  onAllFormations: () => void;
  /** The manager's saved plans he can load now, by name. */
  plans: readonly string[];
  onPlan: (name: string) => void;
  onSavePreset: () => void;
  canUndo: boolean;
  onUndo: () => void;
  /** Fills the formation with the best eleven by stars (spec/05, Moving players). */
  onQuickPick: () => void;
  savedAt: number | null;
  problem: string | null;
}) {
  const keyed = keyedPresets(presets, inUse);
  return (
    <div className="bg-panel">
      <div role="toolbar" aria-label={toolbarLabel} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <Choice label={presetLabel} name={FORMATION_KEYS_NAME} options={keyed} words={(name) => name} chosen={inUse} onChoose={onPreset} />
        <button type="button" aria-expanded={windowOpen} onClick={onAllFormations} className="secondary-action gap-1">
          {allFormationsWords} <span aria-hidden="true">{nextGlyph}</span>
        </button>
        {SIDES.map((side) => (
          <InstructionPicker key={side} side={side} offered={offeredOn(side, cells, instructions)} picked={picked[side]} onPick={onInstruction} />
        ))}
        <span className="flex max-w-full flex-wrap items-center gap-3">
          {plans.length > 0 ? <Choice label={presetsWords} name={PLAN_KEYS_NAME} options={plans} words={(name) => name} chosen={null} onChoose={onPlan} /> : <span className="text-soft">{presetsWords}</span>}
          <button type="button" onClick={onSavePreset} className="secondary-action">
            {savePresetWords}
          </button>
        </span>
        <span className="ml-auto flex gap-2">
          <button type="button" disabled={!canUndo} onClick={onUndo} className={canUndo ? "secondary-action" : "action-idle"}>
            {undoWords}
          </button>
          <button type="button" onClick={onQuickPick} className="secondary-action">
            {quickPickWords}
          </button>
        </span>
      </div>
      <Status words={savedAt === null ? null : savedWords(savedAt)} className="px-3 pb-2" />
      <Status words={switchedNote} className="px-3 pb-2" />
      <Problem problem={problem} />
    </div>
  );
}

/** One side's team instruction: only what the formation offers (spec/05, Team instructions; Craig,
 *  6 Nov 2026, on #990). */
function InstructionPicker({ side, offered, picked, onPick }: { side: Side; offered: readonly Instruction[]; picked: string; onPick(side: Side, key: string): void }) {
  return (
    <label className="flex max-w-full items-center gap-3">
      <span className="text-soft">{SIDE_WORDS[side]}</span>
      <select aria-label={instructionLabel(side)} value={picked} onChange={(event) => onPick(side, event.target.value)} className="text-box">
        {offered.map(({ key, name }) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The desk's switch for the roles' runs; a phone shows just the tapped player's run (spec/05
 *  Runs). */
export function RunsSwitch({ shown, onChange }: { shown: boolean; onChange: (shown: boolean) => void }) {
  return (
    <div className="max-lg:hidden">
      <TickBox checked={shown} onChange={onChange}>
        {runsWords}
      </TickBox>
    </div>
  );
}
