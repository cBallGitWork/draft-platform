import { expect, test } from "vitest";
import { annsScoredGame, GAMEWEEK, HULL_SCORER, scoreRead, scoresLeague } from "../../support/convex/gameweekScores.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";

// The matchup at half-time: it sends a playing man's match as at half-time, so the matchup says
// "HT" as the Premier League's pages do (#781), and live again once the second half starts. Ann fields Hull.

/** The first half's stoppage time, two minutes in, where the clock stopped for half-time. */
const HALF_TIME_LABEL = "45+2'00";
const HALF_TIME_MINUTES = 47;
const SECOND_HALF_MINUTE = 46;

test("at half-time his match is sent as at half-time, with the clock it stopped at, then live again", async () => {
  const league = await scoresLeague();
  const scorerStatus = async () => {
    const { team } = await annsScoredGame(league, GAMEWEEK);
    if (team.kind !== "team" || team.lineup === null) throw new Error("Ann's side has no lineup");
    return team.lineup.starters.find((slot) => slot.playerCode === HULL_SCORER)!.status;
  };

  await scoreRead(league, "halfTime", HALF_TIME_MINUTES, HULL_EVERTON, HALF_TIME_LABEL);
  expect(await scorerStatus()).toEqual({ kind: "playing", fixtureCode: HULL_EVERTON, state: "halfTime", minute: HALF_TIME_MINUTES, clockLabel: HALF_TIME_LABEL });

  await scoreRead(league, "live", SECOND_HALF_MINUTE);
  expect(await scorerStatus()).toEqual({ kind: "playing", fixtureCode: HULL_EVERTON, state: "live", minute: SECOND_HALF_MINUTE, clockLabel: null });
});
