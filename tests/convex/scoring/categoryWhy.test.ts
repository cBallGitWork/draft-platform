import { describe, expect, test } from "vitest";
import { ALL_CELLS, positionOfSlot, type Cell } from "../../../convex/lineup/pitch";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { priceFor } from "../../../convex/scoring/priced";
import { scoreMatch, type CategoryWhy } from "../../../convex/scoring/scoring";
import type { ScoringRule, ScoringSet } from "../../../convex/scoring/scoringSet";
import { inTenths, type MatchStats } from "../../../convex/scoring/values";
import { DEWSBURY_HALL, fplLines, plLines, recordOf, TZOLAKIS } from "../../support/convex/teamPoints.harness";
import { centreOf, EXAMPLE_SET, everyArea, everyPosition } from "../../support/convex/scoring.example";

// Each category's points come with why (spec/14, On screen; #797): how many of the stat he made,
// the rule's value at his slot and how finely it is set, and the points limit or minutes rule that
// cut it. The card writes its lines from these, so they must reproduce the points exactly.

const dewsburyHall = recordOf(fplLines, DEWSBURY_HALL);
const tzolakis = recordOf(fplLines, TZOLAKIS);
/** The site's first set, whose clean sheet needs 60 minutes. */
const FIRST = FIRST_SCORING as ScoringSet;

/** The why of one category of his match under `set` at `cell`. */
function whyOf(record: MatchStats, set: ScoringSet, cell: Cell, stat: string): CategoryWhy {
  const category = scoreMatch(record, set, cell).categories.find((each) => each.stat === stat);
  if (category === undefined || category.points === null) throw new Error(`no points for ${stat}`);
  return category.why;
}
const oneRule = (rule: ScoringRule): ScoringSet => ({ rules: [rule], wholePointsOnly: false });

describe("each rule shape says what it counted and its value at the slot", () => {
  test("per action, priced by area: Dewsbury-Hall's goal in midfield is 1 at 5", () => {
    expect(whyOf(dewsburyHall, EXAMPLE_SET, centreOf("midfield"), "goals_scored")).toEqual({
      actions: 1,
      value: { shape: "perAction", points: 5 },
      pricedBy: { by: "area", area: "midfield" },
      cut: null,
    });
  });

  test("per action, the same for all", () => {
    expect(whyOf({ yellow_cards: 1 }, EXAMPLE_SET, centreOf("midfield"), "yellow_cards")).toEqual({
      actions: 1,
      value: { shape: "perAction", points: -1 },
      pricedBy: { by: "all" },
      cut: null,
    });
  });

  test("per action, priced by position: a right back is priced as FB", () => {
    const set = oneRule({ shape: "perAction", stat: "assists", values: { byPosition: { ...everyPosition(3), FB: 4 } } });
    expect(whyOf(dewsburyHall, set, { area: "defence", lane: "right" }, "assists")).toMatchObject({
      value: { shape: "perAction", points: 4 },
      pricedBy: { by: "position", position: "FB" },
    });
  });

  test("per count: the keeper's 4 saves, at 1 for every 3", () => {
    expect(whyOf(tzolakis, EXAMPLE_SET, centreOf("goalkeeper"), "saves")).toEqual({
      actions: 4,
      value: { shape: "perCount", every: 3, points: 1 },
      pricedBy: { by: "area", area: "goalkeeper" },
      cut: null,
    });
  });

  test("bands paying the highest: his 90 minutes earn only the 60+ band", () => {
    expect(whyOf(dewsburyHall, EXAMPLE_SET, centreOf("midfield"), "minutes").value).toEqual({ shape: "bands", earned: [{ atLeast: 60, points: 2 }] });
  });

  test("stacked bands: each band he reached", () => {
    const set = oneRule({ shape: "bands", stat: "minutes", stack: true, values: { all: [{ atLeast: 60, points: 2 }, { atLeast: 1, points: 1 }] } });
    expect(whyOf(dewsburyHall, set, centreOf("midfield"), "minutes").value).toEqual({
      shape: "bands",
      earned: [
        { atLeast: 60, points: 2 },
        { atLeast: 1, points: 1 },
      ],
    });
  });

  test("bands he reached none of: none earned", () => {
    expect(whyOf({ minutes: 90, defensive_contribution: 3 }, EXAMPLE_SET, centreOf("defence"), "defensive_contribution").value).toEqual({ shape: "bands", earned: [] });
  });
});

describe("what cut his points", () => {
  const stackedTwice = { shape: "bands", stat: "defensive_contribution", stack: true, values: { all: [{ atLeast: 10, points: 2 }, { atLeast: 12, points: 2 }] } } as const;

  test("a most that held them: 14 defensive actions earn 4 but are held to 2", () => {
    const set = oneRule({ ...stackedTwice, limit: { all: { max: 2, min: null } } });
    const scored = scoreMatch({ minutes: 90, defensive_contribution: 14 }, set, centreOf("defence"));
    expect(scored.categories).toEqual([
      {
        stat: "defensive_contribution",
        points: 2,
        why: { actions: 14, value: { shape: "bands", earned: stackedTwice.values.all }, pricedBy: { by: "all" }, cut: { by: "max", limit: 2 } },
      },
    ]);
  });

  test("a most he didn't reach cuts nothing", () => {
    const set = oneRule({ ...stackedTwice, limit: { all: { max: 4, min: null } } });
    expect(whyOf({ defensive_contribution: 14 }, set, centreOf("defence"), "defensive_contribution").cut).toBeNull();
  });

  test("a least that held them: three own goals at −2 are held to −4", () => {
    const set = oneRule({ shape: "perAction", stat: "own_goals", values: { all: -2 }, limit: { byArea: everyArea({ max: null, min: -4 }) } });
    const scored = scoreMatch({ own_goals: 3 }, set, centreOf("defence"));
    expect(scored.categories[0]).toMatchObject({ points: -4, why: { actions: 3, value: { shape: "perAction", points: -2 }, cut: { by: "min", limit: -4 } } });
  });

  test("too few minutes for the rule: a clean sheet in 45 minutes earns nothing, and says why", () => {
    const scored = scoreMatch({ minutes: 45, clean_sheets: 1 }, FIRST, centreOf("defence"));
    expect(scored.categories.find((each) => each.stat === "clean_sheets")).toEqual({
      stat: "clean_sheets",
      points: 0,
      why: { actions: 1, value: { shape: "perAction", points: 4 }, pricedBy: { by: "area", area: "defence" }, cut: { by: "minutes", atLeast: 60 } },
    });
  });

  test("too few minutes cuts nothing when the rule gave nothing anyway: no clean sheet", () => {
    expect(whyOf({ minutes: 45, clean_sheets: 0 }, FIRST, centreOf("defence"), "clean_sheets").cut).toBeNull();
  });

  test("enough minutes, and the clean sheet counts uncut", () => {
    expect(scoreMatch({ minutes: 60, clean_sheets: 1 }, FIRST, centreOf("defence")).categories.find((each) => each.stat === "clean_sheets")).toMatchObject({
      points: 4,
      why: { cut: null },
    });
  });
});

/** The points a line's why gives, worked out apart from the scorer: a minutes cut is nothing, a
 *  limit's cut its limit, else the value for the actions. */
function pointsFromWhy({ actions, value, cut }: CategoryWhy): number {
  if (cut?.by === "minutes") return 0;
  if (cut !== null) return cut.limit;
  switch (value.shape) {
    case "perAction":
      return inTenths(actions * value.points);
    case "perCount":
      return inTenths(Math.floor(actions / value.every) * value.points);
    case "bands":
      return inTenths(value.earned.reduce((total, band) => total + band.points, 0));
  }
}

/** One cell for each slot position: a rule is priced by area and position alone. */
const ONE_CELL_A_POSITION = ALL_CELLS.filter((cell, index) => ALL_CELLS.findIndex((each) => positionOfSlot(each) === positionOfSlot(cell)) === index);

// #797's Done: over a recorded match, every category's why reproduces its points.
describe.each([
  ["the example set", EXAMPLE_SET],
  ["the first scoring set", FIRST],
])("every recorded line of Hull v Everton, from both feeds, at every slot position, under %s", (_name, set) => {
  const lines = [...fplLines, ...plLines];

  test("each category's why gives its points, and its value is the rule's at the slot", () => {
    let checked = 0;
    for (const { stats } of lines) {
      for (const cell of ONE_CELL_A_POSITION) {
        const { categories } = scoreMatch(stats, set, cell);
        categories.forEach((category, index) => {
          if (category.points === null) throw new Error("a recorded line is whole");
          expect(pointsFromWhy(category.why)).toBe(category.points);
          const rule = set.rules[index];
          const position = positionOfSlot(cell);
          if (rule.shape === "perAction") expect(category.why.value).toEqual({ shape: "perAction", points: priceFor(rule.values, cell.area, position) });
          if (rule.shape === "perCount") expect(category.why.value).toEqual({ shape: "perCount", ...priceFor(rule.values, cell.area, position) });
          checked += 1;
        });
      }
    }
    expect(checked).toBe(lines.length * ONE_CELL_A_POSITION.length * set.rules.length);
  });
});
