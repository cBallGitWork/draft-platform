import { expect, test } from "vitest";
import { FEED_TYPE } from "../../../convex/football/commentary";
import { scorersOf, type ScorerMan } from "../../../convex/match/matchScorers";
import { HULL_SCORER } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { ANN } from "../../support/convex/leagues.harness";
import { holdLines, manOf, matchAs, matchLeague, storedLine } from "../../support/convex/matchPage.harness";
import { silenceConsoleWarn } from "../../support/convex/test.harness";

// The scorers' line under the match page's scoreboard (spec/10 S10.7: "Under the scoreboard, each
// side's scorers"; Craig, 10 Nov 2026, on #1032), read from the match's stored lines, newest first.

const HOME_WINGER = 1;
const HOME_STRIKER = 2;
const AWAY_MIDFIELDER = 3;
const AWAY_DEFENDER = 4;
const PAGE_MEN = new Map<number, ScorerMan>([
  [HOME_WINGER, { name: "Saka", side: "home" }],
  [HOME_STRIKER, { name: "Gyökeres", side: "home" }],
  [AWAY_MIDFIELDER, { name: "Palmer", side: "away" }],
  [AWAY_DEFENDER, { name: "Cucurella", side: "away" }],
]);

const LOGGED_AS = "Match 7";

let sourceId = 0;
const line = (type: string, minute: number | null, playerCodes: (number | null)[], addedMinute: number | null = null) => ({
  sourceId: ++sourceId,
  text: type,
  minute,
  addedMinute,
  type,
  playerCodes,
});

test("S10.7: each side's goals under it, oldest first, an added-time goal with its added minutes", () => {
  const newestFirst = [
    line(FEED_TYPE.matchEnds, 90, []),
    line(FEED_TYPE.penaltyGoal, 90, [HOME_STRIKER], 3),
    line(FEED_TYPE.goal, 67, [HOME_STRIKER, HOME_WINGER]),
    line(FEED_TYPE.goal, 44, [AWAY_MIDFIELDER]),
    line(FEED_TYPE.yellowCard, 31, [HOME_WINGER]),
    line(FEED_TYPE.goal, 23, [HOME_WINGER, HOME_STRIKER]),
  ];
  expect(scorersOf(newestFirst, PAGE_MEN, LOGGED_AS)).toEqual({
    home: [
      { name: "Saka", minute: "23'", ownGoal: false },
      { name: "Gyökeres", minute: "67'", ownGoal: false },
      { name: "Gyökeres", minute: "90+3'", ownGoal: false },
    ],
    away: [{ name: "Palmer", minute: "44'", ownGoal: false }],
  });
});

test("S10.7: an own goal counts for the other side, and a goal VAR took away goes", () => {
  const newestFirst = [line(FEED_TYPE.varCancelledGoal, 52, [HOME_WINGER]), line(FEED_TYPE.goal, 51, [HOME_WINGER]), line(FEED_TYPE.ownGoal, 12, [AWAY_DEFENDER])];
  expect(scorersOf(newestFirst, PAGE_MEN, LOGGED_AS)).toEqual({ home: [{ name: "Cucurella", minute: "12'", ownGoal: true }], away: [] });
});

test("S10.7: the match page carries the scorers its stored lines give, under the side the man played for", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await holdLines(league, [storedLine(1, "64' GOAL Scorer", 64, FEED_TYPE.goal, [HULL_SCORER])]);
  const page = (await matchAs(league, ANN))!;
  expect(page.scorers).toEqual({ home: [{ name: manOf(page.men, HULL_SCORER).name, minute: "64'", ownGoal: false }], away: [] });
});

test("S10.7: no goals, no scorers; a goal the page can't place is left off, not guessed, and logged", () => {
  const warned = silenceConsoleWarn();
  expect(scorersOf([], PAGE_MEN, LOGGED_AS)).toEqual({ home: [], away: [] });
  expect(warned).not.toHaveBeenCalled();
  const unplaced = new Map<number, ScorerMan>([[HOME_WINGER, { name: "Saka", side: null }]]);
  const newestFirst = [line(FEED_TYPE.goal, null, [AWAY_MIDFIELDER]), line(FEED_TYPE.goal, 20, [null]), line(FEED_TYPE.goal, 10, [HOME_WINGER])];
  expect(scorersOf(newestFirst, unplaced, LOGGED_AS)).toEqual({ home: [], away: [] });
  expect(warned.mock.calls.map(([logged]) => logged)).toEqual([
    `${LOGGED_AS}'s goal at 20' is left off the scorers: its line names no scorer`,
    `${LOGGED_AS}'s goal by player ${AWAY_MIDFIELDER} is left off the scorers: its line has no minute`,
    `${LOGGED_AS}'s goal at 10' by player ${HOME_WINGER} is left off the scorers: he is on neither side`,
  ]);
});
