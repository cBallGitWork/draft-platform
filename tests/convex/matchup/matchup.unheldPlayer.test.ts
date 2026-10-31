import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { unheldPlayerWords } from "../../../convex/shared/players";
import { actingAs } from "../../support/convex/leagues.harness";
import { HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
// Belloumi, Hull's midfielder on at 64 minutes, is second on Ann's bench after Hull's keeper.
import { BELLOUMI } from "../../support/convex/teamPoints.harness";
import {
  ANN,
  annsScoredGame,
  fullTimeRecords,
  GAMEWEEK,
  holdHullAndEverton,
  HULL_KEEPER,
  HULL_SCORER,
  HULL_STARTERS,
  lineupOf,
  losePlayer,
  nameOf,
  PHILLIPS,
  readTable,
  scoresLeague,
  sideTotal,
  slotOf,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";

// A lineup naming a man the football sync no longer holds (#810): data gone wrong. He scores as if
// he didn't play, so a starter's slot is filled from the bench as spec/05's Auto-subs say and a
// bench player never comes on, and the matchup says what's wrong where his name would be (Craig,
// 31 Oct 2026: "score him like he didnt play, we can always admin update later"). The table, the
// matchup and the gameweek's totals all load, and agree.

/** Ann's total in the gameweek, as the table has it. */
async function annsTablePoints(league: ScoresLeague) {
  const table = await readTable(league);
  return table!.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures[0].points!.team;
}

test("a starter the football data has lost scores 0, the first on the bench who can play his slot takes it, and the matchup and table agree", async () => {
  const league = await scoresLeague();
  const belloumisName = await nameOf(league, BELLOUMI);
  await losePlayer(league, HULL_SCORER);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  // Hull's keeper is first on the bench, but can't play midfield; Belloumi, next, can.
  expect(slotOf(game.team, HULL_SCORER)).toMatchObject({
    name: unheldPlayerWords(HULL_SCORER),
    points: 0,
    counts: false,
    status: { kind: "noMatch" },
    autoSub: { kind: "off", playerName: belloumisName },
  });
  expect(slotOf(game.team, BELLOUMI)).toMatchObject({ counts: true, area: "midfield", autoSub: { kind: "on", playerName: unheldPlayerWords(HULL_SCORER) } });

  // Worked out here: the keeper on for Phillips, and Belloumi in the scorer's slot.
  const counting = HULL_STARTERS.flatMap((starter) =>
    starter.playerCode === PHILLIPS ? [{ ...starter, playerCode: HULL_KEEPER }] : starter.playerCode === HULL_SCORER ? [{ ...starter, playerCode: BELLOUMI }] : [starter],
  );
  const expected = sideTotal(mergedHullEverton(), counting);
  expect(game.team.points).toBe(expected);
  expect(await annsTablePoints(league)).toBe(expected);
});

test("a teammate's card, which reads his team's scoring as the Squad tab does (scoredMatches.ts), loads with his match", async () => {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  await losePlayer(league, HULL_SCORER);
  await fullTimeRecords(league);

  const card = await (await actingAs(league.t, ANN)).query(api.playerCard.playerCard.card, { leagueId: league.leagueId, playerCode: BELLOUMI, now: Date.now() });
  expect(card!.matches.map(({ fixtureCode }) => fixtureCode)).toEqual([HULL_EVERTON]);
});

test("a bench player the football data has lost never comes on: Phillips, who didn't play, is left unreplaced, as Hull's bench holds no other keeper", async () => {
  const league = await scoresLeague();
  await losePlayer(league, HULL_KEEPER);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(slotOf(game.team, HULL_KEEPER)).toMatchObject({ name: unheldPlayerWords(HULL_KEEPER), points: 0, counts: false, autoSub: null });
  expect(slotOf(game.team, PHILLIPS)).toMatchObject({ counts: true, autoSub: { kind: "unreplaced" } });
  expect(lineupOf(game.team).bench.some((slot) => slot.counts)).toBe(false);

  const expected = sideTotal(
    mergedHullEverton(),
    HULL_STARTERS.filter((starter) => starter.playerCode !== PHILLIPS),
  );
  expect(game.team.points).toBe(expected);
  expect(await annsTablePoints(league)).toBe(expected);
});
