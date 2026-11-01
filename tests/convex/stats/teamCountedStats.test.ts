import { expect, test } from "vitest";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { HeldMatch } from "../../../convex/gameweekScorer/heldMatches";
import type { TeamInGameweek } from "../../../convex/gameweekScorer/teamGameweek";
import type { AutoSubs } from "../../../convex/lineup/autoSubs";
import type { SlotPoints } from "../../../convex/scoring/teamPoints";
import { countedTeamStats } from "../../../convex/stats/teamCountedStats";

// What counts in the stat race (#800, spec/19): a team's starters and the bench players who came
// on, each in the matches his points count, as the gameweek scorer has it. Pure: a team's gameweek
// built by hand.

const FIRST_FIXTURE = 101;
const SECOND_FIXTURE = 102;
const STARTER = 7;
const SUBBED_OFF = 8;
const CAME_ON = 9;
const STAYED_ON_BENCH = 10;
const NOT_WHOLE = 11;

type Record = Doc<"playerMatchStats">;
const whole = (playerCode: number, fixtureCode: number, stats: Record["stats"]): Record =>
  ({ playerCode, fixtureCode, started: true, played: true, arrived: { fpl: true, pl: true }, stats, state: "locked" }) as Record;

const match = (code: number, records: Record[]): HeldMatch => ({
  fixture: { code } as Doc<"fixtures">,
  status: null,
  records: new Map(records.map((record) => [record.playerCode, record])),
  overrides: new Map(),
});

const slot = (playerCode: number, counts: boolean, matchesCounted: boolean[]): SlotPoints => ({
  playerCode,
  cell: { area: "midfield", lane: "centre" },
  counts,
  matches: matchesCounted.map(() => ({ total: 0, categories: [] })),
  matchesCounted,
  points: 0,
  provisional: false,
});

const first = match(FIRST_FIXTURE, [
  whole(STARTER, FIRST_FIXTURE, { goals_scored: 1, minutes: 90 }),
  whole(SUBBED_OFF, FIRST_FIXTURE, { minutes: 0 }),
  whole(CAME_ON, FIRST_FIXTURE, { assists: 1, minutes: 90 }),
  whole(STAYED_ON_BENCH, FIRST_FIXTURE, { goals_scored: 3, minutes: 30 }),
  { ...whole(NOT_WHOLE, FIRST_FIXTURE, { goals_scored: 1 }), arrived: { fpl: true, pl: false } },
]);
const second = match(SECOND_FIXTURE, [whole(STARTER, SECOND_FIXTURE, { goals_scored: 2, minutes: 90 })]);

const gameweek = (starterCounted: boolean[]): TeamInGameweek => ({
  team: {
    starters: [slot(STARTER, true, starterCounted), slot(SUBBED_OFF, false, [true]), slot(NOT_WHOLE, true, [true])],
    bench: [slot(CAME_ON, true, [true]), slot(STAYED_ON_BENCH, false, [true])],
    total: 0,
    provisional: false,
  },
  autoSubs: {} as AutoSubs,
  noLineup: false,
  formation: null,
  matchesOf: new Map([
    [STARTER, [first, second]],
    [SUBBED_OFF, [first]],
    [NOT_WHOLE, [first]],
    [CAME_ON, [first]],
    [STAYED_ON_BENCH, [first]],
  ]),
});

test("a starter and the bench player who came on count; a starter subbed off and a bench player who stayed on don't", () => {
  expect(countedTeamStats(gameweek([true, true]))).toEqual({ goals_scored: 3, assists: 1, minutes: 270 });
});

test("in a double gameweek counting his best match only, his other match's stats don't count either", () => {
  expect(countedTeamStats(gameweek([false, true]))).toEqual({ goals_scored: 2, assists: 1, minutes: 180 });
});

test("a record not yet whole adds nothing", () => {
  const notWhole = gameweek([true, true]);
  notWhole.team.starters = notWhole.team.starters.filter((each) => each.playerCode === NOT_WHOLE);
  notWhole.team.bench = [];
  expect(countedTeamStats(notWhole)).toEqual({});
});

test("a counted man with no matches in the gameweek is data gone wrong, and throws", () => {
  const broken = gameweek([true, true]);
  broken.matchesOf.delete(CAME_ON);
  expect(() => countedTeamStats(broken)).toThrow(`player ${CAME_ON} has a slot but no matches in the gameweek`);
});
