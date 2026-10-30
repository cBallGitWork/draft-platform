// The order the match page lists a match's men (#45, #580): home first, then away, then any who
// have left both; each side's starters before its substitutes; each by position, a man with none
// last; then by name. Pure, so the server's match page and the preview's (src/premierLeague/
// matchPreview.ts) sort with this one comparator and can't drift apart.

import { positionRank } from "../positions/positionTables";
import type { MatchMan } from "./matchPage";

/** What the order reads of a man. */
type SheetMan = Pick<MatchMan, "side" | "started" | "position" | "name">;

const SIDE_ORDER = { home: 0, away: 1 } as const;
const sideRank = (side: SheetMan["side"]) => (side === null ? Object.keys(SIDE_ORDER).length : SIDE_ORDER[side]);

/** Compares two men in the match page's order, for `toSorted`. */
export const bySheetOrder = (one: SheetMan, other: SheetMan) =>
  sideRank(one.side) - sideRank(other.side) ||
  Number(other.started) - Number(one.started) ||
  positionRank(one.position) - positionRank(other.position) ||
  one.name.localeCompare(other.name);
