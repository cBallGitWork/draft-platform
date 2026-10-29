import type { Position } from "../convex/positions/positionTables";
import { listSeparator, POSITION_NAMES } from "./shared/words";

// A player's positions as every screen writes them: short codes, each named in full on hover.

/** A position's code, its name on hover. */
export function PositionCode({ position }: { position: Position }) {
  return (
    <abbr title={POSITION_NAMES[position]} className="no-underline">
      {position}
    </abbr>
  );
}

/** His positions in a line: "CDM, CM". */
export function PositionCodes({ positions }: { positions: readonly Position[] }) {
  return positions.map((position, index) => (
    <span key={position}>
      {index > 0 && listSeparator}
      <PositionCode position={position} />
    </span>
  ));
}
