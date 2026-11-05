import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { POSITION_NAMES } from "../shared/words";
import { everyPositionTabWords, positionTabsLabel } from "./words";

// The position tabs in the draft room's players list's title bar (the approved draft room picture):
// All, then every position in its fixed order (positionTables.ts: positions are the same in every
// league, spec/06), butted on the plate like a section's tabs (plate.md, Shape), the chosen one
// white with the cyan underline. The bar's height on the desk, the tap size on a phone.

const TAB =
  "min-h-tap border-l border-plate-rule px-3 font-semibold text-soft first:border-l-0 hover:text-fact " +
  "aria-pressed:text-fact aria-pressed:shadow-subtab-active lg:min-h-bar-control";

/** The tabs, `chosen` pressed (null for All). */
export function PositionTabs({ chosen, choose }: { chosen: Position | null; choose: (position: Position | null) => void }) {
  const tab = (position: Position | null) => (
    <button
      key={position ?? everyPositionTabWords}
      type="button"
      aria-pressed={chosen === position}
      title={position === null ? undefined : POSITION_NAMES[position]}
      onClick={() => choose(position)}
      className={TAB}
    >
      {position ?? everyPositionTabWords}
    </button>
  );
  return (
    <span role="group" aria-label={positionTabsLabel} className="flex flex-wrap">
      {tab(null)}
      {POSITIONS.map(tab)}
    </span>
  );
}
