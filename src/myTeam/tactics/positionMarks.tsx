import { playsCell, positionOfSlot, type Cell } from "../../../convex/lineup/pitch";
import type { Position } from "../../../convex/positions/positionTables";
import type { SquadMember } from "./lineupDraft";
import { flaggedMarkLabel, outOfPositionMarkLabel } from "./words";

// A player's positions at stake (#23; spec/06, When positions change; Craig, 6 Nov 2026), marked
// after his name on My team's Tactics and Squad tabs: flagged by a run of starts elsewhere, or out
// of position, standing in a slot of the lineup the next save is for that his positions no longer
// play. Losing a position never moves him (spec/06), so only the mark says so.

export type PositionMark = { kind: "outOfPosition"; position: Position } | { kind: "flagged"; position: Position; startsElsewhere: number };

/** His marks, out of position first: `cell` is the slot he stands in, null on the bench. One the
 *  football sync doesn't hold has no positions to judge, so none. */
export function positionMarksOf(member: Pick<SquadMember, "positions" | "flagged" | "unheld">, cell: Cell | null): PositionMark[] {
  if (member.unheld) return [];
  const out: PositionMark[] = cell !== null && !playsCell(member.positions, cell) ? [{ kind: "outOfPosition", position: positionOfSlot(cell) }] : [];
  return [...out, ...member.flagged.map(({ position, startsElsewhere }) => ({ kind: "flagged" as const, position, startsElsewhere }))];
}

const labelOf = (mark: PositionMark) => (mark.kind === "flagged" ? flaggedMarkLabel(mark.position, mark.startsElsewhere) : outOfPositionMarkLabel(mark.position));

/** Each mark as a square solid chip in the event colour reading the position at stake, the size of
 *  a position chip (plate.md, Marks), named on hover and for screen readers. */
export function PositionMarks({ marks }: { marks: readonly PositionMark[] }) {
  return marks.map((mark) => (
    <span key={`${mark.kind} ${mark.position}`} title={labelOf(mark)} className="ml-1 inline-block min-w-chip bg-event px-1 text-center font-bold text-ground">
      <span aria-hidden="true">{mark.position}</span>
      <span className="sr-only">{labelOf(mark)}</span>
    </span>
  ));
}
