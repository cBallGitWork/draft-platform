import { Choice } from "../../ui/Choice";
import { Problem, Status } from "../../ui/Panel";
import { Placeholder } from "../../ui/Placeholder";
import { TickBox } from "../../ui/TickBox";
import { nextGlyph } from "../../shared/words";
import type { OpenTactics } from "./seam";
import {
  allFormationsWords,
  presetLabel,
  presetsPlaceholder,
  presetsWords,
  quickPickPlaceholder,
  runsWords,
  savedWords,
  savePresetPlaceholder,
  teamTacticPlaceholder,
  teamTacticWords,
  toolbarLabel,
  undoWords,
} from "./words";

// The Tactics tab's controls (#14; spec/05; the approved Tactics picture): the toolbar over the
// pitch and the table, with the Formation keys, All formations, Team tactic, Presets, Undo and Quick
// Pick, and what the last save said; and the desk's switch for the roles' runs. The lineup they
// change is kept in ./TacticsPage.tsx.

/** How many of the league's presets the Formation keys show, in its order: the rest are in the
 *  formation window (the approved picture draws five). */
export const FORMATION_KEYS = 5;

/** The keys' radio group's name. */
const FORMATION_KEYS_NAME = "formation";

/** The presets the Formation keys show: the league's first, and the one in use where it is not one
 *  of them, so the shape the eleven stand in is always pressed in. */
export function keyedPresets(presets: OpenTactics["presets"], inUse: string | null): string[] {
  const first = presets.slice(0, FORMATION_KEYS).map(({ name }) => name);
  return inUse === null || first.includes(inUse) ? first : [...first, inUse];
}

/** The toolbar, with the line the last save left under it: its gameweek, or the refusal in the
 *  server's words, read where the move was made, even on a phone. Data and features not held yet
 *  (Team tactic, saved presets, Quick Pick) show as placeholders in their places (plate.md, Marks). */
export function TacticsToolbar({
  presets,
  inUse,
  onPreset,
  windowOpen,
  onAllFormations,
  canUndo,
  onUndo,
  savedFrom,
  problem,
}: {
  presets: OpenTactics["presets"];
  inUse: string | null;
  onPreset: (name: string) => void;
  windowOpen: boolean;
  onAllFormations: () => void;
  canUndo: boolean;
  onUndo: () => void;
  savedFrom: number | null;
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
        <span className="flex max-w-full flex-wrap items-center gap-3">
          <span className="text-soft">{teamTacticWords}</span>
          <Placeholder label={teamTacticPlaceholder} className="h-9 w-36" />
        </span>
        <span className="flex max-w-full flex-wrap items-center gap-3">
          <span className="text-soft">{presetsWords}</span>
          <Placeholder label={presetsPlaceholder} className="h-9 w-64 max-w-full" />
          <Placeholder label={savePresetPlaceholder} className="h-9 w-24" />
        </span>
        <span className="ml-auto flex gap-2">
          <button type="button" disabled={!canUndo} onClick={onUndo} className={canUndo ? "secondary-action" : "action-idle"}>
            {undoWords}
          </button>
          <Placeholder label={quickPickPlaceholder} className="h-11 w-24" />
        </span>
      </div>
      <Status words={savedFrom === null ? null : savedWords(savedFrom)} className="px-3 pb-2" />
      <Problem problem={problem} />
    </div>
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
