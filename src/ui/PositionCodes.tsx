import type { Position } from "../../convex/positions/positionTables";
import { listSeparator, POSITION_NAMES } from "../shared/words";
import { chipColoursOf } from "./PositionChip";

// A player's positions as every screen writes them: short codes, each named in full on hover.

/** A position's code in its area's colour (spec/12 S12.29, S12.30): the colour itself where it
 *  reads on the panel, else its chip's fill under the chip's ink; its name on hover. */
export function PositionCode({ position }: { position: Position }) {
  const { fill, ink, text } = chipColoursOf(position);
  const colours = text ?? `px-1 ${fill} ${ink}`;
  return (
    <abbr title={POSITION_NAMES[position]} className={`no-underline ${colours}`}>
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
