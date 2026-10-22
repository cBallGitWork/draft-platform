import { useState } from "react";

/** A box's text as a number: null when blank, NaN when it isn't one. */
function parse(text: string): number | null {
  return text.trim() === "" ? null : Number(text);
}

const show = (value: number | null) => (value === null || Number.isNaN(value) ? "" : String(value));

const same = (one: number | null, other: number | null) => one === other || (Number.isNaN(one) && Number.isNaN(other));

/**
 * A box for one number of a rule, in the figure colour. It keeps what is typed, such as "-" on
 * the way to "-1", and hands up what it reads: a number, NaN while the text is none, or null when
 * emptied, which the caller turns into "no limit" or a box left without a number. It is marked
 * invalid while it holds no number, unless it is `optional`. A new value from outside, such as a
 * changed kind of rule, replaces the text.
 */
export function NumberBox({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  optional?: boolean;
}) {
  const [text, setText] = useState(show(value));
  const [shown, setShown] = useState(value);
  if (!same(shown, value)) {
    setShown(value);
    setText(show(value));
  }
  function change(next: string) {
    const read = parse(next);
    setText(next);
    setShown(read);
    onChange(read);
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
