import { describe, expect, test } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { checkLeagueRules } from "../../../convex/rules/leagueRulesCheck";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { rulesWith } from "../../support/convex/leagueRules.harness";
import { ODD_TEAM_OUTS } from "../../../convex/table/roundRobin";
import { everyArea } from "../../support/convex/scoring.example";
import { MOST_IN_SQUAD } from "../../../convex/leagues/leagueLimits";
import type { OwnStat } from "../../../convex/scoring/ownStats";

// What a league's rules are refused for on save, with the reason (#25 Done: "an invalid rule is
// refused with the reason"). Unchecked, each of these would save and then fail, or score wrong,
// in some later gameweek.

const [firstPreset] = FIRST_RULES.presets;
const limits = FIRST_RULES.areaLimits;
const FRIDAY_9_05 = { day: "friday", hour: 9, minute: 5 } as const;
const ONE_PER_3 = { every: 3, points: 1 };

/** A scoring set of one own stat, tackles won, named as `change` says. */
const scoringWithOwn = (change: Partial<Pick<OwnStat, "name" | "shortCode">>): LeagueRules["scoring"] => ({
  rules: [{ shape: "perAction", stat: "own_tackles", values: { all: 1 } }],
  wholePointsOnly: false,
  ownStats: [{ stat: "own_tackles", name: "Tackles won", shortCode: "TW+", parts: [{ stat: "won_tackle", weight: 1 }], ...change }],
});

test("the first rules are sound", () => {
  expect(() => checkLeagueRules(FIRST_RULES)).not.toThrow();
});

test("no squad limits, no club limit, no presets and no tie-breaks are all sound", () => {
  const free = rulesWith({ squad: { size: null, byArea: null, maxPerClub: null }, presets: [], tieBreaks: [] });
  expect(() => checkLeagueRules(free)).not.toThrow();
});

test.each(ODD_TEAM_OUTS)("the team left over playing %s is sound", (oddTeamOut) => {
  expect(() => checkLeagueRules(rulesWith({ oddTeamOut }))).not.toThrow();
});

test.each([1, 2, 4])("%i head-to-head games a gameweek is sound", (gamesPerGameweek) => {
  expect(() => checkLeagueRules(rulesWith({ gamesPerGameweek }))).not.toThrow();
});

describe.each<[string, Partial<LeagueRules>, string]>([
  ["no games a gameweek", { gamesPerGameweek: 0 }, "The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not 0."],
  ["half a game a gameweek", { gamesPerGameweek: 1.5 }, "The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not 1.5."],
  [
    "a squad whose minimum is above its maximum",
    { squad: { ...FIRST_RULES.squad, size: { minimum: 15, maximum: 14 } } },
    "The squad size's minimum, 15, is above its maximum, 14.",
  ],
  [
    "a squad too small to field a team",
    { squad: { ...FIRST_RULES.squad, size: { minimum: 5, maximum: 10 } } },
    "The squad's maximum, 10, can't field the 11 who start.",
  ],
  [
    "a squad size of a fraction",
    { squad: { ...FIRST_RULES.squad, size: { minimum: 11.5, maximum: 14 } } },
    "The squad size's minimum must be a whole number, 0 or more, not 11.5.",
  ],
  [
    "squad minimums by area above the squad's maximum",
    { squad: { ...FIRST_RULES.squad, byArea: { ...limits, defence: { minimum: 6, maximum: 8 }, attack: { minimum: 9, maximum: 9 } } } },
    "The squad's minimums by area add up to 16, more than its maximum size, 14.",
  ],
  [
    "a club limit of 0",
    { squad: { ...FIRST_RULES.squad, maxPerClub: 0 } },
    "The most players from one club must be a whole number, 1 or more, not 0.",
  ],
  [
    "an area whose minimum on the pitch is above its maximum",
    { areaLimits: { ...limits, attack: { minimum: 3, maximum: 2 } } },
    "On the pitch, attack's minimum, 3, is above its maximum, 2.",
  ],
  [
    "a negative area limit",
    { areaLimits: { ...limits, midfield: { minimum: -1, maximum: 4 } } },
    "On the pitch, midfield's minimum must be a whole number, 0 or more, not -1.",
  ],
  [
    "minimums on the pitch adding up to more than eleven",
    { areaLimits: { ...limits, defence: { minimum: 6, maximum: 6 }, midfield: { minimum: 5, maximum: 5 } }, presets: [] },
    "The areas' minimums on the pitch add up to 12, more than the 11 who start.",
  ],
  [
    "maximums on the pitch adding up to fewer than eleven",
    { areaLimits: everyArea({ minimum: 0, maximum: 1 }), presets: [] },
    "The areas' maximums on the pitch add up to 6, fewer than the 11 who start.",
  ],
  [
    "a preset with no name",
    { presets: [{ ...firstPreset, name: "  " }] },
    "A preset needs a name.",
  ],
  [
    "two presets of one name, told apart only by a space",
    { presets: [firstPreset, { ...firstPreset, name: ` ${firstPreset.name}` }] },
    'Two presets are called "4-4-2".',
  ],
  [
    "a preset of ten",
    { presets: [{ ...firstPreset, cells: firstPreset.cells.slice(1) }] },
    "The preset 4-4-2 places 10 players, not the 11 who start.",
  ],
  [
    "a preset with two players in one cell",
    { presets: [{ ...firstPreset, cells: [...firstPreset.cells.slice(0, 10), firstPreset.cells[1]] }] },
    "The preset 4-4-2 puts two players in defence left.",
  ],
  [
    "a preset the league's own area limits forbid",
    { areaLimits: { ...limits, attack: { minimum: 0, maximum: 1 } } },
    "The preset 4-4-2 puts 2 in attack, outside its limits of 0 to 1.",
  ],
  [
    "a deadline after the first kickoff",
    { deadline: { minutesBeforeFirstKickoff: -30 } },
    "The deadline's minutes before the first kickoff must be a whole number, 0 or more, not -30.",
  ],
  [
    "a deadline of part of a minute",
    { deadline: { minutesBeforeFirstKickoff: 90.5 } },
    "The deadline's minutes before the first kickoff must be a whole number, 0 or more, not 90.5.",
  ],
  ["a tie-break listed twice", { tieBreaks: ["pointsFor", "headToHead", "pointsFor"] }, "The tie-break pointsFor is listed twice."],
  ["waivers that never run", { waivers: { ...FIRST_RULES.waivers, runs: [] } }, "Waivers need a time to run, once a week or more."],
  [
    "a waiver run at hour 24",
    { waivers: { ...FIRST_RULES.waivers, runs: [{ day: "monday", hour: 24, minute: 0 }] } },
    "A waiver run's hour is a whole number from 0 to 23, not 24.",
  ],
  [
    "a waiver run at minute 60",
    { waivers: { ...FIRST_RULES.waivers, runs: [{ day: "monday", hour: 9, minute: 60 }] } },
    "A waiver run's minute is a whole number from 0 to 59, not 60.",
  ],
  [
    "two waiver runs at one time",
    { waivers: { ...FIRST_RULES.waivers, runs: [FRIDAY_9_05, FRIDAY_9_05] } },
    "Waivers run on friday at 9:05 twice.",
  ],
  [
    "a scoring set missing an area's value",
    { scoring: { rules: [{ shape: "perCount", stat: "saves", values: { byArea: { ...everyArea(ONE_PER_3), attack: { every: 0, points: 1 } } } }], wholePointsOnly: false } },
    "The scoring set can't be saved: the Saves rule in attack pays for every 0 actions; it must be more than 0.",
  ],
  [
    "a squad maximum above the most any team can hold",
    { squad: { ...FIRST_RULES.squad, size: { minimum: 15, maximum: MOST_IN_SQUAD + 1 } } },
    `The squad's maximum, ${MOST_IN_SQUAD + 1}, is above the ${MOST_IN_SQUAD} players any team can hold.`,
  ],
  [
    "an own stat named as a catalogue stat is, case and spaces aside",
    { scoring: scoringWithOwn({ name: " won  TACKLE" }) },
    'The scoring set can\'t be saved: the own stat own_tackles has the name " won  TACKLE", which the catalogue\'s Won tackle has.',
  ],
  [
    "an own stat with a catalogue stat's short code, case and spaces aside",
    { scoring: scoringWithOwn({ shortCode: "a s" }) },
    'The scoring set can\'t be saved: the own stat own_tackles has the short code "a s", which the catalogue\'s Assists has.',
  ],
])("%s", (_name, change, reason) => {
  test("is refused with the reason", () => {
    expect(() => checkLeagueRules(rulesWith(change))).toThrow(new Error(reason));
  });
});

test(`a squad maximum of ${MOST_IN_SQUAD}, the most any team can hold, is sound`, () => {
  expect(() => checkLeagueRules(rulesWith({ squad: { ...FIRST_RULES.squad, size: { minimum: 15, maximum: MOST_IN_SQUAD } } }))).not.toThrow();
});

test("an own stat whose name and short code are its own is sound", () => {
  expect(() => checkLeagueRules(rulesWith({ scoring: scoringWithOwn({}) }))).not.toThrow();
});

describe("games a gameweek, in a league of so many teams (Craig, 22 Oct 2026)", () => {
  // Each against a different opponent: one fewer than the teams, or with an odd number, as many,
  // the league's average or a bye counting as one.
  test.each([
    [4, 3],
    [5, 5],
    [2, 1],
    [20, 19],
  ])("with %i teams, %i is the most", (maxTeams, most) => {
    expect(() => checkLeagueRules(rulesWith({ gamesPerGameweek: most }), maxTeams)).not.toThrow();
    expect(() => checkLeagueRules(rulesWith({ gamesPerGameweek: most + 1 }), maxTeams)).toThrow(
      new Error(`With ${maxTeams} teams, a team can play at most ${most === 1 ? "1 game" : `${most} games`} a gameweek, each against a different opponent, not ${most + 1}.`),
    );
  });

  test("the admin's defaults, for no league, aren't checked against one", () => {
    expect(() => checkLeagueRules(rulesWith({ gamesPerGameweek: 30 }))).not.toThrow();
  });
});
