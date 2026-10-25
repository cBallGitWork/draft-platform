import { useState } from "react";

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
type NumberBoxProps = { label: string; value: number | null } & (
  | { optional?: false; onChange: (value: number) => void }
  | { optional: true; onChange: (value: number | null) => void }
);

/**
 * A box for one number of a rule, in the figure colour. It keeps what is typed, such as "-" on
 * the way to "-1", and hands up what it reads: a number, NaN while the text is none, and a blank
 * as NumberBoxProps says. It is marked invalid while it holds no number, unless it is an emptied
 * `optional` one. A new value from outside, such as a changed kind of rule, replaces the text.
 */
export function NumberBox(props: NumberBoxProps) {
  const { label, value, optional = false } = props;
  const [text, setText] = useState(show(value));
  const [shown, setShown] = useState(value);
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
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={(event) => change(event.target.value)}
      className="number-box"
    />
  );
}
