import type { Result } from "../../convex/table/standings";
import { formLabel, liveFormLabel, liveResultWords, noFigureWords, resultWords } from "../shared/words";

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
        <ResultChip key={index} result={result} live={lastLive(index)} />
      ))}
    </span>
  );
}

/** One result's chip, W, D or L, named in full on its hover; `live` draws it as an outline while
 *  its gameweek may still move. Form's own, and a result's on My team's Fixtures tab. */
export function ResultChip({ result, live = false }: { result: Result; live?: boolean }) {
  return (
    <abbr title={live ? liveResultWords(result) : resultWords[result].long} className={`${CHIP} ${live ? LIVE : LOCKED}`}>
      {resultWords[result].short}
    </abbr>
  );
}
