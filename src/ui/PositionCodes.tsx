import type { Position } from "../../convex/positions/positionTables";
import { listSeparator, POSITION_NAMES } from "../shared/words";

// A player's positions as every screen writes them: short codes, each named in full on hover.

/** A position's code, its name on hover. */
export function PositionCode({ position }: { position: Position }) {
  return (
    <abbr title={POSITION_NAMES[position]} className="no-underline">
      {position}
    </abbr>
  );
}

/** His positions in a line: "CDM, CM". `spaced` sets them side by side as a table's chips are
 *  (the Squad tab), a gap drawn between them and a space for screen readers. */
export function PositionCodes({ positions, spaced = false }: { positions: readonly Position[]; spaced?: boolean }) {
  const codes = positions.map((position, index) => (
    <span key={position}>
      {index > 0 && (spaced ? " " : listSeparator)}
      <PositionCode position={position} />
    </span>
  ));
  return spaced ? <span className="flex gap-1">{codes}</span> : codes;
}
