import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { inTenths } from "../../../convex/scoring/scoringSet";
import { gameweekScorer, type ScoredGameweek } from "../../../convex/table/gameweekScores";
import { averageScore } from "../../../convex/table/teamGames";
import { addManagers } from "../../support/convex/leagues.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";
import {
  CAT,
  EVERTON_POINTS,
  fullTimeRecords,
  GAMEWEEK,
  HULL_POINTS,
  lockMatch,
  scoresLeague,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";

// The gameweek scorer (#625; spec/07), called on a seeded league with no screen: each team's
// points, saved once the gameweek is final and worked out until then; a team that has never saved
// a lineup on 0; the teams worked out final, for finalScores to store; and the league's average.

/** A score no team made, written over a stored one to tell a saved total from one worked out. */
const WRITTEN_OVER = 99;

/** Gameweek 6 as the league's scorer scores it for `teamIds`. A run sends back only Convex values,
 *  so the scores cross as entries. */
async function scored({ t, leagueId }: ScoresLeague, teamIds: readonly Id<"teams">[]): Promise<ScoredGameweek> {
  const { scores, toStore } = await t.run(async (ctx) => {
    const league = (await ctx.db.get("leagues", leagueId))!;
    const scoredGameweek = await gameweekScorer(ctx, league, (await seasonRules(ctx, leagueId))!);
    const gameweek = await scoredGameweek(GAMEWEEK, teamIds);
    return { scores: [...gameweek.scores], toStore: gameweek.toStore };
  });
  return { scores: new Map(scores), toStore };
}

const storeLeague = ({ t, leagueId }: ScoresLeague) => t.mutation(internal.table.finalScores.storeLeague, { leagueId });

test("a team that has never saved a lineup scores 0, and a gameweek not yet final has nothing to store", async () => {
  const league = await scoresLeague({ bobSaves: false });
  await fullTimeRecords(league);

  const { scores, toStore } = await scored(league, [league.annsTeam, league.bobsTeam]);
  expect(scores.get(league.annsTeam)).toEqual({ points: HULL_POINTS, provisional: true, noLineup: false });
  expect(scores.get(league.bobsTeam)).toEqual({ points: 0, provisional: false, noLineup: true });
  expect(toStore).toBeNull();
});

test("once final, every team worked out is to be stored, with the matches it was scored from", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);

  const { scores, toStore } = await scored(league, [league.annsTeam, league.bobsTeam]);
  expect(scores.get(league.annsTeam)).toEqual({ points: HULL_POINTS, provisional: false, noLineup: false });
  expect(scores.get(league.bobsTeam)).toEqual({ points: EVERTON_POINTS, provisional: false, noLineup: false });
  expect(toStore).toEqual({ teamIds: [league.annsTeam, league.bobsTeam], fixtureCodes: [HULL_EVERTON], replace: true });
});

test("a final gameweek gives its saved total, even where working it out again would differ", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await league.t.run(async (ctx) => {
    const row = (await ctx.db.query("finalScores").collect()).find((each) => each.teamId === league.annsTeam)!;
    await ctx.db.patch("finalScores", row._id, { points: WRITTEN_OVER });
  });

  const { scores, toStore } = await scored(league, [league.annsTeam, league.bobsTeam]);
  expect(scores.get(league.annsTeam)).toEqual({ points: WRITTEN_OVER, provisional: false, noLineup: false });
  expect(toStore).toBeNull();
});

test("a team added since the gameweek was stored is worked out alone, on 0 with no lineup, and stored beside the rest", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  const [catsTeam] = await addManagers(league.t, league.leagueId, [CAT]);

  const { scores, toStore } = await scored(league, [league.annsTeam, league.bobsTeam, catsTeam]);
  expect(scores.get(catsTeam)).toEqual({ points: 0, provisional: false, noLineup: true });
  expect(toStore).toEqual({ teamIds: [catsTeam], fixtureCodes: [HULL_EVERTON], replace: false });
});

test("the league's average counts a team with no lineup as its 0, provisional while any team's points are", async () => {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  const teams = [league.annsTeam, league.bobsTeam, league.catsTeam!];

  const live = await scored(league, teams);
  expect(averageScore(teams, live.scores, GAMEWEEK)).toEqual({ points: inTenths((HULL_POINTS + EVERTON_POINTS) / 3), provisional: true });
  await lockMatch(league);
  const final = await scored(league, teams);
  expect(averageScore(teams, final.scores, GAMEWEEK)).toEqual({ points: inTenths((HULL_POINTS + EVERTON_POINTS) / 3), provisional: false });
});
