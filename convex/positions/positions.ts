// A player's positions (#22, spec/06-positions.md): the one seam between where he started, the
// Premier League's label for him, the admin's say, and the positions he plays. The rules follow
// Craig's depth chart work (starts only, 3 to get a position, overrides win), copied as rules,
// not its engine. Pure: the same inputs always give the same positions.

import type { Infer } from "convex/values";
import { startsElsewhere, type ChangeThresholds } from "./positionChanges";
import { labelPositions, placePosition, POSITIONS, type Position } from "./positionTables";
import type { approveMode, startRecord } from "../schema";

/** How many of his newest starts count, last season's and this (spec/06). */
export const START_WINDOW = 38;
/** Starts at a position, within the window, that give it to him (spec/06). */
export const STARTS_FOR_A_POSITION = 3;

/** One match he started and where he lined up (`MatchSlot`, in plMatch.ts); a formation, line and
 *  place are null for a sheet that drew none. A substitute's appearance is never a start. */
export type Start = Infer<typeof startRecord>;

/** Where a position came from: his starts, the Premier League's label for him, or the admin. */
export type PositionSource = "starts" | "label" | "admin";

export interface HeldPosition {
  position: Position;
  source: PositionSource;
  /** False until the admin has approved it; an admin's own position always is. */
  confirmed: boolean;
  /** Flagged (spec/06, When positions change): how many of his newest starts in a row were
   *  elsewhere. Null while it isn't, as an admin's or a label's position never is. */
  flaggedElsewhere: number | null;
}

/** The admin's say on one player, kept apart from the feeds so no read overwrites it. */
export interface AdminPositions {
  /** Positions from starts he has approved. */
  approved: Position[];
  /** The Premier League label he confirmed, so it is confirmed while the label stays the same. */
  confirmedLabel: string | null;
  /** Positions he set, support striker included: each stays until he removes it. */
  set: Position[];
  /** Positions he took away: no start or label gives one back. */
  removed: Position[];
}

/** "proposals": positions from starts count once the admin approves them (spec/06, at first).
 *  "countAtOnce": they count straight away, unconfirmed until he approves them. */
export type ApproveMode = Infer<typeof approveMode>;

export interface PositionInputs {
  starts: Start[];
  /** The Premier League's `positionInfo` for him ("Left Full Back"); null when no squad names him. */
  plLabel: string | null;
  admin: AdminPositions;
  approveMode: ApproveMode;
  thresholds: ChangeThresholds;
  /** Starts from this kickoff on wait for the next gameweek to be judged for a change; null
   *  judges every start (`startsElsewhere`). */
  judgedBefore: number | null;
}

export interface PlayerPositions {
  positions: HeldPosition[];
  /** Positions his starts give that the admin has not approved: his queue (spec/15). */
  proposals: Position[];
  /** Positions his starts would give him that a run elsewhere took away (spec/06): each counted
   *  until it did. */
  removed: Position[];
  /** Formations in his window that `FORMATION_PLACES` does not know: those starts gave nothing. */
  unknownFormations: string[];
  /** His label, when `labelPositions` does not know it. */
  unknownLabel: string | null;
}

export const NO_ADMIN: AdminPositions = { approved: [], confirmedLabel: null, set: [], removed: [] };

/** The positions his newest `START_WINDOW` starts give him: each place he started at
 *  `STARTS_FOR_A_POSITION` times or more, and the formations that placed no one. */
export function positionsFromStarts(starts: Start[]): { positions: Position[]; unknownFormations: string[] } {
  const window = [...starts].sort((a, b) => b.kickoff - a.kickoff).slice(0, START_WINDOW);
  const startsAt = new Map<Position, number>();
  const unknownFormations = new Set<string>();
  for (const { formation, line, place } of window) {
    if (formation === null || line === null || place === null) continue;
    const position = placePosition(formation, line, place);
    if (position === null) unknownFormations.add(formation);
    else startsAt.set(position, (startsAt.get(position) ?? 0) + 1);
  }
  const positions = POSITIONS.filter((position) => (startsAt.get(position) ?? 0) >= STARTS_FOR_A_POSITION);
  return { positions, unknownFormations: [...unknownFormations].sort() };
}

/** His positions, each once, in `POSITIONS` order. An admin's position wins over one from starts,
 *  and starts over his label. His label counts only while no start-position does (spec/06: a new
 *  signing, too few starts anywhere, or starts the admin has not yet approved). A position from
 *  starts is flagged, then removed, by a run of starts elsewhere (positionChanges.ts). */
export function positionsOf({ starts, plLabel, admin, approveMode, thresholds, judgedBefore }: PositionInputs): PlayerPositions {
  const fromStarts = positionsFromStarts(starts);
  const kept = fromStarts.positions.filter((position) => !admin.removed.includes(position));
  const runElsewhere = new Map(kept.map((position) => [position, startsElsewhere(starts, position, judgedBefore)]));
  const isApproved = (position: Position) => admin.approved.includes(position);
  const wouldCount = (position: Position) => approveMode === "countAtOnce" || isApproved(position);
  const isRemoved = (position: Position) => runElsewhere.get(position)! >= thresholds.removeAfter;
  const standing = kept.filter((position) => !isRemoved(position));
  const counted = standing.filter(wouldCount);
  const fromLabel = plLabel === null ? [] : labelPositions(plLabel);
  const held = new Map<Position, HeldPosition>();
  const hold = (position: Position, source: PositionSource, confirmed: boolean, flaggedElsewhere: number | null = null) => {
    if (!held.has(position) && !admin.removed.includes(position)) held.set(position, { position, source, confirmed, flaggedElsewhere });
  };
  for (const position of admin.set) hold(position, "admin", true);
  for (const position of counted) {
    const run = runElsewhere.get(position)!;
    hold(position, "starts", isApproved(position), run >= thresholds.flagAfter ? run : null);
  }
  if (counted.length === 0) {
    for (const position of fromLabel ?? []) hold(position, "label", plLabel === admin.confirmedLabel);
  }
  return {
    positions: POSITIONS.flatMap((position) => held.get(position) ?? []),
    proposals: standing.filter((position) => !isApproved(position)),
    removed: kept.filter((position) => isRemoved(position) && wouldCount(position) && !admin.set.includes(position)),
    unknownFormations: fromStarts.unknownFormations,
    unknownLabel: fromLabel === null ? plLabel : null,
  };
}
