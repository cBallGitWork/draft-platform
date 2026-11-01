import { Problem, Status } from "../../ui/Panel";
import { TickBox } from "../../ui/TickBox";
import type { OpenTactics } from "./seam";
import { pickPresetWords, presetLabel, runsWords, savedWords, undoWords } from "./words";

// The Tactics tab's controls around the pitch (#14; spec/05): Undo with what the last save said,
// the preset picker, and the desk's switch for the roles' runs. The lineup they change is kept in
// ./TacticsPage.tsx.

const PRESET_ID = "tactics-preset";

/** Undo, with the line the last save left: its gameweek, or the refusal in the server's words.
 *  Above the pitch, so a refusal is read where the move was made, even on a phone. */
export function UndoBar({ canUndo, onUndo, savedFrom, problem }: { canUndo: boolean; onUndo: () => void; savedFrom: number | null; problem: string | null }) {
  return (
    <div className="bg-panel">
      <div className="flex flex-wrap justify-end gap-2 px-3 py-2">
        <button type="button" disabled={!canUndo} onClick={onUndo} className={canUndo ? "secondary-action" : "action-idle"}>
          {undoWords}
        </button>
      </div>
      <Status words={savedFrom === null ? null : savedWords(savedFrom)} className="px-3 pb-2" />
      <Problem problem={problem} />
    </div>
  );
}

/** The preset picker. Always back on "Pick a preset", so the same one can be picked again after
 *  moves. */
export function PresetPicker({ presets, onPick }: { presets: OpenTactics["presets"]; onPick: (name: string) => void }) {
  return (
    <>
      <label htmlFor={PRESET_ID} className="text-soft">
        {presetLabel}
      </label>
      <select id={PRESET_ID} value="" onChange={(event) => onPick(event.target.value)} className="text-box">
        <option value="" disabled>
          {pickPresetWords}
        </option>
        {presets.map(({ name }) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </>
  );
}

/** The desk's switch for the roles' runs; a phone shows just the tapped player's run (spec/05
 *  Runs). */
export function RunsSwitch({ shown, onChange }: { shown: boolean; onChange: (shown: boolean) => void }) {
  return (
    <div className="ml-auto max-lg:hidden">
      <TickBox checked={shown} onChange={onChange}>
        {runsWords}
      </TickBox>
    </div>
  );
}
