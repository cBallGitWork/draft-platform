import { expect, test } from "vitest";
import { missingClubLog } from "../../../convex/matchup/slotParts";
import { annsScoredGame, GAMEWEEK, holdHullAndEverton, HULL_KEEPER, HULL_SCORER, nameOf, scoresLeague, slotOf } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, liveRecords, scoreRead } from "../../support/convex/gameweekScoresMatch.harness";
import { MIDFIELD_GOAL } from "../../support/convex/gameweekScoresFixes.harness";
import { holdLines, storedLine } from "../../support/convex/matchPage.harness";
import { EVERTON_CLUB, HULL_CITY, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { silenceConsoleWarn } from "../../support/convex/test.harness";

// The matchup's vidiprinter gives each team its own column of what a line moves its score by, and
// each line the men it is about, whom a tapped man's cyan bar marks (the approved picture, #1026).
// A column shows only what moves its team's score: a bench man's lines show nothing in it, and an
// auto-sub's lines of the gameweek do once he comes on (Craig, 9 Nov 2026, on #1026). Ann fields
// Hull, whose unused keeper Phillips is replaced at full time by the bench's Tzolakis
// (HULL_KEEPER); Bob fields Everton.

const ANNS_COLUMN = 0;
const BOBS_COLUMN = 1;

async function readLines(league: Awaited<ReturnType<typeof scoresLeague>>) {
  const { commentary } = await annsScoredGame(league, GAMEWEEK);
  if (commentary.kind !== "read") throw new Error(`the commentary wasn't read: ${commentary.reason}`);
  return commentary.lines;
}

test("a starter's goal is in his team's column alone, about him; the full-time line moves no column but is about each man it lists", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  const scorer = await nameOf(league, HULL_SCORER);
  await holdLines(league, [storedLine(2, "FT HUL 1–2 EVE", 1, "end 14"), storedLine(1, `64' GOAL ${scorer}`, 64, "goal", [HULL_SCORER])]);

  const [fullTime, goal] = await readLines(league);
  expect(goal.about).toEqual([HULL_SCORER]);
  expect(goal.columns).toEqual([`+${MIDFIELD_GOAL}`, null]);
  expect(fullTime.columns).toEqual([null, null]);
  expect(fullTime.about).toContain(HULL_SCORER);
});

test("an auto-sub's line shows in his team's column only once he has come on", async () => {
  const league = await scoresLeague();
  const booked = storedLine(1, "30' YELLOW Tzolakis", 30, "yellow card", [HULL_KEEPER]);
  await holdLines(league, [booked]);
  // The records write threshold lines too.
  const bookingOf = async (from: typeof league) => (await readLines(from)).find((line) => line.text === booked.text)!;

  // Mid-match, he is still a bench man: the line is priced for him, in neither team's column.
  await liveRecords(league, mergedHullEverton(), 70);
  const whileOnBench = await bookingOf(league);
  expect(whileOnBench.points).not.toBeNull();
  expect(whileOnBench.columns).toEqual([null, null]);

  // At full time Phillips hasn't played, so Tzolakis comes on, and his line counts for Ann.
  await fullTimeRecords(league);
  const { team } = await annsScoredGame(league, GAMEWEEK);
  expect(slotOf(team, HULL_KEEPER).autoSub?.kind).toBe("on");
  const cameOn = await bookingOf(league);
  expect(cameOn.about).toEqual([HULL_KEEPER]);
  expect(cameOn.points).not.toBeNull();
  expect(cameOn.columns[ANNS_COLUMN]).toBe(cameOn.points);
  expect(cameOn.columns[BOBS_COLUMN]).toBeNull();
});

test("a breakdown names its match by its clubs and its score as the newest read gives it", async () => {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await fullTimeRecords(league);
  await scoreRead(league, "fullTime", 90);

  const [match] = slotOf((await annsScoredGame(league, GAMEWEEK)).team, HULL_SCORER).breakdown;
  expect(match).toMatchObject({ home: HULL_CITY.shortName, away: EVERTON_CLUB.shortName, score: { state: "fullTime", homeGoals: 1, awayGoals: 2, minutes: 90 } });
});

test("a breakdown's clubs the football sync doesn't hold are null and logged, and the matchup still scores", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  const warn = silenceConsoleWarn();

  const [match] = slotOf((await annsScoredGame(league, GAMEWEEK)).team, HULL_SCORER).breakdown;
  expect(match).toMatchObject({ home: null, away: null, score: null });
  expect(warn).toHaveBeenCalledWith(missingClubLog(match.fixtureCode, HULL_CITY.code));
  expect(warn).toHaveBeenCalledWith(missingClubLog(match.fixtureCode, EVERTON_CLUB.code));
});
