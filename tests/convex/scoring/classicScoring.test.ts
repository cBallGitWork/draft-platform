import { describe, expect, test } from "vitest";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { CLASSIC_SCORING, DEFENDER_STAT, MIDFIELD_STAT } from "../../../convex/scoring/classicScoring";
import { checkedOnce } from "../../../convex/scoring/scoringSet";
import { LINE_NAMES, type Line } from "../../../convex/shared/lineNames";
import { SPORTMONKS_STAT_IDS } from "../../../convex/football/sportmonks/sportmonksStats";
import {
  ASSISTS,
  BLOCKS,
  CLEAN_SHEETS,
  CLEARANCES,
  GOALS,
  GOALS_CONCEDED,
  INTERCEPTIONS,
  MINUTES_STAT,
  OWN_GOALS,
  PENALTIES_MISSED,
  PENALTIES_SAVED,
  RECOVERIES,
  RED_CARDS,
  SAVES,
  TACKLES,
  YELLOW_CARDS,
} from "../../../convex/scoring/statKeys";
import type { MatchStats } from "../../../convex/scoring/values";
import { centreOf } from "../../support/convex/scoring.example";

const total = (record: MatchStats, line: Line) => scoreMatch(record, CLASSIC_SCORING, line).total;
const pointsFor = (record: MatchStats, line: Line, stat: string) =>
  scoreMatch(record, CLASSIC_SCORING, line).categories.find((category) => category.stat === stat)?.points;

test("S22.13 classic's set is a sound scoring set", () => {
  expect(() => checkedOnce(CLASSIC_SCORING)).not.toThrow();
});

describe("S22.13 one worked match per line, each by its row of the table", () => {
  test("FWD: 90 minutes, a goal, an assist, a clean sheet and a yellow: 2 + 4 + 3 + 0 − 1 = 8", () => {
    const record = { [MINUTES_STAT]: 90, [GOALS]: 1, [ASSISTS]: 1, [CLEAN_SHEETS]: 1, [TACKLES]: 3, [INTERCEPTIONS]: 2, [YELLOW_CARDS]: 1 };
    expect(total(record, "FWD")).toBe(8);
  });

  test("AM: 75 minutes, a goal, a clean sheet, 3 tackles, an interception and 4 recoveries: 2 + 5 + 0 + 1 = 8", () => {
    const record = { [MINUTES_STAT]: 75, [GOALS]: 1, [CLEAN_SHEETS]: 1, [TACKLES]: 3, [INTERCEPTIONS]: 1, [RECOVERIES]: 4 };
    expect(pointsFor(record, "AM", MIDFIELD_STAT)).toBe(1);
    expect(total(record, "AM")).toBe(8);
  });

  test("CM: 90 minutes, an assist, a clean sheet, 4 tackles, 2 interceptions, a block and 8 recoveries: 2 + 3 + 2 + 2 = 9", () => {
    const record = { [MINUTES_STAT]: 90, [ASSISTS]: 1, [CLEAN_SHEETS]: 1, [TACKLES]: 4, [INTERCEPTIONS]: 2, [BLOCKS]: 1, [RECOVERIES]: 8 };
    expect(pointsFor(record, "CM", MIDFIELD_STAT)).toBe(2);
    expect(total(record, "CM")).toBe(9);
  });

  test("DEF: 90 minutes, 3 conceded, 2 tackles, 3 interceptions, 2 blocks, 5 clearances and an own goal: 2 − 1 + 2 − 2 = 1", () => {
    const record = { [MINUTES_STAT]: 90, [GOALS_CONCEDED]: 3, [TACKLES]: 2, [INTERCEPTIONS]: 3, [BLOCKS]: 2, [CLEARANCES]: 5, [RECOVERIES]: 20, [OWN_GOALS]: 1 };
    expect(pointsFor(record, "DEF", DEFENDER_STAT)).toBe(2);
    expect(pointsFor(record, "DEF", MIDFIELD_STAT)).toBe(0);
    expect(total(record, "DEF")).toBe(1);
  });

  test("GK: 90 minutes, a clean sheet, 5 saves and a penalty saved: 2 + 4 + 2 + 5 = 13", () => {
    const record = { [MINUTES_STAT]: 90, [CLEAN_SHEETS]: 1, [SAVES]: 5, [PENALTIES_SAVED]: 1 };
    expect(total(record, "GK")).toBe(13);
  });

  test.each<[Line, number]>([
    ["FWD", 4],
    ["AM", 5],
    ["CM", 5],
    ["DEF", 5],
    ["GK", 5],
  ])("a goal by a %s gives %i", (line, points) => {
    expect(pointsFor({ [MINUTES_STAT]: 90, [GOALS]: 1 }, line, GOALS)).toBe(points);
  });

  test.each<[Line, number]>([
    ["FWD", 0],
    ["AM", 0],
    ["CM", 2],
    ["DEF", 4],
    ["GK", 4],
  ])("a clean sheet at 60+ minutes for a %s gives %i, and none under 60", (line, points) => {
    expect(pointsFor({ [MINUTES_STAT]: 60, [CLEAN_SHEETS]: 1 }, line, CLEAN_SHEETS)).toBe(points);
    expect(pointsFor({ [MINUTES_STAT]: 59, [CLEAN_SHEETS]: 1 }, line, CLEAN_SHEETS)).toBe(0);
  });

  test("saves are +1 per 2 for the keeper only", () => {
    expect(pointsFor({ [MINUTES_STAT]: 90, [SAVES]: 5 }, "GK", SAVES)).toBe(2);
    expect(pointsFor({ [MINUTES_STAT]: 90, [SAVES]: 5 }, "DEF", SAVES)).toBe(0);
  });
});

describe("S22.14 defcon counts per action", () => {
  test("a CM earns +1 per 4 of the midfield stat, recoveries at a quarter: 7¾ is 1, 8 is 2", () => {
    const blocking = { [MINUTES_STAT]: 90, [TACKLES]: 4, [INTERCEPTIONS]: 2, [BLOCKS]: 1 };
    expect(pointsFor({ ...blocking, [RECOVERIES]: 3 }, "CM", MIDFIELD_STAT)).toBe(1);
    expect(pointsFor({ ...blocking, [RECOVERIES]: 4 }, "CM", MIDFIELD_STAT)).toBe(2);
  });

  test("an AM earns +1 per 5 of the same stat: 9 is 1, 10 is 2", () => {
    expect(pointsFor({ [MINUTES_STAT]: 90, [TACKLES]: 9 }, "AM", MIDFIELD_STAT)).toBe(1);
    expect(pointsFor({ [MINUTES_STAT]: 90, [TACKLES]: 10 }, "AM", MIDFIELD_STAT)).toBe(2);
  });

  test("a DEF earns +1 per 4 of the defender stat, clearances at a quarter, never FPL's all-or-nothing +2", () => {
    expect(pointsFor({ [MINUTES_STAT]: 90, [TACKLES]: 3, [CLEARANCES]: 3 }, "DEF", DEFENDER_STAT)).toBe(0);
    expect(pointsFor({ [MINUTES_STAT]: 90, [TACKLES]: 3, [CLEARANCES]: 4 }, "DEF", DEFENDER_STAT)).toBe(1);
    expect(pointsFor({ [MINUTES_STAT]: 90, [TACKLES]: 12 }, "DEF", DEFENDER_STAT)).toBe(3);
  });

  test("the keeper and the striker earn no defcon", () => {
    const busy = { [MINUTES_STAT]: 90, [TACKLES]: 12, [CLEARANCES]: 12, [RECOVERIES]: 12 };
    for (const line of ["GK", "FWD"] as const) {
      expect(pointsFor(busy, line, MIDFIELD_STAT)).toBe(0);
      expect(pointsFor(busy, line, DEFENDER_STAT)).toBe(0);
    }
  });
});

test.each(LINE_NAMES)("S22.15 a %s: yellow −1, red −3, own goal −2, penalty missed −2, penalty saved +5", (line) => {
  const record = { [MINUTES_STAT]: 30, [YELLOW_CARDS]: 1, [RED_CARDS]: 1, [OWN_GOALS]: 1, [PENALTIES_MISSED]: 1, [PENALTIES_SAVED]: 1 };
  expect([YELLOW_CARDS, RED_CARDS, OWN_GOALS, PENALTIES_MISSED, PENALTIES_SAVED].map((stat) => pointsFor(record, line, stat))).toEqual([-1, -3, -2, -2, 5]);
  expect(total(record, line)).toBe(1 - 1 - 3 - 2 - 2 + 5);
});

test.each(LINE_NAMES)("S22.16 a %s scores no FPL bonus", (line) => {
  const record = { [MINUTES_STAT]: 90, [GOALS]: 1 };
  expect(total({ ...record, bonus: 3, bps: 40 }, line)).toBe(total(record, line));
  expect(CLASSIC_SCORING.rules.map((rule) => rule.stat)).not.toContain("bonus");
});

test.each<[Line, number]>([
  ["GK", -2],
  ["DEF", -2],
  ["CM", 0],
  ["AM", 0],
  ["FWD", 0],
])("S22.17 4 goals conceded cost a %s %i, −1 per 2", (line, points) => {
  expect(pointsFor({ [MINUTES_STAT]: 90, [GOALS_CONCEDED]: 4 }, line, GOALS_CONCEDED)).toBe(points);
  expect(pointsFor({ [MINUTES_STAT]: 90, [GOALS_CONCEDED]: 5 }, line, GOALS_CONCEDED)).toBe(points);
});

test.each(LINE_NAMES)("S22.18 a %s's appearance is 1, or 2 at 60+ minutes", (line) => {
  expect([0, 1, 59, 60, 90].map((minutes) => total({ [MINUTES_STAT]: minutes }, line))).toEqual([0, 1, 1, 2, 2]);
});

describe("S22.19 a player scores by his line's row, whatever slot he fills", () => {
  test("a CM scored by his line says so on each priced line, and no slot or back line changes it", () => {
    const record = { [MINUTES_STAT]: 90, [GOALS]: 1, [CLEAN_SHEETS]: 1 };
    const scored = scoreMatch(record, CLASSIC_SCORING, "CM");
    expect(scored.categories.find((category) => category.stat === GOALS)).toMatchObject({ why: { pricedBy: { by: "line", line: "CM" } } });
    expect(scored.categories.find((category) => category.stat === ASSISTS)).toMatchObject({ why: { pricedBy: { by: "all" } } });
    expect(scored.total).toBe(2 + 5 + 2);
  });

  test("a line no league plays is refused", () => {
    expect(() => scoreMatch({}, CLASSIC_SCORING, "LW" as Line)).toThrow("is not one of the five lines");
  });

  test("a slot still prices the site's way outside classic", () => {
    expect(scoreMatch({ [MINUTES_STAT]: 90 }, CLASSIC_SCORING, centreOf("midfield")).categories[0]).toMatchObject({ why: { pricedBy: { by: "all" } } });
    expect(scoreMatch({ [MINUTES_STAT]: 90, [GOALS]: 1 }, CLASSIC_SCORING, centreOf("attack")).categories[1]).toMatchObject({ why: { pricedBy: { by: "area", area: "attack" } } });
  });
});

test("S22.20 the defcon stats each stand on a stat Sportmonks sends", () => {
  const parts = CLASSIC_SCORING.ownStats!.flatMap((own) => own.parts.map((part) => part.stat));
  expect(parts.filter((stat) => SPORTMONKS_STAT_IDS[stat] === undefined)).toEqual([]);
});
