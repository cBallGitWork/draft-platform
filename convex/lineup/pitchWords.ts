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

/** Each area inside a sentence, as a fan says it (Craig, 18 Nov 2026: a line names the band itself):
 *  "The league needs at least 3 in defence", "right-centre in attack", "1 in goal". */
export const AREA_IN_WORDS = Object.fromEntries(
  Object.entries(AREA_WORDS).map(([area, words]) => [area, area === "goalkeeper" ? "in goal" : `in ${words.toLowerCase()}`]),
) as Record<Area, string>;

/** The players of each area: "Fewest defenders", "vs attacking midfielders", and the attack's
 *  "forwards" (Craig, 18 Nov 2026: "Fewest forwards: 1", "Too many forwards"). */
export const AREA_PLAYER_WORDS: Record<Area, string> = {
  goalkeeper: "goalkeepers",
  defence: "defenders",
  defensiveMidfield: "defensive midfielders",
  midfield: "midfielders",
  attackingMidfield: "attacking midfielders",
  attack: "forwards",
};

/** Each area's starters counted in a sentence: "at least 3 in defence", but "at most 3 forwards",
 *  as the attack's players are forwards (Craig, 18 Nov 2026). */
export const AREA_COUNT_WORDS: Record<Area, string> = { ...AREA_IN_WORDS, attack: AREA_PLAYER_WORDS.attack };

/** The pitch's lanes, left to right. */
export const LANE_WORDS: Record<Lane, string> = {
  left: "left",
  leftCentre: "left-centre",
  centre: "centre",
  rightCentre: "right-centre",
  right: "right",
};
