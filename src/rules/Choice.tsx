/** One of a few options, butted side by side, as the rules screens choose them: the rule's kind in
 *  Player scoring, the odd team out in League settings. `name` groups its radio inputs. */
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
  words: Record<Option, string>;
  chosen: Option;
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
          <label
            key={option}
            className="flex min-h-tap cursor-pointer items-center border border-soft px-3 has-checked:border-fact has-checked:bg-plate has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-derived"
          >
            <input type="radio" name={name} className="sr-only" checked={chosen === option} onChange={() => onChoose(option)} />
            {words[option]}
          </label>
        ))}
      </span>
    </div>
  );
}
