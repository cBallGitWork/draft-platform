import { describe, expect, test } from "vitest";
import { codesByOpta } from "./feedIds";
import { fplStatLines } from "./fplLive";
import { plStatLines } from "./plMatch";
import { FULL_STATS, MATCH, recordedGw6, recordedPlFixture } from "./recorded/gw6.payloads";
import { everyArea, EXAMPLE_SET } from "./scoring.example";
import { AREAS, scoreGameweek, scoreMatch, type Area, type Band, type MatchRecord, type ScoringSet } from "./scoring";

// Every record is a recorded line from Hull v Everton, gameweek 6 of 2026/27.
const { fpl, pl } = recordedGw6();
const fplLines = fplStatLines(fpl.live, fpl.bootstrap.elements, fpl.fixtures);
const plReads = new Map(
  pl.playerStats.filter((read) => read.fixture === MATCH.hullEverton.pl).map((read) => [read.player, read.payload]),
);
const plLines = plStatLines(recordedPlFixture(MATCH.hullEverton.pl), plReads, codesByOpta(fpl.bootstrap.elements)).lines;

function recordOf(lines: { playerCode: number; stats: MatchRecord }[], playerCode: number): MatchRecord {
  const line = lines.find((each) => each.playerCode === playerCode);
  if (line === undefined) throw new Error(`no recorded line for player ${playerCode}`);
  return line.stats;
}

/** FPL codes of men in that match beyond `FULL_STATS`, whose FPL lines are as full as anyone's. */
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
    const scored = scoreMatch(dewsburyHall, EXAMPLE_SET, area);

    expect(scored.categories).toEqual(EXAMPLE_SET.rules.map((rule, i) => ({ stat: rule.stat, points: points[i] })));
    expect(scored.total).toBe(total);
  });

  test("those are all six areas, back to front", () => {
    expect(BY_AREA.map(([area]) => area)).toEqual(AREAS);
  });
});

test("a per-action rule pays for each action: a goal and an assist", () => {
  const { categories } = scoreMatch(dewsburyHall, EXAMPLE_SET, "midfield");
  expect(categories.slice(0, 2)).toEqual([
    { stat: "goals_scored", points: 5 },
    { stat: "assists", points: 3 },
  ]);
});

test.each([
  [4, 1],
  [5, 1],
  [6, 2],
])("a per-count rule pays for each whole three: %i saves pay %i", (saves, points) => {
  const record = { ...recordOf(fplLines, TZOLAKIS), saves };
  expect(scoreMatch(record, EXAMPLE_SET, "goalkeeper").categories).toContainEqual({ stat: "saves", points });
});

test("the recorded keeper's 4 saves, 2 conceded and full match score 2", () => {
  expect(recordOf(fplLines, TZOLAKIS)).toMatchObject({ saves: 4, goals_conceded: 2, minutes: 90 });
  expect(scoreMatch(recordOf(fplLines, TZOLAKIS), EXAMPLE_SET, "goalkeeper").total).toBe(2);
});

describe("a band rule", () => {
  const minutesBands = (stack: boolean, bands: Band[]): ScoringSet => ({
    rules: [{ shape: "bands", stat: "minutes", stack, byArea: everyArea(bands) }],
  });
  const ONE_THEN_TWO = [
    { atLeast: 1, points: 1 },
    { atLeast: 60, points: 2 },
  ];
  const minutesPoints = (set: ScoringSet, playerCode: number) =>
    scoreMatch(recordOf(fplLines, playerCode), set, "midfield").total;

  test.each([
    ["90 minutes", DEWSBURY_HALL, 3, 2],
    ["26 minutes off the bench", FULL_STATS.belloumi.code, 1, 1],
    ["an unused substitute's 0", FULL_STATS.phillips.code, 0, 0],
  ])("for %s pays %i when it stacks, %i when it pays only the highest band", (_what, playerCode, stacked, highest) => {
    expect(minutesPoints(minutesBands(true, ONE_THEN_TWO), playerCode)).toBe(stacked);
    expect(minutesPoints(minutesBands(false, ONE_THEN_TWO), playerCode)).toBe(highest);
  });

  test("paying only the highest means the highest threshold reached, in whatever order the bands are listed", () => {
    const lowerPaysMore = [
      { atLeast: 60, points: 2 },
      { atLeast: 1, points: 3 },
    ];
    expect(minutesPoints(minutesBands(false, lowerPaysMore), DEWSBURY_HALL)).toBe(2);
    expect(minutesPoints(minutesBands(false, [...ONE_THEN_TWO].reverse()), DEWSBURY_HALL)).toBe(2);
  });

  test("with no bands for his area pays nothing", () => {
    expect(minutesPoints(minutesBands(true, []), DEWSBURY_HALL)).toBe(0);
  });
});

test("a record not yet arrived shows every category as \"—\" and no total, never a guess", () => {
  const scored = scoreMatch(null, EXAMPLE_SET, "midfield");

  expect(scored.total).toBeNull();
  expect(scored.categories).toEqual(EXAMPLE_SET.rules.map((rule) => ({ stat: rule.stat, points: null })));
});

describe("once his record has arrived, a stat it leaves out is 0", () => {
  // The Premier League's lines, which leave most noughts out (docs/pl-match-stats.md).
  const PL_SET: ScoringSet = {
    rules: [
      { shape: "perAction", stat: "goals", byArea: everyArea(5) },
      { shape: "perAction", stat: "won_tackle", byArea: everyArea(1) },
    ],
  };

  test("a right back who didn't score has 0 for goals, not \"—\"", () => {
    const coyle = recordOf(plLines, FULL_STATS.coyle.code);
    expect("goals" in coyle).toBe(false);

    expect(scoreMatch(coyle, PL_SET, "defence")).toEqual({
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

    expect(scoreMatch(phillips, PL_SET, "goalkeeper").total).toBe(0);
  });

  test("a stat named like an object's own property is left out like any other", () => {
    const set: ScoringSet = { rules: [{ shape: "perAction", stat: "constructor", byArea: everyArea(1) }] };
    expect(scoreMatch(dewsburyHall, set, "midfield").total).toBe(0);
  });
});

test("FPL's bonus in a record scores nothing: no rule names it", () => {
  expect(dewsburyHall.bonus).toBe(3);
  const scored = scoreMatch(dewsburyHall, EXAMPLE_SET, "midfield");

  expect(scored.total).toBe(10);
  expect(scored.categories.map((category) => category.stat)).not.toContain("bonus");
});

test.each([
  [
    "a per-count rule of every 0 actions",
    { shape: "perCount", stat: "saves", byArea: everyArea({ every: 0, points: 1 }) },
    "saves's rule pays per 0 actions in midfield",
  ],
  [
    "a band rule with two bands at one threshold",
    { shape: "bands", stat: "minutes", stack: false, byArea: everyArea([{ atLeast: 60, points: 1 }, { atLeast: 60, points: 2 }]) },
    "minutes's rule has two bands at one threshold in midfield",
  ],
  ["a rule of no known shape", { shape: "perMinute", stat: "minutes", byArea: everyArea(1) }, 'shape "perMinute"'],
  [
    "a rule with no value for his area",
    { shape: "perAction", stat: "goals_scored", byArea: { attack: 4 } },
    "goals_scored's rule has no values for midfield",
  ],
  [
    "a rule whose value is not a number",
    { shape: "perAction", stat: "goals_scored", byArea: everyArea("five") },
    'goals_scored\'s rule gives NaN points in midfield',
  ],
])("%s throws rather than score", (_what, rule, message) => {
  const set = { rules: [rule] } as ScoringSet;
  expect(() => scoreMatch(dewsburyHall, set, "midfield")).toThrow(message);
});

describe("a double gameweek, his two matches", () => {
  const first = scoreMatch(dewsburyHall, EXAMPLE_SET, "midfield"); // 10
  const second = scoreMatch(recordOf(fplLines, GELHARDT), EXAMPLE_SET, "midfield"); // 7
  const notArrived = scoreMatch(null, EXAMPLE_SET, "midfield");

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
});
