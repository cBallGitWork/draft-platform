import { describe, expect, test } from "vitest";
import type { Lineup } from "../../../convex/lineup/lineup";
import { scoreMatch } from "../../../convex/scoring/scoring";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import type { PlayerMatch } from "../../../convex/scoring/teamPoints";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";
import {
  ATTACK,
  BELLOUMI,
  DEWSBURY_HALL,
  finalMatch,
  fplRecordOf,
  GELHARDT,
  KEEPER,
  LINEUP,
  MIDFIELD,
  NOT_ARRIVED,
  PHILLIPS,
  RIGHT_BACK,
  team,
  TZOLAKIS,
  withMatches,
} from "../../support/convex/teamPoints.harness";

describe("with no substitutions, the starters count", () => {
  const scored = team();

  test("each slot's points, and the total of the starters' alone", () => {
    expect(scored.starters.map((slot) => [slot.playerCode, slot.points, slot.counts])).toEqual([
      [TZOLAKIS, 2, true],
      [DEWSBURY_HALL, 10, true],
      [GELHARDT, 6, true],
    ]);
    expect(scored.total).toBe(18);
    expect(scored.provisional).toBe(false);
  });

  test("each slot carries its match's breakdown by category, as scoreMatch gives it at his cell", () => {
    for (const [slot, cell] of [
      [scored.starters[0], KEEPER],
      [scored.starters[1], MIDFIELD],
      [scored.starters[2], ATTACK],
    ] as const) {
      expect(slot.cell).toEqual(cell);
      expect(slot.matches).toEqual([scoreMatch(fplRecordOf(slot.playerCode), EXAMPLE_SET, cell)]);
    }
  });

  test("every rule shape reaches the breakdown: per count, per action, bands paying the highest and stacking", () => {
    // The keeper: 4 saves pay 1 for each whole three, 2 conceded cost 1, 90 minutes pay the
    // highest band's 2. Dewsbury-Hall in midfield: a goal 5, an assist 3; his 10 defensive actions
    // reach no band there (12), so try him at the back, where 10 stacks to 2.
    const [keeper, midfielder] = scored.starters.map((slot) => slot.matches[0]?.categories);
    expect(keeper).toEqual(
      expect.arrayContaining([
        { stat: "saves", points: 1 },
        { stat: "goals_conceded", points: -1 },
        { stat: "minutes", points: 2 },
      ]),
    );
    expect(midfielder).toEqual(
      expect.arrayContaining([
        { stat: "goals_scored", points: 5 },
        { stat: "assists", points: 3 },
        { stat: "defensive_contribution", points: 0 },
      ]),
    );
    const atTheBack = team({
      lineup: {
        ...LINEUP,
        starters: [LINEUP.starters[0]!, { playerCode: DEWSBURY_HALL, ...RIGHT_BACK }, LINEUP.starters[2]!],
      },
    });
    expect(atTheBack.starters[1]?.matches[0]?.categories).toContainEqual({
      stat: "defensive_contribution",
      points: 2,
    });
  });

  test("a player is priced by the slot he starts in: Dewsbury-Hall's goal pays 5 in midfield, 4 up front", () => {
    const upFront = team({
      lineup: {
        ...LINEUP,
        starters: [LINEUP.starters[0]!, { playerCode: DEWSBURY_HALL, ...ATTACK }, { playerCode: GELHARDT, ...MIDFIELD }],
      },
    });
    expect(upFront.starters[1]?.points).toBe(9);
    expect(upFront.starters[1]?.matches[0]?.categories).toContainEqual({
      stat: "goals_scored",
      points: 4,
    });
  });
});

test("a cell left empty, as a stored lineup leaves one when a starter leaves the squad, scores nothing and isn't refused", () => {
  const oneLeft = team({ lineup: { ...LINEUP, starters: LINEUP.starters.filter((starter) => starter.playerCode !== GELHARDT) } });
  expect(oneLeft.starters.map((slot) => slot.playerCode)).toEqual([TZOLAKIS, DEWSBURY_HALL]);
  expect(oneLeft).toMatchObject({ total: 2 + 10, provisional: false });
});

describe("the bench: points shown, counted only if subbed on", () => {
  test("bench points show in bench order but don't count", () => {
    const scored = team();
    expect(scored.bench.map((slot) => [slot.playerCode, slot.points, slot.counts])).toEqual([
      [BELLOUMI, 6, false],
      [PHILLIPS, 0, false],
    ]);
    expect(scored.total).toBe(18);
  });

  test("a sub who came on counts at the cell he came on in, and the starter he replaced doesn't", () => {
    const scored = team({
      substitutions: [{ off: GELHARDT, on: BELLOUMI, cell: ATTACK }],
    });

    expect(scored.starters[2]).toMatchObject({
      playerCode: GELHARDT,
      counts: false,
      points: 6,
    });
    expect(scored.bench[0]).toMatchObject({
      playerCode: BELLOUMI,
      counts: true,
      cell: ATTACK,
    });
    expect(scored.bench[0]?.points).toBe(5);
    expect(scored.total).toBe(2 + 10 + 5);
  });

  test("a sub can come on in a different area when the formation changes, and is priced there", () => {
    const formationChanged = team({
      substitutions: [{ off: GELHARDT, on: BELLOUMI, cell: RIGHT_BACK }],
    });
    const belloumi = fplRecordOf(BELLOUMI);
    expect(formationChanged.bench[0]?.matches).toEqual([scoreMatch(belloumi, EXAMPLE_SET, RIGHT_BACK)]);
  });

  test("a bench player's record not yet arrived shows \"—\" but doesn't make the team provisional", () => {
    const scored = team({ matches: withMatches(PHILLIPS, [NOT_ARRIVED]) });
    expect(scored.bench[1]).toMatchObject({
      points: null,
      provisional: true,
      counts: false,
    });
    expect(scored.provisional).toBe(false);
  });
});

describe("a double gameweek, under the league's rule", () => {
  // Gelhardt's two matches: his own recorded line, then Dewsbury-Hall's standing in for a second.
  const double = withMatches(GELHARDT, [finalMatch(GELHARDT), finalMatch(DEWSBURY_HALL)]);

  test("both matches count: his slot adds the two, and so does the total", () => {
    const scored = team({ matches: double, doubleGameweekRule: "bothMatches" });
    expect(scored.starters[2]?.matches.map((match) => match.total)).toEqual([6, 9]);
    expect(scored.starters[2]?.points).toBe(15);
    expect(scored.total).toBe(2 + 10 + 15);
  });

  test("best match: only the higher, both still broken down", () => {
    const scored = team({ matches: double, doubleGameweekRule: "bestMatch" });
    expect(scored.starters[2]?.matches).toHaveLength(2);
    expect(scored.starters[2]?.points).toBe(9);
    expect(scored.total).toBe(2 + 10 + 9);
  });

  test.each(["bothMatches", "bestMatch"] as const)(
    "under %s, a second match not yet arrived leaves the first's points, provisional",
    (rule) => {
      const scored = team({
        matches: withMatches(GELHARDT, [finalMatch(GELHARDT), NOT_ARRIVED]),
        doubleGameweekRule: rule,
      });
      expect(scored.starters[2]).toMatchObject({
        points: 6,
        provisional: true,
      });
      expect(scored.provisional).toBe(true);
    },
  );

  test("a blank gameweek, no match at all, scores 0 and is final", () => {
    const scored = team({ matches: withMatches(GELHARDT, []) });
    expect(scored.starters[2]).toMatchObject({
      points: 0,
      provisional: false,
      matches: [],
    });
    expect(scored).toMatchObject({ total: 12, provisional: false });
  });
});

describe("fractions add up in tenths, never drifting", () => {
  /** A tenth of a point a minute. */
  const tenths: ScoringSet = {
    rules: [{ shape: "perAction", stat: "minutes", values: { all: 0.1 } }],
    wholePointsOnly: false,
  };
  const minutesPlayed = (minutes: number): PlayerMatch => ({ record: { minutes }, final: true });
  const threeMen: Lineup = {
    starters: [
      { playerCode: 1, ...KEEPER },
      { playerCode: 2, ...MIDFIELD },
      { playerCode: 3, ...ATTACK },
    ],
    bench: [],
  };

  test("across the team's slots", () => {
    const scored = team({
      lineup: threeMen,
      set: tenths,
      matches: new Map([1, 2, 3].map((code) => [code, [minutesPlayed(1)]])),
      benchCells: new Map(),
    });
    expect(scored.total).toBe(0.3);
  });

  test("slots of 0.3, -0.1 and -0.2 total 0, never -0 (#422)", () => {
    const withFouls: ScoringSet = { ...tenths, rules: [...tenths.rules, { shape: "perAction", stat: "fouls", values: { all: -0.1 } }] };
    const scored = team({
      lineup: threeMen,
      set: withFouls,
      matches: new Map([
        [1, [{ record: { minutes: 3 }, final: true }]],
        [2, [{ record: { fouls: 1 }, final: true }]],
        [3, [{ record: { fouls: 2 }, final: true }]],
      ]),
      benchCells: new Map(),
    });
    expect(scored.starters.map((slot) => slot.points)).toEqual([0.3, -0.1, -0.2]);
    expect(Object.is(scored.total, 0)).toBe(true);
  });

  test("in one slot's double gameweek, both matches counting (#412)", () => {
    const scored = team({ set: tenths, matches: withMatches(GELHARDT, [minutesPlayed(1), minutesPlayed(2)]) });
    expect(scored.starters[2]?.points).toBe(0.3);
  });
});

describe("a commissioner's override (#32)", () => {
  test("stands in for the match's total, which the slot and the team add up; its categories stay the record's", () => {
    const scored = team({ matches: withMatches(GELHARDT, [{ ...finalMatch(GELHARDT), override: 1.5 }]) });
    const gelhardt = scored.starters[2];

    expect(gelhardt.matches[0]).toEqual({ ...scoreMatch(fplRecordOf(GELHARDT), EXAMPLE_SET, ATTACK), total: 1.5 });
    expect(gelhardt.points).toBe(1.5);
    expect(scored.total).toBe(2 + 10 + 1.5);
  });

  test("counts only one match of a double gameweek, the other still scored from its record", () => {
    const scored = team({ matches: withMatches(GELHARDT, [finalMatch(GELHARDT), { ...finalMatch(GELHARDT), override: -2 }]) });

    expect(scored.starters[2].points).toBe(6 - 2);
  });
});
