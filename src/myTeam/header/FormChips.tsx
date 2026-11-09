import type { Result } from "../../../convex/table/standings";
import { formLabel, liveFormLabel, liveResultWords, noFigureWords, resultWords } from "./words";

const CHIP = "inline-block min-w-chip-tight text-center font-bold no-underline";
/** A result locked, solid in the figure colour; one still live, a 1px muted outline until it locks
 *  (the approved table's live picture). */
const LOCKED = "bg-figure text-ground";
const LIVE = "text-fact outline -outline-offset-1 outline-muted";

/** A team's form (plate.md, Marks: form): its last results, oldest first, each a square chip in the
 *  figure colour, the whole set named for screen readers; a dash before any result. `live` draws the
 *  last as an outline while its gameweek may still move (the table's live picture). */
export function FormChips({ form, live = false }: { form: readonly Result[]; live?: boolean }) {
  if (form.length === 0) return <span className="text-muted">{noFigureWords}</span>;
  const lastLive = (index: number) => live && index === form.length - 1;
  return (
    <span role="img" aria-label={live ? liveFormLabel(form) : formLabel(form)} className="inline-flex gap-1">
      {form.map((result, index) => (
        <abbr
          key={index}
          title={lastLive(index) ? liveResultWords(result) : resultWords[result].long}
          className={`${CHIP} ${lastLive(index) ? LIVE : LOCKED}`}
        >
          {resultWords[result].short}
        </abbr>
      ))}
    </span>
  );
}
