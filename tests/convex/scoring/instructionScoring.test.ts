import { describe, expect, test } from "vitest";
import { FIRST_INSTRUCTIONS } from "../../../convex/lineup/instructions";
import { FIRST_INSTRUCTION_SCORING } from "../../../convex/scoring/draftedInstructionScoring";
import { FIRST_ROLE_OWN_STATS } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch, type TeamScoring } from "../../../convex/scoring/scoring";
import { validateScoringSet, type InstructionScoring, type ScoringSet } from "../../../convex/scoring/scoringSet";
import { TWO_AT_THE_BACK } from "../../../convex/lineup/presets";
import { UnsoundScoring } from "../../../convex/scoring/values";

// A team instruction's scoring (#990, spec/05 Team instructions): each line scored player by player
// on his own club's match, whole points for each whole `every`, only in the slots it names, as its
// own line on top of his role's; and two at the back's own clean sheet and goals conceded for its
// keeper and defence slots (Craig, 9 Nov 2026, on #990).

const KEEPER = { area: "goalkeeper", lane: "centre" } as const;
const CENTRE_BACK = { area: "defence", lane: "leftCentre" } as const;
const WING_BACK = { area: "defensiveMidfield", lane: "left" } as const;
const MIDFIELD = { area: "midfield", lane: "centre" } as const;
const STRIKER = { area: "attack", lane: "centre" } as const;

const SET: ScoringSet = { ...FIRST_SCORING, ownStats: FIRST_ROLE_OWN_STATS, instructions: FIRST_INSTRUCTION_SCORING };
const picks = (...instructions: string[]): TeamScoring => ({ instructions, backLine: null });
const TWO_AT_BACK: TeamScoring = { instructions: [], backLine: { formation: "2-3-5", scoring: TWO_AT_THE_BACK } };

describe("an instruction's line", () => {
  test("Park the bus: a defender's clean sheet +1, and a goal and an assist −2, his own line on top of base", () => {
    const record = { minutes: 90, clean_sheets: 1, goals_scored: 1, assists: 1 };
    const base = scoreMatch(record, SET, CENTRE_BACK);
    const parked = scoreMatch(record, SET, CENTRE_BACK, undefined, picks("parkTheBus"));
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
    expect(scoreMatch({ minutes: 45, clean_sheets: 1 }, SET, CENTRE_BACK, undefined, picks("parkTheBus")).instructions?.[0].points).toBe(0);
  });

  test("whole points for each whole `every`, held to its most: Hold a high line's up to 3", () => {
    const high = (offsides: number) => scoreMatch({ minutes: 90, offside_provoked: offsides, interception: 1 }, SET, CENTRE_BACK, undefined, picks("holdAHighLine"));
    expect(high(2).instructions?.[0].points).toBe(1); // 3 counted, one whole 2
    expect(high(9).instructions?.[0].points).toBe(3); // 10 counted would be 5
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

  test("an instruction the set doesn't score gives no line: Keep it tight early waits for the half-time score", () => {
    expect(scoreMatch({ minutes: 90 }, SET, MIDFIELD, undefined, picks("keepItTightEarly")).instructions).toBeUndefined();
  });

  test("the first values score every instruction of the first set but Keep it tight early, and the set holding them is sound", () => {
    expect(() => validateScoringSet(SET)).not.toThrow();
    expect(FIRST_INSTRUCTION_SCORING.map(({ instruction }) => instruction)).toEqual(
      FIRST_INSTRUCTIONS.map(({ key }) => key).filter((key) => key !== "keepItTightEarly"),
    );
  });
});

describe("a set refuses an instruction that would score wrong", () => {
  const refused = (instruction: Partial<InstructionScoring> & Record<string, unknown>) =>
    expect(() => validateScoringSet({ ...SET, instructions: [{ instruction: "x", lines: [{ stats: [{ stat: "fouls", weight: 1 }], every: 1, points: -1 }], ...instruction }] }));
  const line = (changes: Record<string, unknown>) => ({ lines: [{ stats: [{ stat: "fouls", weight: 1 }], every: 1, points: -1, ...changes }] });

  test("one scored twice, or with no lines", () => {
    expect(() => validateScoringSet({ ...SET, instructions: [FIRST_INSTRUCTION_SCORING[0], FIRST_INSTRUCTION_SCORING[0]] })).toThrow(/scored twice/);
    refused({ lines: [] }).toThrow(UnsoundScoring);
  });

  test("a line of points that aren't whole, an every of 0, a stat nobody holds or a slot that isn't one", () => {
    refused(line({ points: 0.5 })).toThrow(/not whole points/);
    refused(line({ every: 0 })).toThrow(/not above 0/);
    refused(line({ stats: [{ stat: "nonsense", weight: 1 }] })).toThrow(/neither a catalogue stat/);
    refused(line({ positions: ["LB"] })).toThrow(/no slot's position/);
    refused(line({ most: 0 })).toThrow(/not a whole number above 0/);
  });
});

describe("two at the back's back line", () => {
  const record = { minutes: 90, clean_sheets: 0, goals_conceded: 3 };

  test("costs its keeper and defenders 1 for every goal conceded, on his goals conceded line, priced by the formation", () => {
    const conceded = (cell: typeof KEEPER | typeof CENTRE_BACK) =>
      scoreMatch(record, SET, cell, undefined, TWO_AT_BACK).categories.find((category) => category.stat === "goals_conceded");
    for (const cell of [KEEPER, CENTRE_BACK]) {
      expect(conceded(cell)).toMatchObject({ points: -3, why: { pricedBy: { by: "formation", formation: "2-3-5" } } });
    }
    expect(scoreMatch(record, SET, CENTRE_BACK).categories.find((category) => category.stat === "goals_conceded")?.points).toBe(-1);
  });

  test("makes a clean sheet worth 3, keeping its 60 minutes", () => {
    const sheet = (minutes: number) =>
      scoreMatch({ minutes, clean_sheets: 1 }, SET, CENTRE_BACK, undefined, TWO_AT_BACK).categories.find((category) => category.stat === "clean_sheets")?.points;
    expect(sheet(90)).toBe(3);
    expect(sheet(45)).toBe(0);
  });

  test("leaves every other slot, and every other rule, as the set has it", () => {
    const scored = { minutes: 90, clean_sheets: 1, goals_conceded: 3, goals_scored: 1 };
    expect(scoreMatch(scored, SET, MIDFIELD, undefined, TWO_AT_BACK)).toEqual(scoreMatch(scored, SET, MIDFIELD));
    expect(scoreMatch(scored, SET, STRIKER, undefined, TWO_AT_BACK)).toEqual(scoreMatch(scored, SET, STRIKER));
    const goal = (team?: TeamScoring) => scoreMatch(scored, SET, CENTRE_BACK, undefined, team).categories.find((category) => category.stat === "goals_scored");
    expect(goal(TWO_AT_BACK)).toEqual(goal());
  });
});
