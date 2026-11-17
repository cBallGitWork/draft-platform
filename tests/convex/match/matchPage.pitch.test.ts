import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { EVERTON_STARTERS, HULL_STARTERS, PHILLIPS } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { ANN } from "../../support/convex/leagues.harness";
import { manOf, matchAs, matchLeague } from "../../support/convex/matchPage.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";

// The match page's pitch (#2492; spec/10 S10.9): each starter's place in his side's formation, as
// the team sheets held before kickoff draw it. The rest of the page is matchPage.test.ts's.

test("S10.9: each starter stands where the held sheets place him, before kickoff and once records come; a substitute, and a man no sheet places, stands nowhere", async () => {
  const league = await matchLeague();
  const starter = HULL_STARTERS[1].playerCode;
  const place = { formation: "4-4-2", line: 1, place: 2 };
  await league.t.mutation(internal.football.matchTeamSheets.store, {
    fixtureCode: HULL_EVERTON,
    men: [
      { playerCode: starter, started: true, formationPlace: place },
      { playerCode: PHILLIPS, started: false },
    ],
  });
  const before = (await matchAs(league, ANN))!;
  expect(manOf(before.men, starter).formationPlace).toEqual(place);
  expect(manOf(before.men, PHILLIPS).formationPlace).toBeNull();

  await fullTimeRecords(league);
  const after = (await matchAs(league, ANN))!;
  expect(manOf(after.men, starter)).toMatchObject({ started: true, formationPlace: place });
  expect(manOf(after.men, EVERTON_STARTERS[0].playerCode)).toMatchObject({ started: true, formationPlace: null });
});
