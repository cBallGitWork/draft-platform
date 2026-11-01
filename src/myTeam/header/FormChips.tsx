import type { Result } from "./teamStanding";
import { formLabel, noFigureWords, RESULT_WORDS } from "./words";

/** A team's form (plate.md, Marks: form): its last results, oldest first, each a square chip in the
 *  figure colour, the whole set named for screen readers; a dash before any result. */
export function FormChips({ form }: { form: readonly Result[] }) {
  if (form.length === 0) return <span className="text-muted">{noFigureWords}</span>;
  return (
    <span role="img" aria-label={formLabel(form)} className="inline-flex gap-1">
      {form.map((result, index) => (
        <abbr key={index} title={RESULT_WORDS[result]} className="inline-block min-w-chip-tight bg-figure text-center font-bold text-ground no-underline">
          {result}
        </abbr>
      ))}
    </span>
  );
}
