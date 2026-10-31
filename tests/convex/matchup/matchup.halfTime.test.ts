import { expect, test } from "vitest";
import { annsScoredGame, GAMEWEEK, HULL_SCORER, scoreRead, scoresLeague, slotOf } from "../../support/convex/gameweekScores.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";

// The matchup at half-time (#781): it sends a playing man's match with its state, so the screen
// says "HT" as the Premier League's pages do, and live again in the second half. Ann fields Hull.

/** Where the clock stopped for half-time: two minutes into the first half's stoppage time. */
const HALF_TIME_LABEL = "45+2'00";
const HALF_TIME_MINUTES = 47;
/** The second half's first minute, as FPL counts it. */
const SECOND_HALF_MINUTE = 46;

test("at half-time his match is sent as at half-time, with the clock it stopped at, then live again", async () => {
  const league = await scoresLeague();
  const scorerStatus = async () => slotOf((await annsScoredGame(league, GAMEWEEK)).team, HULL_SCORER).status;

  await scoreRead(league, "halfTime", HALF_TIME_MINUTES, HULL_EVERTON, HALF_TIME_LABEL);
  expect(await scorerStatus()).toEqual({ kind: "playing", fixtureCode: HULL_EVERTON, state: "halfTime", minute: HALF_TIME_MINUTES, clockLabel: HALF_TIME_LABEL });

  await scoreRead(league, "live", SECOND_HALF_MINUTE);
  expect(await scorerStatus()).toEqual({ kind: "playing", fixtureCode: HULL_EVERTON, state: "live", minute: SECOND_HALF_MINUTE, clockLabel: null });
});
