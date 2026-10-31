import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { inTenths } from "../../../convex/scoring/values";
import { actingAs } from "../../support/convex/leagues.harness";
import {
  ANN,
  CAT,
  EVERTON_POINTS,
  fullTimeRecords,
  GAMEWEEK,
  HULL_POINTS,
  lockMatch,
  scoresLeague,
} from "../../support/convex/gameweekScores.harness";

// The league's average in a gameweek begun is over the teams in its stored fixtures (spec/09: "games
// played in past are done"), so a team joining later leaves it as it was, alike on the matchup,
// the table and My team's Fixtures tab. Gameweek 6 is stored with Ann's and Bob's teams playing
// each other and Cat's the average (gameweekScores.harness.ts).

test("a team that joins after a gameweek began is no part of its league average, on the matchup, the table or My team", async () => {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  await lockMatch(league);
  await league.t.run((ctx) => ctx.db.insert("teams", { leagueId: league.leagueId, number: 4, name: "Team 4", managerEmail: "dan@example.com" }));

  // (26 + 38 + 0) / 3 = 21.3, Cat's own 0 counted; the new team's 0 too would make it 16.
  const average = inTenths((HULL_POINTS + EVERTON_POINTS) / 3);
  const asCat = await actingAs(league.t, CAT);
  const matchup = await asCat.query(api.matchup.matchup.ofTeam, { leagueId: league.leagueId, now: Date.now(), gameweek: GAMEWEEK });
  expect(matchup).toMatchObject({ game: { kind: "scored", opponent: { kind: "leagueAverage", points: average, provisional: false } } });

  const table = (await (await actingAs(league.t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId: league.leagueId }))!;
  const catsFixture = table.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures.find((each) => each.teamId === league.catsTeam)!;
  expect(catsFixture.points).toEqual({ team: 0, opponent: average });
  expect(table.table.find((row) => row.teamId === league.catsTeam)).toMatchObject({ played: 1, lost: 1, pointsAgainst: average });

  const catsGames = (await asCat.query(api.table.teamFixtures.ofMyTeam, { leagueId: league.leagueId }))!.games;
  expect(catsGames.find((each) => each.gameweek === GAMEWEEK)!.score).toEqual({ team: 0, opponent: average, provisional: false });
});
