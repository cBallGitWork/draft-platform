/** One of a few options, butted keys with the chosen one pressed in (plate.md, Controls).
 *  `name` groups its radio inputs. */
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
          <label key={option} className="key">
            <input type="radio" name={name} className="sr-only" checked={chosen === option} onChange={() => onChoose(option)} />
            {words[option]}
          </label>
        ))}
      </span>
    </div>
  );
}
