import { describe, expect, test } from "vitest";
import { FULL_STATS } from "../../support/recorded/gw6.payloads";
import { DEWSBURY_HALL, fplLines, GELHARDT, plLines, recordOf, TZOLAKIS, type RecordedLine } from "../../support/convex/teamPoints.harness";
import { centreOf, everyArea, EXAMPLE_SET, MINUTES_BANDS } from "../../support/convex/scoring.example";
import { scoreGameweek, scoreMatch } from "../../../convex/scoring/scoring";
import { statIn, type DoubleGameweekRule, type MatchStats } from "../../../convex/scoring/values";
import { AREAS, type Area, type Band, type ScoringSet } from "../../../convex/scoring/scoringSet";

// Every record is a recorded line from Hull v Everton, gameweek 6 of 2026/27 (teamPoints.harness).
// FPL's lines keep every stat for all 40 men; `FULL_STATS` names the men whose Premier League
// lines do. Dewsbury-Hall's FPL line also holds 3 FPL bonus.
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

    expect(scored.categories).toMatchObject(EXAMPLE_SET.rules.map((rule, i) => ({ stat: rule.stat, points: points[i] })));
    expect(scored.total).toBe(total);
  });

  test("those are all six areas, back to front", () => {
    expect(BY_AREA.map(([area]) => area)).toEqual(AREAS);
  });
});

test("a per-action rule scores each action: two goals in midfield earn 10", () => {
  const { categories } = scoreMatch({ ...dewsburyHall, goals_scored: 2 }, EXAMPLE_SET, centreOf("midfield"));
  expect(categories).toContainEqual(expect.objectContaining({ stat: "goals_scored", points: 10 }));
});

const tzolakis = recordOf(fplLines, TZOLAKIS);

test.each([
  [4, 1],
  [5, 1],
  [6, 2],
])("a per-count rule scores each whole three: %i saves earn %i", (saves, points) => {
  const scored = scoreMatch({ ...tzolakis, saves }, EXAMPLE_SET, centreOf("goalkeeper"));
  expect(scored.categories).toContainEqual(expect.objectContaining({ stat: "saves", points }));
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
  ])("for %s earns %i when it stacks, %i when it scores only the highest band", (_what, stacked, highest, playerCode) => {
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

  test("with no bands for his area earns nothing", () => {
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
      { shape: "perAction", stat: "total_scoring_att", values: { all: 5 } },
      { shape: "perAction", stat: "won_tackle", values: { all: 1 } },
    ],
    wholePointsOnly: false,
  };

  test("a right back who didn't shoot has 0 for shots, not \"—\"", () => {
    const coyle = recordOf(plLines, FULL_STATS.coyle.code);
    expect("total_scoring_att" in coyle).toBe(false);

    expect(scoreMatch(coyle, PL_SET, centreOf("defence"))).toMatchObject({
      total: 1,
      categories: [
        { stat: "total_scoring_att", points: 0 },
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
    expect(statIn(dewsburyHall, "constructor")).toBe(0);
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
  test("a set saved before #135, with a rule on a stat no record holds, throws rather than score 0 in it", () => {
    const typo: ScoringSet = { rules: [{ shape: "perAction", stat: "goals_scroed", values: { all: 5 } }], wholePointsOnly: false };
    expect(() => scoreMatch(dewsburyHall, typo, centreOf("midfield"))).toThrow(
      'rule 1 of the scoring set scores "goals_scroed", which is neither a catalogue stat nor one of the set\'s own stats',
    );
  });

  const { goalkeeper: _leftOut, ...outfieldOnly } = everyArea(5);
  const noGoalkeeperValues = {
    rules: [{ shape: "perAction", stat: "goals_scored", values: { byArea: outfieldOnly } }],
    wholePointsOnly: false,
  } as unknown as ScoringSet;

  test("a set missing one area's values is refused whatever area is scored, arrived or not", () => {
    const refusal = "the Goals scored rule has no values for goalkeeper";
    expect(() => scoreMatch(dewsburyHall, noGoalkeeperValues, centreOf("attack"))).toThrow(refusal);
    expect(() => scoreMatch(null, noGoalkeeperValues, centreOf("attack"))).toThrow(refusal);
  });

  test("a slot's area that is not one of the six", () => {
    expect(() => scoreMatch(dewsburyHall, EXAMPLE_SET, { area: "wing" as Area, lane: "centre" })).toThrow(
      '"wing" is not one of the pitch\'s six areas',
    );
  });

  test.each([
    ["NaN minutes, which a band would score 0", { minutes: NaN }, "his record's minutes is NaN, not a number"],
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

// The whole-match golden locks the engine's arithmetic under EXAMPLE_SET, not the league's real
// rules. The named-man tests above say why a number is what it is; this says no number moved.
test("every recorded line of Hull v Everton, from both feeds, in every area, scores as the golden file", async () => {
  const scoredBy = (feed: "fpl" | "pl", lines: RecordedLine[]) =>
    [...lines]
      .sort((a, b) => a.playerCode - b.playerCode)
      .flatMap(({ playerCode, stats }) =>
        AREAS.map((area) => {
          const { total, categories } = scoreMatch(stats, EXAMPLE_SET, centreOf(area));
          // The golden holds each category's points; categoryWhy.test.ts checks their why reproduces them.
          return { feed, playerCode, area, total, categories: categories.map(({ stat, points }) => ({ stat, points })) };
        }),
      );
  const rows = [...scoredBy("fpl", fplLines), ...scoredBy("pl", plLines)];

  // One row per man per area, each on its own line, so a diff of the golden names exactly what moved.
  const scoredJson = `[\n${rows.map((row) => `  ${JSON.stringify(row)}`).join(",\n")}\n]\n`;
  await expect(scoredJson).toMatchFileSnapshot("../../support/golden/hull-everton.scores.json");
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

  test("both count: fractions add up in tenths, never drifting (#412)", () => {
    const tenth = { total: 0.1, categories: [] };
    const twoTenths = { total: 0.2, categories: [] };
    expect(scoreGameweek([tenth, twoTenths], "bothMatches")).toEqual({ points: 0.3, provisional: false });
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
