import { useId, useState, type FormEvent } from "react";
import { PLAN_NAME_MOST } from "../../../../convex/lineup/lineupWords";
import { CloseButton, Problem } from "../../../ui/Panel";
import type { Plan } from "../savedPlans";
import { FormationTile } from "./FormationTile";
import {
  cancelWords,
  deletePlanLabel,
  notAllowedWords,
  planNameLabel,
  replaceQuestion,
  replaceWords,
  savePresetLine,
  savePresetName,
  saveWords,
} from "./words";

// The formation window's Your presets (the approved formation window; spec/05, Saved plans; #992):
// the manager's saved plans, each a tile with its formation and a delete (×), and the Save preset…
// tile, which saves the formation and roles in use now by name. Saving under a name he has asks
// "Replace 'Press 4-3-3'?" first; a refusal says why under the tiles (Craig, 6 Nov 2026).

/** A plan as the window lists it: the formation it stands in, or undefined once the league no longer
 *  has it. */
export type ListedPlan = { plan: Plan; formation: string | undefined };

export function PlansGroup({
  plans,
  picked,
  inUse,
  saving: startsSaving,
  onPick,
  onSave,
  onDelete,
}: {
  plans: readonly ListedPlan[];
  picked: string | null;
  inUse: string | null;
  /** Whether the window opens with the Save preset… form open, from the toolbar's Save preset…. */
  saving: boolean;
  onPick(name: string): void;
  /** Resolves with null once saved, or with the words saying why not. */
  onSave(name: string): Promise<string | null>;
  onDelete(name: string): Promise<string | null>;
}) {
  const [saving, setSaving] = useState(startsSaving);
  const [problem, setProblem] = useState<string | null>(null);
  const answered = async (answer: Promise<string | null>) => {
    const refused = await answer;
    setProblem(refused);
    return refused === null;
  };
  return (
    <>
      {plans.map(({ plan, formation }) => (
        <div key={plan.name} className="flex">
          <span className="grid min-w-0 grow">
            <FormationTile
              shape={{ name: plan.name, cells: plan.slots }}
              checked={plan.name === picked}
              inUse={formation !== undefined && plan.name === inUse}
              onPick={() => onPick(plan.name)}
              tag={formation ?? notAllowedWords}
              subtitle={formation ?? notAllowedWords}
            />
          </span>
          <CloseButton
            label={deletePlanLabel(plan.name)}
            close={() => void answered(onDelete(plan.name))}
            className="flex items-start justify-center p-2 text-lead font-bold shadow-bevel-panel"
          />
        </div>
      ))}
      {saving ? (
        <SaveForm
          names={plans.map(({ plan }) => plan.name)}
          onSave={async (name) => {
            if (await answered(onSave(name))) setSaving(false);
          }}
          onCancel={() => {
            setSaving(false);
            setProblem(null);
          }}
        />
      ) : (
        <button type="button" onClick={() => setSaving(true)} className="min-h-tile p-2 text-left shadow-bevel-panel">
          <span className="block text-tile font-semibold">{savePresetName}</span>
          <span className="block text-soft">{savePresetLine}</span>
        </button>
      )}
      <Problem problem={problem} className="col-span-2" />
    </>
  );
}

/** The Save preset… tile opened: the name, then Save, or Replace once asked for a name he has. */
function SaveForm({ names, onSave, onCancel }: { names: readonly string[]; onSave(name: string): Promise<void>; onCancel(): void }) {
  const inputId = useId();
  const [name, setName] = useState("");
  // The name he has a plan by, once Save asks whether to replace it.
  const [replacing, setReplacing] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (replacing === null && names.includes(trimmed)) setReplacing(trimmed);
    else void onSave(trimmed);
  };
  return (
    <form onSubmit={submit} className="flex min-h-tile flex-col gap-2 p-2 shadow-bevel-panel">
      <label htmlFor={inputId} className="text-tile font-semibold">
        {planNameLabel}
      </label>
      <input
        id={inputId}
        required
        maxLength={PLAN_NAME_MOST}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setReplacing(null);
        }}
        className="text-box"
      />
      {replacing !== null && <span>{replaceQuestion(replacing)}</span>}
      <span className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="secondary-action">
          {cancelWords}
        </button>
        <button type="submit" className="action">
          {replacing === null ? saveWords : replaceWords}
        </button>
      </span>
    </form>
  );
}
