// The Tactics lineup's pure tests' shared players (lineupDraft.ts): a keeper and a back in a
// two-man draft, and who plays where when a preset is picked.

import type { Position } from "../../../convex/positions/positionTables";
import type { RatingsOf } from "../../../src/myTeam/tactics/lineupDraft";

export const KEEPER = { playerCode: 1, area: "goalkeeper", lane: "centre" } as const;
export const BACK = { playerCode: 2, area: "defence", lane: "left" } as const;
export const DRAFT = { starters: [KEEPER, BACK], bench: [3, 4] };
/** No stars: everyone dropped starts on the slot's first role. */
export const NO_STARS: RatingsOf = () => [];

/** Who plays where in the preset tests: a keeper, two defenders, a striker, a wide midfielder, three
 *  holding midfielders, one also a full back and one also a number ten. */
const PRESET_POSITIONS: Record<number, Position[]> = {
  1: ["GK"], 2: ["CB"], 5: ["ST"], 6: ["WM"], 7: ["FB"], 8: ["CDM"], 9: ["FB", "CDM"], 10: ["CDM", "CAM"],
};
export const PLAYS = { positionsOf: (playerCode: number) => PRESET_POSITIONS[playerCode] ?? [] };
