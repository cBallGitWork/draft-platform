import { expect, test } from "vitest";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { AutoSubs } from "../../../convex/lineup/autoSubs";
import type { SlotPoints } from "../../../convex/scoring/teamPoints";
import { pointsByMatch, pointsInMatch, type HeldMatch, type TeamInGameweek } from "../../../convex/table/teamGameweek";

// One man's points in one match are read from a team's gameweek by pairing his matches (matchesOf)
// with his slot's scored matches, which scoreTeam keeps in the same order.

const FIRST_FIXTURE = 101;
const SECOND_FIXTURE = 102;
const OTHER_FIXTURE = 103;
const DOUBLE_MAN = 7;
const SINGLE_MAN = 8;
const BENCH_MAN = 9;
const NOT_IN_LINEUP = 99;

const held = (code: number): HeldMatch => ({
  fixture: { code } as Doc<"fixtures">,
  status: null,
  records: new Map(),
  overrides: new Map(),
});

const slot = (playerCode: number, totals: (number | null)[], counts = true): SlotPoints => ({
  playerCode,
  cell: { area: "midfield", lane: "centre" },
  counts,
  matches: totals.map((total) => ({ total, categories: [] })),
  matchesCounted: totals.map(() => true),
  points: null,
  provisional: true,
});

const doubleMan = slot(DOUBLE_MAN, [3, 11]);
const benchMan = slot(BENCH_MAN, [5], false);

const scored: TeamInGameweek = {
  team: { starters: [doubleMan, slot(SINGLE_MAN, [null])], bench: [benchMan], total: 0, provisional: true },
  autoSubs: {} as AutoSubs,
  matchesOf: new Map([
    [DOUBLE_MAN, [held(FIRST_FIXTURE), held(SECOND_FIXTURE)]],
    [SINGLE_MAN, [held(SECOND_FIXTURE)]],
    [BENCH_MAN, [held(OTHER_FIXTURE)]],
  ]),
};

test("a man with two matches has each match's own points, by its order in his matches", () => {
  expect(pointsInMatch(scored, DOUBLE_MAN, FIRST_FIXTURE)).toEqual({ slot: doubleMan, points: 3 });
  expect(pointsInMatch(scored, DOUBLE_MAN, SECOND_FIXTURE)).toEqual({ slot: doubleMan, points: 11 });
});

test("a bench man's points in his match are found as a starter's are", () => {
  expect(pointsInMatch(scored, BENCH_MAN, OTHER_FIXTURE)).toEqual({ slot: benchMan, points: 5 });
});

test("points not yet arrived are null, not 0", () => {
  expect(pointsInMatch(scored, SINGLE_MAN, SECOND_FIXTURE)?.points).toBeNull();
});

test("a man the lineup doesn't hold, or a match he has no part in, gives null", () => {
  expect(pointsInMatch(scored, NOT_IN_LINEUP, FIRST_FIXTURE)).toBeNull();
  expect(pointsInMatch(scored, SINGLE_MAN, FIRST_FIXTURE)).toBeNull();
});

test("each of his matches is paired with his points in it, in order", () => {
  expect(pointsByMatch(doubleMan, scored.matchesOf.get(DOUBLE_MAN)!).map(({ match, points }) => [match.fixture.code, points])).toEqual([
    [FIRST_FIXTURE, 3],
    [SECOND_FIXTURE, 11],
  ]);
});

test("a slot with no matches held for him is data gone wrong, and throws", () => {
  const unheld: TeamInGameweek = { ...scored, matchesOf: new Map() };
  expect(() => pointsInMatch(unheld, DOUBLE_MAN, FIRST_FIXTURE)).toThrow(`player ${DOUBLE_MAN} has a slot but no matches in the gameweek`);
});
