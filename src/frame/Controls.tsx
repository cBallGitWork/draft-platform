import { useId, type ReactNode } from "react";

// The controls the screens share, in the Wells look (plate.md, Controls): a tick box, a row of keys
// to choose one of, and the Discard and Save pair. The words are the caller's.

/** The drawn tick (plate.md, Controls), on a 14-unit square the size of `size-tick-mark`, stroked in white with square caps. */
const TICK_VIEW_BOX = "0 0 14 14";
const TICK_PATH = "M2 7.5 L5.5 11 L12 3";
const TICK_STROKE_WIDTH = 2.5;

/** A tick box: a real checkbox drawn as a sunken well, on a 44px row that toggles it anywhere. The
 *  label is white when ticked, soft when not. */
export function TickBox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className="group flex min-h-tap cursor-pointer items-center gap-3 text-soft has-checked:text-fact">
      <span className="grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer tick-well group-hover:bg-stepper" />
        <svg viewBox={TICK_VIEW_BOX} aria-hidden className="pointer-events-none invisible size-tick-mark peer-checked:visible">
          <path d={TICK_PATH} fill="none" strokeWidth={TICK_STROKE_WIDTH} strokeLinecap="square" className="stroke-fact" />
        </svg>
      </span>
      {children}
    </label>
  );
}

/** A row of butted keys, one chosen (plate.md, Controls): a radio group named by `label`, so the
 *  arrow keys move the choice. */
export function Keys<Choice extends string>({
  label,
  choices,
  words,
  chosen,
  onChoose,
}: {
  label: string;
  choices: readonly Choice[];
  words: Record<Choice, string>;
  chosen: Choice;
  onChoose: (choice: Choice) => void;
}) {
  const labelId = useId();
  const name = useId();
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span id={labelId} className="text-soft">
        {label}
      </span>
      <span className="flex">
        {choices.map((choice) => (
          <label key={choice} className="key">
            <input type="radio" name={name} className="sr-only" checked={choice === chosen} onChange={() => onChoose(choice)} />
            {words[choice]}
          </label>
        ))}
      </span>
    </div>
  );
}

/** Discard and Save (plate.md, Controls): Discard is the secondary action, shown only when given
 *  `onDiscard`; Save is the action, or plainly bordered and disabled when there's nothing to save. */
export function DiscardSave({
  discardWords,
  saveWords,
  onDiscard,
  onSave,
  nothingToSave,
  busy,
}: {
  discardWords: string;
  saveWords: string;
  onDiscard?: () => void;
  onSave: () => void;
  nothingToSave: boolean;
  busy: boolean;
}) {
  return (
    <span className="flex grow flex-wrap justify-end gap-2">
      {onDiscard && (
        <button type="button" onClick={onDiscard} className="secondary-action">
          {discardWords}
        </button>
      )}
      <button type="button" disabled={nothingToSave || busy} onClick={onSave} className={nothingToSave ? "action-idle" : "action"}>
        {saveWords}
      </button>
    </span>
  );
}
