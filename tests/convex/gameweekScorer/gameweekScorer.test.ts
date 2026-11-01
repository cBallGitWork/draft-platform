import { expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { inTenths } from "../../../convex/scoring/values";
import {
  gameweekScorer,
  tableGameweek,
  workedOutGameweek,
  type ScoredGameweek,
  type TeamGameweekTotal,
} from "../../../convex/gameweekScorer/gameweekScores";
import { leagueReads } from "../../../convex/gameweekScorer/teamGameweek";
import { lineupsInGameweek } from "../../../convex/lineup/lineups";
import { averageScore } from "../../../convex/table/teamGames";
import { addManagers } from "../../support/convex/leagues.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";
import {
  annsSquadAndEvery,
  CAT,
  EVERTON_POINTS,
  GAMEWEEK,
  HULL_POINTS,
  scoresLeague,
  type ScoresLeague,
  BOBS_FIRST_POINTS,
  HULL_SCORER,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch, storeLeague, writeOverAnns, WRITTEN_OVER } from "../../support/convex/gameweekScoresMatch.harness";

// The gameweek scorer (#625; spec/07), called on a seeded league with no screen: each team's
// points, saved once the gameweek is final and worked out until then; a team that has never saved
// a lineup on 0; the teams worked out final, for finalScores to store; the league's average; and
// one gameweek team by team, slot by slot, as the matchup and an override read it (#626); and one
// team from reads the size of its squad, as a player's card and the Squad tab read it (#627).

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

test("a team that has never saved a lineup scores its first (#637), and a gameweek not yet final has nothing to store", async () => {
  const league = await scoresLeague({ bobSaves: false });
  await fullTimeRecords(league);

  const { scores, toStore } = await scored(league, [league.annsTeam, league.bobsTeam]);
  expect(scores.get(league.annsTeam)).toEqual({ points: HULL_POINTS, provisional: true, noLineup: false });
  expect(scores.get(league.bobsTeam)).toEqual({ points: BOBS_FIRST_POINTS, provisional: true, noLineup: false });
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
  await writeOverAnns(league);

  const { scores, toStore } = await scored(league, [league.annsTeam, league.bobsTeam]);
  expect(scores.get(league.annsTeam)).toEqual({ points: WRITTEN_OVER, provisional: false, noLineup: false });
  expect(toStore).toBeNull();
});

test("a team added since the gameweek was stored is worked out alone, on 0 with nobody in its squad, and stored beside the rest", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  const [catsTeam] = await addManagers(league.t, league.leagueId, [CAT]);

  const { scores, toStore } = await scored(league, [league.annsTeam, league.bobsTeam, catsTeam]);
  expect(scores.get(catsTeam)).toEqual({ points: 0, provisional: false, noLineup: false });
  expect(toStore).toEqual({ teamIds: [catsTeam], fixtureCodes: [HULL_EVERTON], replace: false });
});

test("the league's average counts a team with no lineup as its 0, provisional while any team's points are", async () => {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  const teams = [league.annsTeam, league.bobsTeam, league.catsTeam!];
  // (26 + 38 + 0) / 3: Cat's team, with no lineup, on its 0.
  const average = inTenths((HULL_POINTS + EVERTON_POINTS) / 3);

  const live = await scored(league, teams);
  expect(averageScore(teams, live.scores, GAMEWEEK)).toEqual({ points: average, provisional: true });
  await lockMatch(league);
  const final = await scored(league, teams);
  expect(averageScore(teams, final.scores, GAMEWEEK)).toEqual({ points: average, provisional: false });
});

/** What one team's gameweek, team by team, gives: its points, and its slots' total, null with no
 *  lineup. `asTable` reads it as the matchup does, else worked out now as an override does. */
async function teamByTeam(
  { t, leagueId }: ScoresLeague,
  teamId: Id<"teams">,
  asTable: boolean,
): Promise<{ points: TeamGameweekTotal; slotsTotal: number | null }> {
  return t.run(async (ctx) => {
    const league = (await ctx.db.get("leagues", leagueId))!;
    const reads = await leagueReads(ctx, league, (await seasonRules(ctx, leagueId))!);
    const teams = await (asTable ? tableGameweek : workedOutGameweek)(ctx, reads, GAMEWEEK, [teamId]);
    const slots = await teams.slotsOf(teamId);
    return { points: await teams.pointsOf(teamId), slotsTotal: slots === null ? null : slots.team.total };
  });
}

test("as the table has it, a final gameweek's saved total stands, while its slots are still worked out", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);

  const { points, slotsTotal } = await teamByTeam(league, league.annsTeam, true);
  expect(points).toEqual({ points: WRITTEN_OVER, provisional: false, noLineup: false });
  expect(slotsTotal).toBe(HULL_POINTS);
});

test("worked out now, a saved total is set aside, as an override's before and after need", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);
  await writeOverAnns(league);

  const { points, slotsTotal } = await teamByTeam(league, league.annsTeam, false);
  expect(points).toEqual({ points: HULL_POINTS, provisional: false, noLineup: false });
  expect(slotsTotal).toBe(HULL_POINTS);
});

test("team by team, a team that has never saved a lineup scores its first, slot by slot (#637)", async () => {
  const league = await scoresLeague({ bobSaves: false });
  await fullTimeRecords(league);

  for (const asTable of [true, false]) {
    const { points, slotsTotal } = await teamByTeam(league, league.bobsTeam, asTable);
    expect(points).toEqual({ points: BOBS_FIRST_POINTS, provisional: true, noLineup: false });
    expect(slotsTotal).toBe(BOBS_FIRST_POINTS);
  }
});

/** The points a commissioner gives Hull's scorer in Hull v Everton, over his record's. */
const SCORER_OVERRIDDEN = 20;

test("one team from its squad's rows scores slot by slot as from every match's, the league's overrides in (#577)", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await league.t.run((ctx) =>
    ctx.db.insert("pointsOverrides", { leagueId: league.leagueId, gameweek: GAMEWEEK, fixtureCode: HULL_EVERTON, playerCode: HULL_SCORER, points: SCORER_OVERRIDDEN, reason: "A goal the feed gave someone else", by: CAT, at: 0 }),
  );

  const { squad, every } = await annsSquadAndEvery(league);

  expect(squad).toEqual(every);
  expect(squad.starters.find((slot) => slot.playerCode === HULL_SCORER)?.points).toBe(SCORER_OVERRIDDEN);
});

test("worked out now from lineups handed in, a team scores from those, not a second read of its own (#770)", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);

  const { read, handedIn, handedEmpty } = await league.t.run(async (ctx) => {
    const held = (await ctx.db.get("leagues", league.leagueId))!;
    const reads = await leagueReads(ctx, held, (await seasonRules(ctx, league.leagueId))!);
    const teamIds = [league.annsTeam];
    const lineups = await lineupsInGameweek(ctx, league.leagueId, teamIds, GAMEWEEK);
    const empty = new Map([[league.annsTeam, { ...lineups.get(league.annsTeam)!, starters: [], bench: [] }]]);
    const slotsOf = async (handed?: typeof lineups) => (await (await workedOutGameweek(ctx, reads, GAMEWEEK, teamIds, handed)).slotsOf(league.annsTeam)).team;
    return { read: await slotsOf(), handedIn: await slotsOf(lineups), handedEmpty: await slotsOf(empty) };
  });

  expect(handedIn).toEqual(read);
  expect(read.total).toBe(HULL_POINTS);
  // An empty lineup handed in scores nothing: the one handed in is the one scored.
  expect(handedEmpty.total).toBe(0);
});
