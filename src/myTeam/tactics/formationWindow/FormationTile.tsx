import type { ReactNode } from "react";
import { cellKey, LANES, positionOfSlot, sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { Placeholder } from "../../../ui/Placeholder";
import { chipFillOf } from "../../../ui/PositionChip";
import type { PresetShape as Shape } from "../lineupEdits";
import { CELL_GRID } from "../pitch/Pitch";
import { ROWS_DRAWN } from "../../../ui/pitch/rowLayout";
import { descriptionPlaceholder, inUseWords, subtitlePlaceholder } from "./words";

// A formation's tile in the formation window (the approved formation window): its thumbnail, its
// name with the formation's tag on the right, a subtitle and a description, and In use. A plain
// formation's subtitle waits on Craig's words, so shows as its placeholder (plate.md, Marks), and its
// description is the site's (spec/05 S05.61), a placeholder for a preset the site doesn't list; a
// classic formation's are its own (#991). A saved plan's tile says its formation instead.

/** Each cell of the pitch as it is drawn, attack first, for a formation's thumbnail and preview. */
export const cellsDrawn = (each: (cell: Cell) => ReactNode) => ROWS_DRAWN.flatMap((area) => LANES.map((lane) => each({ area, lane })));

export function FormationTile({
  shape,
  checked,
  inUse,
  onPick,
  tag = shape.name,
  subtitle,
  description,
}: {
  shape: Shape;
  checked: boolean;
  inUse: boolean;
  onPick(): void;
  /** The formation's tag on the right: its own name unless given, the formation a saved plan or a
   *  classic formation stands in. */
  tag?: string;
  /** A saved plan's line under its name, or a classic formation's season and manager, in place of a
   *  formation's subtitle placeholder. */
  subtitle?: string;
  /** A formation's or classic formation's description, under its subtitle. */
  description?: string;
}) {
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
          <span key={cellKey(cell)} className="flex items-center justify-center">
            {shape.cells.some((each) => sameCell(each, cell)) && <span className={`size-1.5 ${chipFillOf(positionOfSlot(cell))}`} />}
          </span>
        ))}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="text-tile font-semibold">{shape.name}</span>
          <span className="ml-auto font-semibold text-derived">{tag}</span>
        </span>
        {subtitle === undefined ? (
          <>
            <Placeholder label={subtitlePlaceholder(shape.name)} className="h-4 w-24" />
            {description === undefined ? (
              <Placeholder label={descriptionPlaceholder(shape.name)} className="h-8 w-full" />
            ) : (
              <span className="text-soft">{description}</span>
            )}
          </>
        ) : description === undefined ? (
          <span className="text-soft">{subtitle}</span>
        ) : (
          <>
            <span>{subtitle}</span>
            <span className="text-soft">{description}</span>
          </>
        )}
        {inUse && <span className="text-derived">{inUseWords}</span>}
      </span>
    </button>
  );
}
