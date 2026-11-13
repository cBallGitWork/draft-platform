import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { BOBS_TEAM, EVERTON_STARTERS, HULL_SCORER } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { ADMIN, ANN, BOB } from "../../support/convex/leagues.harness";
import { manOf, matchAs, matchLeague } from "../../support/convex/matchPage.harness";
import { HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";

// The match page's sheets (spec/10 S10.9; #1032): "your own players highlighted", and "We probably
// need an assist icon somewhere too" (Craig, 10 Nov 2026). Hull v Everton, Ann owning Hull's men
// and Bob Everton's, as matchPage.test.ts has it.

test("each man carries his goals, assists and cards from his record, and whether his team is the viewer's own", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  const page = (await matchAs(league, ANN))!;
  const { stats } = mergedHullEverton().find((each) => each.playerCode === HULL_SCORER)!;
  expect(stats.goals_scored).toBeGreaterThan(0);
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({
    mine: true,
    marks: { goals: stats.goals_scored, assists: stats.assists ?? 0, yellowCards: stats.yellow_cards ?? 0, redCards: stats.red_cards ?? 0 },
  });
  expect(manOf(page.men, EVERTON_STARTERS[0].playerCode)).toMatchObject({ ownerTeamName: BOBS_TEAM, mine: false });
  expect(manOf((await matchAs(league, BOB))!.men, EVERTON_STARTERS[0].playerCode).mine).toBe(true);
  // The admin runs no team here, so lights none.
  expect((await matchAs(league, ADMIN))!.men.some((man) => man.mine)).toBe(false);
});

test("before kickoff, from the sheets, no man has a mark", async () => {
  const league = await matchLeague();
  const sheets = mergedHullEverton().map(({ playerCode, started }) => ({ playerCode, started }));
  await league.t.mutation(internal.football.matchTeamSheets.store, { fixtureCode: HULL_EVERTON, men: sheets });
  const page = (await matchAs(league, ANN))!;
  expect(page.men.length).toBeGreaterThan(0);
  expect(page.men.every(({ marks }) => Object.values(marks).every((count) => count === 0))).toBe(true);
});
