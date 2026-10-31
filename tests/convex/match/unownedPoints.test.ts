import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import {
  annsScoredGame,
  ANN,
  GAMEWEEK,
  HULL_SCORER,
  lineupOf,
  readTable,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { ADMIN, actingAs } from "../../support/convex/leagues.harness";
import { manOf, matchAs, notYetBegun, scorerFreeLeague } from "../../support/convex/matchPage.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";

// The match page's men in no lineup at the deadline (#771; spec/10, The match page): a free agent,
// or one picked up after it, shows no team and the points his player card opens on (spec/12), his
// base points at the first of his positions, counted for no team.

/** The points the player card opens on for `playerCode` in this match: the league's override where
 *  it holds one, else his base points at the switch's first position. */
async function pointsOnCard(league: ScoresLeague, playerCode: number) {
  const card = (await (await actingAs(league.t, ANN)).query(api.playerCard.playerCard.card, { leagueId: league.leagueId, playerCode, now: Date.now() }))!;
  const match = card.matches.find((each) => each.fixtureCode === HULL_EVERTON)!;
  return { opening: card.pricedAt[0] ?? null, position: match.points[0].position, total: match.override?.points ?? match.points[0].total };
}

/** Every man either lineup on Ann's matchup names. */
async function lineupMen(league: ScoresLeague): Promise<number[]> {
  const game = await annsScoredGame(league);
  return [game.team, game.opponent].flatMap((side) => [...lineupOf(side).starters, ...lineupOf(side).bench]).map((slot) => slot.playerCode);
}

// "I need to stress that players who don't have a team still have their scores show. Just because
// they aren't a team doesn't mean they don't get points" (Craig, 31 Oct 2026; #771).
test("a free agent shows no team and the points his card opens on, counted for no team", async () => {
  const league = await scorerFreeLeague();
  const page = (await matchAs(league, ANN))!;
  const card = await pointsOnCard(league, HULL_SCORER);
  expect(card.position).toBe(card.opening);
  expect(card.total).toEqual(expect.any(Number));
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ ownerTeamName: null, points: card.total, counts: false });
  // Display only: no lineup holds him, so no team's points include his.
  expect(await lineupMen(league)).not.toContain(HULL_SCORER);
});

test("a man picked up after the deadline shows no team and the points his card opens on, and every team's points stay as they were", async () => {
  const league = await scorerFreeLeague();
  const table = await readTable(league);
  const game = await annsScoredGame(league);
  await (await actingAs(league.t, ADMIN)).mutation(api.squads.squads.assign, { leagueId: league.leagueId, playerCode: HULL_SCORER, teamId: league.bobsTeam });
  const page = (await matchAs(league, ANN))!;
  const card = await pointsOnCard(league, HULL_SCORER);
  expect(card.position).toBe(card.opening);
  expect(card.total).toEqual(expect.any(Number));
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ ownerTeamName: null, points: card.total, counts: false });
  expect(await readTable(league)).toEqual(table);
  expect(await annsScoredGame(league)).toEqual(game);
});

test("a free agent's points are the league's override of them where it holds one, as on his card", async () => {
  const league = await scorerFreeLeague();
  const OVERRIDE = 17;
  await league.t.run((ctx) =>
    ctx.db.insert("pointsOverrides", { leagueId: league.leagueId, gameweek: GAMEWEEK, fixtureCode: HULL_EVERTON, playerCode: HULL_SCORER, points: OVERRIDE, reason: "", by: ADMIN, at: 0 }),
  );
  expect((await pointsOnCard(league, HULL_SCORER)).total).toBe(OVERRIDE);
  expect(manOf((await matchAs(league, ANN))!.men, HULL_SCORER)).toMatchObject({ ownerTeamName: null, points: OVERRIDE, counts: false });
});

test("before the league's gameweek begins, a free agent shows no points yet, as an owned man shows none", async () => {
  const league = await scorerFreeLeague();
  await notYetBegun(league);
  expect(manOf((await matchAs(league, ANN))!.men, HULL_SCORER)).toMatchObject({ ownerTeamName: null, points: null, counts: false });
});
