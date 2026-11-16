// The matchup preview's men (preview.ts) and how the opponent's eleven line up. preview.ts reads the
// men themselves from My team's and Scouting's previews, each one's match from Football's (#2455),
// and his points and goals in it from his player card's (#2478).

import type { Area, Cell } from "../../convex/lineup/pitch";
import type { Position } from "../../convex/positions/positionTables";

/** A man: his code, name, club and squad number, his positions, which his card prices him at, his
 *  area and, a starter, his cell (a starter with none takes his area's next lane). He plays his
 *  club's match in Football's gameweek. */
export type Man = { code: number; name: string; clubCode: number; number: number | null; positions: readonly Position[]; area: Area; cell: Cell | null };
export type Men = { starters: Man[]; bench: Man[] };

/** The opponent's eleven's areas, in Scouting's order, a 3-4-3; the rest are his bench. */
export const THEIR_AREAS: readonly Area[] = ["goalkeeper", "defence", "defence", "defence", "midfield", "midfield", "midfield", "midfield", "attack", "attack", "attack"];
