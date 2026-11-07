import type { ReactNode } from "react";
import { LANES, positionOfSlot, sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { Placeholder } from "../../../ui/Placeholder";
import { chipFillOf } from "../../../ui/PositionChip";
import { CELL_GRID } from "../pitch/Pitch";
import { ROWS_DRAWN } from "../pitch/rowLayout";
import type { Shape } from "./formationGroups";
import { descriptionPlaceholder, inUseWords, subtitlePlaceholder } from "./words";

// A formation's tile in the formation window (the approved formation window): its thumbnail, its
// name with the formation's tag on the right, a subtitle and a description, and In use. A plain
// formation's subtitle and description wait on Craig's words (to-grill: Formation descriptions), so
// each shows as its placeholder (plate.md, Marks); a classic's are its own, sample until Craig
// rewrites them (#991).

/** Each cell of the pitch as it is drawn, attack first, for a formation's thumbnail and preview. */
export const cellsDrawn = (each: (cell: Cell) => ReactNode) => ROWS_DRAWN.flatMap((area) => LANES.map((lane) => each({ area, lane })));

/** A classic's words on its tile and preview: the formation it stands in, its season and manager,
 *  and what it did (classics.ts). */
export type ClassicWords = { tag: string; subtitle: string; description: string };

/** `words` is a classic's; a plain formation's are placeholders, its tag its own name. */
export function FormationTile({ shape, words, checked, inUse, onPick }: { shape: Shape; words?: ClassicWords; checked: boolean; inUse: boolean; onPick(): void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-label={shape.name}
      aria-checked={checked}
      onClick={onPick}
      className="grid min-h-tile grid-cols-dated-row items-start gap-3 p-2 text-left shadow-bevel-panel aria-checked:bg-plate aria-checked:outline-2 aria-checked:outline-derived"
    >
      <span aria-hidden="true" style={CELL_GRID} className="grid h-18 w-12 border border-pitch-line bg-pitch-stripe">
        {cellsDrawn((cell) => (
          <span key={`${cell.area}-${cell.lane}`} className="flex items-center justify-center">
            {shape.cells.some((each) => sameCell(each, cell)) && <span className={`size-1.5 ${chipFillOf(positionOfSlot(cell))}`} />}
          </span>
        ))}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="text-tile font-semibold">{shape.name}</span>
          <span className="ml-auto font-semibold text-derived">{words?.tag ?? shape.name}</span>
        </span>
        {words === undefined ? (
          <>
            <Placeholder label={subtitlePlaceholder(shape.name)} className="h-4 w-24" />
            <Placeholder label={descriptionPlaceholder(shape.name)} className="h-8 w-full" />
          </>
        ) : (
          <>
            <span>{words.subtitle}</span>
            <span className="text-soft">{words.description}</span>
          </>
        )}
        {inUse && <span className="text-derived">{inUseWords}</span>}
      </span>
    </button>
  );
}
