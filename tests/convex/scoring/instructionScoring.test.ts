import { describe, expect, test } from "vitest";
import { FIRST_INSTRUCTIONS } from "../../../convex/lineup/instructions";
import { FIRST_INSTRUCTION_SCORING } from "../../../convex/scoring/draftedInstructionScoring";
import { FIRST_ROLE_OWN_STATS } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch, type TeamScoring } from "../../../convex/scoring/scoring";
import { validateScoringSet, type ScoringSet } from "../../../convex/scoring/scoringSet";
import { TWO_AT_THE_BACK } from "../../../convex/lineup/presets";
import type { TeamPointsInput } from "../../../convex/scoring/teamPoints";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";
import { ATTACK, BELLOUMI, GELHARDT, KEEPER, LEFT_CENTRE_BACK, MIDFIELD, team } from "../../support/convex/teamPoints.harness";

// A team instruction's scoring (#990, spec/05 Team instructions): each line scored player by player
// on his own club's match, whole points for each whole `every`, only in the slots it names, as its
// own line on top of his role's; and two at the back's own clean sheet and goals conceded for its
// keeper and defence slots (Craig, 9 Nov 2026, on #990).

const WING_BACK = { area: "defensiveMidfield", lane: "left" } as const;
const WINGER = { area: "attackingMidfield", lane: "left" } as const;

const SET: ScoringSet = { ...FIRST_SCORING, ownStats: FIRST_ROLE_OWN_STATS, instructions: FIRST_INSTRUCTION_SCORING };
const picks = (...instructions: string[]): TeamScoring => ({ instructions, backLine: null });
const TWO_AT_BACK: TeamScoring = { instructions: [], backLine: { formation: "2-3-5", scoring: TWO_AT_THE_BACK } };

describe("an instruction's line", () => {
  test("Park the bus: a defender's clean sheet +1, and a goal and an assist −2, his own line on top of base", () => {
    const record = { minutes: 90, clean_sheets: 1, goals_scored: 1, assists: 1 };
    const base = scoreMatch(record, SET, LEFT_CENTRE_BACK);
    const parked = scoreMatch(record, SET, LEFT_CENTRE_BACK, undefined, picks("parkTheBus"));
    expect(parked.instructions).toEqual([
      {
        instruction: "parkTheBus",
        points: -1,
        lines: [
          { points: 1, stats: [{ stat: "clean_sheets", actions: 1 }] },
          { points: -2, stats: [{ stat: "goals_scored", actions: 1 }, { stat: "assists", actions: 1 }] },
        ],
      },
    ]);
    expect(parked.total).toBe(base.total! - 1);
    expect(parked.categories).toEqual(base.categories);
  });

  test("scores only the slots it names: a wing-back is GK/DEF, a midfielder isn't", () => {
    const record = { minutes: 90, clean_sheets: 1 };
    expect(scoreMatch(record, SET, WING_BACK, undefined, picks("parkTheBus")).instructions?.[0].points).toBe(1);
    expect(scoreMatch(record, SET, MIDFIELD, undefined, picks("parkTheBus")).instructions).toEqual([
      { instruction: "parkTheBus", points: 0, lines: [] },
    ]);
  });

  test("gives nothing below its minimum minutes: a clean sheet in 45 minutes", () => {
    expect(scoreMatch({ minutes: 45, clean_sheets: 1 }, SET, LEFT_CENTRE_BACK, undefined, picks("parkTheBus")).instructions?.[0].points).toBe(0);
  });

  test("whole points for each whole `every`, held to its most: Hold a high line's up to 3", () => {
    const high = (offsides: number) => scoreMatch({ minutes: 90, offside_provoked: offsides, interception: 1 }, SET, LEFT_CENTRE_BACK, undefined, picks("holdAHighLine"));
    expect(high(2).instructions?.[0].points).toBe(1); // 3 counted, one whole 2
    expect(high(9).instructions?.[0].points).toBe(3); // 10 counted would be 5
  });

  test("Shoot on sight: +1 a shot of any range, −1 for each 2 off target, in any slot (S05.37)", () => {
    const shooting = (cell: typeof ATTACK | typeof LEFT_CENTRE_BACK) =>
      scoreMatch({ minutes: 90, total_scoring_att: 4, shot_off_target: 3 }, SET, cell, undefined, picks("shootOnSight")).instructions?.[0];
    expect(shooting(ATTACK)).toEqual({
      instruction: "shootOnSight",
      points: 3,
      lines: [
        { points: 4, stats: [{ stat: "total_scoring_att", actions: 4 }] },
        { points: -1, stats: [{ stat: "shot_off_target", actions: 3 }] },
      ],
    });
    expect(shooting(LEFT_CENTRE_BACK)?.points).toBe(3);
  });

  test("Press high: up front, attacking midfielders too, +1 for each 2 tackles won and interceptions; −1 a foul in any slot (S05.37, S05.42)", () => {
    const pressing = (cell: typeof ATTACK | typeof MIDFIELD | typeof WINGER) =>
      scoreMatch({ minutes: 90, won_tackle: 2, interception: 3, fouls: 1 }, SET, cell, undefined, picks("pressHigh")).instructions?.[0].points;
    expect(pressing(ATTACK)).toBe(1); // 5 counted, two whole 2s, less a foul
    expect(pressing(WINGER)).toBe(1);
    expect(pressing(MIDFIELD)).toBe(-1);
  });

  test("scores his team's attacking and defensive picks apart, each a line, both in his total", () => {
    const record = { minutes: 90, accurate_cross: 2, total_cross: 2, won_tackle: 3, duel_won: 2 };
    const scored = scoreMatch(record, SET, MIDFIELD, undefined, picks("getItWide", "getStuckIn"));
    expect(scored.instructions?.map(({ instruction, points }) => [instruction, points])).toEqual([
      ["getItWide", 2],
      ["getStuckIn", 1],
    ]);
    expect(scored.total).toBe(scoreMatch(record, SET, MIDFIELD).total! + 3);
  });

  test("an instruction the set doesn't score gives no line", () => {
    const without = { ...SET, instructions: SET.instructions!.filter(({ instruction }) => instruction !== "getStuckIn") };
    expect(scoreMatch({ minutes: 90, won_tackle: 5 }, without, MIDFIELD, undefined, picks("getStuckIn")).instructions).toBeUndefined();
  });

  test("Keep it tight early: +1 for his club's clean sheet at half-time, −1 a goal let in before it, for any slot", () => {
    const tight = (record: Record<string, number>, cell: typeof MIDFIELD | typeof ATTACK | typeof KEEPER) =>
      scoreMatch({ minutes: 90, ...record }, SET, cell, undefined, picks("keepItTightEarly")).instructions?.[0];
    expect(tight({ clean_sheet_half_time: 1, goals_conceded_half_time: 0 }, ATTACK)).toEqual({
      instruction: "keepItTightEarly",
      points: 1,
      lines: [{ points: 1, stats: [{ stat: "clean_sheet_half_time", actions: 1 }] }],
    });
    expect(tight({ clean_sheet_half_time: 0, goals_conceded_half_time: 2 }, KEEPER)?.points).toBe(-2);
    // A bench man's record holds no half-time stats (plMatch.ts), so he scores nothing from it.
    expect(tight({}, MIDFIELD)).toEqual({ instruction: "keepItTightEarly", points: 0, lines: [] });
  });

  test("the first values score every instruction of the first set, and the set holding them is sound", () => {
    expect(() => validateScoringSet(SET)).not.toThrow();
    expect(FIRST_INSTRUCTION_SCORING.map(({ instruction }) => instruction)).toEqual(FIRST_INSTRUCTIONS.map(({ key }) => key));
  });
});

describe("a team's instructions", () => {
  const scored = (changes: Partial<TeamPointsInput> = {}) => team({ set: { ...EXAMPLE_SET, ownStats: FIRST_ROLE_OWN_STATS, instructions: FIRST_INSTRUCTION_SCORING }, team: picks("gungHo"), ...changes });
  const gungHo = (slot: { matches: { instructions?: unknown }[] }) => slot.matches[0].instructions;

  test("score every starter, each on his own club's match: a goal is +1 under Gung-ho", () => {
    const [, , striker] = scored().starters;
    expect(striker.playerCode).toBe(GELHARDT);
    expect(gungHo(striker)).toEqual([{ instruction: "gungHo", points: 1, lines: [{ points: 1, stats: [{ stat: "goals_scored", actions: 1 }] }] }]);
    expect(scored().total).toBe(team().total + scored().starters.reduce((total, slot) => total + slot.matches[0].instructions![0].points, 0));
  });

  test("score a bench player who comes on, never one who doesn't", () => {
    const subbed = scored({ substitutions: [{ off: GELHARDT, on: BELLOUMI, cell: ATTACK }] });
    expect(gungHo(subbed.bench[0])).toEqual([{ instruction: "gungHo", points: 1, lines: [{ points: 1, stats: [{ stat: "goals_scored", actions: 1 }] }] }]);
    expect(gungHo(scored().bench[0])).toBeUndefined();
  });
});

// A set's refusals of an unsound instruction are scoringSet.test.ts's sweep's.

describe("two at the back's back line", () => {
  const record = { minutes: 90, clean_sheets: 0, goals_conceded: 3 };

  test("costs its keeper and defenders 1 for every goal conceded, on his goals conceded line, priced by the formation", () => {
    const conceded = (cell: typeof KEEPER | typeof LEFT_CENTRE_BACK) =>
      scoreMatch(record, SET, cell, undefined, TWO_AT_BACK).categories.find((category) => category.stat === "goals_conceded");
    for (const cell of [KEEPER, LEFT_CENTRE_BACK]) {
      expect(conceded(cell)).toMatchObject({ points: -3, why: { pricedBy: { by: "formation", formation: "2-3-5" } } });
    }
    expect(scoreMatch(record, SET, LEFT_CENTRE_BACK).categories.find((category) => category.stat === "goals_conceded")?.points).toBe(-1);
  });

  test("makes a clean sheet worth 3, keeping its 60 minutes", () => {
    const sheet = (minutes: number) =>
      scoreMatch({ minutes, clean_sheets: 1 }, SET, LEFT_CENTRE_BACK, undefined, TWO_AT_BACK).categories.find((category) => category.stat === "clean_sheets")?.points;
    expect(sheet(90)).toBe(3);
    expect(sheet(45)).toBe(0);
  });

  test("leaves every other slot, and every other rule, as the set has it", () => {
    const scored = { minutes: 90, clean_sheets: 1, goals_conceded: 3, goals_scored: 1 };
    expect(scoreMatch(scored, SET, MIDFIELD, undefined, TWO_AT_BACK)).toEqual(scoreMatch(scored, SET, MIDFIELD));
    expect(scoreMatch(scored, SET, ATTACK, undefined, TWO_AT_BACK)).toEqual(scoreMatch(scored, SET, ATTACK));
    const goal = (team?: TeamScoring) => scoreMatch(scored, SET, LEFT_CENTRE_BACK, undefined, team).categories.find((category) => category.stat === "goals_scored");
    expect(goal(TWO_AT_BACK)).toEqual(goal());
  });
});
