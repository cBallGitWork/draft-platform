import { describe, expect, test } from "vitest";
import { codesByOpta } from "../../../convex/football/feedIds";
import { fplStatLines } from "../../../convex/football/fplLive";
import { plStatLines } from "../../../convex/football/plMatch";
import { FULL_STATS, hullEvertonReads, MATCH, recordedGw6, recordedPlFixture } from "../../support/recorded/gw6.payloads";
import { centreOf, everyArea, EXAMPLE_SET, MINUTES_BANDS } from "../../support/convex/scoring.example";
import { scoreGameweek, scoreMatch, type DoubleGameweekRule, type MatchStats } from "../../../convex/scoring/scoring";
import { AREAS, type Area, type Band, type ScoringSet } from "../../../convex/scoring/scoringSet";

// Every record is a recorded line from Hull v Everton, gameweek 6 of 2026/27.
const gw6 = recordedGw6();
const { fpl } = gw6;
const fplLines = fplStatLines(fpl.live, fpl.bootstrap.elements, fpl.fixtures);
const plReads = hullEvertonReads(gw6);
const hullEverton = recordedPlFixture(MATCH.hullEverton.pl);
const plLines = plStatLines(hullEverton, plReads, codesByOpta(fpl.bootstrap.elements)).lines;

function recordOf(lines: { playerCode: number; stats: MatchStats }[], playerCode: number): MatchStats {
  const line = lines.find((each) => each.playerCode === playerCode);
  if (line === undefined) throw new Error(`no recorded line for player ${playerCode}`);
  return line.stats;
}

/** Three more men in that match, by FPL code. FPL's lines keep every stat for all 40; `FULL_STATS`
 *  names the men whose Premier League lines do. */
const DEWSBURY_HALL = 215413; // Everton: 90 minutes, a goal, an assist, 3 FPL bonus, 10 defensive actions
const TZOLAKIS = 473284; // Hull's keeper: 4 saves, 2 conceded
const GELHARDT = 462635; // Hull: 64 minutes, a goal
const dewsburyHall = recordOf(fplLines, DEWSBURY_HALL);

describe("each area of the slot he starts in prices the same match its own way", () => {
  // Per rule, in the set's order: goals, assists, minutes, saves, goals conceded, defensive actions, yellows.
  const BY_AREA: [Area, number[], number][] = [
    ["goalkeeper", [10, 3, 2, 0, -1, 0, 0], 14],
    ["defence", [6, 3, 2, 0, -1, 2, 0], 12],
    ["defensiveMidfield", [6, 3, 2, 0, 0, 2, 0], 13],
    ["midfield", [5, 3, 2, 0, 0, 0, 0], 10],
    ["attackingMidfield", [5, 4, 2, 0, 0, 0, 0], 11],
    ["attack", [4, 3, 2, 0, 0, 0, 0], 9],
  ];

  test.each(BY_AREA)("in %s, each category and the total", (area, points, total) => {
    const scored = scoreMatch(dewsburyHall, EXAMPLE_SET, centreOf(area));

    expect(scored.categories).toEqual(EXAMPLE_SET.rules.map((rule, i) => ({ stat: rule.stat, points: points[i] })));
    expect(scored.total).toBe(total);
  });

  test("those are all six areas, back to front", () => {
    expect(BY_AREA.map(([area]) => area)).toEqual(AREAS);
  });
});

test("a per-action rule pays for each action: two goals in midfield pay 10", () => {
  const { categories } = scoreMatch({ ...dewsburyHall, goals_scored: 2 }, EXAMPLE_SET, centreOf("midfield"));
  expect(categories).toContainEqual({ stat: "goals_scored", points: 10 });
});

const tzolakis = recordOf(fplLines, TZOLAKIS);

test.each([
  [4, 1],
  [5, 1],
  [6, 2],
])("a per-count rule pays for each whole three: %i saves pay %i", (saves, points) => {
  const scored = scoreMatch({ ...tzolakis, saves }, EXAMPLE_SET, centreOf("goalkeeper"));
  expect(scored.categories).toContainEqual({ stat: "saves", points });
});

test("the recorded keeper's 4 saves, 2 conceded and full match score 2", () => {
  expect(tzolakis).toMatchObject({ saves: 4, goals_conceded: 2, minutes: 90 });
  expect(scoreMatch(tzolakis, EXAMPLE_SET, centreOf("goalkeeper")).total).toBe(2);
});

describe("a band rule", () => {
  const minutesBands = (stack: boolean, bands: Band[]): ScoringSet => ({
    rules: [{ shape: "bands", stat: "minutes", stack, values: { all: bands } }],
    wholePointsOnly: false,
  });
  const minutesPoints = (set: ScoringSet, playerCode: number) =>
    scoreMatch(recordOf(fplLines, playerCode), set, centreOf("midfield")).total;

  test.each([
    ["90 minutes", 3, 2, DEWSBURY_HALL],
    ["26 minutes off the bench", 1, 1, FULL_STATS.belloumi.code],
    ["an unused substitute's 0", 0, 0, FULL_STATS.phillips.code],
  ])("for %s pays %i when it stacks, %i when it pays only the highest band", (_what, stacked, highest, playerCode) => {
    expect(minutesPoints(minutesBands(true, MINUTES_BANDS), playerCode)).toBe(stacked);
    expect(minutesPoints(minutesBands(false, MINUTES_BANDS), playerCode)).toBe(highest);
  });

  test("paying only the highest means the highest threshold reached, in whatever order the bands are listed", () => {
    const lowerPaysMore = [
      { atLeast: 60, points: 2 },
      { atLeast: 1, points: 3 },
    ];
    expect(minutesPoints(minutesBands(false, lowerPaysMore), DEWSBURY_HALL)).toBe(2);
    expect(minutesPoints(minutesBands(false, [...MINUTES_BANDS].reverse()), DEWSBURY_HALL)).toBe(2);
  });

  test("with no bands for his area pays nothing", () => {
    expect(minutesPoints(minutesBands(true, []), DEWSBURY_HALL)).toBe(0);
  });
});

test("a record not yet arrived shows every category as \"—\" and no total, never a guess", () => {
  const scored = scoreMatch(null, EXAMPLE_SET, centreOf("midfield"));

  expect(scored.total).toBeNull();
  expect(scored.categories).toEqual(EXAMPLE_SET.rules.map((rule) => ({ stat: rule.stat, points: null })));
});

describe("once his record has arrived, a stat it leaves out is 0", () => {
  // The Premier League's lines, which leave most noughts out (docs/pl-match-stats.md).
  const PL_SET: ScoringSet = {
    rules: [
      { shape: "perAction", stat: "goals", values: { all: 5 } },
      { shape: "perAction", stat: "won_tackle", values: { all: 1 } },
    ],
    wholePointsOnly: false,
  };

  test("a right back who didn't score has 0 for goals, not \"—\"", () => {
    const coyle = recordOf(plLines, FULL_STATS.coyle.code);
    expect("goals" in coyle).toBe(false);

    expect(scoreMatch(coyle, PL_SET, centreOf("defence"))).toEqual({
      total: 1,
      categories: [
        { stat: "goals", points: 0 },
        { stat: "won_tackle", points: 1 },
      ],
    });
  });

  test("an unused substitute's near-empty record scores 0 in every category", () => {
    const phillips = recordOf(plLines, FULL_STATS.phillips.code);
    expect(phillips).toEqual({ formation_place: 0 });

    expect(scoreMatch(phillips, PL_SET, centreOf("goalkeeper")).total).toBe(0);
  });

  test("a stat named like an object's own property is left out like any other", () => {
    const set: ScoringSet = { rules: [{ shape: "perAction", stat: "constructor", values: { all: 1 } }], wholePointsOnly: false };
    expect(scoreMatch(dewsburyHall, set, centreOf("midfield")).total).toBe(0);
  });
});

test("FPL's bonus in a record scores nothing: no rule names it", () => {
  expect(dewsburyHall.bonus).toBe(3);
  const scored = scoreMatch(dewsburyHall, EXAMPLE_SET, centreOf("midfield"));

  expect(scored.total).toBe(10);
  expect(scored.categories.map((category) => category.stat)).not.toContain("bonus");
});

describe("bad data throws rather than score", () => {
  // Each way a rule itself can be bad is in scoringSet.test.ts; these are what scoreMatch adds.
  const { goalkeeper: _leftOut, ...outfieldOnly } = everyArea(5);
  const noGoalkeeperValues = {
    rules: [{ shape: "perAction", stat: "goals_scored", values: { byArea: outfieldOnly } }],
    wholePointsOnly: false,
  } as unknown as ScoringSet;

  test("a set missing one area's values is refused whatever area is scored, arrived or not", () => {
    const refusal = "the goals_scored rule has no values for goalkeeper";
    expect(() => scoreMatch(dewsburyHall, noGoalkeeperValues, centreOf("attack"))).toThrow(refusal);
    expect(() => scoreMatch(null, noGoalkeeperValues, centreOf("attack"))).toThrow(refusal);
  });

  test("a slot's area that is not one of the six", () => {
    expect(() => scoreMatch(dewsburyHall, EXAMPLE_SET, { area: "wing" as Area, lane: "centre" })).toThrow(
      '"wing" is not one of the pitch\'s six areas',
    );
  });

  test.each([
    ["NaN minutes, which a band would pay 0", { minutes: NaN }, "his record's minutes is NaN, not a number"],
    ["2 goals sent as text, which a per-action rule would coerce", { goals_scored: "2" }, 'goals_scored is "2"'],
  ])("a record with %s", (_what, stats, message) => {
    const record = { ...dewsburyHall, ...stats } as unknown as MatchStats;
    expect(() => scoreMatch(record, EXAMPLE_SET, centreOf("midfield"))).toThrow(message);
  });

  test("points too large to be a number", () => {
    expect(() => scoreMatch({ goals_scored: 1e308 }, EXAMPLE_SET, centreOf("midfield"))).toThrow(
      "the goals_scored rule gives Infinity points as CM",
    );
  });
});

describe("a double gameweek, his two matches", () => {
  // Two men's recorded lines stand in for one man's two matches: the combiner sees only their points.
  const first = scoreMatch(dewsburyHall, EXAMPLE_SET, centreOf("midfield"));
  const second = scoreMatch(recordOf(fplLines, GELHARDT), EXAMPLE_SET, centreOf("midfield"));
  const notArrived = scoreMatch(null, EXAMPLE_SET, centreOf("midfield"));

  test("both count: the two added up", () => {
    expect([first.total, second.total]).toEqual([10, 7]);
    expect(scoreGameweek([first, second], "bothMatches")).toEqual({ points: 17, provisional: false });
  });

  test("best match: only the higher-scoring, whichever came first", () => {
    expect(scoreGameweek([first, second], "bestMatch")).toEqual({ points: 10, provisional: false });
    expect(scoreGameweek([second, first], "bestMatch")).toEqual({ points: 10, provisional: false });
  });

  test.each(["bothMatches", "bestMatch"] as const)(
    "under %s, a match whose record hasn't arrived leaves the other's points, provisional",
    (rule) => {
      expect(scoreGameweek([notArrived, second], rule)).toEqual({ points: 7, provisional: true });
      expect(scoreGameweek([notArrived, notArrived], rule)).toEqual({ points: null, provisional: true });
    },
  );

  test.each(["bothMatches", "bestMatch"] as const)("under %s, one match is that match, and none is 0", (rule) => {
    expect(scoreGameweek([first], rule)).toEqual({ points: 10, provisional: false });
    expect(scoreGameweek([], rule)).toEqual({ points: 0, provisional: false });
  });

  test("a rule that is neither throws rather than add the matches up", () => {
    expect(() => scoreGameweek([first, second], "both" as DoubleGameweekRule)).toThrow(
      'a double-gameweek rule of "both" is neither both matches nor best match',
    );
  });
});
