import { expect, test } from "vitest";
import { HOUR_MS } from "./matchStats";
import { HULL_EVERTON, mergedHullEverton, withPlReadEmpty } from "./matchStats.harness";
import { isMatchComplete, isWhole, lockTime, matchRecords, mergeStats, statChanges, statValue } from "./matchRecords";
import { FULL_STATS, recordedGw6 } from "./recorded/gw6.payloads";

const records = mergedHullEverton();
const recordOf = (code: number, from = records) => from.find((record) => record.playerCode === code)!;
/** A substitute's slot, which places him nowhere. */
const benchSlot = (playerCode: number) =>
  ({ playerCode, fixtureCode: HULL_EVERTON, started: false, formation: null, line: null, place: null }) as const;
const plLine = (playerCode: number, stats: Record<string, number>) => ({ playerCode, fixtureCode: HULL_EVERTON, stats });

test("every man either sheet names has a record, keyed on his and the match's FPL codes", () => {
  expect(records).toHaveLength(40);
  expect(records.every((record) => record.fixtureCode === HULL_EVERTON)).toBe(true);
  expect(new Set(records.map((record) => record.playerCode)).size).toBe(40);
});

test("FPL's count is kept for goals and minutes, the Premier League's for the rest, each under its feed's name", () => {
  const belloumi = recordOf(FULL_STATS.belloumi.code).stats;
  expect(belloumi).toMatchObject({ goals_scored: 1, minutes: 26, won_contest: 3, total_sub_on: 1, expected_goals: 0.17 });
  expect(belloumi).not.toHaveProperty("goals");
  expect(belloumi).not.toHaveProperty("mins_played");
  // The two feeds differ by a minute here (docs/pl-match-stats.md): FPL's 85, not Opta's 86.
  expect(recordOf(FULL_STATS.grealish.code).stats.minutes).toBe(85);
});

test("where both feeds send a stat, FPL's count is kept for saves, the Premier League's for own goals and starts", () => {
  expect(mergeStats({ saves: 3, own_goals: 1, starts: 1 }, { saves: 4, own_goals: 0, game_started: 1, touches: 9 })).toEqual({
    saves: 3,
    own_goals: 0,
    game_started: 1,
    touches: 9,
  });
});

test("FPL's bonus, BPS and the points built on them are not stored", () => {
  const stored = new Set(records.flatMap((record) => Object.keys(record.stats)));
  for (const fplPoints of ["bonus", "bps", "total_points", "in_dreamteam"]) expect(stored.has(fplPoints)).toBe(false);
});

test("an unused substitute is stored as not having played, his record whole and every stat 0", () => {
  const phillips = recordOf(FULL_STATS.phillips.code);
  expect(phillips).toMatchObject({ started: false, played: false, arrived: { fpl: true, pl: true } });
  expect(statValue(phillips, "minutes")).toBe(0);
  expect(recordOf(FULL_STATS.belloumi.code)).toMatchObject({ started: false, played: true });
  expect(recordOf(FULL_STATS.coyle.code)).toMatchObject({ started: true, played: true });
});

test("a record the Premier League has not counted yet shows every stat as —, and FPL's part is kept", () => {
  const coyle = recordOf(FULL_STATS.coyle.code, mergedHullEverton(withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl)));
  expect(coyle.arrived).toEqual({ fpl: true, pl: false });
  expect(isWhole(coyle)).toBe(false);
  expect(statValue(coyle, "minutes")).toBeNull();
  expect(statValue(coyle, "won_tackle")).toBeNull();
  expect(coyle.stats.minutes).toBe(90);
});

test("once a record is whole, a stat it leaves out is 0", () => {
  const coyle = recordOf(FULL_STATS.coyle.code);
  expect(coyle.stats).not.toHaveProperty("aerial_won");
  expect(statValue(coyle, "aerial_won")).toBe(0);
  expect(statValue(coyle, "won_tackle")).toBe(1);
});

test("a substitute neither feed has sent may have played, so his record is not whole", () => {
  const [unsent] = matchRecords(HULL_EVERTON, [benchSlot(FULL_STATS.belloumi.code)], [], []);
  expect(unsent).toMatchObject({ played: null, arrived: { fpl: false, pl: false }, stats: {} });
  expect(isWhole(unsent)).toBe(false);
});

test("before FPL sends a substitute, Opta's minutes say whether he played", () => {
  const { belloumi, phillips } = FULL_STATS;
  const [cameOn] = matchRecords(HULL_EVERTON, [benchSlot(belloumi.code)], [], [
    plLine(belloumi.code, { mins_played: 26, formation_place: 0 }),
  ]);
  const [unused] = matchRecords(HULL_EVERTON, [benchSlot(phillips.code)], [], [plLine(phillips.code, { formation_place: 0 })]);

  expect(cameOn).toMatchObject({ played: true, arrived: { fpl: false, pl: true } });
  expect(isWhole(cameOn)).toBe(false);
  expect(unused).toMatchObject({ played: false, arrived: { fpl: false, pl: true } });
  expect(isWhole(unused)).toBe(true);
});

test("a match is complete only once every man who played has his whole record", () => {
  expect(isMatchComplete(records)).toBe(true);
  expect(isMatchComplete(mergedHullEverton(withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl)))).toBe(false);
  // An unused substitute's FPL line already says he never came on.
  expect(isMatchComplete(mergedHullEverton(withPlReadEmpty(recordedGw6(), FULL_STATS.phillips.pl)))).toBe(true);
  expect(isMatchComplete([])).toBe(false);
});

test("FPL's line for a man neither sheet names is dropped when he played no minutes, and throws when he played", () => {
  const stranger = (minutes: number) => [{ playerCode: 1, fixtureCode: HULL_EVERTON, stats: { minutes } }];
  expect(matchRecords(HULL_EVERTON, [], stranger(0), [])).toEqual([]);
  expect(() => matchRecords(HULL_EVERTON, [], stranger(12), [])).toThrow(
    `FPL has player 1 playing in match ${HULL_EVERTON}, whom neither team sheet names`,
  );
});

test("a match complete inside the window locks at its end; one complete after it, a window after that", () => {
  const fullTime = 0;
  expect(lockTime(fullTime, fullTime, HOUR_MS)).toBe(HOUR_MS);
  expect(lockTime(fullTime, HOUR_MS, HOUR_MS)).toBe(HOUR_MS);
  expect(lockTime(fullTime, HOUR_MS + 1, HOUR_MS)).toBe(2 * HOUR_MS + 1);
});

test("a stat taken away is a change to 0, and a stat sent as 0 or left out is no change", () => {
  expect(statChanges({ goal_assist: 1, touches: 9 }, { touches: 9 })).toEqual([{ stat: "goal_assist", locked: 1, sent: 0 }]);
  expect(statChanges({ winning_goal: 0 }, {})).toEqual([]);
});
