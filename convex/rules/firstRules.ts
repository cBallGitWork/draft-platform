import { FPL_DEADLINE_RULE } from "../gameweeks/deadline";
import type { LeagueRules } from "./leagueRulesShape";
import { AREAS, type Area } from "../lineup/pitch";
import { DEFAULT_PRESETS } from "../lineup/presets";
import type { DrawRules, OddTeamOut } from "../table/roundRobin";

// The first rules a deployment gives a new league (#25), used once: the first league created
// copies them into the admin's default rules row (`defaultLeagueRules`), and every league after
// copies that row, which the admin edits (leagueRules.ts says how). Once that row exists, nothing
// reads this file but `drawRulesOf`, for rules saved before the odd team out and games a gameweek
// were among them. The scoring is not a league's rule but the site's (spec/14, Who owns it):
// ../scoring/firstScoring.ts holds the first set.
//
// Only the presets, the deadline, the double-gameweek rule, the odd team out and games a gameweek
// are the spec's own (spec/05, spec/03, spec/09). The rest is a guess marked where it stands,
// against docs/research/fantrax-options.md's live values where it has them.

function everyArea<Value>(value: Value): Record<Area, Value> {
  return Object.fromEntries(AREAS.map((area) => [area, value])) as Record<Area, Value>;
}

/** Craig's: with an odd number of teams, the team left over plays the league's average (spec/09). */
const FIRST_ODD_TEAM_OUT: OddTeamOut = "leagueAverage";

/** Craig's: one head-to-head game a gameweek, unless a league chooses more (spec/09). */
const FIRST_GAMES_PER_GAMEWEEK = 1;

/** How the league's round robin is drawn: the first rules' odd team out and games a gameweek, for
 *  rules saved before #33 and #130 made them rules. */
export const drawRulesOf = (rules: LeagueRules): DrawRules => ({
  oddTeamOut: rules.oddTeamOut ?? FIRST_ODD_TEAM_OUT,
  gamesPerGameweek: rules.gamesPerGameweek ?? FIRST_GAMES_PER_GAMEWEEK,
});

export const FIRST_RULES: LeagueRules = {
  format: "headToHead", // guess: the Tim Hortons league plays head-to-head matchups
  squad: {
    // guess: 14 is the Tim Hortons league's draft rounds on Fantrax, which spec/04 makes the
    // maximum; 11 is only enough to field a team. No league is made with 14: a new league's
    // maximum is the site's for its size (squadMaximums.ts).
    size: { minimum: 11, maximum: 14 },
    minimumByArea: null,
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
};
