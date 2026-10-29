// The pitch's areas and lanes in words, for the screens and for the server's refusals alike
// (src/shared/words.ts passes AREA_WORDS on to the screens).

import type { Area, Lane } from "./pitch";

/** The pitch's areas, as the rules screens name them. */
export const AREA_WORDS: Record<Area, string> = {
  goalkeeper: "Goalkeeper",
  defence: "Defence",
  defensiveMidfield: "Defensive midfield",
  midfield: "Midfield",
  attackingMidfield: "Attacking midfield",
  attack: "Attack",
};

/** The pitch's lanes, left to right. */
export const LANE_WORDS: Record<Lane, string> = {
  left: "left",
  leftCentre: "left-centre",
  centre: "centre",
  rightCentre: "right-centre",
  right: "right",
};
