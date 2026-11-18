import { describe, expect, test } from "vitest";
import { autoSubs } from "../../../convex/lineup/autoSubs";
import { lineupProblems, type ClassicLineup, type Lineup, type LineupMode } from "../../../convex/lineup/lineup";
import type { Line } from "../../../convex/positions/lines";
import { FIRST_RULES, lineLimitsOf } from "../../../convex/rules/firstRules";
import { checkLeagueRules } from "../../../convex/rules/leagueRulesCheck";
import { rulesWith } from "../../support/convex/leagueRules.harness";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { openLimits } from "../../support/convex/lineup.harness";
import { FIRST, SECOND, THIRD, OTHER_STRIKER, LEFT_MIDFIELDER, STRIKER, fourFourTwo, plays } from "../../support/convex/autoSubs.harness";

// Classic mode's lineup (spec/22, The lineup): no formation, cell or role, only each starter's line
// inside the league's line limits, and an auto-sub that keeps them.

/** The 4-4-2's starters by line: 1 in goal, 2–5 DEF, 6–9 CM, 10 and 11 FWD. */
const FOUR_FOUR_TWO_LINES: [number, Line][] = [
  [1, "GK"],
  ...[2, 3, 4, 5].map((code): [number, Line] => [code, "DEF"]),
  ...[6, 7, 8, 9].map((code): [number, Line] => [code, "CM"]),
  [10, "FWD"],
  [11, "FWD"],
];

/** The 4-4-2 with a bench of one player per line given, first to last, every line known. */
function classic(benchLines: Line[], changed: [number, Line][] = [], lineLimits = lineLimitsOf({})) {
  const lineup: Lineup = { ...fourFourTwo, bench: fourFourTwo.bench.slice(0, benchLines.length) };
  const lines = new Map<number, Line>([...FOUR_FOUR_TWO_LINES, ...changed, ...lineup.bench.map((code, index): [number, Line] => [code, benchLines[index]])]);
  const mode: LineupMode & ClassicLineup = { classic: true, lines, lineLimits };
  return { lineup, mode };
}

/** No positions at all: classic mode never reads them. */
const NO_POSITIONS = new Map();

const problemsOf = ({ lineup, mode }: ReturnType<typeof classic>) => lineupProblems(lineup, NO_POSITIONS, openLimits(), mode);

const subbedIn = ({ lineup, mode }: ReturnType<typeof classic>, absent: number[]) =>
  autoSubs(lineup, NO_POSITIONS, plays(lineup, absent), openLimits(), [], undefined, mode);

describe("a classic league's lineup", () => {
  test("S22.8 any eleven whose lines are inside the limits stand, with no positions, formation or role read", () => {
    expect(problemsOf(classic([]))).toEqual([]);
    // Two starters in one cell and a role a cell doesn't offer: classic has neither.
    const { lineup, mode } = classic([]);
    const sameCell = { ...lineup, starters: lineup.starters.map((starter, index) => (index === 10 ? { ...lineup.starters[9], playerCode: 11, role: "poacher" } : starter)) };
    expect(lineupProblems(sameCell, NO_POSITIONS, openLimits(), mode)).toEqual([]);
  });

  test("S22.8 still eleven, each named once, and each starter needs a line", () => {
    const { lineup, mode } = classic([]);
    const ten = { ...lineup, starters: lineup.starters.slice(0, 10) };
    expect(lineupProblems(ten, NO_POSITIONS, openLimits(), mode)).toContainEqual({ kind: "wrongStarterCount", starterCount: 10 });
    const noLine = { ...mode, lines: new Map([...mode.lines].filter(([code]) => code !== STRIKER)) };
    expect(lineupProblems(lineup, NO_POSITIONS, openLimits(), noLine)).toEqual([{ kind: "lineUnknown", playerCode: STRIKER }]);
  });

  test("S22.9 the limits start at GK exactly 1, DEF 3 to 5, CM 1 to 5, AM 0 to 4, FWD 1 to 3", () => {
    expect(lineLimitsOf(FIRST_RULES)).toEqual({
      GK: { minimum: 1, maximum: 1 },
      DEF: { minimum: 3, maximum: 5 },
      CM: { minimum: 1, maximum: 5 },
      AM: { minimum: 0, maximum: 4 },
      FWD: { minimum: 1, maximum: 3 },
    });
  });

  test("S22.9 a line above its maximum or below its minimum is refused", () => {
    // Both strikers as DEF: six at the back and none up front.
    expect(problemsOf(classic([], [[10, "DEF"], [11, "DEF"]]))).toEqual([
      { kind: "lineAboveMaximum", line: "DEF", starterCount: 6, maximum: 5 },
      { kind: "lineBelowMinimum", line: "FWD", starterCount: 0, minimum: 1 },
    ]);
    expect(problemsOf(classic([], [[1, "CM"]]))).toContainEqual({ kind: "lineBelowMinimum", line: "GK", starterCount: 0, minimum: 1 });
  });

  test("S22.9 the limits are a league rule the commissioner can change, checked when saved", () => {
    const sixAtTheBack = { ...lineLimitsOf({}), DEF: { minimum: 3, maximum: 6 }, FWD: { minimum: 0, maximum: 3 } };
    expect(problemsOf(classic([], [[10, "DEF"], [11, "DEF"]], sixAtTheBack))).toEqual([]);

    expect(() => checkLeagueRules(rulesWith({ lineLimits: sixAtTheBack }), PL_GAMEWEEKS)).not.toThrow();
    expect(() => checkLeagueRules(rulesWith({ lineLimits: { ...sixAtTheBack, DEF: { minimum: 10, maximum: 10 } } }), PL_GAMEWEEKS)).toThrow(
      "The lines' minimums on the pitch add up to 12, more than the 11 who start.",
    );
    expect(() => checkLeagueRules(rulesWith({ lineLimits: { ...sixAtTheBack, AM: { minimum: 2, maximum: 1 } } }), PL_GAMEWEEKS)).toThrow(
      "On the pitch, AM's minimum, 2, is above its maximum, 1.",
    );
  });

  test("S22.10 the squad has no limits by line: a bench of keepers stands", () => {
    expect(problemsOf(classic(["GK", "GK", "GK", "GK"]))).toEqual([]);
  });
});

describe("a classic league's auto-subs", () => {
  test("S22.11 the first sub, in bench order, who keeps the lineup valid comes on, whatever his line", () => {
    // A CM didn't play: a second keeper would break GK's limit, so the striker behind him comes on.
    const result = subbedIn(classic(["GK", "FWD", "CM"]), [LEFT_MIDFIELDER]);
    expect(result.substitutions).toEqual([{ off: LEFT_MIDFIELDER, on: SECOND, area: "midfield", lane: "left", into: "theSlot" }]);
    expect(result.unfilled).toEqual([]);
    expect(result.lineup.bench).toEqual([FIRST, LEFT_MIDFIELDER, THIRD]);
    expect(result.carriedProblems).toEqual([]);
  });

  test("S22.11 a lone striker is replaced only by one who keeps FWD's minimum", () => {
    // 5-4-1: striker 10 plays DEF, so 11 is the only FWD; DEF would make six, CM leaves FWD empty.
    const result = subbedIn(classic(["DEF", "CM", "FWD"], [[10, "DEF"]]), [OTHER_STRIKER]);
    expect(result.substitutions.map(({ off, on }) => [off, on])).toEqual([[OTHER_STRIKER, THIRD]]);
  });

  test("S22.12 when no bench player keeps the lineup valid, the slot stays empty", () => {
    const { lineup, mode } = classic(["DEF", "GK"], [[10, "DEF"]]);
    const result = subbedIn({ lineup, mode }, [OTHER_STRIKER]);
    expect(result.substitutions).toEqual([]);
    expect(result.unfilled).toEqual([OTHER_STRIKER]);
    expect(result.lineup).toEqual(lineup);
  });

  test("S22.11 a bench player with no line can't be weighed, so it is thrown, never guessed", () => {
    const { lineup, mode } = classic(["CM"]);
    const noLine = { ...mode, lines: new Map([...mode.lines].filter(([code]) => code !== FIRST)) };
    expect(() => subbedIn({ lineup, mode: noLine }, [LEFT_MIDFIELDER])).toThrow(`Auto-subs need player ${FIRST}'s line`);
  });
});
