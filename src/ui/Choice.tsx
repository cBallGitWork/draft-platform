/** One of a few options, butted keys with the chosen one pressed in (plate.md, Controls).
 *  `name` groups its radio inputs; `words` says each option, by a table or a function. */
export function Choice<Option extends string>({
  label,
  name,
  options,
  words,
  chosen,
  onChoose,
}: {
  label: string;
  name: string;
  options: readonly Option[];
  words: Record<Option, string> | ((option: Option) => string);
  /** Null where none of them is, such as a formation the eleven stand in that is no preset. */
  chosen: Option | null;
  onChoose: (option: Option) => void;
}) {
  const labelId = `${name}-label`;
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span id={labelId} className="text-soft">
        {label}
      </span>
      <span className="flex flex-wrap">
        {options.map((option) => (
          <label key={option} className="key">
            <input type="radio" name={name} className="sr-only" checked={chosen === option} onChange={() => onChoose(option)} />
            {typeof words === "function" ? words(option) : words[option]}
          </label>
        ))}
      </span>
    </div>
  );
}
