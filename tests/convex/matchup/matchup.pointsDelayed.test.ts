import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { annsScoredGame, GAMEWEEK, holdHullAndEverton, LEAGUE_KICKOFF, scoresLeague } from "../../support/convex/gameweekScores.harness";
import { liveRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { matchAs } from "../../support/convex/matchPage.harness";
import { ANN } from "../../support/convex/leagues.harness";
import { HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";

// "Live points delayed" on the scoreboard (spec/10 `S10.12`): Hull v Everton's live points held as
// last read, as Ann's matchup (her lineup's men play in it) and the match page read them.

test("the matchup and the match page say a match's live points are delayed until its next full read (S10.12)", async () => {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await liveRecords(league, mergedHullEverton());
  expect((await annsScoredGame(league, GAMEWEEK)).pointsDelayed).toBe(false);
  expect((await matchAs(league, ANN))!.pointsDelayed).toBe(false);

  await league.t.mutation(internal.stats.liveStats.delayLivePoints, { fixtureCodes: [HULL_EVERTON], readAt: LEAGUE_KICKOFF });
  expect((await annsScoredGame(league, GAMEWEEK)).pointsDelayed).toBe(true);
  expect((await matchAs(league, ANN))!.pointsDelayed).toBe(true);

  await liveRecords(league, mergedHullEverton());
  expect((await annsScoredGame(league, GAMEWEEK)).pointsDelayed).toBe(false);
  expect((await matchAs(league, ANN))!.pointsDelayed).toBe(false);
});
