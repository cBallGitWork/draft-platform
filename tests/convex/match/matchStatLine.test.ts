import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { MATCH_STAT_KEYS, statLineOf } from "../../../convex/match/matchStatLine";
import { HULL_SCORER } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import { ANN } from "../../support/convex/leagues.harness";
import { manOf, matchAs, matchLeague } from "../../support/convex/matchPage.harness";
import { HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";

// The match page's Player stats tab (spec/10 S10.8; #1032): "A match needs a tab for detailed
// stats" (Craig, 10 Nov 2026). Hull v Everton, as matchPage.test.ts has it.

test("S10.8 each man carries his stats for the match from his record, 0 where it leaves one out", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  const page = (await matchAs(league, ANN))!;
  const { stats } = mergedHullEverton().find((each) => each.playerCode === HULL_SCORER)!;
  const expected = Object.fromEntries(Object.entries(MATCH_STAT_KEYS).map(([column, stat]) => [column, stats[stat] ?? 0]));
  expect(expected.goals).toBeGreaterThan(0);
  expect(manOf(page.men, HULL_SCORER).statLine).toEqual(expected);
});

test("S10.8 a stat his record leaves out counts 0, and none is made up before his record", () => {
  expect(statLineOf({ [MATCH_STAT_KEYS.minutes]: 67, [MATCH_STAT_KEYS.shots]: 4 })).toMatchObject({ minutes: 67, shots: 4, tackles: 0, saves: 0 });
  expect(statLineOf(undefined)).toBeNull();
});

test("S10.8 before kickoff, from the sheets, no man has a stat line", async () => {
  const league = await matchLeague();
  const sheets = mergedHullEverton().map(({ playerCode, started }) => ({ playerCode, started }));
  await league.t.mutation(internal.football.matchTeamSheets.store, { fixtureCode: HULL_EVERTON, men: sheets });
  const page = (await matchAs(league, ANN))!;
  expect(page.men.length).toBeGreaterThan(0);
  expect(page.men.every(({ statLine }) => statLine === null)).toBe(true);
});
