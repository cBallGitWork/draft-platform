import { FPL_DEADLINE_RULE } from "./deadline";
import type { LeagueRules } from "./leagueRulesShape";
import { AREAS, type Area } from "./pitch";
import { DEFAULT_PRESETS } from "./presets";
import type { DrawOptions, OddTeamOut } from "./roundRobin";

// The first rules a deployment gives a new league
// (spec/14, The first scoring set; #25), used once: the first league created copies them into
// the admin's default rules row (`defaultLeagueRules`), and every league after copies that row,
// which the admin edits (leagueRules.ts says how). Once that row exists, nothing reads this file
// but `drawRulesOf`, for rules saved before the odd team out and games a gameweek were among them.
//
// Only the presets, the deadline and the double-gameweek rule are the spec's own (spec/05, spec/03).
// The scoring is FPL's own for 2025/26 without bonus points, Craig's choice to start from and tune
// (spec/14, 21 Oct 2026), keyed on FPL's stat names as #27 stores them. FPL scores a player by his
// position and this by the area he starts in, so all three midfield areas take FPL's midfielder
// values. The rest is a guess marked where it stands, against docs/research/fantrax-options.md's
// live values where it has them. Roles (spec/05) are not here: their shape is #10's.

function everyArea<Value>(value: Value): Record<Area, Value> {
  return Object.fromEntries(AREAS.map((area) => [area, value])) as Record<Area, Value>;
}

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

/** Craig's: with an odd number of teams, the team left over plays the league's average (spec/09). */
const FIRST_ODD_TEAM_OUT: OddTeamOut = "leagueAverage";

/** Craig's: one head-to-head game a gameweek, unless a league chooses more (spec/09). */
const FIRST_GAMES_PER_GAMEWEEK = 1;

/** How the league's round robin is drawn: the first rules' odd team out and games a gameweek, for
 *  rules saved before #33 and #130 made them rules. */
export const drawRulesOf = (rules: LeagueRules): Omit<DrawOptions, "seed"> => ({
  oddTeamOut: rules.oddTeamOut ?? FIRST_ODD_TEAM_OUT,
  gamesPerGameweek: rules.gamesPerGameweek ?? FIRST_GAMES_PER_GAMEWEEK,
});

export const FIRST_RULES: LeagueRules = {
  format: "headToHead", // guess: the Tim Hortons league plays head-to-head matchups
  squad: {
    // guess: 14 is the Tim Hortons league's draft rounds on Fantrax, which spec/04 makes the
    // maximum; 11 is only enough to field a team.
    size: { minimum: 11, maximum: 14 },
    byArea: null,
    maxPerClub: null,
  },
  // guess: spec/05 sets no defaults. One goalkeeper, and room for every preset.
  areaLimits: { ...everyArea({ minimum: 0, maximum: 10 }), goalkeeper: { minimum: 1, maximum: 1 } },
  presets: DEFAULT_PRESETS.map(({ name, cells }) => ({ name, cells: cells.map((cell) => ({ ...cell })) })),
  deadline: { ...FPL_DEADLINE_RULE },
  doubleGameweek: "bothMatches",
  // guess: the doc's live tie-breaks, "none; highest seed", are a matchup's and a playoff's, not
  // the standings' these are; it has no standings value.
  tieBreaks: ["pointsFor"],
  oddTeamOut: FIRST_ODD_TEAM_OUT,
  gamesPerGameweek: FIRST_GAMES_PER_GAMEWEEK,
  // guess: the doc's live 23-hour minimum waiver period has no rule here: spec/03
  // sets only when waivers run and the order.
  waivers: { runs: [{ day: "tuesday", hour: 23, minute: 0 }], order: "reverseStandings" },
  scoring: {
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
  },
};
