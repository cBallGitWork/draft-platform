import { FPL_DEADLINE_RULE } from "./deadline";
import type { LeagueRules } from "./leagueRulesShape";
import { AREAS, type Area } from "./pitch";
import { DEFAULT_PRESETS } from "./presets";

// PLACEHOLDER, for Craig to edit before the beta. The first rules a deployment gives a new league
// (spec/14, The first scoring set; #25), used once: the first league created copies them into
// the admin's default rules row (`defaultLeagueRules`), and every league after copies that row,
// which the admin edits with leagueRules.setDefaults. No league reads this file.
//
// Only the presets, the deadline and the double-gameweek rule are the spec's own (spec/05, spec/03).
// The Tim Hortons Pro League's scoring values are not in this repo, so every scoring value is 0
// for Craig to fill from them: its categories are FPL's stat names as #27 stores them, and which
// shape each takes is a guess too. The rest is a guess marked where it stands. Roles (spec/05)
// are not here: their shape is #10's.

function everyArea<Value>(value: Value): Record<Area, Value> {
  return Object.fromEntries(AREAS.map((area) => [area, value])) as Record<Area, Value>;
}

/** Placeholder: 0 a time in every area, for Craig to set. */
const unpriced = (stat: string) => ({ shape: "perAction" as const, stat, byArea: everyArea(0) });

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
  tieBreaks: ["pointsFor"], // guess
  waivers: { runs: [{ day: "tuesday", hour: 23, minute: 0 }], order: "reverseStandings" }, // guess
  scoring: {
    rules: [
      { shape: "bands", stat: "minutes", stack: false, byArea: everyArea([]) },
      ...[
        "goals_scored",
        "assists",
        "clean_sheets",
        "goals_conceded",
        "saves",
        "penalties_saved",
        "penalties_missed",
        "yellow_cards",
        "red_cards",
        "own_goals",
      ].map(unpriced),
    ],
  },
};
