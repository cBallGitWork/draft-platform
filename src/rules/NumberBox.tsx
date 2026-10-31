import { useContext, useEffect, useId, useRef, useState } from "react";
import { Problem } from "../ui/Panel";
import { BoxRefusalContext } from "./blank";

/** A box's text as a number: null when blank, NaN when it isn't a finite one ("Infinity" isn't). */
function parse(text: string): number | null {
  if (text.trim() === "") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

const show = (value: number | null) => (value === null || Number.isNaN(value) ? "" : String(value));

const same = (one: number | null, other: number | null) => one === other || (Number.isNaN(one) && Number.isNaN(other));

/** A required box hands up NaN for a blank (a box left without a number); an optional one, null
 *  (which its caller reads as "no limit"). */
type NumberBoxProps = { label: string; value: number | null; hintId?: string } & (
  | { optional?: false; onChange: (value: number) => void }
  | { optional: true; onChange: (value: number | null) => void }
);

/**
 * A box for one number of a rule, in the figure colour. It keeps what is typed, such as "-" on
 * the way to "-1", and hands up what it reads: a number, NaN while the text is none, and a blank
 * as NumberBoxProps says. It is marked invalid while it holds no number, unless it is an emptied
 * `optional` one. A new value from outside, such as a changed kind of rule, replaces the text.
 * A save refused for this box (BoxRefusalContext) is said under it while it still holds no number,
 * tied to it for screen readers; a parent that wraps puts it on a line of its own, after the row;
 * and the save bar says it once the box leaves the screen (#645). `hintId` names the caller's hint,
 * which describes the box after any refusal (#915).
 */
export function NumberBox(props: NumberBoxProps) {
  const { label, value, hintId, optional = false } = props;
  const [text, setText] = useState(show(value));
  const [shown, setShown] = useState(value);
  const id = useId();
  const refusalId = useId();
  const boxRefusal = useContext(BoxRefusalContext);
  if (!same(shown, value)) {
    setShown(value);
    setText(show(value));
  }
  function change(next: string) {
    const read = parse(next);
    setText(next);
    if (props.optional) {
      setShown(read);
      props.onChange(read);
    } else {
      const handed = read ?? NaN;
      setShown(handed);
      props.onChange(handed);
    }
  }
  const read = parse(text);
  const invalid = read === null ? !optional : Number.isNaN(read);
  const refusal = invalid && boxRefusal?.boxId === id ? boxRefusal.words : null;
  // A box leaving the screen while it says a refusal hands it back to the bar.
  const handBack = useRef<(() => void) | null>(null);
  useEffect(() => {
    handBack.current = refusal === null ? null : (boxRefusal?.gone ?? null);
  });
  useEffect(() => () => handBack.current?.(), []);
  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={[refusal === null ? undefined : refusalId, hintId].filter((id) => id !== undefined).join(" ") || undefined}
        value={text}
        onChange={(event) => change(event.target.value)}
        className="number-box"
      />
      <Problem id={refusalId} problem={refusal} className="order-last basis-full" />
    </>
  );
}
