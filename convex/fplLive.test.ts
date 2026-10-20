import { expect, test } from "vitest";
import { fplStatLines, type RawLive } from "./fplLive";
import { FULL_STATS, MATCH, recordedGw6 } from "./recorded/gw6.payloads";

const { fpl } = recordedGw6();
const { elements } = fpl.bootstrap;
const lines = fplStatLines(fpl.live, elements, fpl.fixtures);
const lineOf = (code: number) => lines.find((line) => line.playerCode === code)!;
const BELLOUMI_ID = 286; // His per-season id in this payload, which no line carries.

test("each player with one match has one line, by his code and the match's", () => {
  expect(lines).toHaveLength(40);
  expect(lines.every((line) => line.fixtureCode === MATCH.hullEverton.code)).toBe(true);
  expect(new Set(lines.map((line) => line.playerCode))).toEqual(new Set(elements.map((element) => element.code)));
});

test("a line holds every stat FPL sent under FPL's names, its decimal strings as numbers", () => {
  const belloumi = lineOf(FULL_STATS.belloumi.code);

  expect(Object.keys(belloumi.stats).sort()).toEqual(
    Object.keys(fpl.live.elements.find((element) => element.id === BELLOUMI_ID)!.stats).sort(),
  );
  expect(belloumi.stats).toMatchObject({
    minutes: 26,
    goals_scored: 1,
    starts: 0,
    bps: 25,
    expected_goals: 0.17,
    defensive_contribution: 2,
    played: 1,
    in_dreamteam: 0,
  });
});

test("an unused substitute's line says he played no minutes", () => {
  expect(lineOf(FULL_STATS.phillips.code).stats).toMatchObject({ minutes: 0, played: 0 });
});

/** Belloumi's gameweek as if Hull had played twice: a second match's block, and totals of both. */
function doubleGameweek(): RawLive {
  const live = structuredClone(fpl.live);
  const belloumi = live.elements.find((element) => element.id === BELLOUMI_ID)!;
  belloumi.explain.push({
    fixture: 51,
    stats: [
      { identifier: "minutes", value: 90 },
      { identifier: "assists", value: 1 },
    ],
  });
  belloumi.stats = { ...belloumi.stats, minutes: 116, assists: 1, tackles: 3 };
  return live;
}

test("in a double gameweek each match's line has that match's scoring stats", () => {
  const twice = fplStatLines(doubleGameweek(), elements, fpl.fixtures).filter(
    (line) => line.playerCode === FULL_STATS.belloumi.code,
  );

  expect(twice.map((line) => line.fixtureCode)).toEqual([MATCH.hullEverton.code, MATCH.arsenalLeeds.code]);
  expect(twice.map((line) => line.stats)).toEqual([
    { minutes: 26, goals_scored: 1 },
    { minutes: 90, assists: 1 },
  ]);
});

test("in a double gameweek the gameweek totals FPL does not split are left out, not guessed", () => {
  const [first] = fplStatLines(doubleGameweek(), elements, fpl.fixtures).filter(
    (line) => line.playerCode === FULL_STATS.belloumi.code,
  );
  expect("tackles" in first.stats).toBe(false);
});

test("a player with no match in the gameweek has no line", () => {
  const live = structuredClone(fpl.live);
  live.elements[0].explain = [];

  expect(fplStatLines(live, elements, fpl.fixtures)).toHaveLength(39);
});

test.each([
  [
    "a player bootstrap-static does not list",
    (live: RawLive) => {
      live.elements[0].id = 9999;
    },
    "player id 9999",
  ],
  [
    "a match /fixtures/ does not list",
    (live: RawLive) => {
      live.elements[0].explain[0].fixture = 999;
    },
    "match id 999",
  ],
] as const)("a line naming %s throws", (_what, change, message) => {
  const live = structuredClone(fpl.live);
  change(live);

  expect(() => fplStatLines(live, elements, fpl.fixtures)).toThrow(
    `name ${message}, which its other reads do not list`,
  );
});

test.each([
  [
    "a total that is not a number",
    (live: RawLive) => {
      live.elements[0].stats.influence = "n/a";
    },
    'sent influence "n/a"',
  ],
  [
    "an empty total",
    (live: RawLive) => {
      live.elements[0].stats.bps = "";
    },
    'sent bps ""',
  ],
  [
    "a match stat that is not a number",
    (live: RawLive) => {
      live.elements[0].explain[0].stats[0].value = null as never;
    },
    "sent minutes null",
  ],
  [
    "a match stat sent twice",
    (live: RawLive) => {
      live.elements[0].explain[0].stats.push({ ...live.elements[0].explain[0].stats[0] });
    },
    "sent minutes twice",
  ],
] as const)("%s is a changed payload, and throws", (_what, change, message) => {
  const live = structuredClone(fpl.live);
  change(live);

  expect(() => fplStatLines(live, elements, fpl.fixtures)).toThrow(message);
});
