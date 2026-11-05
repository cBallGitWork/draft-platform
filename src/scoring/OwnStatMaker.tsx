import { useId, useState } from "react";
import { STAT_CATALOGUE } from "../../convex/scoring/statCatalogueList";
import { NumberBox } from "../rules/NumberBox";
import { Problem } from "../ui/Panel";
import type { OwnStatMade } from "./editing";
import {
  addPartWords,
  cancelWords,
  makeOwnStatWords,
  makeWords,
  ownStatNameLabel,
  ownStatProblemWords,
  ownStatShortCodeLabel,
  partStatLabel,
  partWeightLabel,
  removePartLabel,
  removePartWords,
} from "./words";

/** The catalogue by name, which an own stat's parts are chosen from (spec/14, Own stats). */
const CATALOGUE_BY_NAME = STAT_CATALOGUE.toSorted((one, other) => one.name.localeCompare(other.name));
/** A part just added: the first stat by name, counted once. */
const newPart = () => ({ stat: CATALOGUE_BY_NAME[0].stat, weight: 1 });

/** Why an own stat as typed can't be made yet, or null: what the server would refuse as no reason
 *  the admin can act on (a weight left without a number), or refuse anyway (no name). That a name
 *  or short code is a catalogue stat's the server says when the set is saved. */
export function ownStatProblem(made: OwnStatMade): string | null {
  if (made.name.trim() === "") return ownStatProblemWords.name;
  if (made.shortCode.trim() === "") return ownStatProblemWords.shortCode;
  if (made.parts.length === 0) return ownStatProblemWords.parts;
  if (made.parts.some((part) => !Number.isFinite(part.weight))) return ownStatProblemWords.weight;
  return null;
}

/** "Make a stat of your own" (spec/14, Own stats): a name, a short code, and catalogue stats each
 *  with a weight, negative ones too. `onMake` hands up the stat once it is sound to make. */
export function OwnStatMaker({ onMake }: { onMake: (made: OwnStatMade) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [parts, setParts] = useState([newPart()]);
  const [problem, setProblem] = useState<string | null>(null);
  const nameId = useId();
  const codeId = useId();

  function close() {
    setOpen(false);
    setName("");
    setShortCode("");
    setParts([newPart()]);
    setProblem(null);
  }
  function make() {
    const made = { name: name.trim(), shortCode: shortCode.trim(), parts };
    const reason = ownStatProblem(made);
    setProblem(reason);
    if (reason !== null) return;
    onMake(made);
    close();
  }
  const setPart = (index: number, changed: { stat: string; weight: number }) => setParts(parts.map((each, at) => (at === index ? changed : each)));

  if (!open) {
    return (
      <div className="px-3 pb-3">
        <button type="button" onClick={() => setOpen(true)} className="secondary-action w-full justify-center">
          {makeOwnStatWords}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-3">
      <label htmlFor={nameId}>{ownStatNameLabel}</label>
      <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} className="text-box" />
      <label htmlFor={codeId}>{ownStatShortCodeLabel}</label>
      <input id={codeId} value={shortCode} onChange={(event) => setShortCode(event.target.value)} className="text-box" />
      <ul className="flex flex-col gap-2">
        {parts.map((part, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <NumberBox label={partWeightLabel(index + 1)} value={part.weight} onChange={(weight) => setPart(index, { ...part, weight })} />
            <span>×</span>
            <select aria-label={partStatLabel(index + 1)} value={part.stat} onChange={(event) => setPart(index, { ...part, stat: event.target.value })} className="text-box min-w-0 grow">
              {CATALOGUE_BY_NAME.map((entry) => (
                <option key={entry.stat} value={entry.stat}>
                  {entry.name}
                </option>
              ))}
            </select>
            <button type="button" aria-label={removePartLabel(index + 1)} onClick={() => setParts(parts.filter((_, at) => at !== index))} className="secondary-action">
              {removePartWords}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setParts([...parts, newPart()])} className="secondary-action self-start">
        {addPartWords}
      </button>
      <Problem problem={problem} />
      <div className="flex gap-2">
        <button type="button" onClick={make} className="secondary-action">
          {makeWords}
        </button>
        <button type="button" onClick={close} className="secondary-action">
          {cancelWords}
        </button>
      </div>
    </div>
  );
}
