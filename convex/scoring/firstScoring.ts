import type { Area } from "../lineup/pitch";
import type { StoredScoringSet } from "./scoringSetShape";
import {
  ASSISTS,
  CLEAN_SHEET_MINUTES,
  CLEAN_SHEETS,
  GOALS,
  GOALS_CONCEDED,
  MINUTES_STAT,
  OWN_GOALS,
  PENALTIES_MISSED,
  PENALTIES_SAVED,
  RED_CARDS,
  SAVES,
  YELLOW_CARDS,
} from "./statKeys";

// The site's first scoring set (spec/14, Who owns it, and The first scoring set; #354): what every
// league plays on until the admin first saves the site's set (siteScoring.ts), and what the
// gameweeks before that save keep. Moved here unchanged from the first rules when the scoring
// stopped being each league's.
//
// FPL's own scoring for 2025/26 without bonus points, Craig's choice to start from and tune
// (spec/14, 21 Oct 2026), and without its defensive contribution (Craig, 4 Nov 2026: "Drop it from
// scoring"), keyed on FPL's stat names as #27 stores them. FPL scores a player by his
// position and this by the area he starts in, so all three midfield areas take FPL's midfielder
// values. It scores no role (spec/05): the roles' first values came in a version of their own
// (firstRolesVersion.ts), so the gameweeks before them keep this set.

/** FPL's four positions spread over the six areas: every midfield area is FPL's midfielder. */
function fplPositions<Value>(goalkeeper: Value, defender: Value, midfielder: Value, forward: Value): Record<Area, Value> {
  return {
    goalkeeper,
    defence: defender,
    defensiveMidfield: midfielder,
    midfield: midfielder,
    attackingMidfield: midfielder,
    attack: forward,
  };
}

/** -1 for every two goals conceded, for the keeper and the defence. */
const CONCEDED = { every: 2, points: -1 };
const NOT_CONCEDED = { every: 2, points: 0 };
/** 1 for every three saves, for the keeper. */
const SAVES_VALUE = { every: 3, points: 1 };
const NO_SAVES = { every: 3, points: 0 };

export const FIRST_SCORING: StoredScoringSet = {
  rules: [
    // 1 for playing, 2 for 60 minutes or more.
    { shape: "bands", stat: MINUTES_STAT, stack: false, values: { all: [{ atLeast: 1, points: 1 }, { atLeast: CLEAN_SHEET_MINUTES, points: 2 }] } },
    { shape: "perAction", stat: GOALS, values: { byArea: fplPositions(10, 6, 5, 4) } },
    { shape: "perAction", stat: ASSISTS, values: { all: 3 } },
    // FPL counts a clean sheet only for a player on for 60 minutes or more.
    { shape: "perAction", stat: CLEAN_SHEETS, values: { byArea: fplPositions(4, 4, 1, 0) }, minMinutes: { all: CLEAN_SHEET_MINUTES } },
    { shape: "perCount", stat: GOALS_CONCEDED, values: { byArea: fplPositions(CONCEDED, CONCEDED, NOT_CONCEDED, NOT_CONCEDED) } },
    { shape: "perCount", stat: SAVES, values: { byArea: fplPositions(SAVES_VALUE, NO_SAVES, NO_SAVES, NO_SAVES) } },
    { shape: "perAction", stat: PENALTIES_SAVED, values: { all: 5 } },
    { shape: "perAction", stat: PENALTIES_MISSED, values: { all: -2 } },
    { shape: "perAction", stat: YELLOW_CARDS, values: { all: -1 } },
    { shape: "perAction", stat: RED_CARDS, values: { all: -3 } },
    { shape: "perAction", stat: OWN_GOALS, values: { all: -2 } },
  ],
  wholePointsOnly: false,
};
