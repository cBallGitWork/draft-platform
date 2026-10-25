import type { Area } from "../lineup/pitch";
import type { StoredScoringSet } from "../rules/leagueRulesShape";

// The site's first scoring set (spec/14, Who owns it, and The first scoring set; #354): what every
// league plays on until the admin first saves the site's set (siteScoring.ts), and what the
// gameweeks before that save keep. Moved here unchanged from the first rules when the scoring
// stopped being each league's.
//
// FPL's own scoring for 2025/26 without bonus points, Craig's choice to start from and tune
// (spec/14, 21 Oct 2026), keyed on FPL's stat names as #27 stores them. FPL scores a player by his
// position and this by the area he starts in, so all three midfield areas take FPL's midfielder
// values. Roles (spec/05) are not here: their shape is #10's.

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
const SAVES = { every: 3, points: 1 };
const NO_SAVES = { every: 3, points: 0 };

export const FIRST_SCORING: StoredScoringSet = {
  rules: [
    // 1 for playing, 2 for 60 minutes or more.
    { shape: "bands", stat: "minutes", stack: false, values: { all: [{ atLeast: 1, points: 1 }, { atLeast: 60, points: 2 }] } },
    { shape: "perAction", stat: "goals_scored", values: { byArea: fplPositions(10, 6, 5, 4) } },
    { shape: "perAction", stat: "assists", values: { all: 3 } },
    // FPL counts a clean sheet only for a player on for 60 minutes or more.
    { shape: "perAction", stat: "clean_sheets", values: { byArea: fplPositions(4, 4, 1, 0) }, minMinutes: { all: 60 } },
    { shape: "perCount", stat: "goals_conceded", values: { byArea: fplPositions(CONCEDED, CONCEDED, NOT_CONCEDED, NOT_CONCEDED) } },
    { shape: "perCount", stat: "saves", values: { byArea: fplPositions(SAVES, NO_SAVES, NO_SAVES, NO_SAVES) } },
    { shape: "perAction", stat: "penalties_saved", values: { all: 5 } },
    { shape: "perAction", stat: "penalties_missed", values: { all: -2 } },
    // 2 for 10 defensive contributions as a defender, 12 as a midfielder or forward; none for a
    // keeper, and never more than 2.
    {
      shape: "bands",
      stat: "defensive_contribution",
      stack: false,
      values: { byArea: fplPositions([], [{ atLeast: 10, points: 2 }], [{ atLeast: 12, points: 2 }], [{ atLeast: 12, points: 2 }]) },
      limit: { all: { max: 2, min: null } },
    },
    { shape: "perAction", stat: "yellow_cards", values: { all: -1 } },
    { shape: "perAction", stat: "red_cards", values: { all: -3 } },
    { shape: "perAction", stat: "own_goals", values: { all: -2 } },
  ],
  wholePointsOnly: false,
};
