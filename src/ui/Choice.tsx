/** One of a few options, butted keys with the chosen one pressed in (plate.md, Controls).
 *  `name` groups its radio inputs; `words` says each option, by a table or a function. */
export function Choice<Option extends string>({
  label,
  name,
  options,
  words,
  chosen,
  onChoose,
  labelShown = true,
}: {
  label: string;
  name: string;
  options: readonly Option[];
  words: Record<Option, string> | ((option: Option) => string);
  chosen: Option;
  onChoose: (option: Option) => void;
  /** False where what sits beside the keys already says it, such as a panel's title (the Squad
   *  tab's views): the label is then for screen readers only. */
  labelShown?: boolean;
}) {
  const labelId = `${name}-label`;
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span id={labelId} className={labelShown ? "text-soft" : "sr-only"}>
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
